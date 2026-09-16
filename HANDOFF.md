# Handoff — Antecipa / Copiloto de Caixa

Estado verificado em **16/09/2026** para o II Inovathon SemAd 2026, desafio Cielo “Inteligência de Caixa para PMEs”.

## Objetivo e tese

O protótipo transforma dados de pagamentos e informações complementares de caixa em previsão, diagnóstico e comparação de ações. A regra central é diagnosticar a causa antes de recomendar:

- **TIMING:** entra mais do que sai, mas o dinheiro chega depois dos compromissos. O sistema compara mix de pagamento, negociação, antecipação dimensionada e não fazer nada.
- **MARGEM:** as saídas superam as entradas no período. Antecipação e crédito ficam vetados; a interface informa que uma redução isolada pode apenas amenizar o buraco e que o ajuste é estrutural.

O sistema recomenda uma alternativa pelas hipóteses simuladas, mostra custo e efeito e espera a decisão do lojista. Nenhuma transação é executada.

## Acesso e execução para avaliadores

- Repositório público: https://github.com/rhedymarques/copiloto-caixa-inovathon
- A demonstração é HTML, CSS e JavaScript sem build e sem backend.
- Na raiz do projeto, execute:

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Depois abra http://127.0.0.1:8765. Não abra `dist/index.html` diretamente por `file://`, pois a página carrega `data.json` por HTTP. Para apenas avaliar a interface, não é necessário instalar as dependências de aprendizado de máquina.

Para verificar o motor, use Node.js:

```bash
node work/test_engine.js
node --check dist/engine.js
node --check dist/app.js
node --check dist/features.js
```

