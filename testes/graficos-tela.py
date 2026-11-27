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

def pagina(nav, tam="notebook", reduzir=False, escuro=False):
    w, h = TAMANHOS[tam]
    ctx = nav.new_context(viewport={"width": w, "height": h}, reduced_motion="reduce" if reduzir else "no-preference",
                          color_scheme="dark" if escuro else "light")
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

def opcoes(c, campo): return c.locator(f'[data-campo="{campo}"] option').evaluate_all("o=>o.map(x=>x.value)")

def parte_tipos(nav):
    p = pagina(nav); demo(p); c = cartoes(p).first
    campo = lambda n, v: (c.locator(f'[data-campo="{n}"]').select_option(v), parado(p))
    confere("R$/kg só barras e colunas", opcoes(c, "tipo") == ["barras", "colunas"], str(opcoes(c, "tipo")))
    campo("medida", "fat")
    confere("faturamento tem rosca", "rosca" in opcoes(c, "tipo"))
    campo("tipo", "rosca")
    confere("rosca com 3 fatias", c.locator(".gfx-fatia").count() == 3)
    confere("rosca mostra a parte", "%" in c.locator(".gfx-area").inner_text())
    campo("medida", "rkg")
    confere("volta para barras", c.locator('[data-campo="tipo"]').input_value() == "barras" and c.locator(".gfx-barra").count() == 3)
    campo("medida", "fat"); campo("dim", "lote"); campo("tipo", "rosca")
    confere("muitos viram 8 + Outros", c.locator(".gfx-fatia").count() == 9 and "Outros" in c.inner_text(), str(c.locator(".gfx-fatia").count()))
    confere("rosca sem 'ver todos'", not c.locator("[data-todos]").is_visible())
    campo("medida", "rkg"); campo("tipo", "dispersao")
    confere("um ponto por lote vendido", c.locator(".gfx-ponto").count() == 27, str(c.locator(".gfx-ponto").count()))
    c.locator(".gfx-alvo").nth(0).dispatch_event("click")
    t = c.locator(".gfx-info").inner_text()
    confere("toque mostra lote, peso e R$/kg", "Lote 01" in t and "185 kg" in t and "/kg" in t, t)
    confere("destaque em preço e peso", "preço" in c.locator(".gfx-destaque").inner_text() and "pesado" in c.locator(".gfx-destaque").inner_text())
    p.reload(); parado(p); c = cartoes(p).first
    confere("tipo persiste", c.locator('[data-campo="tipo"]').input_value() == "dispersao")
    confere("sem NaN", "NaN" not in p.locator("body").inner_text() and "NaN" not in c.inner_html())
    confere("sem erro de JS", not p.erros, str(p.erros))
    for tam in TAMANHOS:
        t = pagina(nav, tam); demo(t); t.click('[data-atalho="lotes"]'); t.wait_for_timeout(100)
        a, b = cartoes(t).first, cartoes(t).last
        a.locator('[data-campo="medida"]').select_option("fat"); a.locator('[data-campo="dim"]').select_option("vendedor"); a.locator('[data-campo="tipo"]').select_option("rosca")
        b.locator('[data-campo="tipo"]').select_option("dispersao"); t.wait_for_timeout(1700)
        confere(f"rosca e dispersão sem rolagem lateral {tam}", sem_estouro(t))
        t.screenshot(path=str(FOTOS / f"tipos-{tam}.png"), full_page=True)
        confere(f"sem erro {tam}", not t.erros, str(t.erros))

LUZ = """e=>{const m=getComputedStyle(e).color.match(/[0-9.]+/g).map(Number);return (0.299*m[0]+0.587*m[1]+0.114*m[2])/255}"""

def parte_cores(nav):
    p = pagina(nav, "celular", escuro=True); demo(p)
    confere("escuro: texto das caixas de escolha fica claro", cartoes(p).first.locator('[data-campo="dim"]').evaluate(LUZ) > .6)
    p.click(".gfx-filtros summary"); p.locator('[data-filtro="sexo"] button[data-v="M"]').click(); parado(p)
    b = p.locator('[data-filtro="sexo"] button[data-v="M"]')
    confere("escuro: filtro marcado se destaca do cartão", b.evaluate("e=>getComputedStyle(e).backgroundColor!==getComputedStyle(e.closest('.gfx-card')).backgroundColor"))
    cor = "e=>getComputedStyle(e).backgroundColor"
    escura = p.locator(".gfx-barra").first.evaluate(cor)
    q = pagina(nav, "celular"); demo(q)
    confere("barras mudam de tom no escuro", escura != q.locator(".gfx-barra").first.evaluate(cor), escura)
    q.locator('[data-campo="dim"]').select_option("vendedor"); parado(q)
    confere("lista sem ordem fixa usa uma cor só", len(set(q.locator(".gfx-barra").evaluate_all("l=>l.map(e=>getComputedStyle(e).backgroundColor)"))) == 1)
    c = cartoes(p).first
    c.locator('[data-campo="medida"]').select_option("cab"); c.locator('[data-campo="tipo"]').select_option("rosca"); parado(p)
    p.screenshot(path=str(FOTOS / "escuro-rosca.png"), full_page=True)
    c.locator('[data-campo="dim"]').select_option("lote"); c.locator('[data-campo="tipo"]').select_option("dispersao"); c.locator('[data-campo="sub"]').select_option("grupo"); parado(p)
    confere("dispersão por grupo de raça tem legenda", all(x in c.locator(".gfx-legenda").inner_text() for x in ("Branco", "Cruzado", "Britânico")))
    p.screenshot(path=str(FOTOS / "escuro-pontos.png"), full_page=True)
    confere("sem erro no escuro", not p.erros, str(p.erros))

PARTES = {"cartoes": parte_cartoes, "tipos": parte_tipos, "cores": parte_cores}

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
