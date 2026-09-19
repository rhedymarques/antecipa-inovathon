# Execução, testes e reprodução

[← Voltar à apresentação](../README.md)

## Apenas abrir a interface

Na raiz do repositório, com Python 3.12+:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

Abra [a interface principal](http://127.0.0.1:8765/prototipo/) ou [o painel técnico](http://127.0.0.1:8765/dist/). No Windows, `py -3` pode substituir `python`. Não é necessário instalar as dependências do treinamento.

## Testar o motor

Com Node.js 24, na raiz:

```bash
node work/test_engine.js
node --check dist/engine.js
node --check dist/app.js
node --check dist/features.js
node --check prototipo/app.js
```

A suíte usa somente módulos nativos do Node.js e os dados incluídos. Não exige `npm install`.

## Recriar a base e treinar

Use um ambiente virtual Python 3.12. As versões de NumPy e scikit-learn estão fixadas em [`requirements.txt`](../requirements.txt).

### Windows / PowerShell

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe gerar_base_ficticia.py
.\.venv\Scripts\python.exe work/train_model.py
node work/test_engine.js
```

### Linux / macOS

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python gerar_base_ficticia.py
.venv/bin/python work/train_model.py
node work/test_engine.js
```

**São duas etapas:** o gerador recria os dados de entrada; o treino lê esses arquivos e exporta as previsões. `train_model.py` chama `enrich_model.py` ao final, mas não executa o gerador automaticamente.

O processo sobrescreve arquivos em `dados_ficticios/`, `dist/data.json` e `dist/pagamentos_sinteticos.csv`. Confira `git status` e `git diff` ao final antes de incluir esses arquivos em um commit. Sementes e data são fixas; diferenças de ambiente e bibliotecas devem ser consideradas ao comparar resultados numéricos.

## Verificação automática

O workflow [Verificações](../.github/workflows/verify.yml) roda em pushes e pull requests para `main`. Ele valida a sintaxe JavaScript e Python e executa a suíte financeira contra os dados incluídos.

O workflow [Reprodução dos modelos](../.github/workflows/reproduce.yml) pode ser iniciado manualmente na aba Actions. Ele instala as versões fixadas, recria a base, treina e executa os testes. Não faz commit nem publica os arquivos resultantes.

## Problemas comuns

| Sintoma | Como resolver |
| --- | --- |
| A página informa que não conseguiu carregar a previsão. | Sirva a raiz do repositório e abra `/prototipo/` por HTTP; confira se `dist/data.json` existe. |
| O comando `python` não é encontrado. | Instale Python; no Windows, tente o iniciador `py -3`. |
| A porta 8765 está ocupada. | Use outra porta, como 8766, no comando e no endereço do navegador. |
| O treino não encontra um CSV ou perfil. | Execute `gerar_base_ficticia.py` antes de `work/train_model.py`. |
| A interface mantém uma versão antiga após uma alteração. | Recarregue sem cache com `Ctrl+Shift+R`. |

GitHub e o site hospedado são entregas separadas. Estes comandos e workflows não alteram a publicação ou a visibilidade do site.
