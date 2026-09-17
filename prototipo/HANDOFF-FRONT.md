# Handoff do front — Antecipa

Atualizado em **16/09/2026**. Este registro pertence apenas à interface em `prototipo/`; o handoff da raiz é mantido pelo trabalho geral e pelo back-end.

## Estado da integração com o motor

O front inicial foi integrado à `main` pelo PR #1. O back-end oferece a ação `mix`: `evaluateActions()` aceita `pixDiscount` (0 a 6%) e `maxInstall` (2, 3, 4, 6 ou 12 parcelas) nessa ação. O front envia esses nomes e valores e atualiza custo e projeções determinísticas ao mover os controles. A migração de vendas para Pix e a perda de vendas ao reduzir parcelas são **hipóteses**, não previsões causais comprovadas. As bandas probabilísticas continuam representando o cenário base, sem recálculo por ajuste.

O front chama `recommend(shop, data, {horizon})` para destacar a ação escolhida pelo motor, com `params`, custo, cobertura, impacto no dia 30 e justificativa integral. `evaluateActions()` calcula os cinco cenários; o front só exibe cartões de medidas que melhoram o menor saldo no horizonte selecionado. Em margem, antecipação não aparece; a redução destacada é marcada como medida parcial e estrutural. A apresentação futura de exatamente três opções por níveis de custo ainda precisa de um contrato do back-end.

## Escopo entregue

- Nova aba Antecipa em uma moldura de celular, com áreas existentes do app representadas abstratamente.
- Notificação interna simulada que leva à aba Antecipa; pode ser repetida pelo botão do sino.
- Seletor de negócio, horizontes de 30 e 60 dias (60 padrão), gráfico SVG simplificado com linha central, uma faixa de 95%, zero e marcador de data de risco quando há problema.
- Situação do negócio baseada em `uncertainty.horizons`: saudável, timing ou margem, com probabilidades e valor mediano do déficit quando informado.
- Recomendação do motor acima dos cartões úteis de comparação produzidos por `evaluateActions()`. A ação escolhida é identificada e destacada quando aparece na comparação. O desconto no Pix e a antecipação partem dos parâmetros retornados por `recommend()` quando disponíveis; nas demais ações, usam hipóteses ilustrativas declaradas. Os sliders manuais não alteram a recomendação. Em cenário saudável, ficam só a orientação de acompanhamento e a previsão.
- Painel recolhível no fim da aba com `uncertainty.method`, as três principais variáveis em `importance` (sem inferir causalidade), `metrics.mae` versus `baselineMae` quando há teste, justificativa completa de `recommend()` e limites das simulações. `coldStart` também mostra aviso breve ao lado do seletor; `firstNegativeDay: null` recebe explicação legível.
- Controles separados: parcelamento dentro do cartão de ajuste das formas de pagamento e desconto Pix em cartão próprio. Cada um usa `evaluateActions()` isoladamente para não atribuir a uma medida o efeito da outra. O cartão de liquidação de estoque foi removido porque `dist/engine.js` ainda não calcula o efeito de uma promoção.
- Cartões sem melhora no menor saldo não são exibidos. Os simuladores continuam disponíveis para explorar os parâmetros e mostram o efeito no menor saldo e no saldo final. A página principal usa textos mais diretos; números do modelo, justificativa integral e hipóteses ficaram no painel opcional final.
- Página de detalhe de cada alternativa com funcionamento, custo, mudança no menor saldo e efeito no saldo final do horizonte selecionado.
- Controles de desconto no Pix e parcelamento máximo conectados à ação `mix` do motor atual, com custo e efeitos no caixa exibidos no simulador e aviso de que as faixas do gráfico continuam no cenário base.
- Cabeçalho azul, filtros arredondados e cartões claros inspirados na referência visual do app Cielo; as outras áreas seguem abstratas e não reproduzem telas oficiais.
- Texto longo sobre número de cenários e método retirado da tela do gráfico. As premissas seguem documentadas no back-end.
- `LEIA-ME.md` com instruções para execução local.
- Revisão frente ao documento executivo: bloco "Por que este cenário?" explica o diagnóstico com a frequência disponível no JSON e a data de risco quando presente. A tela de cada alternativa agora compara o pior saldo antes/depois e apresenta um "Plano da sessão" com passos consultivos. Essa sequência cobre previsão, explicação, comparação e plano de ação no fluxo do protótipo.

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
- `../dist/engine.js`: `recommend(shop, data, {horizon})` para a escolha e `evaluateActions(shop, data, options)` para comparação. O motor não fornece `how`/`caution`; os textos das cinco ações ficam em `app.js`.
- `../HANDOFF.md`: limites financeiros e distinção entre protótipo e produto real.

