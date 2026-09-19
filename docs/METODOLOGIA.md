# Metodologia, avaliação e limites

[← Voltar à apresentação](../README.md)

## Dados

A demonstração usa apenas dados sintéticos, com referência fixa em **15/09/2026** e semente principal **42**. Os três negócios com histórico individual têm 620 dias na base. Bar e vestuário também possuem histórico sintético por produto para avaliar campanhas. O [dicionário de dados](../dados_ficticios/LEIA-ME.md) explica os arquivos.

As taxas, prazos, custos, estoques, cancelamentos e respostas comerciais são hipóteses de demonstração. Não representam condições da Cielo ou de clientes reais.

## Previsão de vendas

A modelagem é implementada na [camada de processamento analítico](../work/README.md), executada em Python antes da demonstração. Seus resultados alimentam o motor de cálculo e a interface por `dist/data.json`.

O `RandomForestRegressor` usa 100 árvores e variáveis de calendário, defasagens e estatísticas móveis de vendas. O modelo prevê 60 dias; o motor converte as vendas previstas em recebimentos conforme mix, taxas e prazos.

A avaliação reserva os últimos **60 dias** do histórico. As janelas de treino são filtradas para que seus alvos não invadam esse período. O comparativo é uma referência simples: **repetir a última semana**.

O erro absoluto médio (MAE), em reais por dia, está em `shop.metrics.mae`; o erro da referência está em `shop.metrics.baselineMae`. Os valores podem ser consultados no painel explicativo ou impressos por `node work/test_engine.js`. São métricas da base sintética, sem evidência de desempenho em produção.

## Caixa e diagnóstico

O caixa diário considera saldo inicial, recebíveis de vendas realizadas, liquidação de vendas previstas e saídas declaradas. O motor diferencia problemas de prazo e de margem antes de comparar alternativas.

A antecipação acrescenta principal líquido de taxa no início e retira o principal das datas originais. Essa conservação é verificada nos testes. Recomendações podem indicar acompanhamento ou melhora parcial, e não implicam que toda alternativa resolverá o déficit.

## Incerteza

O Monte Carlo gera **2.000 cenários** por negócio. Recebíveis existentes e compromissos conhecidos ficam fixos; variam vendas, mix de pagamento e cancelamentos hipotéticos. Os resíduos do teste de vendas alimentam a reamostragem.

A faixa principal corresponde aos percentis 2,5 e 97,5. A possibilidade de saldo negativo é a fração de cenários que cruza o zero no horizonte. O diagnóstico é calculado em cada cenário e a interface apresenta o mais frequente.

Essa faixa é uma simulação condicionada às hipóteses. Sua cobertura não foi validada em uma amostra real independente. O período usado para avaliar vendas também fornece os resíduos da simulação; não é um teste independente da calibração das faixas.

## Campanhas por produto

As campanhas consideram estoque, giro, desconto, adesão, canibalização e prazo de recebimento. O cálculo desconta o benefício oferecido sobre unidades que já venderiam e evita lançar novamente como saída o estoque já comprado.

Uma campanha elegível não é necessariamente a recomendação principal. A comparação pode recusá-la por custo ou preferir outra medida. As faixas do cenário-base não são recalculadas para campanhas ou controles de Pix e parcelas.

## Limitações conhecidas

- Não há validação com empresas reais nem medição de impacto econômico.
- O Café Primeiro Passo usa 14 dias próprios e referências de 18 negócios sintéticos; não possui teste independente e não herda as métricas dos demais casos.
- A importância de variáveis não explica causalidade.
- Elasticidade, custos comerciais e condições de negociação não foram calibrados com lojistas.
- Calendário bancário, feriados, gravames e elegibilidade real de recebíveis não estão implementados.
- A API de comparação possui diferenças de tratamento de horizonte documentadas em [arquitetura](ARQUITETURA.md#fronteiras-importantes).
- As camadas analítica e de decisão estão implementadas, mas não são expostas por uma API remota de produção nesta demonstração. Não há integração real com Open Finance, DDA ou Cielo Farol, fluxo de consentimento, autenticação ou execução de transações.

O projeto permite inspecionar a proposta e suas regras. Qualquer piloto depende de validação adicional e dados autorizados, conforme as [próximas etapas](PROPOSTA.md#próximas-etapas).
