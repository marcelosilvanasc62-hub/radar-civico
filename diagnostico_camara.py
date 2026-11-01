#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Radar Cívico — M0: diagnóstico somente de leitura da API da Câmara.

Uso:
  python3 diagnostico_camara.py --rapido
  python3 diagnostico_camara.py

Gera m0_resultados/resumo.txt e resultados.json. Usa apenas a biblioteca padrão.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

API = os.getenv("M0_API", "https://dadosabertos.camara.leg.br/api/v2")
OUT = os.getenv("M0_OUT", "m0_resultados")
PAUSA = float(os.getenv("M0_PAUSA", "0.35"))
UA = "RadarCivico-M0/1.0 (diagnostico somente leitura)"


def requisitar(url, tentativas=3):
    """GET JSON com timeout, pausa e retry limitado para falhas transitórias."""
    ultimo = {"url": url, "status": None, "erro": None}
    for tentativa in range(1, tentativas + 1):
        req = urllib.request.Request(
            url,
            headers={"User-Agent": UA, "Accept": "application/json"},
            method="GET",
        )
        inicio = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=30) as resposta:
                bruto = resposta.read()
                dado = json.loads(bruto.decode("utf-8"))
                return {
                    "url": url,
                    "status": resposta.status,
                    "duracao_ms": round((time.monotonic() - inicio) * 1000),
                    "bytes": len(bruto),
                    "dados": dado,
                    "erro": None,
                }
        except urllib.error.HTTPError as exc:
            ultimo.update(status=exc.code, erro=str(exc))
            if exc.code not in (429, 500, 502, 503, 504) or tentativa == tentativas:
                break
            espera = exc.headers.get("Retry-After", "")
            time.sleep(min(int(espera), 15) if espera.isdigit() else tentativa * 2)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            ultimo.update(erro=str(exc))
            if tentativa < tentativas:
                time.sleep(tentativa * 2)
    ultimo["duracao_ms"] = None
    ultimo["bytes"] = 0
    return ultimo


def resumir_estrutura(valor, prefixo="$", saida=None):
    saida = {} if saida is None else saida
    if isinstance(valor, dict):
        for chave, item in valor.items():
            resumir_estrutura(item, prefixo + "." + chave, saida)
    elif isinstance(valor, list):
        if valor:
            resumir_estrutura(valor[0], prefixo + "[]", saida)
        else:
            saida[prefixo + "[]"] = "lista vazia"
    else:
        saida[prefixo] = "null" if valor is None else type(valor).__name__
    return saida


def executar(rapido=False):
    ano = date.today().year
    testes = [
        ("legislaturas", "/legislaturas?ordem=DESC&ordenarPor=id&itens=3"),
        ("deputados", "/deputados?idLegislatura=57&itens=5&ordem=ASC&ordenarPor=nome"),
        ("partidos", "/partidos?idLegislatura=57&itens=5&ordem=ASC&ordenarPor=sigla"),
        ("proposicoes", f"/proposicoes?siglaTipo=PL&ano={ano}&itens=5&ordem=DESC&ordenarPor=id"),
        ("eventos", f"/eventos?dataInicio={ano}-01-01&dataFim={ano}-12-31&itens=5"),
        ("votacoes", f"/votacoes?dataInicio={ano}-01-01&dataFim={ano}-12-31&itens=5"),
    ]
    if not rapido:
        testes.extend([
            ("orgaos", "/orgaos?itens=5"),
            ("legislatura_atual", "/legislaturas/57"),
        ])

    os.makedirs(OUT, exist_ok=True)
    resultados = []
    for nome, caminho in testes:
        item = requisitar(API + caminho)
        dado = item.pop("dados", None)
        item["teste"] = nome
        if dado is not None:
            item["estrutura"] = resumir_estrutura(dado)
            if isinstance(dado, dict):
                item["quantidade_dados"] = len(dado.get("dados", [])) if isinstance(dado.get("dados"), list) else None
                item["links"] = dado.get("links")
            with open(os.path.join(OUT, nome + ".json"), "w", encoding="utf-8") as arquivo:
                json.dump(dado, arquivo, ensure_ascii=False, indent=2)
        resultados.append(item)
        print(f"[{item['status'] or 'ERRO'}] {nome}")
        time.sleep(PAUSA)

    pacote = {
        "projeto": "Radar Cívico",
        "modulo": "M0",
        "gerado_em": date.today().isoformat(),
        "python": sys.version.split()[0],
        "somente_leitura": True,
        "resultados": resultados,
    }
    with open(os.path.join(OUT, "resultados.json"), "w", encoding="utf-8") as arquivo:
        json.dump(pacote, arquivo, ensure_ascii=False, indent=2)

    linhas = [
        "RADAR CÍVICO — M0 — DIAGNÓSTICO DA API DA CÂMARA",
        f"Data: {pacote['gerado_em']} | Python: {pacote['python']}",
        f"Testes: {len(resultados)} | HTTP 200: {sum(x['status'] == 200 for x in resultados)}",
        "",
    ]
    for item in resultados:
        linhas.append(
            f"{item['teste']}: HTTP {item['status']} | {item.get('duracao_ms')} ms"
            + (f" | erro: {item['erro']}" if item.get("erro") else "")
        )
        for campo, tipo in item.get("estrutura", {}).items():
            linhas.append(f"  {campo}: {tipo}")
    with open(os.path.join(OUT, "resumo.txt"), "w", encoding="utf-8") as arquivo:
        arquivo.write("\n".join(linhas) + "\n")
    print(f"\nConcluído. Consulte {OUT}/resumo.txt e {OUT}/resultados.json.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Diagnóstico somente de leitura da API da Câmara.")
    parser.add_argument("--rapido", action="store_true", help="Executa apenas os testes essenciais.")
    executar(parser.parse_args().rapido)
