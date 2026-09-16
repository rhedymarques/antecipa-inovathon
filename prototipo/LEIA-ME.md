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
3. Leia o diagnóstico probabilístico. Em problema de margem, antecipação e ajuste do mix não aparecem como soluções estruturais; o simulador ainda pode comparar o mix e explica seu limite. Em cenário saudável, apenas a previsão e a mensagem positiva são exibidas; alternativas e simulador ficam ocultos.
4. Abra uma alternativa para ver funcionamento, custo direto estimado, efeito sobre o pior saldo e efeito no fim de 60 dias. **Não fazer nada** permanece como referência. A lista exclui ações sem melhora do pior saldo ou cujo custo supere o déficit determinístico.
5. Mova os controles do simulador: o desconto Pix vai de 0 a 6% e o parcelamento máximo oferece 3, 4, 6 ou 12 vezes. A interface reexecuta `evaluateActions()` com `pixDiscount` e `maxInstall`; a ação de mix mostra custo e melhora do pior saldo sob hipóteses, mesmo quando não é adequada à lista de alternativas. As faixas probabilísticas continuam representando o cenário base.

## Integração e limites

- `app.js` lê `../dist/data.json` e carrega `../dist/engine.js` sem modificá-los.
- A lista de alternativas é renderizada a partir de `evaluateActions()`; novos códigos de ação recebem uma apresentação genérica se não houver texto específico no front.
- O diagnóstico e as probabilidades vêm de `shop.uncertainty.horizons`. Sem esses campos, a página informa que a análise está indisponível; não cria uma probabilidade fictícia.
- As alternativas determinísticas de `evaluateActions()` e as faixas de Monte Carlo são cálculos diferentes. O protótipo não recalcula o Monte Carlo ao mover controles.
- O método detalhado e o número de cenários não ocupam mais a tela do gráfico; as premissas continuam no back-end e na documentação.
- Custos operacionais indiretos, condições reais de crédito, elegibilidade de recebíveis e impacto comercial do desconto no Pix não são conhecidos pela demonstração.
- A notificação é um elemento da página; não há push do sistema, monitoramento em segundo plano, login ou transação financeira.

O código desta pasta usa HTML, CSS e JavaScript puros. A interface foi desenhada para teclado, áreas de toque amplas, texto legível e largura de celular.
