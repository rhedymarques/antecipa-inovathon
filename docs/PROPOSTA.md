# Proposta do Antecipa

[← Voltar à apresentação](../README.md)

## Contexto

O Antecipa foi desenvolvido para o desafio Cielo “Inteligência de Caixa para PMEs”, no II Inovathon SemAd 2026, da UFSCar. A pergunta que orienta o projeto é: **como ajudar um pequeno negócio a perceber um aperto antes do vencimento das contas e escolher uma resposta compatível com a causa?**

## Para quem e para quê

O protótipo representa a rotina de um lojista que tem vendas, recebimentos em datas diferentes e compromissos a pagar. A interface reúne previsão, explicação, comparação e um plano consultivo em uma aba móvel.

| Situação | Resposta da proposta |
| --- | --- |
| O dinheiro chega depois das contas. | Comparar mudanças de prazo e de pagamento, incluindo antecipação dimensionada quando elegível. |
| As saídas superam as entradas. | Sinalizar um problema estrutural de margem e vetar antecipação como recomendação. |
| O cenário é saudável ou agir custa demais. | Apresentar acompanhamento como uma opção válida. |
| Nenhuma medida resolve sozinha. | Explicitar a cobertura parcial e a necessidade de rever custos e prazos. |
| Há estoque e margem para uma campanha. | Calcular uma proposta por produto, com desconto, canibalização e efeito estimado no caixa. |

## Relação com o desafio Cielo

A proposta explora como informações de pagamentos podem apoiar decisões do lojista, com transparência sobre custos e limites. O diferencial apresentado é **diagnosticar antes de oferecer uma ação**, permitindo inclusive recusar antecipação ou uma promoção que não compense nas hipóteses simuladas.

Dados de pagamentos não descrevem, sozinhos, todo o caixa. Saldo, obrigações e outras fontes de recebimento precisam ser informados ou conciliados. O painel técnico demonstra essa distinção; a interface principal usa o cenário de dados complementares sintéticos.

Não há uso de dados internos, integração, endosso ou produto oficial da Cielo. A interface é uma proposta acadêmica independente.

## O que já pode ser demonstrado

- Navegação por dois negócios e horizontes de 30 e 60 dias.
- Projeção de caixa e incerteza do cenário-base.
- Diagnóstico probabilístico e comparação de ações pelo motor compartilhado.
- Simuladores de desconto no Pix, parcelamento e campanhas por produto.
- Explicações sobre custos, cobertura parcial, hipóteses e motivos de recusa.
- Notificação interna simulada e plano consultivo da sessão.

## Próximas etapas

Estas são propostas de evolução, não funcionalidades entregues ou compromissos de implantação.

1. **Validar o problema com lojistas.** Observar decisões reais, compreensão dos alertas e informações disponíveis sobre despesas.
2. **Avaliar em dados autorizados.** Fazer testes temporais em diferentes negócios, avaliar erros, estabilidade e calibração das faixas, sem extrapolar as métricas sintéticas.
3. **Calibrar as ações.** Medir adesão a descontos, elasticidade, estoque, impacto comercial e condições de renegociação.
4. **Desenhar a integração.** Definir conciliação, consentimento, cobertura das obrigações e elegibilidade de recebíveis com os responsáveis pelos sistemas.
5. **Executar um piloto controlado.** Acompanhar compreensão das recomendações, alertas úteis, custos das ações e resultados de caixa com supervisão especializada.

Antes de produção, também seriam necessários backend, autenticação, persistência, observabilidade e revisão dos contratos do motor. As [limitações técnicas](METODOLOGIA.md#limitações-conhecidas) descrevem as lacunas atuais.
