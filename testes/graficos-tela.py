"""Testes de tela dos gráficos. Uso: python3 testes/graficos-tela.py [parte...]  (precisa do Chrome)."""
import sys, json, threading, functools, http.server, pathlib, time
from playwright.sync_api import sync_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
FOTOS = RAIZ / ".superpowers" / "telas"
TAMANHOS = {"celular": (390, 844), "tablet-em-pe": (820, 1180), "tablet-deitado": (1180, 820), "notebook": (1366, 768)}

class Quieto(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Quieto, directory=str(RAIZ)))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{srv.server_port}"
falhas, feitos = [], 0

def confere(nome, cond, extra=""):
    global feitos
    feitos += 1
    if not cond: falhas.append(f"{nome} {extra}".strip())

def pagina(nav, tam="notebook", reduzir=False):
    w, h = TAMANHOS[tam]
    ctx = nav.new_context(viewport={"width": w, "height": h}, reduced_motion="reduce" if reduzir else "no-preference")
    # nada de internet nos testes
    ctx.route("**/*", lambda r: r.continue_() if r.request.url.startswith(BASE) else r.abort())
    p = ctx.new_page(); p.erros = []; p.set_default_timeout(4000)
    p.on("pageerror", lambda e: p.erros.append(str(e)))
    return p

SOBREPOE = """sel=>{const els=[...document.querySelectorAll(sel)];
  if(els.some(e=>e.scrollWidth>e.clientWidth+1))return true;
  const r=els.map(e=>e.getBoundingClientRect());
  return r.some((a,i)=>r.some((b,j)=>j>i&&a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1))}"""
def sem_estouro(p): return p.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth")
def cartoes(p): return p.locator(".gfx-card")
def parado(p): p.wait_for_timeout(900)
def textos(p, sel): return p.locator(sel).all_inner_texts()

def demo(p, ctx="rel", extra=""):
    p.goto(f"{BASE}/testes/graficos-demo.html?ctx={ctx}{extra}"); parado(p)

