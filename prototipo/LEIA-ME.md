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
2. Escolha entre **Bar do Léo** e **Linha & Cor** e compare 30 e 60 dias. Os outros casos permanecem em `dist/data.json` para testes, mas não aparecem neste seletor. O gráfico principal usa os quantis do cenário-base e mostra a linha central, a faixa de simulação, o zero e a data de risco quando disponível.
3. Leia a situação do negócio e a sugestão em destaque. A campanha comercial calculada aparece em um bloco próprio, mesmo quando outra medida é a escolha principal. No bar, ela testa um combo de bebida e petisco; na loja, uma liquidação da coleção anterior.
4. Compare somente os cartões de mudanças que melhoram o menor saldo no período escolhido. A opção sugerida, quando aparece na lista, tem borda azul e identificação própria. Abra um cartão para ver funcionamento, cautelas, antes/depois e plano da sessão.
5. Depois dos cartões de comparação, veja a campanha calculada, seguida dos testes de **Pix** e **parcelas**. No resumo da campanha, compare entrada líquida, melhora do caixa, resultado após custos dos produtos e estoque. Abra **Entender esta campanha** para ver o gráfico **Como o caixa pode mudar**, conferir produtos e hipóteses e testar outros produtos e descontos de 0% a 50%. Campanhas recusadas mostram o motivo e não oferecem execução.
6. Explore separadamente **Oferecer desconto no Pix** e **Ajustar parcelas das vendas**. Cada cartão atualiza apenas a sua comparação, mostrando o efeito no momento de maior aperto e o saldo ao fim do período.
7. No fim da aba, abra **Como calculamos esta demonstração** para ver a justificativa completa, o método e os limites. Essas explicações ficam fora do fluxo principal.

## Integração e limites

- `app.js` lê `../dist/data.json` e carrega `../dist/engine.js` sem modificá-los.
- A recomendação vem de `recommend()`, a comparação de `evaluateActions(..., { includePromotion: true })` e a campanha de `evaluatePromotion()`. Uma campanha elegível não é automaticamente a escolha principal. A interface oculta cartões sem melhora no menor saldo e, em margem, a antecipação. Textos operacionais e cautelas complementares ficam no front.
- O parcelamento inicial vem de `shop.installments`; o controle aceita 2, 3, 4, 6 ou 12 parcelas. O custo ao reduzir o número de parcelas é a estimativa de vendas parceladas que podem deixar de ocorrer, calculada pelo motor como hipótese.
- O diagnóstico e as probabilidades vêm de `shop.uncertainty.horizons`. Sem esses campos, a página informa que a análise está indisponível; não cria uma probabilidade fictícia.
- As alternativas determinísticas de `evaluateActions()` e as faixas de Monte Carlo são cálculos diferentes. O protótipo não recalcula o Monte Carlo ao mover controles.
- Os dois controles usam `simulate()` do motor existente com as séries limitadas ao horizonte selecionado. O parcelamento e o Pix são testados separadamente contra o cenário sem mudança; o total de descontos corresponde apenas aos dias exibidos.
- O método detalhado fica em um painel recolhível no fim da aba. O gráfico permanece simples.
- As campanhas de produtos são estimativas calculadas sobre catálogo e histórico sintéticos, com hipóteses de adesão e substituição de vendas. `promotion.series` permite comparar saldos dia a dia. O gráfico aproxima a campanha e os sete dias seguintes, mantendo R$ 0 na escala e informando o recorte; os valores finais continuam referentes ao horizonte completo. A faixa probabilística do cenário-base não foi recalculada para nenhuma campanha.
- Custos operacionais indiretos, condições reais de crédito, elegibilidade de recebíveis e impacto comercial do desconto no Pix não são conhecidos pela demonstração.
- A notificação é um elemento da página; não há push do sistema, monitoramento em segundo plano, login ou transação financeira.

O código desta pasta usa HTML, CSS e JavaScript puros. A interface foi desenhada para teclado, áreas de toque amplas, texto legível e largura de celular.
