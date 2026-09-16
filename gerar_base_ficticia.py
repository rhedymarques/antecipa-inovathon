"""
Gerador de dados sintéticos — Copiloto de Caixa (Inovathon UFSCar 2026, case Cielo).

Cria o histórico de tres negocios ficticios com modos de falha DIFERENTES:

  bar        -> falha MISTA      (folha pesada, fluxo rapido, insumo volatil)
  vestuario  -> falha por TIMING (parcela muito, compra colecao de uma vez;
                                  e lucrativo mas o dinheiro chega tarde)
  mercadinho -> falha por MARGEM (recebe rapido, mas sobra quase nada;
                                  antecipar NAO resolve o problema dele)

Nenhum dado real da Cielo. Taxas e prazos sao hipoteses de demonstracao.

Saidas em ./dados_ficticios/:
  vendas_por_dia.csv          o que foi vendido: negocio, dia, forma de pagamento
  agenda_de_recebiveis.csv    quando o dinheiro cai: uma linha por parcela, ja liquido
  contas_a_pagar.csv          quando o dinheiro sai: fornecedor, folha, aluguel, imposto
  perfil_dos_negocios.json    ficha de cada negocio e diagnostico de caixa

Uso:  python gerar_base_ficticia.py
"""

from __future__ import annotations

import csv
import json
from datetime import date, timedelta
from pathlib import Path

import numpy as np

# --------------------------------------------------------------------------
# Parametros globais
# --------------------------------------------------------------------------

SEMENTE = 42
DATA_REF = date(2026, 9, 15)   # "hoje" do protótipo
DIAS_HISTORICO = 620           # ~20 meses, igual ao repositorio atual
SAIDA = Path(__file__).resolve().parent / "dados_ficticios"

# Modalidades de recebimento. Taxa e prazo sao HIPOTESES de demonstracao,
# nao condicoes contratuais da Cielo.
MODALIDADES = {
    #                taxa    prazo(d)  parcelas
    "pix":           (0.000,      0,        1),
    "debito":        (0.012,      1,        1),
    "credito_vista": (0.025,     30,        1),
    "credito_4x":    (0.035,     30,        4),
}

# --------------------------------------------------------------------------
# Perfis dos negocios
# --------------------------------------------------------------------------
# fator_semana: multiplicador por dia da semana (segunda=0 ... domingo=6)
# mix: fatia de cada modalidade, na ordem de MODALIDADES
# margem_bruta: quanto sobra do faturamento antes das despesas fixas
# aperto_alvo: modo de falha que queremos que o dado exiba

