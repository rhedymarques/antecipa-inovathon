# Guia do grupo — Copiloto de Caixa

## Acessar o repositório público

O código está disponível publicamente em https://github.com/rhedymarques/copiloto-caixa-inovathon. Qualquer pessoa pode abrir ou clonar o repositório sem convite. Permissão de escrita continua restrita aos colaboradores autorizados no GitHub.

Para colaborar, trabalhe em uma branch própria e abra um pull request. Não publique dados reais de clientes, senhas ou chaves: os dados deste projeto são fictícios.

## Abrir a demonstração no computador

1. Na página pública do repositório, use **Code → Download ZIP** e extraia o arquivo, ou clone com Git.
2. Instale Python 3.12 ou mais recente, se ainda não tiver Python.
3. Abra o terminal na pasta extraída e execute:

```bash
python -m http.server 8765 --bind 127.0.0.1 --directory dist
```

4. Abra http://localhost:8765 no navegador.
5. Para encerrar, pressione Ctrl+C no terminal.

Para visualizar a demonstração, não é necessário instalar scikit-learn: as previsões já estão incluídas. Não abra apenas o HTML com duplo clique, pois o navegador precisa carregar o JSON pelo servidor local.

## Treinar novamente

```bash
python -m venv .venv
```

Ative o ambiente virtual conforme seu sistema. No PowerShell do Windows, também é possível usar diretamente:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe work/train_model.py
```

O script recria dados sintéticos e previsões. O script principal chama também o modelo de pouco histórico em `work/enrich_model.py`.

## O que existe em cada pasta

- `dist/`: interface, simulador, previsões, pagamentos sintéticos e notas conceituais.
- `work/train_model.py`: geração reproduzível e treinamento dos modelos individuais.
- `work/enrich_model.py`: modelo baseado em empresas semelhantes e dados contábeis complementares.
- `work/test_engine.js`: testes das contas, diagnósticos e recomendações; execute com `node work/test_engine.js`.
- `requirements.txt`: dependências do treinamento.

## Colaborar

Criem uma branch para cada alteração e abram um pull request antes de integrar na branch principal. A visibilidade pública permite leitura e clone, mas não concede permissão para enviar mudanças diretamente.

## Código e site têm acessos separados

O repositório público não torna automaticamente público o site hospedado no Sites. O código pode ser executado localmente pelas instruções acima; acesso e publicação do site continuam sob configuração separada do proprietário.

## Limitações a explicar no pitch

As Random Forests foram treinadas com dados sintéticos. A página carrega previsões previamente calculadas e simula o caixa em tempo real. Open Finance, DDA e Cielo Farol não estão integrados. O modelo de pouco histórico ainda não tem validação independente. Nenhuma transação financeira é executada.
