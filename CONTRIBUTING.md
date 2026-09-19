# Como contribuir

Obrigado pelo interesse no Antecipa. Comece pelo [README](README.md) e pela [arquitetura](docs/ARQUITETURA.md).

## Fluxo de trabalho

1. Crie uma branch com uma alteração de escopo definido.
2. Preserve a identificação dos dados sintéticos e os limites da demonstração.
3. Execute `node work/test_engine.js` na raiz e confira a sintaxe dos arquivos JavaScript alterados.
4. Para mudanças de interface, confira Bar do Léo e Linha & Cor em 30 e 60 dias, incluindo uma tela estreita e a navegação por teclado.
5. Abra um pull request com o problema, a mudança e as verificações realizadas. Atualize a documentação afetada e o registro em `HANDOFF.md`.

## Cuidados com o projeto

- `dist/` contém código-fonte e dados consumidos pelas duas interfaces.
- Não publique dados reais de clientes, credenciais ou arquivos de ambiente.
- Não remova avisos de cobertura parcial, custos, incerteza ou ausência de integração.
- Não apresente resultados sintéticos como validação de mercado ou desempenho real.
- Mudanças no motor precisam manter coerência entre saldo, recebíveis, custos e horizonte.
- O GitHub Pages publica a raiz de `main` pela configuração existente. Uma hospedagem no Sites tem configuração separada; não presuma sincronização entre elas.

## Relatar um problema

Use uma [issue](https://github.com/rhedymarques/antecipa-inovathon/issues/new/choose) e informe o negócio, o horizonte, o comportamento esperado e os passos para reproduzir. Inclua capturas apenas com dados sintéticos.