PERFIS = {
    "bar": {
        "nome": "Bar do Léo",
        "setor": "Bar e restaurante",
        "meses_operando": 20,
        "ticket_medio": 52.0,
        "vendas_dia": 78,
        "fator_semana": [0.70, 0.75, 0.85, 0.95, 1.45, 1.60, 0.70],
        "fator_inicio_mes": 1.10,      # do dia 1 ao 10
        "fator_fim_mes": 0.90,         # do dia 25 em diante
        "ruido": 0.15,
        "tendencia_anual": 0.02,       # cresce 2% ao ano
        "mix": [0.34, 0.28, 0.26, 0.12],
        "mix_concentracao": 190,   # menor = mix do dia varia mais
        "margem_bruta": 0.55,
        "saldo_inicial": 9_800.0,
        "fornecedor_dias_semana": [1],          # terca
        "fornecedor_peso": 0.22,                # % do faturamento semanal
        "folha_dias": [5, 20],                  # quinzena
        "folha_peso": 0.30,                     # % do faturamento mensal
        "aluguel_dia": 10,
        "aluguel_peso": 0.07,
        "imposto_dia": 20,
        "imposto_aliquota": 0.06,
        "operacional_diario": 0.05,
        "aperto_alvo": "timing",
        "severidade_alvo": "leve",
    },
    "vestuario": {
        "nome": "Linha & Cor",
        "setor": "Loja de roupas",
        "meses_operando": 20,
        "ticket_medio": 186.0,
        "vendas_dia": 19,
        "fator_semana": [0.80, 0.85, 0.90, 1.00, 1.20, 1.60, 0.45],
        "fator_inicio_mes": 1.18,
        "fator_fim_mes": 0.82,
        "ruido": 0.22,
        "tendencia_anual": 0.11,       # em crescimento — e parte do problema
        "mix": [0.13, 0.18, 0.22, 0.47],   # quase metade parcelado em 4x
        "mix_concentracao": 140,   # publico mais heterogeneo: mix oscila mais
        "margem_bruta": 0.52,
        "saldo_inicial": 7_400.0,
        "colecao_intervalo": 90,       # colecao sazonal: 2 compras grandes por ano
        "colecao_peso": 0.32,          # % do faturamento do periodo, paga de uma vez
        "colecao_parcelas": 1,
        "colecao_prazo": 30,           # fornecedor da 30 dias para pagar
        "folha_dias": [5],
        "folha_peso": 0.26,
        "aluguel_dia": 10,
        "aluguel_peso": 0.13,
        "imposto_dia": 20,
        "imposto_aliquota": 0.06,
        "operacional_diario": 0.09,
        "aperto_alvo": "timing",
        "severidade_alvo": "severa",
    },
    "mercadinho": {
        "nome": "Mercado Bom Preço",
        "setor": "Mercado de bairro",
        "meses_operando": 20,
        "ticket_medio": 34.0,
        "vendas_dia": 132,
        "fator_semana": [1.05, 0.95, 0.95, 1.00, 1.25, 1.40, 0.60],
        "fator_inicio_mes": 1.28,      # pico forte depois do pagamento
        "fator_fim_mes": 0.76,         # vale pesado no fim do mes
        "ruido": 0.10,
        "tendencia_anual": 0.01,
        "mix": [0.42, 0.34, 0.20, 0.04],   # dinheiro entra quase todo rapido
        "mix_concentracao": 260,   # clientela fixa: mix mais estavel
        "margem_bruta": 0.24,              # margem fina: aqui mora o problema
        "saldo_inicial": 6_100.0,
        "fornecedor_dias_semana": [0, 2, 4],    # seg, qua, sex
        "fornecedor_peso": 0.72,                # reposicao constante e pesada
        "folha_dias": [5, 20],
        "folha_peso": 0.13,
        "aluguel_dia": 10,
        "aluguel_peso": 0.05,
        "imposto_dia": 20,
        "imposto_aliquota": 0.04,
        "operacional_diario": 0.03,
        "aperto_alvo": "margem",
        "severidade_alvo": "media",
    },
}

# Choque de demanda: queda de vendas num intervalo, para o modelo ter
# algo real para detectar. Dias contados a partir do fim do historico.
CHOQUE = {"inicio_dias_atras": 75, "duracao": 32, "intensidade": -0.09}


# --------------------------------------------------------------------------
# Geracao
# --------------------------------------------------------------------------

def datas_historico() -> list[date]:
    return [DATA_REF - timedelta(days=DIAS_HISTORICO - i) for i in range(DIAS_HISTORICO)]


