#!/usr/bin/env python3
"""Atualiza os banners dos leilões da Leiloingá.

O site leiloinga.com.br troca o endereço da imagem a cada novo upload, então o link guardado
na agenda fica quebrado. Este script abre a página de cada leilão, pega a imagem de
compartilhamento (og:image), baixa para banners/<id>.<ext> e grava na agenda:
  banner      -> endereço atual no site
  bannerLocal -> cópia no próprio repositório (é a que o sistema usa)
Uso: python3 .github/ferramentas/banners.py   (na raiz do repositório)
"""
import json, os, re, sys, urllib.request

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
AGENDA = os.path.join(RAIZ, "agenda.json")
PASTA = os.path.join(RAIZ, "banners")
UA = {"User-Agent": "Mozilla/5.0 (Leiloinga agenda)"}

def baixa(url, limite=15_000_000):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.headers.get("Content-Type", ""), r.read(limite)

def main():
    with open(AGENDA, encoding="utf-8") as f:
        dados = json.load(f)
    os.makedirs(PASTA, exist_ok=True)
    mudou = False
    for l in dados.get("leiloes", []):
        if l.get("leiloeira") != "Leiloingá" or not l.get("pagina"):
            continue
        try:
            _, html = baixa(l["pagina"], 2_000_000)
            m = re.search(rb'property="og:image"\s+content="([^"]+)"', html) or re.search(rb'content="([^"]+)"\s+property="og:image"', html)
            if not m:
                print("sem og:image:", l["id"]); continue
            url = m.group(1).decode()
            tipo, img = baixa(url)
            if not tipo.startswith("image/") or len(img) < 2000:
                print("imagem inválida:", l["id"], tipo); continue
            ext = {"image/png": "png", "image/webp": "webp"}.get(tipo.split(";")[0], "jpg")
            nome = f"banners/{l['id']}.{ext}"
            caminho = os.path.join(RAIZ, nome)
            antigo = open(caminho, "rb").read() if os.path.exists(caminho) else None
            if antigo != img:
                for velho in os.listdir(PASTA):
                    if velho.startswith(l["id"] + ".") and velho != os.path.basename(nome):
                        os.remove(os.path.join(PASTA, velho))
                with open(caminho, "wb") as f:
                    f.write(img)
                mudou = True
                print("banner novo:", nome)
            generico = len(img) < 60_000  # a foto padrão do site (sem arte do leilão) é pequena
            if l.get("banner") != url or l.get("bannerLocal") != nome or l.get("bannerGenerico") != generico:
                l["banner"], l["bannerLocal"], l["bannerGenerico"] = url, nome, generico
                mudou = True
        except Exception as e:  # um leilão com problema não trava os outros
            print("erro em", l.get("id"), "->", e)
    if mudou:
        with open(AGENDA, "w", encoding="utf-8") as f:
            json.dump(dados, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print("agenda atualizada" if mudou else "nada mudou")

if __name__ == "__main__":
    sys.exit(main())
