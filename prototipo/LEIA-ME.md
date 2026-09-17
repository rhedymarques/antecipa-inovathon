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
3. Leia o diagnóstico probabilístico e abra **Como a previsão foi calculada** para consultar o método, as variáveis de maior peso e, quando disponíveis, os erros no teste sintético. O Café Primeiro Passo é marcado como caso de pouco histórico, sem validação independente.
4. Confira o bloco em destaque: `recommend()` escolhe uma medida e apresenta custo, cobertura do déficit, efeito no saldo do dia 30 e justificativa. Em margem, a recomendação é operacional e informa que só ameniza o problema estrutural. Em cenário saudável, orienta acompanhar o caixa, sem cartões de soluções.
5. Os cinco cartões secundários comparam os resultados de `evaluateActions()`, inclusive **não fazer nada** e medidas que pioram o saldo. Antecipação aparece apenas como comparação em margem, com aviso explícito de que não é recomendada. Os parâmetros da escolha do motor alimentam o estado inicial; quando não há parâmetro para uma ação, o cartão declara a hipótese ilustrativa.
6. Abra um cartão para ver funcionamento, cautelas específicas, antes/depois e plano da sessão. Mova os controles do simulador para explorar Pix e parcelamento sem alterar a recomendação do motor. As faixas probabilísticas continuam representando o cenário-base.

## Integração e limites

- `app.js` lê `../dist/data.json` e carrega `../dist/engine.js` sem modificá-los.
- A recomendação vem de `recommend()` e a comparação vem de `evaluateActions()`. Os textos operacionais e cautelas das cinco ações ficam no front porque o motor não devolve `how` nem `caution`.
- O diagnóstico e as probabilidades vêm de `shop.uncertainty.horizons`. Sem esses campos, a página informa que a análise está indisponível; não cria uma probabilidade fictícia.
- As alternativas determinísticas de `evaluateActions()` e as faixas de Monte Carlo são cálculos diferentes. O protótipo não recalcula o Monte Carlo ao mover controles.
- O método detalhado fica em um painel recolhível abaixo da explicação. O gráfico permanece simples.
- Custos operacionais indiretos, condições reais de crédito, elegibilidade de recebíveis e impacto comercial do desconto no Pix não são conhecidos pela demonstração.
- A notificação é um elemento da página; não há push do sistema, monitoramento em segundo plano, login ou transação financeira.

O código desta pasta usa HTML, CSS e JavaScript puros. A interface foi desenhada para teclado, áreas de toque amplas, texto legível e largura de celular.
