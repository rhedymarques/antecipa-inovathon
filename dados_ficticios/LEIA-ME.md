# Base de dados fictícia

Todos os dados desta pasta são **sintéticos**, gerados por `gerar_base_ficticia.py`.
Não há nenhum dado real da Cielo, de clientes ou de estabelecimentos. Taxas e prazos
são hipóteses de demonstração, não condições contratuais da empresa.

Para recriar tudo do zero: `python gerar_base_ficticia.py` (semente fixa 42, resultado
sempre idêntico).

Os históricos de produtos usados nas promoções têm RNGs separados: semente 4201
para o bar e 4202 para a loja de roupas. Preços, custos, estoques, giro, adesão,
elasticidade ao desconto e canibalização são hipóteses sintéticas de demonstração.
Não foram calibrados com clientes da Cielo e exigiriam validação com lojistas ou ERP.

---

## Os três negócios

Cada um foi desenhado para falhar de um jeito **diferente**, porque a solução precisa
saber distinguir os casos antes de recomendar qualquer coisa.

| Negócio | Setor | Modo de falha | O que isso significa |
|---|---|---|---|
| Bar do Léo | Bar e restaurante | Timing, leve | Sobra dinheiro no mês, mas um dia específico aperta |
| Linha & Cor | Loja de roupas | Timing, severa | É lucrativa e mesmo assim fica negativa quando a coleção vence |
| Mercado Bom Preço | Mercado de bairro | Margem | Gasta mais do que recebe — antecipar **não** resolve |

O gerador imprime o diagnóstico dos últimos 90 dias, incluindo entradas, saídas,
folga, pior saldo e dias negativos. Para consultar os valores da versão executada,
rode `python gerar_base_ficticia.py`, conforme o [guia de reprodução](../docs/REPRODUCAO.md).
Esse diagnóstico histórico não é a previsão futura exibida pela interface.

**Por que essa diferença importa.** A loja de roupas tem folga positiva e ainda assim
fura o caixa: o problema é *quando* o dinheiro chega, não *quanto*. Já o mercadinho tem
folga negativa: nenhuma antecipação conserta isso, ela só adia o buraco e cobra taxa por
isso. Recomendar antecipação para o mercadinho seria exatamente o comportamento que o
desafio pede para evitar.

---

## Os arquivos

### `vendas_por_dia.csv`
O que foi vendido. Uma linha por negócio, dia e forma de pagamento.

| coluna | descrição |
|---|---|
| `negocio` | identificador do estabelecimento |
| `data` | dia da venda |
| `modalidade` | `pix`, `debito`, `credito_vista` ou `credito_4x` |
| `valor_bruto` | faturamento do dia naquela modalidade, antes da taxa |

620 dias de histórico, terminando em 15/09/2026.

### `agenda_de_recebiveis.csv`
Quando o dinheiro efetivamente cai na conta. Cada venda vira uma ou mais parcelas.

| coluna | descrição |
|---|---|
| `data_venda` | quando a venda aconteceu |
| `modalidade` | forma de pagamento |
| `parcela` / `de_parcelas` | ex.: 2 de 4 |
| `valor_bruto` | valor da parcela antes da taxa |
| `taxa` | taxa hipotética da modalidade |
| `data_liquidacao` | quando esse valor entra no caixa |
| `valor_liquido` | o que de fato cai na conta |

É aqui que o descasamento aparece: uma venda em 4x hoje vira quatro entradas espalhadas
por quatro meses.

### `contas_a_pagar.csv`
Quando o dinheiro sai, com a data de vencimento.

| coluna | descrição |
|---|---|
| `data` | vencimento |
| `categoria` | `fornecedor`, `fornecedor_colecao`, `folha`, `aluguel`, `imposto`, `operacional` |
| `valor` | valor da obrigação |

Este é o lado que a adquirente **não** enxerga hoje. No produto, viria do lojista ou de
Open Finance com consentimento.

### `produtos_por_dia.csv`

Recorte de 90 dias de quantidades sintéticas vendidas por produto para o Bar do Léo
e a Linha & Cor. Não é uma abertura integral nem reconciliada de todo o faturamento;
serve para estimar o ritmo-base dos SKUs elegíveis sem contar novamente as vendas
que já estão na previsão agregada.

O catálogo completo fica em `perfil_dos_negocios.json`, no campo `commercial`, com
nome, categoria, preço, custo, margem implícita, estoque disponível, histórico diário
e, conforme o setor, validade ou coleção. Para o bar, o motor testa pares de bebida e
petisco. Para roupas, testa itens e a coleção anterior. A escolha é feita pelo efeito
incremental no caixa e na margem, não somente pelo volume histórico.

### `perfil_dos_negocios.json`
Ficha de cada negócio: setor, ticket médio, mix de pagamento, taxas e prazos usados,
saldo inicial e o diagnóstico de caixa acima.

---

## Premissas de modelagem

**Taxas e prazos (hipotéticos):**

| Modalidade | Taxa | Prazo | Parcelas |
|---|---|---|---|
| Pix | 0,0% | D+0 | 1 |
| Débito | 1,2% | D+1 | 1 |
| Crédito à vista | 2,5% | D+30 | 1 |
| Crédito parcelado | 3,5% | D+30, 60, 90, 120 | 4 |

**Mix de pagamento variável.** A fatia de cada modalidade **não é fixa**: em cada
dia ela é sorteada de uma distribuição de Dirichlet centrada no mix médio do
negócio. A concentração muda por setor — clientela fixa (mercadinho) oscila
menos, público heterogêneo (loja de roupas) oscila mais. O desvio-padrão diário
observado fica entre 1 e 4 pontos percentuais por modalidade e está registrado em
`perfil_dos_negocios.json`, campo `mix_desvio_observado`. Isso permite que a
simulação de cenários calibre a incerteza do mix a partir do próprio histórico
do negócio, em vez de usar um valor arbitrado.

**Sazonalidade.** Cada setor tem um padrão semanal próprio (sexta e sábado fortes no bar,
segunda e sábado no mercadinho, sábado na loja de roupas), um padrão mensal (alta até o
dia 10, queda a partir do dia 25) e uma onda anual suave.

**Choque de demanda.** Queda de 9% nas vendas por 32 dias, começando 75 dias antes da data
de referência. Existe para que haja algo real a ser detectado pela previsão.

**Liquidação** em dias corridos, sem feriados. Não há cancelamentos, chargebacks, tributos
por transação nem conciliação entre múltiplos adquirentes.

**Promoções comerciais.** A campanha dura 14 dias no bar e 21 dias em roupas. A
adesão hipotética é de 72% e 68%; a canibalização de outras vendas, 18% e 24%.
O desconto aumenta a demanda com teto explícito. O motor desconta a redução de preço
das unidades que já venderiam normalmente e a receita deslocada de outras compras.
O estoque já comprado reduz o ativo e a margem, mas não é lançado novamente como
saída de caixa. A faixa probabilística do cenário-base não é reaproveitada: o efeito
da promoção é identificado como estimativa pontual.

---

## Limites

Dados sintéticos não comprovam desempenho em dados reais. O objetivo desta base é permitir
demonstrar o raciocínio da solução ponta a ponta — previsão, diagnóstico e recomendação —
de forma reprodutível e auditável por quem abrir este repositório.