## Verificações executadas

- `node --check prototipo/app.js`.
- `node work/test_engine.js` passou, incluindo invariantes financeiras e Monte Carlo.
- Página aberta via servidor HTTP local; gráfico e aviso renderizados para Bar do Léo.
- Mercado Bom Preço selecionado no navegador: diagnóstico de margem exibido, antecipação não listada e explicação presente.
- Tela de detalhes da antecipação aberta no cenário de timing, com efeitos e limites exibidos.
- Na revisão atual: `node --check prototipo/app.js` e `node work/test_engine.js` passaram com o motor atualizado. Prévia aberta no navegador: cabeçalho azul e gráfico simplificado; Café Primeiro Passo mostrou cenário positivo sem soluções, simulador ou aviso antigo; Bar do Léo recalculou a ação de mix ao usar 3% de desconto no Pix (custo estimado R$ 3.804) e alertou que o custo superava o déficit; Mercado Bom Preço mostrou margem e não listou antecipação nem mix como soluções.
- Revisão da API em 16/09/2026: `node --check prototipo/app.js`, `node work/test_engine.js` e prévia no navegador passaram. Bar do Léo (60 dias): mix de 0,5% no Pix destacado e antecipação ilustrativa mostrada como piora de R$ 0,42; Mercado Bom Preço: redução de gastos destacada com alerta estrutural, antecipação apenas comparativa; Café Primeiro Passo: aviso de pouco histórico, sem cartões de solução; Linha & Cor (30 dias): `firstNegativeDay: null` explicado sem mostrar `null`, e painel exibe MAE e variáveis de importância. A base atual classifica margem em 100% dos cenários do Mercado Bom Preço.
- Revisão de linguagem e controles em 16/09/2026: `node --check prototipo/app.js`, `node work/test_engine.js` e prévia local passaram. Bar do Léo: antecipação exibiu "Não resolve neste caso" com motivo; parcelamento e Pix foram alterados sem se afetarem. O cartão de campanha de estoque existiu nessa versão anterior e foi retirado na revisão seguinte. Café Primeiro Passo manteve a mensagem positiva e ocultou os cartões de ação.

## Pendências e limites

