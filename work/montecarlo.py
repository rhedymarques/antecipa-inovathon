"""Simulação Monte Carlo da curva de saldo, com diagnóstico dentro de cada cenário.

Separa o que é previsível do que é incerto (a pedido da mentora de probabilidade):

  PREVISÍVEL (não sorteado): parcelas de vendas já realizadas que ainda vão
    liquidar (`existing`) e as contas com data conhecida — aluguel, folha,
    imposto e demais saídas (`expenses`). Entram fixas em todos os cenários.

  INCERTO (sorteado por cenário):
    - volume de vendas futuras: reamostragem (bootstrap) dos resíduos do teste;
    - mix de pagamento: Dirichlet em torno do mix histórico, dispersão calibrada
      pela volatilidade de vendas do negócio, sempre somando 1;
    - chargeback/cancelamento: taxa entre 0% e 1,5% sobre o crédito (hipótese),
      subtraída dos recebíveis das novas vendas.

Exporta os quantis 2,5/5/25/50/75/95/97,5 da curva de saldo por dia (o intervalo
principal exibido é o de 95%: 2,5 a 97,5) e, por horizonte, o diagnóstico
calculado em cada cenário. Tudo sintético; nada de dados reais da Cielo."""
from collections import Counter
import numpy as np

QUANTIS = [2.5, 5, 25, 50, 75, 95, 97.5]
CHAVES_Q = ['q2_5', 'q5', 'q25', 'q50', 'q75', 'q95', 'q97_5']


def _receita_central(forecast, mix, rates, delays, H, parcelas):
 """Recebimento das novas vendas no cenário central (mix base, sem chargeback)."""
 total = 0.0
 for i, g in enumerate(forecast):
  for m, share in enumerate(mix):
   parts = parcelas if m == 3 else 1
   for p in range(parts):
    if i + delays[m] + 30 * p < H:
     total += g * share * (1 - rates[m]) / parts
 return total


def simular_cenarios(forecast, residuos, mix, concentracao, rates, delays, existing, expenses,
                     opening, dias_future, entradas90, saidas90, rng, parcelas=4, horizontes=(30, 60), n=2000):
 H = len(forecast)
 forecast = np.asarray(forecast, float); residuos = np.asarray(residuos, float)
 existing = np.asarray(existing, float); expenses = np.asarray(expenses, float)
 mix = np.asarray(mix, float); rates = np.asarray(rates, float)

 # ---- INCERTO: volume, mix e chargeback sorteados por cenário -----------------
 vendas = np.maximum(0.0, forecast[None, :] + rng.choice(residuos, size=(n, H)))   # volume de vendas
 mix_scen = rng.dirichlet(mix * concentracao, size=n)                              # mix ~ Dirichlet(mix*conc)
 chargeback = rng.uniform(0.0, 0.015, size=n)                                      # taxa sobre o crédito (hipótese)

 # liquidação das novas vendas por cenário; crédito = índices 2 e 3 (parcelado em `parcelas`, igual ao engine.js)
 incoming = np.zeros((n, H))
 for m in range(len(mix)):
  parts = parcelas if m == 3 else 1
  liquido_credito = 1.0 - (chargeback if m >= 2 else 0.0)      # chargeback só incide no crédito
  fator = mix_scen[:, m] * (1 - rates[m]) / parts * liquido_credito
  for p in range(parts):
   shift = delays[m] + 30 * p
   if shift < H:
    incoming[:, shift:] += vendas[:, :H - shift] * fator[:, None]

 # ---- PREVISÍVEL: recebíveis já contratados e despesas com data conhecida, fixos -
 fluxo = existing[None, :] + incoming - expenses[None, :]
 curvas = opening + np.cumsum(fluxo, axis=1)                    # (n, H) saldo diário por cenário

 # ---- diagnóstico DENTRO de cada cenário (regra da Tarefa 3) ------------------
 # margem é estrutural (entradas−saídas em 90 dias): reescalamos as entradas de 90 dias
 # pelo fator de receita realizado do cenário (volume × mix × chargeback).
 base = _receita_central(forecast, mix, rates, delays, H, parcelas)
 fator_receita = incoming.sum(axis=1) / base if base else np.ones(n)
 margem = entradas90 * fator_receita - saidas90 <= 0           # (n,)

 quantis = {k: np.percentile(curvas, q, axis=0).round(2).tolist() for k, q in zip(CHAVES_Q, QUANTIS)}

 horizons = {}
 for Hh in horizontes:
  c = curvas[:, :Hh]
  mins = c.min(axis=1)
  cruza = mins < 0                                             # curva cruza zero no horizonte
  diag = np.where(margem, 'margem', np.where(cruza, 'timing', 'saudavel'))
  freq = {k: round(float((diag == k).mean()), 3) for k in ('margem', 'timing', 'saudavel')}
  abaixo = c < 0
  primeiro = np.where(abaixo.any(axis=1), abaixo.argmax(axis=1), -1)
  fn = primeiro[primeiro >= 0]
  dist = [0] * Hh
  for i in fn.tolist():
   dist[i] += 1
  dia_idx = int(Counter(fn.tolist()).most_common(1)[0][0]) if fn.size else None
  neg = mins[cruza]
  horizons[str(Hh)] = {
   'diagnosisFreq': freq,
   'diagnosis': max(freq, key=freq.get),                       # diagnóstico mais frequente (o que a interface mostra)
   'probPositiveClose': round(float((c[:, -1] > 0).mean()), 3),  # fechar o período no positivo
   'probNegative': round(float(cruza.mean()), 3),              # ficar negativo em algum dia
   'firstNegativeDist': dist,                                  # distribuição do dia do 1º negativo
   'firstNegativeDay': dias_future[dia_idx] if dia_idx is not None else None,  # dia mais frequente
   'medianHole': round(float(np.median(neg)), 2) if neg.size else 0.0,        # buraco mediano
   'p95Hole': round(float(np.percentile(neg, 5)), 2) if neg.size else 0.0,    # buraco no percentil 95 (cauda ruim)
  }
 return {'scenarios': n, 'quantiles': quantis, 'horizons': horizons}
