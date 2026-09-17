# Antecipa — protótipo da interface móvel

Esta pasta contém uma demonstração independente da nova aba **Antecipa**. As áreas Início, Vendas e Caixa diário são apenas contexto visual; não reproduzem telas ou integrações oficiais do aplicativo Cielo. Todos os números vêm de dados sintéticos do repositório.

## Abrir

Na **raiz do repositório**, execute:

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory .
```

Abra `http://127.0.0.1:8765/prototipo/`. Não abra `index.html` com `file://`: o navegador precisa buscar `../dist/data.json` por HTTP. Não há instalação, build ou dependência de front-end.

## Fluxo da demonstração

1. Ao abrir, uma notificação **simulada** aparece quando o primeiro negócio tem um alerta. O sino permite repeti-la. Toque nela para entrar na aba Antecipa.
2. Selecione um negócio e compare 30 e 60 dias. O gráfico usa os quantis fornecidos em `dist/data.json`; ele mostra a linha central, uma faixa de 95%, a linha do zero e, quando há problema, o dia de maior concentração de saldo negativo.
3. Leia a situação do negócio e a sugestão em destaque. Em margem, o aviso diz que a medida só ameniza o problema; em cenário saudável, há apenas orientação de acompanhamento. O Café Primeiro Passo mostra um aviso curto de pouco histórico.
4. Compare somente os cartões de mudanças que melhoram o menor saldo no período escolhido. A opção sugerida, quando aparece na lista, tem borda azul e identificação própria. Abra um cartão para ver funcionamento, cautelas, antes/depois e plano da sessão.
5. Explore separadamente **Ajustar parcelas das vendas** e **Oferecer desconto no Pix**. Cada cartão atualiza apenas a sua própria comparação, mostrando o efeito no momento de maior aperto e o saldo ao fim dos 30 ou 60 dias escolhidos. Reduzir parcelas também mostra a estimativa de vendas que podem deixar de acontecer, conforme a hipótese atual do motor. O cartão do Pix informa o total simulado em descontos concedidos aos clientes.
6. No fim da aba, abra **Como calculamos esta demonstração** se quiser ver a justificativa completa do motor, probabilidades, método, variáveis de maior peso e validação sintética. Essas explicações ficam fora do fluxo principal.

## Integração e limites

- `app.js` lê `../dist/data.json` e carrega `../dist/engine.js` sem modificá-los.
- A recomendação vem de `recommend()` e a comparação vem de `evaluateActions()`. A interface oculta os cenários sem melhora no menor saldo e, em margem, a antecipação. Os textos operacionais e cautelas das ações ficam no front porque o motor não devolve `how` nem `caution`.
- O parcelamento inicial vem de `shop.installments`; o controle aceita 2, 3, 4, 6 ou 12 parcelas. O custo ao reduzir o número de parcelas é a estimativa de vendas parceladas que podem deixar de ocorrer, calculada pelo motor como hipótese.
- O diagnóstico e as probabilidades vêm de `shop.uncertainty.horizons`. Sem esses campos, a página informa que a análise está indisponível; não cria uma probabilidade fictícia.
- As alternativas determinísticas de `evaluateActions()` e as faixas de Monte Carlo são cálculos diferentes. O protótipo não recalcula o Monte Carlo ao mover controles.
- Os dois controles usam `simulate()` do motor existente com as séries limitadas ao horizonte selecionado. O parcelamento e o Pix são testados separadamente contra o cenário sem mudança; o total de descontos corresponde apenas aos dias exibidos.
- O método detalhado fica em um painel recolhível no fim da aba. O gráfico permanece simples.
- Uma eventual liquidação de estoque fica como evolução futura do projeto; a interface não oferece controles para uma ação que ainda não tem cálculo de caixa.
- Custos operacionais indiretos, condições reais de crédito, elegibilidade de recebíveis e impacto comercial do desconto no Pix não são conhecidos pela demonstração.
- A notificação é um elemento da página; não há push do sistema, monitoramento em segundo plano, login ou transação financeira.

O código desta pasta usa HTML, CSS e JavaScript puros. A interface foi desenhada para teclado, áreas de toque amplas, texto legível e largura de celular.
