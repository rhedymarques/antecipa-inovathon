"""Faixa de incerteza da curva de saldo por reamostragem de resíduos.

Gera N cenários de venda para os próximos H dias somando ao ponto previsto
resíduos reamostrados (bootstrap). Para cada cenário monta a agenda de
recebíveis das novas vendas — espelhando a liquidação do dist/engine.js, sem
nenhuma ação e sem variação manual — e a curva de saldo diária. Devolve os
percentis 10/50/90 por dia, a probabilidade de ficar negativo, o dia mais
provável do primeiro saldo negativo e o valor mediano do buraco.

As despesas são mantidas fixas no cenário central: a incerteza aqui vem do
tempo e do volume das vendas previstas, não das saídas. Tudo sintético."""
from collections import Counter
import numpy as np


def banda_incerteza(forecast, residuos, mix, rates, delays, existing, expenses,
                    opening, dias_future, rng, n=2000):
 H = len(forecast)
 forecast = np.asarray(forecast, float)
 residuos = np.asarray(residuos, float)
 existing = np.asarray(existing, float)
 expenses = np.asarray(expenses, float)

 draws = rng.choice(residuos, size=(n, H), replace=True)
 vendas = np.maximum(0.0, forecast[None, :] + draws)          # (n, H) faturamento por cenário

 # liquidação das novas vendas, igual ao engine.js: crédito parcelado em 3 partes
 incoming = np.zeros((n, H))
 for m, share in enumerate(mix):
  parts = 3 if m == 3 else 1
  net = share * (1 - rates[m]) / parts
  for p in range(parts):
   shift = delays[m] + 30 * p
   if shift < H:
    incoming[:, shift:] += vendas[:, :H - shift] * net

 fluxo = existing[None, :] + incoming - expenses[None, :]
 curvas = opening + np.cumsum(fluxo, axis=1)                  # (n, H) saldo diário

 mins = curvas.min(axis=1)
 negativo = mins < 0
 abaixo = curvas < 0
 primeiro = np.where(abaixo.any(axis=1), abaixo.argmax(axis=1), -1)
 fn = primeiro[primeiro >= 0]
 dia_provavel = dias_future[int(Counter(fn.tolist()).most_common(1)[0][0])] if fn.size else None

 return {
  'scenarios': n,
  'p10': np.percentile(curvas, 10, axis=0).round(2).tolist(),
  'p50': np.percentile(curvas, 50, axis=0).round(2).tolist(),
  'p90': np.percentile(curvas, 90, axis=0).round(2).tolist(),
  'probNegative': round(float(negativo.mean()), 3),
  'firstNegativeDay': dia_provavel,
  'medianHole': round(float(np.median(mins[negativo])), 2) if negativo.any() else 0.0,
 }
