# Guia do grupo — Antecipa

O repositório público é a apresentação técnica do projeto: [github.com/rhedymarques/antecipa-inovathon](https://github.com/rhedymarques/antecipa-inovathon).

## Abrir a demonstração

O caminho mais rápido é a [demonstração pública no GitHub Pages](https://rhedymarques.github.io/antecipa-inovathon/prototipo/), sem instalação.

Clone o repositório ou use **Code → Download ZIP** e extraia o arquivo. Na raiz, com Python 3.12+:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Abra **http://127.0.0.1:8765/prototipo/**. No Windows, `py -3` pode substituir `python`. Encerre com `Ctrl+C`.

A interface principal fica em `prototipo/`. O painel técnico com os quatro casos fica em `http://127.0.0.1:8765/dist/`. As duas páginas usam o mesmo motor e as previsões já incluídas; não é necessário instalar bibliotecas de aprendizado de máquina.

## Apresentar e colaborar

- [README](README.md): visão do projeto, equipe e roteiro de três minutos.
- [Proposta](docs/PROPOSTA.md): problema, diferenciais e próximas etapas.
- [Metodologia](docs/METODOLOGIA.md): avaliação, hipóteses e limites.
- [Reprodução](docs/REPRODUCAO.md): gerar os dados, treinar e testar.
- [Contribuição](CONTRIBUTING.md): fluxo de branch e pull request.

## Limites a explicar

O projeto tem **back-end analítico e motor de cálculo**: geração da base, treinamento e simulação em Python, além das regras de caixa e decisão em JavaScript. A demonstração distribui esses componentes entre processamento prévio e execução no navegador; não depende de um servidor remoto de aplicação. Essa distinção está detalhada em [arquitetura](docs/ARQUITETURA.md#back-end-analítico-e-servidor-remoto).

Os dados são sintéticos. O navegador usa previsões calculadas previamente e simula o caixa ao alterar os controles. As faixas de incerteza continuam as do cenário-base. Open Finance, DDA e Cielo Farol não estão integrados, e nenhuma transação é executada.

A permissão pública permite ler e clonar o repositório; escrita continua restrita aos colaboradores. O **GitHub Pages já está configurado** para publicar a raiz da branch `main`. Uma hospedagem no **Sites** tem histórico e acesso separados e não é atualizada por esse fluxo.
