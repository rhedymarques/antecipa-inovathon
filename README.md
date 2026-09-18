# Antecipa — Inovathon UFSCar 2026 (desafio Cielo)

**Antecipa** é um copiloto de caixa para pequenos negócios. Ele prevê o fluxo de
caixa dos próximos 30 a 60 dias, diagnostica se um aperto é problema de **prazo**
ou de **margem**, e recomenda a ação mais barata que resolve — inclusive
recomendar *não fazer nada* quando agir custa mais que o risco. Nada é executado
automaticamente: o sistema mostra custo e impacto, e a decisão é sempre do lojista.

> Projeto acadêmico, sem vínculo ou integração com a Cielo. **Todos os dados são
> sintéticos** e não representam taxas, políticas ou formatos internos da empresa.

## Equipe

Primeira turma de graduação em Ciência de Dados e Inteligência Artificial da
UFSCar — campus Sorocaba.

- Felipe Pezzato Toledo Prado
- Gustavo Eiji Tomita Camelo
- Otávio André Martinez
- Rhédy Marques Silva
- Vitor Sotto Rodrigues

Orientação: Profa. Dra. Adriane Portela (Estatística, UFSCar).

## Como abrir o protótipo

O protótipo é uma página que roda no navegador. As previsões já vêm prontas, não
é preciso treinar nada.

    python -m http.server 8000

Depois abra **http://localhost:8000/prototipo/**. Abra pelo servidor, não com
duplo clique no HTML — o navegador precisa carregar os dados pelo servidor local.

Selecione um negócio (Bar do Léo ou Linha & Cor), veja a projeção de caixa em 30
ou 60 dias, o diagnóstico e as alternativas comparadas.

## Como funciona

1. **Dados** — histórico de vendas, recebíveis, saldo e despesas previstas.
2. **Previsão** — um `RandomForestRegressor` aprende o padrão de vendas de cada
   negócio e projeta os próximos 60 dias.
3. **Simulação** — Monte Carlo com 2.000 cenários mede o risco com probabilidade,
   variando volume de vendas, mix de pagamento e cancelamentos.
4. **Diagnóstico** — o sistema classifica cada cenário em saudável, problema de
   prazo (timing) ou de margem, e reporta o resultado mais frequente.
5. **Recomendação** — compara as alternativas por custo e escolhe a mais barata
   que resolve, sem sugerir antecipação automaticamente.

Tudo reproduzível com semente fixa (42). As previsões não são inferências causais
e não comprovam desempenho em dados reais.

## Recriar os dados e treinar

Python 3.12+:

    pip install -r requirements.txt
    python work/train_model.py

O script regenera a base sintética e as previsões (`dist/data.json`), de forma
reproduzível.

## Estrutura

- `prototipo/` — a interface que roda no navegador (o protótipo do projeto)
- `dist/engine.js` — motor de cálculo: previsão, diagnóstico e recomendações
- `dist/data.json` — previsões já geradas, consumidas pela interface
- `gerar_base_ficticia.py` — gerador da base sintética dos negócios
- `dados_ficticios/` — a base sintética e sua documentação (ver `LEIA-ME.md`)
- `work/` — treino do modelo, simulação de Monte Carlo e testes

## Limites

Dados 100% sintéticos. As taxas e prazos são hipóteses de demonstração. O sistema
não movimenta dinheiro, não paga contas e não contrata crédito. Negócios com pouco
histórico têm análise inicial menos precisa. O passo seguinte seria um piloto
controlado, com dados autorizados e acompanhamento de especialistas.

## Documentação técnica

Detalhes de arquitetura, decisões e verificações estão em `HANDOFF.md`
(back-end) e `prototipo/HANDOFF-FRONT.md` (interface).
