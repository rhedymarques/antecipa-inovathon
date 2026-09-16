"""Treina e avalia as florestas a partir da base sintetica em dados_ficticios/.

Nao gera mais os dados aqui: le vendas, recebiveis e despesas dos arquivos
produzidos por gerar_base_ficticia.py. Mantidos o holdout temporal de 60 dias,
a comparacao com a referencia (repetir a ultima semana) e a feature importance.
Nenhum dado real da Cielo; taxas e prazos sao hipoteses de demonstracao."""
from pathlib import Path
import sys, json, csv
from collections import defaultdict
from datetime import date, timedelta
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gerar_base_ficticia as base  # fonte unica das regras de despesa/modalidade
import montecarlo                    # faixa de incerteza da curva de saldo

DADOS = ROOT / 'dados_ficticios'
perfis = json.loads((DADOS / 'perfil_dos_negocios.json').read_text(encoding='utf-8'))
ASOF = date.fromisoformat(perfis['data_referencia'])          # 2026-09-15
N, H = perfis['dias_historico'], 60
dates = [ASOF - timedelta(days=N - i) for i in range(N)]      # historico: dia 0..N-1
future = [(ASOF + timedelta(days=i)).isoformat() for i in range(H)]
MODALIDADES = list(base.MODALIDADES)                          # pix, debito, credito_vista, credito_4x

# --- leitura da base (substitui a geracao sintetica que ficava aqui) ----------

def ler_vendas_diarias():
 """Faturamento bruto total por negocio e dia, somando as modalidades."""
 total = defaultdict(lambda: defaultdict(float))
 with (DADOS / 'vendas_por_dia.csv').open(encoding='utf-8-sig', newline='') as fh:
  for r in csv.DictReader(fh):
   total[r['negocio']][r['data']] += float(r['valor_bruto'])
 return total

def ler_recebiveis_futuros():
 """Recebiveis de vendas ja realizadas que caem nos proximos H dias."""
 janela = {(ASOF + timedelta(days=i)).isoformat(): i for i in range(H)}
 receb = {n: np.zeros(H) for n in perfis['negocios']}
 with (DADOS / 'agenda_de_recebiveis.csv').open(encoding='utf-8-sig', newline='') as fh:
  for r in csv.DictReader(fh):
   i = janela.get(r['data_liquidacao'])
   if i is not None:
    receb[r['negocio']][i] += float(r['valor_liquido'])
 return receb

vendas = ler_vendas_diarias()
receb_fut = ler_recebiveis_futuros()

# --- modelo: features, holdout, baseline e importancia ------------------------

def features(y, t):
 d = dates[t] if t < N else ASOF
 return [d.weekday(), d.day, d.month, t, y[t - 1], y[t - 7],
         np.mean(y[t - 7:t]), np.mean(y[t - 28:t]), np.std(y[t - 28:t])]
names = ['Dia da semana', 'Dia do mês', 'Mês', 'Tempo observado', 'Vendas de ontem',
         'Vendas há 7 dias', 'Média de 7 dias', 'Média de 28 dias', 'Variação de 28 dias']

def despesas_futuras(chave, y, forecast):
 """Projeta 60 dias de saidas reaproveitando as regras do gerador (fonte unica)."""
 all_dates = dates + [ASOF + timedelta(days=i) for i in range(H)]
 all_sales = np.concatenate([y, forecast])
 buckets = {ds: {'operating': 0.0, 'supplier': 0.0, 'fixed': 0.0} for ds in future}
 mapa = {'operacional': 'operating', 'fornecedor': 'supplier', 'fornecedor_colecao': 'supplier',
         'folha': 'fixed', 'aluguel': 'fixed', 'imposto': 'fixed'}
 for d in base.gerar_despesas(chave, base.PERFIS[chave], all_dates, all_sales):
  if d['data'] in buckets:
   buckets[d['data']][mapa[d['categoria']]] += d['valor']
 return [{'date': ds, **{k: round(buckets[ds][k], 2) for k in ('operating', 'supplier', 'fixed')}}
         for ds in future]