def gerar_vendas_diarias(perfil: dict, datas: list[date], rng) -> np.ndarray:
    """Faturamento bruto de cada dia, em reais."""
    base = perfil["ticket_medio"] * perfil["vendas_dia"]
    n = len(datas)
    inicio_choque = n - CHOQUE["inicio_dias_atras"]
    fim_choque = inicio_choque + CHOQUE["duracao"]

    valores = []
    for i, d in enumerate(datas):
        f_semana = perfil["fator_semana"][d.weekday()]

        if d.day <= 10:
            f_mes = perfil["fator_inicio_mes"]
        elif d.day >= 25:
            f_mes = perfil["fator_fim_mes"]
        else:
            f_mes = 1.0

        # tendencia composta + onda anual suave (sazonalidade de estacao)
        f_tendencia = (1 + perfil["tendencia_anual"]) ** (i / 365)
        f_estacao = 1 + 0.07 * np.sin(2 * np.pi * i / 365)

        f_choque = 1 + CHOQUE["intensidade"] if inicio_choque <= i < fim_choque else 1.0

        esperado = base * f_semana * f_mes * f_tendencia * f_estacao * f_choque
        ruido = rng.normal(0, esperado * perfil["ruido"])
        valores.append(max(0.0, esperado + ruido))

    return np.round(np.array(valores), 2)


def gerar_mix_diario(perfil: dict, n_dias: int, rng) -> np.ndarray:
    """Fatia de cada modalidade em CADA dia.

    O mix nao e constante na vida real: num dia cai mais Pix, no outro mais
    parcelado. Sorteamos de uma Dirichlet centrada no mix medio do negocio.
    A concentracao controla o quanto oscila: clientela fixa oscila menos.
    """
    alpha = np.array(perfil["mix"]) * perfil["mix_concentracao"]
    return rng.dirichlet(alpha, size=n_dias)


def gerar_recebiveis(chave: str, perfil: dict, datas: list[date],
                     vendas: np.ndarray, mix_diario: np.ndarray) -> list[dict]:
    """Quebra cada dia de venda em parcelas com data de liquidacao e valor liquido."""
    linhas = []
    for i, dia in enumerate(datas):
        for j, modalidade in enumerate(MODALIDADES):
            fatia = mix_diario[i][j]
            taxa, prazo, parcelas = MODALIDADES[modalidade]
            bruto = vendas[i] * fatia
            if bruto <= 0:
                continue
            liquido_total = bruto * (1 - taxa)
            for p in range(parcelas):
                liquidacao = dia + timedelta(days=prazo + 30 * p)
                linhas.append({
                    "negocio": chave,
                    "data_venda": dia.isoformat(),
                    "modalidade": modalidade,
                    "parcela": p + 1,
                    "de_parcelas": parcelas,
                    "valor_bruto": round(bruto / parcelas, 2),
                    "taxa": taxa,
                    "data_liquidacao": liquidacao.isoformat(),
                    "valor_liquido": round(liquido_total / parcelas, 2),
                })
    return linhas


def gerar_despesas(chave: str, perfil: dict, datas: list[date],
                   vendas: np.ndarray) -> list[dict]:
    """Saidas de caixa com data de vencimento. E aqui que os modos de falha aparecem."""
    linhas = []
    media_diaria = float(np.mean(vendas))
    n = len(datas)

    def add(dia: date, categoria: str, valor: float):
        if valor > 0:
            linhas.append({
                "negocio": chave,
                "data": dia.isoformat(),
                "categoria": categoria,
                "valor": round(valor, 2),
            })

    for i, dia in enumerate(datas):
        # operacional diluido (luz, agua, embalagem, manutencao)
        add(dia, "operacional", media_diaria * perfil["operacional_diario"])

        # folha, aluguel e imposto em datas fixas
        if dia.day in perfil["folha_dias"]:
            fatias = len(perfil["folha_dias"])
            add(dia, "folha", media_diaria * 30 * perfil["folha_peso"] / fatias)
        if dia.day == perfil["aluguel_dia"]:
            add(dia, "aluguel", media_diaria * 30 * perfil["aluguel_peso"])
        if dia.day == perfil["imposto_dia"]:
            # imposto sobre o faturamento do mes anterior
            janela = vendas[max(0, i - 30):i]
            add(dia, "imposto", float(np.sum(janela)) * perfil["imposto_aliquota"])

        # fornecedor: recorrente (bar, mercadinho) ou em lote (vestuario)
        if "fornecedor_dias_semana" in perfil:
            if dia.weekday() in perfil["fornecedor_dias_semana"]:
                vezes = len(perfil["fornecedor_dias_semana"])
                add(dia, "fornecedor", media_diaria * 7 * perfil["fornecedor_peso"] / vezes)
        elif "colecao_intervalo" in perfil:
            if i % perfil["colecao_intervalo"] == perfil["colecao_intervalo"] - 1:
                total = media_diaria * perfil["colecao_intervalo"] * perfil["colecao_peso"]
                parcelas = perfil["colecao_parcelas"]
                for p in range(parcelas):
                    venc = dia + timedelta(days=perfil["colecao_prazo"] * (p + 1))
                    add(venc, "fornecedor_colecao", total / parcelas)

    return linhas


