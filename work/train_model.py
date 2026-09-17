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

def ler_recebiveis(horizonte):
 """Recebiveis de vendas ja realizadas que caem nos proximos `horizonte` dias."""
 janela = {(ASOF + timedelta(days=i)).isoformat(): i for i in range(horizonte)}
 receb = {n: np.zeros(horizonte) for n in perfis['negocios']}
 with (DADOS / 'agenda_de_recebiveis.csv').open(encoding='utf-8-sig', newline='') as fh:
  for r in csv.DictReader(fh):
   i = janela.get(r['data_liquidacao'])
   if i is not None:
    receb[r['negocio']][i] += float(r['valor_liquido'])
 return receb

vendas = ler_vendas_diarias()
receb_fut = ler_recebiveis(H)     # 60 dias, exibidos e usados no fluxo

# --- modelo: features, holdout, baseline e importancia ------------------------

def features(y, t):
 d = dates[t] if t < N else ASOF
 return [d.weekday(), d.day, d.month, t, y[t - 1], y[t - 7],
         np.mean(y[t - 7:t]), np.mean(y[t - 28:t]), np.std(y[t - 28:t])]
names = ['Dia da semana', 'Dia do mês', 'Mês', 'Tempo observado', 'Vendas de ontem',
         'Vendas há 7 dias', 'Média de 7 dias', 'Média de 28 dias', 'Variação de 28 dias']

MAPA_DESP = {'operacional': 'operating', 'fornecedor': 'supplier', 'fornecedor_colecao': 'supplier',
             'folha': 'fixed', 'aluguel': 'fixed', 'imposto': 'fixed'}

def projetar_despesas(chave, y, forecast_sales, horizonte):
 """Projeta `horizonte` dias de saidas reaproveitando as regras do gerador (fonte unica)."""
 all_dates = dates + [ASOF + timedelta(days=i) for i in range(horizonte)]
 all_sales = np.concatenate([y, forecast_sales])
 fut = [(ASOF + timedelta(days=i)).isoformat() for i in range(horizonte)]
 buckets = {ds: {'operating': 0.0, 'supplier': 0.0, 'fixed': 0.0} for ds in fut}
 for d in base.gerar_despesas(chave, base.PERFIS[chave], all_dates, all_sales):
  if d['data'] in buckets:
   buckets[d['data']][MAPA_DESP[d['categoria']]] += d['valor']
 return [{'date': ds, **{k: round(buckets[ds][k], 2) for k in ('operating', 'supplier', 'fixed')}}
         for ds in fut]

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
 expenses = projetar_despesas(chave, y, forecast, H)
 expenses_total = np.array([e['operating'] + e['supplier'] + e['fixed'] for e in expenses])
 # diagnóstico timing vs margem: margem é estrutural, então usamos o perfil de caixa de 90 dias
 # em regime do próprio gerador (entra/sai steady-state), não o repique pós-choque da previsão.
 diag90 = perfil['diagnostico_90d']
 diagnosis = {'entradas90': diag90['entra_90d'], 'saidas90': diag90['sai_90d']}
 # dispersão do mix calibrada pelo desvio-padrão diário observado do mix do próprio negócio
 # (campo mix_desvio_observado, agora que o gerador varia o mix dia a dia; antes usávamos o CV
 # de vendas como stand-in porque o mix era constante). Para Dirichlet(s·p) vale
 # Var(pᵢ)=pᵢ(1−pᵢ)/(s+1); logo s = mediana_i[ pᵢ(1−pᵢ)/σᵢ² − 1 ].
 mix_std = [perfil['mix_desvio_observado'][m] for m in MODALIDADES]
 estimativas = [mix[i] * (1 - mix[i]) / mix_std[i] ** 2 - 1 for i in range(len(mix)) if mix_std[i] > 0]
 concentracao = max(2.0, float(np.median(estimativas)))
 parcelas = base.MODALIDADES['credito_4x'][2]     # 4 parcelas do crédito parcelado, vindo do gerador
 uncertainty = montecarlo.simular_cenarios(
  forecast, actual - testpred, mix, concentracao, rates, delays, receb_fut[chave], expenses_total,
  perfil['saldo_inicial'], future, diagnosis['entradas90'], diagnosis['saidas90'], mc, parcelas=parcelas)
 uncertainty['method'] = ('2000 cenários. Previsível (fixo): recebíveis de vendas já feitas, aluguel, folha, '
                          'imposto e contas com data conhecida. Incerto (sorteado por cenário): volume de vendas '
                          '(reamostragem dos resíduos do teste de 60 dias), mix de pagamento (Dirichlet em torno do '
                          'mix histórico, dispersão pela volatilidade de vendas) e chargeback de 0% a 1,5% sobre o '
                          'crédito (hipótese). Faixa principal: 95% (p2,5–p97,5). Diagnóstico calculado em cada cenário.')
 shops.append({'id': chave, 'name': perfil['nome'], 'sector': perfil['setor'],
               'age': perfil['meses_operando'], 'balance': perfil['saldo_inicial'],
               'mix': mix, 'rates': rates, 'delays': delays, 'installments': parcelas,
               'history': [{'date': dates[i].isoformat(), 'sales': float(y[i])} for i in range(N - 90, N)],
               'forecast': forecast.tolist(), 'receivables': receb_fut[chave].round(2).tolist(),
               'expenses': expenses, 'metrics': metrics, 'uncertainty': uncertainty, 'diagnosis': diagnosis,
               'importance': sorted([{'name': n, 'value': round(float(v), 4)} for n, v in zip(names, model.feature_importances_)], key=lambda a: -a['value']),
               'commercial': perfil.get('commercial')})
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

print('\nDiagnóstico timing vs margem (mesma regra do engine.js):')
for s in shops:
 d = s['diagnosis']; ent, sai = d['entradas90'], d['saidas90']
 inc = [0.0] * H
 for i, g in enumerate(s['forecast']):
  for mi, share in enumerate(s['mix']):
   for p in range(3 if mi == 3 else 1):
    due = i + s['delays'][mi] + 30 * p
    if due < H: inc[due] += g * share * (1 - s['rates'][mi]) / (3 if mi == 3 else 1)
 bal, cruza = s['balance'], False
 for i in range(H):
  bal += s['receivables'][i] + inc[i] - sum(s['expenses'][i][k] for k in ('operating', 'supplier', 'fixed'))
  cruza = cruza or bal < 0
 modo = 'MARGEM' if ent - sai <= 0 else ('TIMING' if cruza else 'SAUDÁVEL')
 print(f"  {s['name']:<20} entradas-saidas 90d R$ {ent - sai:>12,.0f}   modo: {modo}")

import runpy
runpy.run_path(str(ROOT / 'work/enrich_model.py'))
