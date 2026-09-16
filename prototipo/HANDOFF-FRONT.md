# Handoff do front — Antecipa

Atualizado em **16/09/2026**. Este registro pertence apenas à interface em `prototipo/`; o handoff da raiz é mantido pelo trabalho geral e pelo back-end.

## Estado da integração com o motor

O front inicial foi integrado à `main` pelo PR #1. Desde então o back-end acrescentou a ação `mix`: `evaluateActions()` aceita `pixDiscount` (0 a 6%) e `maxInstall` (3, 4, 6 ou 12 parcelas) nessa ação. O front agora envia esses nomes e valores corretos e atualiza custo e projeções determinísticas ao mover os controles. A migração de vendas para Pix é uma **hipótese de elasticidade**, não uma previsão causal comprovada; o desconto tem custo. As bandas probabilísticas continuam representando o cenário base, sem recálculo por ajuste.

O motor também expõe `recommend()`, que seleciona uma ação. A apresentação futura de exatamente três opções por níveis de custo precisa de um contrato do back-end que classifique alternativas elegíveis, custos e cobertura por nível. O front não inventa opções nem oferece antecipação em diagnóstico de margem.

## Escopo entregue

- Nova aba Antecipa em uma moldura de celular, com áreas existentes do app representadas abstratamente.
- Notificação interna simulada que leva à aba Antecipa; pode ser repetida pelo botão do sino.
- Seletor de negócio, horizontes de 30 e 60 dias (60 padrão), gráfico SVG simplificado com linha central, uma faixa de 95%, zero e marcador de data de risco quando há problema.
- Situação do negócio baseada em `uncertainty.horizons`: saudável, timing ou margem, com probabilidades e valor mediano do déficit quando informado.
- Alternativas produzidas por `evaluateActions()`, incluindo não fazer nada, ordenadas por custo direto estimado. Como medida prudencial no front, só entram na lista ações que melhoram o pior saldo e não custam mais que o déficit determinístico; o simulador ainda mostra o efeito e o custo da ação de mix fora da lista. Em diagnóstico de margem, antecipação e ajuste do mix não aparecem como solução estrutural; o simulador explica o limite do mix. Em cenário saudável, alternativas e simulador ficam ocultos.
- Página de detalhe de cada alternativa com funcionamento, custo, mudança no pior saldo e efeito no saldo final de 60 dias.
- Controles de desconto no Pix e parcelamento máximo conectados à ação `mix` do motor atual, com custo e melhora do pior saldo exibidos no simulador e aviso de que as faixas do gráfico continuam no cenário base.
- Cabeçalho azul, filtros arredondados e cartões claros inspirados na referência visual do app Cielo; as outras áreas seguem abstratas e não reproduzem telas oficiais.
- Texto longo sobre número de cenários e método retirado da tela do gráfico. As premissas seguem documentadas no back-end.
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
- Na revisão atual: `node --check prototipo/app.js` e `node work/test_engine.js` passaram com o motor atualizado. Prévia aberta no navegador: cabeçalho azul e gráfico simplificado; Café Primeiro Passo mostrou cenário positivo sem soluções, simulador ou aviso antigo; Bar do Léo recalculou a ação de mix ao usar 3% de desconto no Pix (custo estimado R$ 3.804) e alertou que o custo superava o déficit; Mercado Bom Preço mostrou margem e não listou antecipação nem mix como soluções.

## Pendências e limites

- A ação `mix` atual estima migração de crédito para Pix e desconto por hipótese; validar elasticidade, custo e efeito sobre vendas com a equipe antes de qualquer uso real.
- Os detalhes conhecidos de ações têm textos específicos; novas ações do motor usam apresentação genérica até a equipe definir sua explicação operacional.
- A demonstração não aplica ações nem guarda planos. Não há push real, chatbot ou integração com o aplicativo Cielo.
- O cálculo das alternativas é determinístico; as bandas probabilísticas são do cenário base. A interface avisa essa distinção.
- O diagnóstico de margem pode resultar em menos de três medidas recomendadas até que o back forneça alternativas adicionais adequadas.
- Exatamente três recomendações por níveis de custo ainda não têm contrato no motor. A lista atual é dinâmica a partir de `evaluateActions()`, mas pode ter mais ou menos opções e não se apresenta como escada rígida de três níveis.
- O filtro de custo e melhora da interface é provisório e determinístico. Substituir por elegibilidade e níveis de custo definidos no contrato do back-end; uma alternativa individual pode não cobrir todo o déficit.
