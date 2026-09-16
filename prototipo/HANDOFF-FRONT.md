# Handoff do front — Antecipa

Atualizado em **16/09/2026**. Este registro pertence apenas à interface em `prototipo/`; o handoff da raiz é mantido pelo trabalho geral e pelo back-end.

## Decisão de integração à `main`

Esta versão do front pode entrar na `main` para que a equipe use e revise a jornada móvel. **A simulação de desconto no Pix e de parcelamento máximo ainda não está funcional no motor financeiro atual.** Os controles chamam `evaluateActions()` a cada ajuste, mas o `dist/engine.js` desta versão ignora esses parâmetros; portanto, mover os controles não altera os valores calculados. A página avisa isso explicitamente. Não apresentar esses controles no pitch como cálculo financeiro já implementado.

Para encerrar essa pendência, alinhar os nomes e unidades dos parâmetros com o back-end, verificar que cada ajuste altera os resultados esperados, conferir os custos do desconto e os recebimentos futuros e testar o fluxo no navegador. As bandas probabilísticas permanecem do cenário base até que o back-end ofereça novos quantis para cada cenário.

## Escopo entregue

- Nova aba Antecipa em uma moldura de celular, com áreas existentes do app representadas abstratamente.
- Notificação interna simulada que leva à aba Antecipa; pode ser repetida pelo botão do sino.
- Seletor de negócio, horizontes de 30 e 60 dias (60 padrão), gráfico SVG com mediana, faixas de 50% e 95%, zero e marcador de data de risco.
- Situação do negócio baseada em `uncertainty.horizons`: saudável, timing ou margem, com probabilidades e valor mediano do déficit quando informado.
- Alternativas produzidas por `evaluateActions()`, incluindo não fazer nada, ordenadas por custo direto estimado. Antecipação é omitida como recomendação para diagnóstico de margem.
- Página de detalhe de cada alternativa com funcionamento, custo, mudança no pior saldo e efeito no saldo final de 60 dias.
- Controles de desconto no Pix e parcelamento máximo que chamam o motor a cada ajuste e avisam quando a versão atual ainda não interpreta esses parâmetros.
- `LEIA-ME.md` com instruções para execução local.

## Arquivos do front

| Arquivo | Papel |
|---|---|
| `index.html` | Estrutura semântica, navegação, telas e carregamento do motor existente |
| `style.css` | Interface móvel, moldura para gravação, contraste, foco e adaptação a tela estreita |
| `app.js` | Leitura do JSON, gráfico, diagnósticos, alternativas, detalhes, simulador e aviso |
| `LEIA-ME.md` | Como abrir e o que a demonstração faz |
| `HANDOFF-FRONT.md` | Estado do front, verificações e pendências |

## Contratos lidos

- `../dist/data.json`: `shops`, `dates`, `uncertainty.quantiles`, `uncertainty.horizons`.
- `../dist/engine.js`: `evaluateActions(shop, data, options)`; a interface renderiza o retorno em vez de fixar a lista de ações.
- `../HANDOFF.md`: limites financeiros e distinção entre protótipo e produto real.

## Verificações executadas

- `node --check prototipo/app.js`.
- `node work/test_engine.js` passou, incluindo invariantes financeiras e Monte Carlo.
- Página aberta via servidor HTTP local; gráfico e aviso renderizados para Bar do Léo.
- Mercado Bom Preço selecionado no navegador: diagnóstico de margem exibido, antecipação não listada e explicação presente.
- Tela de detalhes da antecipação aberta no cenário de timing, com efeitos e limites exibidos.

## Pendências e limites

- O motor atual ignora os parâmetros dos controles Pix e parcelamento. O front detecta isso e não afirma que houve mudança financeira. Integrar ao contrato definitivo quando a nova ação do back estiver disponível.
- Os detalhes conhecidos de ações têm textos específicos; novas ações do motor usam apresentação genérica até a equipe definir sua explicação operacional.
- A demonstração não aplica ações nem guarda planos. Não há push real, chatbot ou integração com o aplicativo Cielo.
- O cálculo das alternativas é determinístico; as bandas probabilísticas são do cenário base. A interface avisa essa distinção.
- O diagnóstico de margem pode resultar em menos de três medidas recomendadas até que o back forneça alternativas adicionais adequadas.