# --------------------------------------------------------------------------
# Diagnostico: o dado gerado realmente exibe o modo de falha esperado?
# --------------------------------------------------------------------------

def diagnosticar(perfil: dict, datas: list[date], vendas: np.ndarray,
                 recebiveis: list[dict], despesas: list[dict]) -> dict:
    """Roda a contabilidade dos ultimos 90 dias e mede timing vs margem."""
    janela = [d.isoformat() for d in datas[-90:]]
    janela_set = set(janela)

    entra = sum(r["valor_liquido"] for r in recebiveis if r["data_liquidacao"] in janela_set)
    sai = sum(d["valor"] for d in despesas if d["data"] in janela_set)

    # curva de saldo dia a dia
    por_dia_entra = {d: 0.0 for d in janela}
    por_dia_sai = {d: 0.0 for d in janela}
    for r in recebiveis:
        if r["data_liquidacao"] in janela_set:
            por_dia_entra[r["data_liquidacao"]] += r["valor_liquido"]
    for d in despesas:
        if d["data"] in janela_set:
            por_dia_sai[d["data"]] += d["valor"]

    saldo = perfil["saldo_inicial"]
    curva = []
    for d in janela:
        saldo += por_dia_entra[d] - por_dia_sai[d]
        curva.append(saldo)

    folga = entra - sai          # positivo = margem saudavel
    pior = min(curva)            # negativo = aperto de caixa

    negativos = sum(1 for s in curva if s < 0)

    if folga <= 0:
        modo = "margem"          # gasta mais do que recebe: antecipar NAO resolve
    elif pior < 0:
        modo = "timing"          # e lucrativo, mas o dinheiro chega tarde
    else:
        modo = "saudavel"

    # severidade: quanto o buraco pesa em relacao ao faturamento mensal
    faturamento_mensal = entra / 3
    peso = abs(min(0.0, pior)) / faturamento_mensal if faturamento_mensal else 0.0
    if modo == "saudavel":
        severidade = "nenhuma"
    elif peso < 0.05 and negativos <= 5:
        severidade = "leve"      # alavanca comercial barata resolve
    elif peso < 0.20:
        severidade = "media"
    else:
        severidade = "severa"    # so antecipacao ou credito fecha a conta

    return {
        "entra_90d": round(entra, 2),
        "sai_90d": round(sai, 2),
        "folga_90d": round(folga, 2),
        "folga_pct": round(100 * folga / entra, 1) if entra else 0.0,
        "pior_saldo": round(pior, 2),
        "dias_negativos": negativos,
        "peso_do_buraco": round(peso, 3),
        "modo_detectado": modo,
        "severidade": severidade,
    }


# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------