def parte_cartoes(nav):
    p = pagina(nav); demo(p)
    confere("primeiro uso: 1 cartão", cartoes(p).count() == 1)
    confere("padrão grupo × R$/kg", p.locator('[data-campo="dim"]').input_value() == "grupo" and p.locator('[data-campo="medida"]').input_value() == "rkg")
    confere("destaque aparece", "Destaque" in p.locator(".gfx-destaque").inner_text())
    confere("barras mostram nº de lotes", all("lote" in t for t in textos(p, ".gfx-linha")))
    esperado = {"raca": "grupo", "sexo": "sexo", "faixa": "faixa", "lotes": "lote"}
    for i, (atalho, dim) in enumerate(esperado.items()):
        p.click(f'[data-atalho="{atalho}"]'); parado(p)
        ult = cartoes(p).last
        confere(f"atalho {atalho}", cartoes(p).count() == i + 2 and ult.locator('[data-campo="dim"]').input_value() == dim
                and ult.locator('[data-campo="medida"]').input_value() == "rkg")
    ult = cartoes(p).last
    confere("por lote: 10 barras", ult.locator(".gfx-barra").count() == 10)
    ult.locator("[data-todos]").click(); parado(p)
    confere("ver todos", ult.locator(".gfx-barra").count() == 27, str(ult.locator(".gfx-barra").count()))
    ids = p.eval_on_selector_all(".gfx-card", "e=>e.map(c=>c.dataset.id)")
    cartoes(p).nth(1).locator("[data-excluir]").click(); parado(p)
    confere("excluir", cartoes(p).count() == 4)
    p.click("[data-desfazer]"); parado(p)
    confere("desfazer volta na mesma posição", p.eval_on_selector_all(".gfx-card", "e=>e.map(c=>c.dataset.id)") == ids)
    p.reload(); parado(p)
    confere("recarregar mantém", p.eval_on_selector_all(".gfx-card", "e=>e.map(c=>c.dataset.id)") == ids)
    while cartoes(p).count():
        cartoes(p).first.locator("[data-excluir]").click(); p.wait_for_timeout(350)
    p.reload(); parado(p)
    confere("vazio continua vazio", cartoes(p).count() == 0)
    p.click("[data-add]"); parado(p)
    c = cartoes(p).first
    c.locator('[data-campo="dim"]').select_option("comprador"); parado(p)
    confere("sem dados", "Sem dados para esse cruzamento" in c.inner_text())
    confere("sem dados não tem destaque", not c.locator(".gfx-destaque").is_visible())
    c.locator('[data-campo="dim"]').select_option("sexo"); c.locator('[data-campo="medida"]').select_option("cab"); parado(p)
    antes = textos(p, ".gfx-valor")
    c.locator("summary").click(); c.locator('[data-filtro="grupo"] button[data-v="B"]').click(); parado(p)
    depois = textos(p, ".gfx-valor")
    confere("filtro muda valores", antes != depois, f"{antes} {depois}")
    p.reload(); parado(p)
    confere("filtro persiste", textos(p, ".gfx-valor") == depois)
    c = cartoes(p).first
    c.locator('[data-campo="sub"]').select_option("faixa"); parado(p)
    confere("subdivisão cria mais barras", c.locator(".gfx-barra").count() > 2)
    c.locator('[data-campo="tipo"]').select_option("colunas"); parado(p)
    confere("colunas", c.locator(".gfx-colunas .gfx-barra").count() > 2)
    confere("sem NaN", "NaN" not in p.locator("body").inner_text())
    confere("sem erro de JS", not p.erros, str(p.erros))
    # configuração estragada
    p.evaluate("localStorage.setItem('leiloinga-graficos-v1','{quebrado')"); p.reload(); parado(p)
    confere("configuração estragada volta ao padrão", cartoes(p).count() == 1 and not p.erros, str(p.erros))
    p.evaluate("localStorage.setItem('leiloinga-graficos-v1',JSON.stringify({rel:[null,{dim:'x'}]}))"); p.reload(); parado(p)
    confere("configuração antiga volta ao padrão", cartoes(p).count() == 1 and not p.erros, str(p.erros))
    # animação: a barra cresce e não repete ao reencaixar
    p.evaluate("localStorage.clear()"); p.reload(); p.wait_for_timeout(60)
    confere("barra animando", p.evaluate("[...document.querySelectorAll('.gfx-barra')].some(b=>b.getAnimations().length>0)"))
    parado(p)
    repetiu = p.evaluate("""()=>{const b=document.querySelector('.gfx-barra');G.no.remove();document.body.appendChild(G.no);G.atualizar(REGS.slice());
        return b!==document.querySelector('.gfx-barra')||G.no.getAnimations({subtree:true}).length>0}""")
    confere("reencaixar não reinicia", not repetiu)
    r = pagina(nav, reduzir=True); r.goto(f"{BASE}/testes/graficos-demo.html"); r.wait_for_timeout(40)
    dur = r.evaluate("Math.max(0,...document.getAnimations().map(a=>a.effect.getTiming().duration))")
    confere("movimento reduzido", dur <= 150, str(dur))
    for tam in TAMANHOS:
        t = pagina(nav, tam); demo(t)
        for a in ["sexo", "lotes"]: t.click(f'[data-atalho="{a}"]'); t.wait_for_timeout(100)
        c = cartoes(t).last
        c.locator('[data-campo="dim"]').select_option("vendedor"); c.locator('[data-campo="sub"]').select_option("grupo"); parado(t)
        confere(f"sem rolagem lateral {tam}", sem_estouro(t))
        t.screenshot(path=str(FOTOS / f"cartoes-{tam}.png"), full_page=True)
        c.locator('[data-campo="tipo"]').select_option("colunas"); parado(t)
        confere(f"colunas sem rolagem lateral {tam}", sem_estouro(t))
        t.screenshot(path=str(FOTOS / f"colunas-{tam}.png"), full_page=True)
        confere(f"valores das colunas não se sobrepõem {tam}", not t.evaluate(SOBREPOE, ".gfx-colunas .gfx-valor"))
        c.locator('[data-campo="medida"]').select_option("fat"); parado(t)
        confere(f"faturamento nas colunas não se sobrepõe {tam}", not t.evaluate(SOBREPOE, ".gfx-colunas .gfx-valor"))
        cols = t.eval_on_selector_all(".gfx-card", "e=>new Set(e.map(c=>Math.round(c.getBoundingClientRect().left))).size")
        confere(f"colunas de cartões {tam}", cols == (2 if TAMANHOS[tam][0] >= 900 else 1), str(cols))
        confere(f"sem erro {tam}", not t.erros, str(t.erros))

PARTES = {"cartoes": parte_cartoes}

if __name__ == "__main__":
    FOTOS.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        nav = pw.chromium.launch(channel="chrome")
        for nome in (sys.argv[1:] or PARTES):
            try: PARTES[nome](nav)
            except Exception as e: falhas.append(f"{nome} interrompido: {str(e).splitlines()[0]}")
        nav.close()
    for f in falhas: print("FALHOU:", f)
    print(f"{feitos - len([f for f in falhas if 'interrompido' not in f])}/{feitos} verificações ok, {len(falhas)} falha(s)")
    sys.exit(1 if falhas else 0)
