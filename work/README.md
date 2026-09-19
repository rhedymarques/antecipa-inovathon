# Processamento analítico e validação

Esta pasta reúne os scripts Python de modelagem e a suíte de testes do motor de cálculo. Junto ao [gerador da base](../gerar_base_ficticia.py) e ao [motor em JavaScript](../dist/engine.js), compõe a implementação analítica e das regras de negócio do Antecipa.

## Componentes

| Arquivo | Responsabilidade |
| --- | --- |
| [`train_model.py`](train_model.py) | Lê a base sintética, treina as Random Forests, avalia em um período temporal reservado e exporta previsões e dados para a interface. |
| [`montecarlo.py`](montecarlo.py) | Simula 2.000 cenários de caixa, quantis, probabilidade de saldo negativo e diagnóstico por frequência. |
| [`enrich_model.py`](enrich_model.py) | Acrescenta informações financeiras sintéticas e o modelo de pouco histórico apoiado em 18 negócios fictícios semelhantes. É chamado ao final do treino. |
| [`test_engine.js`](test_engine.js) | Verifica conservação do caixa, dimensionamento, custos, recomendações, campanhas, estoque e consistência dos cenários usando Node.js. |

## Execução

Na raiz do repositório, com as dependências de `requirements.txt` instaladas no ambiente Python:

```bash
python gerar_base_ficticia.py
python work/train_model.py
node work/test_engine.js
```

O [guia de reprodução](../docs/REPRODUCAO.md) mostra a preparação do ambiente para Windows, Linux e macOS. O processo regenera arquivos: confira o diff antes de incluí-los em um commit.

## Como chega à interface

O processamento Python é executado antes da demonstração e exporta `dist/data.json`. A página lê esse arquivo e usa `dist/engine.js` para recalcular caixa e alternativas ao interagir. O back-end analítico do projeto está implementado dessa forma; uma API remota de produção não faz parte da versão demonstrativa.

Veja a [arquitetura em camadas](../docs/ARQUITETURA.md) e a [metodologia de avaliação](../docs/METODOLOGIA.md).