def main() -> None:
    rng = np.random.default_rng(SEMENTE)
    SAIDA.mkdir(parents=True, exist_ok=True)
    datas = datas_historico()

    linhas_vendas, linhas_receb, linhas_desp = [], [], []
    perfis_saida = {}

    print(f"Referencia: {DATA_REF}  |  historico: {DIAS_HISTORICO} dias  |  semente: {SEMENTE}\n")

    for chave, perfil in PERFIS.items():
        vendas = gerar_vendas_diarias(perfil, datas, rng)
        mix_diario = gerar_mix_diario(perfil, len(datas), rng)

        for i, dia in enumerate(datas):
            for j, modalidade in enumerate(MODALIDADES):
                linhas_vendas.append({
                    "negocio": chave,
                    "data": dia.isoformat(),
                    "modalidade": modalidade,
                    "valor_bruto": round(vendas[i] * mix_diario[i][j], 2),
                })

        receb = gerar_recebiveis(chave, perfil, datas, vendas, mix_diario)
        desp = gerar_despesas(chave, perfil, datas, vendas)
        linhas_receb += receb
        linhas_desp += desp

        diag = diagnosticar(perfil, datas, vendas, receb, desp)
        perfis_saida[chave] = {
            "nome": perfil["nome"],
            "setor": perfil["setor"],
            "meses_operando": perfil["meses_operando"],
            "ticket_medio": perfil["ticket_medio"],
            "saldo_inicial": perfil["saldo_inicial"],
            "mix": dict(zip(MODALIDADES, perfil["mix"])),
            "mix_desvio_observado": dict(zip(MODALIDADES,
                                             np.round(mix_diario.std(axis=0), 4).tolist())),
            "modalidades": {m: {"taxa": t, "prazo_dias": p, "parcelas": n}
                            for m, (t, p, n) in MODALIDADES.items()},
            "margem_bruta": perfil["margem_bruta"],
            "aperto_alvo": perfil["aperto_alvo"],
            "severidade_alvo": perfil["severidade_alvo"],
            "diagnostico_90d": diag,
            "faturamento_medio_mensal": round(float(np.mean(vendas)) * 30, 2),
        }

        ok = "OK " if diag["modo_detectado"] == perfil["aperto_alvo"] else "!! "
        print(f"{ok}{perfil['nome']:<22} ({perfil['setor']})")
        print(f"   faturamento medio/mes  R$ {np.mean(vendas)*30:>12,.2f}")
        print(f"   entra 90d              R$ {diag['entra_90d']:>12,.2f}")
        print(f"   sai    90d             R$ {diag['sai_90d']:>12,.2f}")
        print(f"   folga  90d             R$ {diag['folga_90d']:>12,.2f}  ({diag['folga_pct']}%)")
        print(f"   pior saldo             R$ {diag['pior_saldo']:>12,.2f}"
              f"   dias negativos: {diag['dias_negativos']}")
        print(f"   esperado: {perfil['aperto_alvo']}/{perfil['severidade_alvo']:<7}"
              f" detectado: {diag['modo_detectado']}/{diag['severidade']}\n")

    _escrever_csv(SAIDA / "vendas_por_dia.csv", linhas_vendas)
    _escrever_csv(SAIDA / "agenda_de_recebiveis.csv", linhas_receb)
    _escrever_csv(SAIDA / "contas_a_pagar.csv", linhas_desp)
    (SAIDA / "perfil_dos_negocios.json").write_text(
        json.dumps({"data_referencia": DATA_REF.isoformat(),
                    "semente": SEMENTE,
                    "dias_historico": DIAS_HISTORICO,
                    "sintetico": True,
                    "choque": CHOQUE,
                    "negocios": perfis_saida},
                   ensure_ascii=False, indent=2),
        encoding="utf-8")

    print(f"Arquivos em {SAIDA}")
    for f in sorted(SAIDA.iterdir()):
        print(f"   {f.name:<20} {f.stat().st_size/1024:>8.1f} KB")


def _escrever_csv(caminho: Path, linhas: list[dict]) -> None:
    with caminho.open("w", newline="", encoding="utf-8-sig") as fh:
        escritor = csv.DictWriter(fh, fieldnames=list(linhas[0].keys()))
        escritor.writeheader()
        escritor.writerows(linhas)


if __name__ == "__main__":
    main()
