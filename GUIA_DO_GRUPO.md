# Guia do grupo — Copiloto de Caixa

## Acessar o repositório privado

O proprietário precisa convidar cada colega em **Settings → Collaborators → Add people**, pesquisando o usuário ou e-mail da conta GitHub. Cada colega precisa aceitar o convite recebido. Compartilhar apenas o endereço de um repositório privado não concede acesso.

Repositórios de conta pessoal têm proprietário e colaboradores; o convite de colaborador permite contribuir com o código. Para mais granularidade de funções, avaliem um repositório de organização. Não é necessário tornar o repositório público para o grupo colaborar.

Documentação: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository

## Abrir a demonstração no computador

1. Após aceitar o convite, use **Code → Download ZIP** e extraia o arquivo, ou clone o repositório com Git.
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
- `work/test_engine.js`: testes das contas e dos efeitos das ações; execute com `node work/test_engine.js` se tiver Node.js.
- `requirements.txt`: dependências do treinamento.

## Colaborar

Criem uma branch para cada alteração e abram um pull request antes de integrar na branch principal. Não incluam dados reais de clientes, senhas ou chaves no repositório. Os dados presentes neste projeto são fictícios.

## Código e site têm acessos separados

Ser colaborador no GitHub não libera automaticamente o site hospedado no Sites. Cada colega já pode executar a demo localmente com as instruções acima. O acesso ao site hospedado deve ser configurado separadamente pelo proprietário.

## Limitações a explicar no pitch

As Random Forests foram treinadas com dados sintéticos. A página carrega previsões previamente calculadas e simula o caixa em tempo real. Open Finance, DDA e Cielo Farol não estão integrados. O modelo de pouco histórico ainda não tem validação independente. Nenhuma transação financeira é executada.