Para reproduzir dados e previsões, use Python com as versões fixadas em `requirements.txt`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe work/train_model.py
```

O treino sobrescreve `dist/data.json` e `dist/pagamentos_sinteticos.csv`, chama `work/enrich_model.py` e recalcula os cenários de Monte Carlo. Confira o diff depois da execução.

## O que existe

| Camada | Implementação atual |
|---|---|
| Dados | 620 dias sintéticos com semente 42, referência fixa em 15/09/2026 e mix de pagamentos variável por dia |
| Previsão | Random Forest de vendas diárias, 100 árvores, holdout temporal de 60 dias sem sobreposição de alvos e comparação com baseline |
| Incerteza | 2.000 cenários; recebíveis já contratados e contas conhecidas ficam fixos; vendas, mix e chargeback hipotético variam |
| Caixa | Saldo inicial + recebíveis existentes + liquidação de vendas previstas − saídas informadas |
| Diagnóstico | `diagnose()` separa TIMING, MARGEM e SAUDÁVEL; o diagnóstico probabilístico é calculado dentro de cada cenário |
| Recomendação | `recommend()` escolhe entre não agir, negociar fornecedor, reduzir gastos variáveis, antecipar recebíveis e ajustar o mix |
| Interface | Dashboard responsivo em `dist/`, horizontes de 30/60 dias, faixas de incerteza, comparação, plano da sessão e exportação de CSV |
| Dados incompletos | Modo somente pagamentos não calcula caixa, risco, recomendação ou capital de giro sem saldo e saídas |

Os casos demonstrativos atuais são:

- **Bar do Léo:** diagnóstico predominante de TIMING; no cenário-base de 60 dias, buraco aproximado de R$ 502.
- **Linha & Cor:** saudável em 30 dias e TIMING em 60; no cenário-base de 60 dias, buraco aproximado de R$ 25,9 mil.
- **Mercado Bom Preço:** diagnóstico predominante de MARGEM; a redução simulada cobre somente parte do buraco e a tela diz que o ajuste é estrutural.
- **Café Primeiro Passo:** somente 14 dias próprios; usa um modelo separado baseado em 18 empresas sintéticas semelhantes e ainda não possui teste independente.

Os valores acima são saídas do cenário-base determinístico. As probabilidades e faixas exibidas vêm dos 2.000 cenários e devem ser apresentadas como incerteza, nunca como certeza.

## Regra de recomendação responsável

Para TIMING, as alternativas que atingem uma margem de segurança de 20% são comparadas por custo. O custo recomendado não pode superar o buraco. A antecipação recomendada:

- é independente do valor que estiver no controle manual;
- usa o menor principal, em centavos, que mantém todos os saldos do horizonte acima da margem;
- não pode exceder 1,5 vez o buraco;
- é descartada quando não resolve dentro desse limite;
- adiciona principal menos taxa hoje e remove o principal das datas originais, preservando a conservação do caixa.

Em MARGEM, `recommend()` nunca retorna antecipação ou crédito. “Não fazer nada” permanece disponível para comparação. O controle de antecipação continua livre para exploração manual, sem contratar ou executar nada.

Com os dados atuais em 60 dias, as recomendações reproduzidas são: Bar do Léo, desconto de 0,5% no Pix; Linha & Cor, desconto de 4% no Pix; Mercado Bom Preço, redução de gastos com aviso explícito de cobertura parcial. Taxas, elasticidade e custos são hipóteses de demonstração.

## O que é sintético ou hipotético

- Todos os dados, negócios, transações, saldos, despesas, recebíveis e métricas são sintéticos.
- Não há dados reais de clientes nem integração com a Cielo.
- Taxas, prazos e a elasticidade de 6 pontos percentuais do crédito para Pix por 1% de desconto são hipóteses declaradas.
- Random Forest e Monte Carlo foram avaliados somente sobre a base sintética; não comprovam acurácia ou impacto econômico em produção.
- Open Finance, DDA e informações do lojista aparecem como possíveis origens futuras, sem conexão, login ou consentimento implementado.
- A adquirente enxerga entradas sob sua operação; uma visão real de saídas exigiria informação do lojista ou Open Finance com consentimento e conciliação.
- Reduzir gastos sem afetar vendas e adiar fornecedor por sete dias sem multa são hipóteses, não promessas.
- Importância de variáveis não representa causalidade.

## O que ficou de fora

- Backend, autenticação, banco de dados e persistência do plano.
- Inferência em tempo real; a página consome previsões já exportadas em `data.json`.
- Integrações reais, validação de elegibilidade de recebíveis, gravames e execução de pagamentos, antecipação ou crédito.
- Calendário bancário, feriados, conciliação entre provedores e importação de dados reais.
- Edição detalhada de compromissos e composição de várias ações ao mesmo tempo.
- Validação independente do modelo de pouco histórico e validação com empresas reais.
- Garantia de resultado, recomendação profissional ou decisão automática.

## Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `dist/index.html`, `dist/style.css` | Estrutura e apresentação da demonstração |
| `dist/app.js`, `dist/features.js` | Estado da interface, gráficos, alertas, comparação e explicações |
| `dist/engine.js` | Simulação, diagnóstico, ações e recomendação |
| `dist/data.json` | Dados sintéticos, previsões e incerteza consumidos pela página |
| `gerar_base_ficticia.py` | Geração reproduzível da base sintética |
| `work/train_model.py` | Treino, holdout temporal, baseline e exportação |
| `work/montecarlo.py` | Simulação dos 2.000 cenários |
| `work/enrich_model.py` | Caso de pouco histórico e informações financeiras complementares |
| `work/test_engine.js` | Invariantes financeiras, diagnósticos e regras de recomendação |
| `dist/alinhamento-proposta.md` | Decisões conceituais e limites da proposta |

## Verificações desta revisão

Executados com sucesso em 16/09/2026:

- `node work/test_engine.js`, incluindo conservação do caixa, antecipação mínima, teto de 1,5 vez, reprodução do valor recomendado, custo limitado ao buraco e veto de antecipação/crédito em MARGEM;
- `node --check` em `dist/engine.js`, `dist/app.js` e `dist/features.js`;
- `python work/train_model.py` com NumPy 2.3.5 e scikit-learn 1.9.1;
- leitura e validação estrutural do JSON regenerado.

O treino completo terminou sem erro e reproduziu os arquivos versionados, sem diferença em `dist/data.json` ou `dist/pagamentos_sinteticos.csv`. O JSON resultante registra referência 15/09/2026, semente 42, indicador sintético, quatro casos, horizonte de 60 dias e 2.000 cenários por caso.

## Estado da entrega

O código está pronto para apoiar a demonstração. Os entregáveis do evento continuam sendo o vídeo de até cinco minutos no YouTube como “Não listado” e o documento descritivo enviados até 18/09/2026 às 7h. Nada neste repositório envia esses materiais, publica o vídeo ou executa uma submissão.

GitHub e o site hospedado têm históricos e configurações independentes. Um push no repositório não atualiza automaticamente o site. Não force sincronização de históricos nem altere a visibilidade do site sem instrução do responsável.

Ao concluir qualquer mudança futura, registre aqui apenas o que realmente foi alterado e verificado. Preserve os avisos de dados sintéticos, as faixas e probabilidades para números previstos e os limites das integrações.
