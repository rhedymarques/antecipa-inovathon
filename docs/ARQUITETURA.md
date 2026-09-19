# Arquitetura e contratos

[← Voltar à apresentação](../README.md)

## Duas interfaces, um motor

| Entrada | Uso | Fonte de dados |
| --- | --- | --- |
| `prototipo/index.html` | Demonstração principal, orientada à experiência móvel e aos dois casos da apresentação. | `../dist/data.json` e `../dist/engine.js` |
| `dist/index.html` | Painel técnico com quatro casos, cobertura dos dados e exploração complementar. | `data.json` e `engine.js` |

Ambas são páginas estáticas sem build. Sirva a raiz do repositório para preservar os caminhos relativos. `dist/` contém código-fonte compartilhado e não deve ser apagada como se fosse uma pasta de compilação.

## Fluxo dos dados

1. [`gerar_base_ficticia.py`](../gerar_base_ficticia.py) gera os CSVs e perfis de negócios em `dados_ficticios/`.
2. [`work/train_model.py`](../work/train_model.py) lê essa base, treina, avalia e exporta previsões e pagamentos em `dist/`.
3. [`work/montecarlo.py`](../work/montecarlo.py) calcula os cenários de incerteza durante o treinamento.
4. O treino chama [`work/enrich_model.py`](../work/enrich_model.py), que acrescenta dados financeiros e o caso de pouco histórico.
5. O navegador carrega `data.json` e chama as funções de `engine.js` para simular alternativas. Nenhuma requisição a uma API da Cielo é feita.

## API do motor

O mesmo arquivo funciona no navegador e em Node.js por `module.exports`.

| Função | Responsabilidade |
| --- | --- |
| `simulate(shop, data, options)` | Série diária de caixa, custo, saldo mínimo, saldo final e efeito da ação. |
| `diagnose(shop, data, options)` | Diagnóstico determinístico de prazo, margem ou situação saudável. |
| `evaluateActions(shop, data, options)` | Comparação das cinco ações básicas; inclui campanha com `includePromotion: true` quando há catálogo. |
| `evaluatePromotion(shop, data, options)` | Elegibilidade, proposta por produto, custos, estoque e série da campanha em 30 ou 60 dias. |
| `recommend(shop, data, options)` | Escolha principal, parâmetros, custo, cobertura e justificativa, incluindo acompanhamento ou cobertura parcial. |
| `financialSnapshot(shop, balance, growth)` | Indicadores complementares de capital de giro a partir dos dados financeiros informados. |

Exemplo na raiz do repositório:

```js
const data = require('./dist/data.json');
const { recommend, evaluatePromotion } = require('./dist/engine.js');
const shop = data.shops.find(shop => shop.id === 'bar');

console.log(recommend(shop, data, { horizon: 60 }));
console.log(evaluatePromotion(shop, data, { horizon: 60, discountPct: 15 }));
```

## Fronteiras importantes

- A projeção de vendas é previamente treinada. Alterar controles simula caixa e não retreina a Random Forest.
- A faixa de Monte Carlo representa o cenário-base. A curva de uma ação é uma estimativa determinística e não recebe uma nova faixa de probabilidade.
- A recomendação e o diagnóstico probabilístico usam contratos diferentes: `recommend()` consulta `shop.uncertainty.horizons`; `diagnose()` calcula um diagnóstico determinístico.
- `evaluateActions()` usa o comprimento das séries recebidas, não recorta automaticamente por `options.horizon`. O front recorta séries ao comparar 30 dias.
- Há uma limitação conhecida de custo em `recommend()` para 30 dias: ações não comerciais podem acumular custo sobre a série completa. O front recalcula o custo no período exibido. Não trate esse contrato como uma API pronta para produção.
- O plano e a notificação existem apenas na página. Não há persistência, push, monitoramento em segundo plano ou execução financeira.

Para alterar cálculos, execute a [suíte de regressão](../work/test_engine.js) e confira os dois horizontes na interface. Veja o [guia de contribuição](../CONTRIBUTING.md).