shops = []
resumo = {}
mc = np.random.default_rng(base.SEMENTE)     # rng dedicado ao Monte Carlo, reprodutível
for chave, perfil in perfis['negocios'].items():
 y = np.array([round(vendas[chave][d.isoformat()], 2) for d in dates])
 X = np.array([features(y, t) for t in range(28, N - H + 1)])
 Y = np.array([y[t:t + H] for t in range(28, N - H + 1)])
 origins = np.arange(28, N - H + 1)
 cutoff = N - H                                               # inicio do teste reservado
 mask = origins + H <= cutoff                                 # alvos do treino terminam antes do teste
 model = RandomForestRegressor(n_estimators=100, max_depth=10, min_samples_leaf=3, random_state=42, n_jobs=-1)
 model.fit(X[mask], Y[mask])
 testpred = model.predict([features(y, cutoff)])[0]
 baseline = np.array([y[cutoff - 7 + i % 7] for i in range(H)])
 actual = y[cutoff:]
 metrics = {'mae': round(mean_absolute_error(actual, testpred), 2),
            'baselineMae': round(mean_absolute_error(actual, baseline), 2),
            'testStart': dates[cutoff].isoformat(), 'testEnd': dates[-1].isoformat(),
            'trainSamples': int(mask.sum()), 'holdoutDays': H}
 model.fit(X, Y)                                              # modelo final usa todo o historico
 forecast = np.maximum(0, model.predict([features(y, N)])[0]).round(2)
 mix = [perfil['mix'][m] for m in MODALIDADES]
 rates = [base.MODALIDADES[m][0] for m in MODALIDADES]
 delays = [base.MODALIDADES[m][1] for m in MODALIDADES]
 expenses = despesas_futuras(chave, y, forecast)
 expenses_total = np.array([e['operating'] + e['supplier'] + e['fixed'] for e in expenses])
 uncertainty = montecarlo.banda_incerteza(
  forecast, actual - testpred, mix, rates, delays, receb_fut[chave], expenses_total,
  perfil['saldo_inicial'], future, mc)
 uncertainty['method'] = ('2000 cenários por reamostragem dos resíduos do teste reservado de 60 dias; '
                          'despesas fixas no cenário central. Faixa da previsão, não probabilidade de falência.')
 shops.append({'id': chave, 'name': perfil['nome'], 'sector': perfil['setor'],
               'age': perfil['meses_operando'], 'balance': perfil['saldo_inicial'],
               'mix': mix, 'rates': rates, 'delays': delays,
               'history': [{'date': dates[i].isoformat(), 'sales': float(y[i])} for i in range(N - 90, N)],
               'forecast': forecast.tolist(), 'receivables': receb_fut[chave].round(2).tolist(),
               'expenses': expenses, 'metrics': metrics, 'uncertainty': uncertainty,
               'importance': sorted([{'name': n, 'value': round(float(v), 4)} for n, v in zip(names, model.feature_importances_)], key=lambda a: -a['value'])})
 resumo[chave] = metrics

data = {'asof': ASOF.isoformat(), 'dates': future, 'seed': base.SEMENTE, 'synthetic': True,
        'model': 'RandomForestRegressor', 'trees': 100, 'historyDays': N, 'shops': shops}
(ROOT / 'dist' / 'data.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')

# pagamentos_sinteticos.csv: ultimos 90 dias por negocio e modalidade, para download
cutoff90 = dates[N - 90].isoformat()
pag = [['empresa', 'data_venda', 'modalidade', 'valor_bruto', 'taxa_hipotetica', 'parcelas', 'prazo_primeira_liquidacao_dias']]
with (DADOS / 'vendas_por_dia.csv').open(encoding='utf-8-sig', newline='') as fh:
 for r in csv.DictReader(fh):
  if r['data'] >= cutoff90:
   taxa, prazo, parcelas = base.MODALIDADES[r['modalidade']]
   pag.append([r['negocio'], r['data'], r['modalidade'], round(float(r['valor_bruto']), 2), taxa, parcelas, prazo])
import io
s = io.StringIO(); csv.writer(s).writerows(pag)
(ROOT / 'dist' / 'pagamentos_sinteticos.csv').write_text(s.getvalue(), encoding='utf-8-sig', newline='')

print('MAE (R$/dia) — floresta vs referência (repetir última semana):')
for chave, perfil in perfis['negocios'].items():
 m = resumo[chave]
 venceu = 'OK  floresta vence' if m['mae'] < m['baselineMae'] else '!!  floresta NAO vence'
 print(f"  {perfil['nome']:<20} floresta {m['mae']:>8.2f}   baseline {m['baselineMae']:>8.2f}   [{venceu}]")

import runpy
runpy.run_path(str(ROOT / 'work/enrich_model.py'))
