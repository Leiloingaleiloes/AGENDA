"""Gera um PDF "Ordem de entrada" no mesmo formato do sistema da Leiloingá,
a partir de um JSON com os lotes (por exemplo, transcritos de uma foto da lista).
O PDF sai com texto de verdade, para a página fichas.html do Painel ler.

Uso: python3 ordem_pdf.py lotes.json saida.pdf
JSON: {"leilao": "...", "data": "dd/mm/aaaa",
       "lotes": [{"ord":1,"lote":"001","qtde":3,"sexo":"M","vendedor":"...",
                  "idade":"18 A 20 M","raca":"1/2 TABAPUÃ","peso":328}, ...]}
"""
import json, os, sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

def fonte():
    for n, a in [("F", "liberation/LiberationSans-Regular.ttf"), ("FB", "liberation/LiberationSans-Bold.ttf")]:
        for base in ["/usr/share/fonts/truetype/"]:
            if os.path.exists(base + a):
                pdfmetrics.registerFont(TTFont(n, base + a))

def main(src, dst):
    d = json.load(open(src, encoding="utf-8"))
    fonte()
    W, H = A4
    c = canvas.Canvas(dst, pagesize=A4)
    c.setTitle("Ordem de entrada")
    X = dict(ord=30, lote=58, qtde=104, sx=110, vend=124, idade=318, raca=380, peso=505)
    lotes = d["lotes"]
    por_pag = 46
    pags = [lotes[i:i + por_pag] for i in range(0, len(lotes), por_pag)] or [[]]
    for pi, pag in enumerate(pags):
        c.setFont("FB", 11); c.drawCentredString(W / 2, H - 50, d.get("leilao", "ORDEM DE ENTRADA"))
        c.setFont("FB", 10); c.drawCentredString(W / 2, H - 64, d.get("data", ""))
        c.setFont("FB", 11); c.drawCentredString(W / 2, H - 80, "ORDEM DE ENTRADA")
        y = H - 100
        c.setFont("F", 8)
        for k, t in [("ord", "Ord."), ("lote", "Lote"), ("qtde", "Qtde"), ("vend", "Vendedor"), ("idade", "Idade"), ("raca", "Raça"), ("peso", "Peso(Kg)")]:
            c.drawString(X[k] if k != "qtde" else X["qtde"] - 18, y, t)
        c.drawString(X["sx"], y, "Sx")
        c.line(25, y - 4, W - 25, y - 4)
        y -= 16
        for r in pag:
            c.setFont("F", 8)
            c.drawRightString(X["ord"] + 12, y, str(r.get("ord") or ""))
            c.drawString(X["lote"], y, str(r.get("lote") or "").zfill(3))
            c.drawRightString(X["qtde"], y, str(r.get("qtde") or ""))
            c.drawString(X["sx"], y, r.get("sexo") or "")
            c.drawString(X["vend"], y, (r.get("vendedor") or "").upper())
            c.setFont("F", 7)
            c.drawString(X["idade"], y, (r.get("idade") or "").upper())
            c.drawString(X["raca"], y, (r.get("raca") or "").upper())
            c.setFont("F", 8)
            c.drawString(X["peso"], y, str(r.get("peso") or ""))
            c.setLineWidth(0.3); c.line(25, y - 4, W - 25, y - 4)
            y -= 15
        if pi == len(pags) - 1:
            tot = sum(int(r.get("qtde") or 0) for r in lotes)
            m = sum(int(r.get("qtde") or 0) for r in lotes if r.get("sexo") == "M")
            c.setFont("FB", 9)
            c.drawString(30, y - 6, f"Total de Animais: {tot}")
            c.drawString(230, y - 6, f"Total Machos: {m}")
            c.drawString(420, y - 6, f"Total Fêmeas: {tot - m}")
        c.showPage()
    c.save()

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
