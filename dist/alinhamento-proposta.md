# Antecipa — alinhamento da versão 2

## O que foi incorporado da proposta da equipe

- Copiloto proativo: alerta é calculado ao abrir ou alterar o cenário, explica o descompasso em uma data e sugere avaliar uma alternativa operacional. Não existe monitoramento em segundo plano.
- Consulta → previsão → recomendação → ação: histórico sintético, Random Forest, regras transparentes de comparação e plano da sessão. Nenhuma ação financeira é executada.
- Cobertura dos dados: modo somente pagamentos oculta conclusões sobre caixa, saídas, NCG e tesouraria; o modo complementado simula informações do lojista e possíveis integrações.
- Open Finance/DDA: representados por dados fictícios locais, sem login bancário, conexão ou consentimento real. Uma integração futura exigiria verificar disponibilidade, cobertura, conciliação e consentimento. DDA e extratos não representam todas as obrigações futuras.
- Pouco histórico: Café Primeiro Passo possui 14 dias próprios. Uma floresta separada usa 18 empresas sintéticas do mesmo segmento, 738 exemplos e 100 árvores. Esse modelo não tem validação independente; não reutilizamos as métricas dos modelos individuais como se fossem suas.
- Capital de giro: ciclo financeiro, NCG e tesouraria aparecem a partir de saldos e prazos complementares declarados. Não se inventam esses dados a partir dos pagamentos.

## Ajustes técnicos para a apresentação

1. A expressão “SGR = ROE − taxa de retenção” precisa ser corrigida. Na formulação simplificada de crescimento com ROE constante e patrimônio inicial, utiliza-se ROE × taxa de retenção. Há outras convenções de cálculo; explicitem período, base do patrimônio e hipóteses. Não implementamos SGR sem lucro, patrimônio e política de retenção. Fonte: https://pages.stern.nyu.edu/adamodar/New_Home_Page/valquestions/growth.htm
2. NCG crescer na mesma proporção das vendas é uma hipótese de estabilidade dos prazos, margens e proporções operacionais, não uma identidade. A interface apresenta apenas uma sensibilidade didática separada do fluxo, sem dupla contagem.
3. Tesouraria negativa não demonstra, isoladamente, dívida cara ou insolvência. O custo e os vencimentos das obrigações precisam ser examinados.
4. Dados bancários históricos não equivalem a uma agenda completa de obrigações futuras. O lojista continua precisando informar e confirmar compromissos.
5. Open Finance permite compartilhar categorias de dados com consentimento; a proposta não pressupõe que exista integração pronta ou acesso automático pela Cielo. Fonte: https://www.bcb.gov.br/meubc/faqs/s/open-finance
6. Não há acesso a Cielo Farol, nem dados setoriais reais. A referência por segmento é inteiramente sintética. Disponibilidade e escopo são perguntas para a mentoria.

## Limites da demonstração

- Os três negócios com histórico individual usam 620 dias sintéticos e um teste temporal de 60 dias. Isso não comprova resultado em empresas reais.
- As previsões foram calculadas em Python e exportadas para a interface. Alterar saldo ou cenário recalcula o caixa, sem retreinar a floresta.
- O modelo estima vendas. O caixa é uma projeção contábil determinística de recebimentos, saldo inicial e saídas, não uma probabilidade de encerramento.
- Estoque, obrigações e dívidas são fotografias contábeis hipotéticas; não são a soma indiscriminada dos próximos 60 dias de despesas.
- No modo complementado, pressupõe-se que o lojista conferiu a completude dos registros fictícios. Em produção seria necessário conciliar outras contas e adquirentes e evitar lançamentos duplicados.
- As hipóteses de economia não incluem impacto negativo em vendas; renegociação depende de aceite do fornecedor; taxas de antecipação são fictícias.
- Ninguém é contatado, nenhuma conta é conectada e nenhuma contratação é realizada. O plano desaparece ao recarregar a página.

## Promoções específicas para os dois casos da apresentação

- **Bar do Léo:** o motor forma candidatos de combo combinando uma bebida e um petisco.
- **Linha & Cor:** o motor avalia peças isoladas e a liquidação conjunta da coleção anterior.
- A seleção considera giro recente, estoque excedente ao que já venderia, margem, desconto,
  adesão, canibalização, prazo de liquidação do meio de pagamento e o dia do aperto de caixa.
- Somente o incremento líquido entra na curva. Vendas normais permanecem na previsão agregada;
  o desconto concedido sobre vendas que já aconteceriam é subtraído, evitando dupla contagem.
- O custo contábil do estoque já comprado reduz a margem e o estoque remanescente, mas não é
  registrado novamente como pagamento. Reposição futura está fora do escopo.
- Todos os parâmetros por produto são sintéticos e arbitrados para demonstração. A estimativa
  da promoção é pontual; as faixas do Monte Carlo continuam representando apenas o cenário-base.

## Roteiro curto da demonstração

1. Comece em “somente pagamentos”: o sistema sabe prever entradas, mas reconhece o que falta.
2. Ative os dados complementares simulados: surge a projeção de caixa e o alerta.
3. Compare as quatro alternativas em 60 dias; observe se só adiam o problema.
4. Abra Capital de giro para explicar prazos, estoque e recursos presos na operação.
5. Selecione Café Primeiro Passo para demonstrar o início com pouco histórico e seus limites.