- A ação `mix` atual estima migração de crédito para Pix e desconto por hipótese; validar elasticidade, custo e efeito sobre vendas com a equipe antes de qualquer uso real.
- Os detalhes conhecidos de ações têm textos específicos; novas ações do motor usam apresentação genérica até a equipe definir sua explicação operacional.
- A demonstração não aplica ações nem guarda planos. Não há push real, chatbot ou integração com o aplicativo Cielo.
- O cálculo das alternativas é determinístico; as bandas probabilísticas são do cenário base. A interface avisa essa distinção.
- Exatamente três recomendações por níveis de custo ainda não têm contrato no motor. A interface mostra uma ação escolhida por `recommend()` e somente cenários comparativos com melhora no menor saldo; eles não são outras recomendações.
- Comparação das alternativas e "Plano da sessão" usam o horizonte selecionado (30 ou 60 dias) com cópias das séries limitadas a esse período. A recomendação continua calculada pela API do motor com `horizon`.
- O bloco de explicação usa o diagnóstico, sua frequência e a data do risco; ainda não há atribuição verificável dos fatores que causaram a previsão. Isso requer dados explicativos do motor, e a interface não deve atribuir causas específicas sem eles.
- O plano é um roteiro visual, sem persistência ou execução. A consulta via chatbot, push real, oferta de crédito/CET e integração nativa com o app Cielo seguem como visão de produto do documento executivo.
- Liquidação de estoque fica como evolução futura no documento. Não há cartão nem controles no front até existir cálculo para vendas, margem, estoque remanescente e caixa.
- Revisão de linguagem em 16/09/2026: a tela troca "motor" por "análise"/"sugestão", "pior dia" e "pior saldo" por "momento de maior aperto"/"saldo mais baixo", "não fazer nada" por "manter como está" e "referência" por "sem mudança". Os identificadores `recommend`, `evaluateActions`, `min`, `coversAmount` e demais campos da API continuam intactos. A justificativa original do back-end permanece disponível no painel opcional.
- Revisão final de 16/09/2026: removidos de `index.html` o `stockSection` e seus dois sliders; removidos de `app.js` `renderStock`, chamadas, listeners e a menção à promoção no painel técnico. `LEIA-ME.md` atualizado. A ideia permanece apenas como evolução futura documentada.
- Revisão dos simuladores em 16/09/2026: os cartões de parcelamento e Pix usam linguagem direta e comparam o saldo sem/com a mudança ao fim do horizonte escolhido (30 ou 60 dias), além de explicar o efeito no momento de menor caixa. O Pix identifica seu custo como o total oferecido em descontos aos clientes e explica o que esse valor significa. Para manter os resultados no período selecionado, o front chama `simulate()` sobre uma cópia das séries limitada a esse período; `dist/` permanece intacto. Um efeito nulo no menor saldo pode coexistir com uma mudança no saldo final, agora visível na interface. A recomendação e os cartões de alternativas continuam no contrato de `recommend()`/`evaluateActions()`.
- Verificação dessa revisão: `node --check prototipo/app.js`, `node work/test_engine.js` e `git diff --check` passaram. Na prévia, Bar do Léo em 60 dias e 6 parcelas manteve praticamente igual o saldo mínimo e mostrou R$ 2.334 a menos no saldo final; em 30 dias, o desconto de 0,5% no Pix mostrou R$ 224 em descontos e R$ 3.405 a mais no saldo final. Os simuladores mudam com o horizonte selecionado; as alternativas secundárias continuam calculadas para 60 dias.

## Revisão de 17/09/2026

- Atualizado o front para o novo contrato do motor em `dist/engine.js`: `shop.installments` define a base (4 nos dados atuais), o controle permite 2, 3, 4, 6 ou 12 parcelas e `simulate().fee` inclui a hipótese de vendas perdidas quando se reduz o parcelamento. O simulador mostra esse valor com explicação, separado do desconto no Pix. O Pix usa o parcelamento-base ao simular sozinho.
- Na situação do negócio, removidos o texto que repetia a probabilidade e o segundo indicador de valor; permanecem a data de maior risco e o indicador de possibilidade de saldo negativo. A explicação da previsão usa frase mais direta sobre a data em que o saldo pode cair para o vermelho.
- A sugestão de formas de pagamento mostra as medidas concretas e os parâmetros escolhidos pelo motor. O caso `recommend().watch` explica corretamente a decisão de acompanhar, sem afirmar que o caixa é positivo. O custo do mix identifica desconto e possível perda de vendas conforme o caso.
- Cartões comparativos agora usam o horizonte selecionado e só aparecem quando melhoram o menor saldo; antecipação continua oculta em diagnóstico de margem. A opção sugerida recebe borda azul e identificação visível na lista. A tela de detalhes usa o mesmo horizonte da comparação.
- `dist/`, `work/` e documentos da raiz foram lidos para integração, sem edição. Pendência: as faixas probabilísticas do gráfico continuam as do cenário-base, sem recálculo após ajustes manuais.
- Verificação: `node --check prototipo/app.js`, `node work/test_engine.js` e `git diff --check` passaram. Na prévia local, Bar do Léo mostrou apenas a data e 92% de possibilidade, sem a segunda caixa; a antecipação sem melhora sumiu. Com 2 parcelas, o simulador exibiu R$ 2.381 a mais no saldo final de 60 dias e R$ 4.518 de vendas que podem deixar de ocorrer. Na Linha & Cor em 60 dias, a sugestão de 4,5% no Pix foi explicada e identificada no terceiro cartão; em 30 dias, o cenário positivo ocultou as opções.
