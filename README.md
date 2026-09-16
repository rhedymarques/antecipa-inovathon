# Copiloto de Caixa — protótipo do Inovathon

Protótipo independente, sem vínculo oficial ou integração com a Cielo. Todos os dados são sintéticos. Não representa taxas, políticas comerciais ou formatos internos da empresa.

## Acesso do grupo

Consulte o [Guia do grupo](GUIA_DO_GRUPO.md) para convidar colegas e abrir a demonstração localmente. O acesso ao repositório privado é separado do acesso ao site hospedado.

## Executar

Para apenas visualizar, as previsões já estão incluídas: execute `python -m http.server 8765 --bind 127.0.0.1 --directory dist` e abra http://localhost:8765. Não é necessário treinar novamente.

Para recriar os dados e treinar, use Python 3.12+: `pip install -r requirements.txt`, depois `python work/train_model.py` para gerar dados e previsões. Sirva a pasta `dist` com `python -m http.server 8765 --directory dist` e abra http://localhost:8765.

O treinamento usa RandomForestRegressor, 100 árvores por negócio, saída direta de 60 dias. As previsões geradas são consumidas pelo navegador. O simulador recalcula o caixa imediatamente; não retreina ao mover controles. Os dados e o treinamento são reproduzíveis com semente 42. Cenários não são inferências causais. O script principal também executa `work/enrich_model.py`, que acrescenta o quarto negócio com 14 dias de histórico, uma floresta treinada em 18 empresas sintéticas (semente 2026) e os dados contábeis declarados.

## Validação

Os três negócios com modelo individual contêm 620 dias de vendas. Reservam-se os últimos 60 para um teste com origem fixa. Exemplos de treino têm todos os seus alvos antes desse corte. Compara-se MAE em reais por dia com repetição da última semana. Depois da avaliação, treina-se novamente com todo o histórico disponível para prever os próximos 60 dias. Não há comprovação de generalização para dados reais, intervalos calibrados ou previsão de mortalidade empresarial.

## Caixa

Recebíveis existentes são gerados apenas por vendas anteriores à data de referência; novas vendas previstas são liquidadas segundo mix e prazos hipotéticos. Saldo e despesas são dados complementares do lojista. Antecipação remove o principal das datas originais e adiciona principal menos custo hoje. Renegociação mantém a despesa, movendo-a em sete dias. Economia operacional supõe ausência de efeito nas vendas. Todas as ações são simulações sem transações externas. Valores da interface arredondados; cálculo interno em ponto flutuante, apropriado apenas para protótipo.

Taxas: Pix 0%; débito 1,2%; crédito 2,5%; 3 parcelas 3,2%. Liquidação em dias corridos, sem feriados: D+0, D+1, D+30 e D+30/60/90. Antecipação ilustrativa de 2,5% por 30 dias, proporcional ao prazo. Sem cancelamentos, chargebacks, tributos por transação ou conciliação de múltiplos provedores.

## Demonstração

1. Selecione um dos quatro negócios fictícios.
2. Observe o menor saldo e a data de insuficiência.
3. Compare negociação, economia e antecipação.
4. Confira 60 dias para ver custos e obrigações deslocadas.
5. Abra Modelo e validação e Origem dos dados; exporte o fluxo.

O plano existe apenas durante a sessão e não é persistido. Nenhum dado pessoal é solicitado. A versão hospedada começa privada.

## Versão 2: proposta da equipe

Consulte `dist/alinhamento-proposta.md` para o que foi incorporado e as correções conceituais. A interface inclui modo somente pagamentos, informações complementares explicitamente simuladas, alertas proativos ao recalcular, tabela comparativa de alternativas, capital de giro e estimativa de início de operação. O modelo de pouco histórico não tem teste independente e informa essa limitação. Os dados contábeis são hipóteses, não saídas da floresta.
