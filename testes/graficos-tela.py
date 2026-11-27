"""Testes de tela dos gráficos. Uso: python3 testes/graficos-tela.py [parte...]  (precisa do Chrome)."""
import sys, json, base64, threading, functools, http.server, pathlib, time
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

def leilao_inventado(i, sexos="MF", n=12, fase="pos"):
    d = f"2020-0{i}-10"
    s = {"id": f"d{i}", "nome": f"Leilão Inventado {i}", "data": d, "cidade": "Cidade Exemplo", "fase": fase, "quem": ["Pessoa A"],
         "L": [], "st": {}, "la": {}, "qm": {}, "cp": {}, "doa": {}, "encerrado": d + "T20:00:00Z", "alterado": d + "T20:00:00Z",
         "com": {"comp": 4.37, "vend": 3.19, "rural": 41.3, "leil": "Pessoa B", "leilP": 0.5, "cidade": "Cidade Exemplo"}}
    for l in range(1, n + 1):
        s["L"].append({"l": l, "o": l, "q": 5 + l % 4, "s": sexos[l % len(sexos)], "r": "NELORE", "i": "06/12 M", "p": 190 + l * 8, "v": f"Vendedor {l % 3}"})
        s["st"][str(l)] = "V"; s["la"][str(l)] = 700 + i * 100 + l * 7
    return s

def boleta(nav, tam="notebook", pos=None, token=False, rota=None, aba="rel"):
    p = pagina(nav, tam)
    pos = pos or {x["id"]: x for x in (leilao_inventado(1), leilao_inventado(2, "F"))}
    dados = {"leiloinga-boleta-v1": json.dumps({"atual": None, "sess": {}, "pos": pos, "posAtual": None})}
    if token: dados["leiloinga-adm-gh"] = json.dumps({"token": "inventado", "repo": "ADM"})
    p.add_init_script("""(d=>{if(sessionStorage.getItem('posto'))return;sessionStorage.setItem('posto','1');
      localStorage.setItem('leiloinga-trava-geral',String(Date.now()+1e9));for(const k in d)localStorage.setItem(k,d[k])})(""" + json.dumps(dados) + ")")
    if rota: p.context.route("https://api.github.com/**", rota)
    p.goto(f"{BASE}/boleta-nova.html#{aba}")
    if aba == "cmp": p.wait_for_selector(".cmw, .cmpw"); parado(p); return p
    p.wait_for_selector("#leilao option[value=d1]", state="attached")
    p.select_option("#leilao", "d1"); parado(p)
    return p

def parte_boleta(nav):
    p = boleta(nav)
    aperta = lambda v: (p.click(f'[data-ver="{v}"]'), parado(p))
    confere("botões Tabela e Gráficos", [t.split()[-1] for t in textos(p, "[data-ver]")] == ["Tabela", "Gráficos"], str(textos(p, "[data-ver]")))
    confere("tabela é o padrão", p.locator('[data-ver="tabela"]').get_attribute("aria-pressed") == "true" and p.locator("table.rt").count() == 1 and p.locator(".gfx").count() == 0)
    la = p.locator('input.la[data-la="1"]'); la.fill("2000"); la.press("Tab"); parado(p)
    confere("tabela segue editando", p.evaluate("JSON.parse(localStorage.getItem('leiloinga-boleta-v1')).pos.d1.la['1']") == 2000)
    aperta("graficos")
    confere("gráficos na tela, sem tabela", p.locator(".gfx-card").count() == 1 and p.locator("table.rt").count() == 0)
    p.click('[data-atalho="lotes"]'); p.click('[data-atalho="sexo"]'); parado(p); p.wait_for_timeout(900)
    lotes = cartoes(p).nth(1)
    confere("lance da tabela no gráfico", "Lote 01" in lotes.locator(".gfx-linha").first.inner_text() and "30,30" in lotes.locator(".gfx-linha").first.inner_text(), lotes.locator(".gfx-linha").first.inner_text())
    p.set_viewport_size({"width": 1366, "height": 600}); p.evaluate("window.scrollTo(0,300)")
    mesmo = p.evaluate("""()=>{const n=document.querySelector('.gfx-card'),y=scrollY;render();
      return {no:n===document.querySelector('.gfx-card'),anima:document.getAnimations().filter(a=>a.effect.target.closest('.gfx')).length,y,depois:scrollY}}""")
    confere("redesenhar não troca o cartão", mesmo["no"], str(mesmo))
    confere("redesenhar não repete a animação", mesmo["anima"] == 0, str(mesmo))
    confere("redesenhar não pula a tela", mesmo["y"] == mesmo["depois"] and mesmo["y"] > 0, str(mesmo))
    aperta("tabela"); la = p.locator('input.la[data-la="1"]'); la.fill("2500"); la.press("Tab"); parado(p); aperta("graficos")
    confere("lance alterado atualiza", "37,88" in cartoes(p).nth(1).locator(".gfx-linha").first.inner_text(), cartoes(p).nth(1).locator(".gfx-linha").first.inner_text())
    confere("machos e fêmeas no 1º leilão", cartoes(p).nth(2).locator(".gfx-linha").count() == 2)
    p.select_option("#leilao", "d2"); parado(p); p.wait_for_timeout(500)
    sexo = cartoes(p).nth(2)
    confere("trocar de leilão atualiza", sexo.locator(".gfx-linha").count() == 1 and "Fêmea" in sexo.inner_text() and "Macho" not in sexo.locator(".gfx-area").inner_text())
    t = p.locator(".gfx").inner_text().lower()
    confere("comissão não aparece nos gráficos", all(x not in t for x in ("comiss", "4,37", "3,19", "41,3")))
    p.reload(); p.wait_for_selector("#leilao option[value=d1]", state="attached"); p.select_option("#leilao", "d1"); parado(p)
    confere("ao abrir de novo, começa na tabela", p.locator("table.rt").count() == 1)
    confere("sem erro na Boleta", not p.erros, str(p.erros))

    # raças salvas na nuvem e sincronização com um gráfico em uso
    remoto = leilao_inventado(1); novo = {"vale": False}
    def rota(r):
        u = r.request.url
        def manda(o): r.fulfill(status=200, content_type="application/json", body=json.dumps({"sha": "x", "content": base64.b64encode(json.dumps(o).encode()).decode()}), headers={"Access-Control-Allow-Origin": "*"})
        if r.request.method == "GET" and u.split("?")[0].endswith("/contents/racas.json"): return manda({"racas": {"NELORE": "X"}})
        if r.request.method == "GET" and u.split("?")[0].endswith("d1.json") and novo["vale"]: return manda(dict(remoto, alterado="2999-01-01T00:00:00Z"))
        r.fulfill(status=404, body="{}", headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,PUT"})
    q = boleta(nav, token=True, rota=rota)
    q.click('[data-ver="graficos"]'); parado(q)
    confere("usa as raças salvas no ADM", textos(q, ".gfx-rotulo") == ["Britânico"], str(textos(q, ".gfx-rotulo")))
    sel = cartoes(q).first.locator('[data-campo="medida"]'); sel.focus(); novo["vale"] = True
    q.evaluate("async()=>{window._r=0;const o=render;window.render=function(){window._r++;return o.apply(this,arguments)};await puxaNuvem()}")
    confere("nuvem não redesenha com o gráfico em uso", q.evaluate("window._r") == 0 and sel.evaluate("e=>e===document.activeElement"), str(q.evaluate("window._r")))
    confere("sem erro com a nuvem", not q.erros, str(q.erros))

    for tam in TAMANHOS:
        t = boleta(nav, tam); t.click('[data-ver="graficos"]'); parado(t)
        t.click('[data-atalho="lotes"]'); t.click('[data-atalho="faixa"]'); t.wait_for_timeout(1700)
        confere(f"Boleta sem rolagem lateral {tam}", sem_estouro(t))
        t.screenshot(path=str(FOTOS / f"boleta-{tam}.png"), full_page=True)
        confere(f"sem erro {tam}", not t.erros, str(t.erros))

def parte_painel(nav):
    """dentro do painel (menu lateral + quadro), como o Rafael usa"""
    for tam in TAMANHOS:
        p = pagina(nav, tam)
        pos = {x["id"]: x for x in (leilao_inventado(1),)}
        dados = {"leiloinga-boleta-v1": json.dumps({"atual": None, "sess": {}, "pos": pos, "posAtual": None})}
        p.add_init_script("""(d=>{localStorage.setItem('leiloinga-trava-geral',String(Date.now()+1e9));
          for(const k in d)if(!localStorage.getItem(k))localStorage.setItem(k,d[k])})(""" + json.dumps(dados) + ")")
        p.goto(f"{BASE}/sistema-novo.html#pos")
        f = p.frame_locator('iframe[src*="boleta-nova"]')
        f.locator("#leilao option[value=d1]").wait_for(state="attached", timeout=10000)
        f.locator("#leilao").select_option("d1"); parado(p)
        f.locator('[data-ver="graficos"]').click(); parado(p)
        f.locator('[data-atalho="lotes"]').click(); p.wait_for_timeout(1700)
        q = next(x for x in p.frames if "boleta-nova" in x.url)
        confere(f"no painel: gráficos {tam}", f.locator(".gfx-card").count() == 2)
        confere(f"no painel: sem rolagem lateral {tam}", q.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth") and sem_estouro(p))
        p.screenshot(path=str(FOTOS / f"painel-{tam}.png"))
        confere(f"no painel: sem erro {tam}", not p.erros, str(p.erros))

def tres_leiloes():
    return {x["id"]: x for x in (leilao_inventado(1), leilao_inventado(2, "F"), leilao_inventado(3, "M"))}

def parte_comparar(nav):
    p = boleta(nav, pos=tres_leiloes(), aba="cmp")
    confere("gráfico atual continua", p.locator(".gr .bars .bc").count() == 3 and p.locator(".ctb tbody tr").count() == 3)
    confere("cartões abaixo da tabela", p.evaluate("""()=>{const t=document.querySelector('.ctb'),g=document.querySelector('.cmpw .gfx');
      return !!(g&&t.compareDocumentPosition(g)&Node.DOCUMENT_POSITION_FOLLOWING)}"""))
    caixas = p.locator("input[data-leilao]")
    confere("todos marcados", caixas.count() == 3 and all(caixas.nth(i).is_checked() for i in range(3)))
    confere("nome do leilão na escolha", "Leilão Inventado 2" in p.locator(".gfx-leiloes").inner_text())
    p.click('[data-atalho="sexo"]'); parado(p)
    macho = lambda: cartoes(p).last.locator('.gfx-linha[data-chave="M"]').inner_text()
    confere("soma os leilões", "18 lotes" in macho(), macho())
    p.locator('input[data-leilao="d3"]').uncheck(); parado(p)
    confere("desmarcar muda os valores", "6 lotes" in macho() and "18" not in macho(), macho())
    p.reload(); p.wait_for_selector(".cmpw .gfx"); parado(p)
    confere("escolha persiste", not p.locator('input[data-leilao="d3"]').is_checked() and "6 lotes" in macho())
    y = p.evaluate("()=>{scrollTo(0,document.body.scrollHeight);return scrollY}")
    mesmo = p.evaluate("""()=>{const n=document.querySelector('.gfx-card');render();
      return {no:n===document.querySelector('.gfx-card'),anima:document.getAnimations().filter(a=>a.effect.target.closest('.gfx')).length,y:scrollY}}""")
    confere("redesenhar não troca nem reanima", mesmo["no"] and mesmo["anima"] == 0, str(mesmo))
    confere("redesenhar não pula a tela", abs(mesmo["y"] - y) < 2 and y > 0, f"{y} {mesmo}")
    for i in ("d1", "d2"): p.locator(f'input[data-leilao="{i}"]').uncheck()
    parado(p)
    confere("nenhum marcado: sem dados", all("Sem dados para esse cruzamento" in t for t in textos(p, ".gfx-card")))
    for i in ("d1", "d2", "d3"): p.locator(f'input[data-leilao="{i}"]').check()
    p.click('[data-atalho="lotes"]'); parado(p)
    confere("lote traz a data", "· 10/0" in cartoes(p).last.locator(".gfx-rotulo").first.inner_text(), cartoes(p).last.locator(".gfx-rotulo").first.inner_text())
    p.click('[data-met="mk"]'); parado(p)
    confere("botões de cima seguem funcionando", p.locator('[data-met="mk"]').get_attribute("aria-pressed") == "true" and cartoes(p).count() == 3)
    confere("sem comissão", all(x not in p.locator(".gfx").inner_text().lower() for x in ("comiss", "4,37", "3,19", "41,3")))
    confere("sem erro no comparar", not p.erros, str(p.erros))

    # leilão trazido da nuvem entra marcado
    novo = leilao_inventado(4); novo["id"] = "2020-04-10-inventado"
    def rota(r):
        u = r.request.url.split("?")[0]; h = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*"}
        def manda(o): r.fulfill(status=200, content_type="application/json", body=json.dumps(o), headers=h)
        for pasta in ("boletas", "pos"):
            if u.endswith("/contents/" + pasta): return manda([{"name": novo["id"] + ".json", "path": f"{pasta}/{novo['id']}.json"}])
        if u.endswith(novo["id"] + ".json") and r.request.method == "GET": return manda({"sha": "x", "content": base64.b64encode(json.dumps(novo).encode()).decode()})
        r.fulfill(status=404, body="{}", headers=h)
    q = boleta(nav, token=True, rota=rota, aba="cmp")
    q.wait_for_selector("#cNuv"); confere("antes: 2 leilões", q.locator("input[data-leilao]").count() == 2)
    q.locator('input[data-leilao="d2"]').uncheck(); q.click("#cNuv"); parado(q); parado(q)
    c = q.locator(f'input[data-leilao="{novo["id"]}"]')
    confere("da nuvem entra marcado", c.count() == 1 and c.is_checked() and not q.locator('input[data-leilao="d2"]').is_checked())
    confere("sem erro com a nuvem no comparar", not q.erros, str(q.erros))

    for tam in TAMANHOS:
        muitos = {x["id"]: x for x in (leilao_inventado(i) for i in range(1, 10))}
        t = boleta(nav, tam, pos=muitos, aba="cmp"); t.click('[data-atalho="lotes"]'); t.click('[data-atalho="raca"]'); t.wait_for_timeout(1700)
        confere(f"comparar sem rolagem lateral {tam}", sem_estouro(t))
        t.screenshot(path=str(FOTOS / f"comparar-{tam}.png"), full_page=True)
        confere(f"sem erro comparar {tam}", not t.erros, str(t.erros))

SEM_FEMEA_NO_MEIO = "()=>G.atualizar(REGS.filter(r=>!(r.leilao==='demo1'&&r.sexo==='F')))"

def parte_tempo(nav):
    p = pagina(nav); demo(p, "rel")
    confere("linha do tempo não aparece no relatório", p.locator('[data-atalho="tempo"]').count() == 0 and "linha" not in opcoes(cartoes(p).first, "tipo"))
    p = pagina(nav); demo(p, "cmp")
    p.click('[data-atalho="tempo"]'); p.wait_for_timeout(60)
    c = cartoes(p).last
    quadros = p.evaluate("""()=>[...document.querySelectorAll('.gfx-traco')].flatMap(e=>e.getAnimations()).map(a=>{const k=a.effect.getKeyframes();return [parseFloat(k[0].strokeDashoffset),parseFloat(k[k.length-1].strokeDashoffset)]})""")
    confere("linha desenha da esquerda para a direita", quadros and all(a > 0 and b == 0 for a, b in quadros), str(quadros))
    parado(p); p.wait_for_timeout(500)
    campo = lambda n, v: (c.locator(f'[data-campo="{n}"]').select_option(v), parado(p))
    confere("atalho: sexo, R$/kg, linha", [c.locator(f'[data-campo="{n}"]').input_value() for n in ("dim", "medida", "tipo")] == ["sexo", "rkg", "linha"])
    confere("categorias da linha do tempo", opcoes(c, "dim") == ["grupo", "raca", "sexo", "faixa", "idade"], str(opcoes(c, "dim")))
    confere("sem 'dividir por' na linha do tempo", not c.locator('[data-campo="sub"]').is_visible())
    confere("uma linha por categoria", c.locator(".gfx-serie-t").count() == 2)
    confere("um ponto por leilão", c.locator('.gfx-serie-t[data-chave="M"] .gfx-no').count() == 3 and c.locator('.gfx-serie-t[data-chave="M"] .gfx-traco').count() == 1)
    t = c.inner_text()
    confere("legenda mostra a variação", ("▲" in t or "▼" in t) and "%" in t, t)
    confere("destaque do último leilão", "10/03" in c.locator(".gfx-destaque").inner_text(), c.locator(".gfx-destaque").inner_text())
    c.locator(".gfx-faixa").nth(0).dispatch_event("click")
    t = c.locator(".gfx-info").inner_text()
    confere("toque mostra o leilão", all(x in t for x in ("10/01/2020", "Macho", "Fêmea", "/kg")), t)
    c.locator('.gfx-item[data-chave="F"]').click()
    confere("legenda destaca a linha", "gfx-apagada" in c.locator('.gfx-serie-t[data-chave="M"]').get_attribute("class")
            and "gfx-apagada" not in c.locator('.gfx-serie-t[data-chave="F"]').get_attribute("class"))
    p.evaluate(SEM_FEMEA_NO_MEIO); parado(p)
    f = c.locator('.gfx-serie-t[data-chave="F"]')
    confere("leilão sem venda não tem ponto nem linha caindo", f.locator(".gfx-no").count() == 2 and f.locator(".gfx-traco").count() == 0, f"{f.locator('.gfx-no').count()} {f.locator('.gfx-traco').count()}")
    p.evaluate("()=>G.atualizar(REGS)"); parado(p)
    campo("tipo", "colunasTempo")
    confere("colunas por leilão", c.locator(".gfx-colunas .gfx-barra").count() == 6, str(c.locator(".gfx-barra").count()))
    confere("leilões na ordem das datas", c.locator(".gfx-rotulo").all_inner_texts() == ["10/01/2020", "10/02/2020", "10/03/2020"], str(c.locator(".gfx-rotulo").all_inner_texts()))
    p.reload(); parado(p); c = cartoes(p).last
    confere("linha do tempo persiste", c.locator('[data-campo="tipo"]').input_value() == "colunasTempo")
    campo("tipo", "barras")
    confere("volta para barras", c.locator(".gfx-barras .gfx-barra").count() == 2 and c.locator('[data-campo="sub"]').is_visible())
    campo("dim", "vendedor")
    confere("vendedor não vira linha do tempo", "linha" not in opcoes(c, "tipo"))
    campo("dim", "raca"); campo("tipo", "linha")
    confere("raça em linha", c.locator(".gfx-serie-t").count() == 3)
    confere("sem NaN na linha do tempo", "NaN" not in c.inner_html())
    confere("sem erro na linha do tempo", not p.erros, str(p.erros))

    u = pagina(nav); demo(u, "cmp", "&leiloes=1"); u.click('[data-atalho="tempo"]'); parado(u); u.wait_for_timeout(500)
    c = cartoes(u).last
    confere("um leilão: pontos e aviso", c.locator(".gfx-no").count() == 2 and "Com um leilão só ainda não dá para ver evolução" in c.inner_text())
    confere("um leilão: sem erro", not u.erros and "NaN" not in c.inner_html(), str(u.erros))

    r = pagina(nav, reduzir=True); demo(r, "cmp"); r.click('[data-atalho="tempo"]'); r.wait_for_timeout(40)
    d = r.evaluate("document.getAnimations().map(a=>a.effect.getTiming().duration+a.effect.getTiming().delay)")
    confere("movimento reduzido na linha do tempo", all(x <= 150 for x in d), str(d))

    q = pagina(nav); q.add_init_script("""localStorage.setItem('leiloinga-graficos-v1',JSON.stringify({rel:[{dim:'sexo',medida:'rkg',tipo:'linha'}],cmp:[{dim:'vendedor',medida:'rkg',tipo:'linha'}],cmpFora:'x'}))""")
    for ctx in ("rel", "cmp"):
        demo(q, ctx); confere(f"configuração estranha vira barras ({ctx})", cartoes(q).first.locator('[data-campo="tipo"]').input_value() == "barras")
    confere("sem erro com configuração estranha", not q.erros, str(q.erros))

    for tam in TAMANHOS:
        t = pagina(nav, tam); demo(t, "cmp", "&leiloes=12"); t.click('[data-atalho="tempo"]'); t.wait_for_timeout(100)
        t.click('[data-atalho="tempo"]'); b = cartoes(t).last; b.locator('[data-campo="tipo"]').select_option("colunasTempo"); b.locator('[data-campo="dim"]').select_option("faixa"); t.wait_for_timeout(1700)
        confere(f"datas sem encavalar {tam}", not t.evaluate(SOBREPOE.replace("els.some(e=>e.scrollWidth>e.clientWidth+1)", "false"), ".gfx-data"))
        confere(f"última data aparece {tam}", "10/12" in " ".join(t.locator(".gfx-data").all_text_contents()))
        confere(f"colunas do tempo não encavalam {tam}", not t.evaluate(SOBREPOE, ".gfx-colunas .gfx-valor"))
        confere(f"linha do tempo sem rolagem lateral {tam}", sem_estouro(t))
        t.screenshot(path=str(FOTOS / f"tempo-{tam}.png"), full_page=True)
        confere(f"sem erro tempo {tam}", not t.erros, str(t.erros))

PARTES = {"cartoes": parte_cartoes, "tipos": parte_tipos, "cores": parte_cores, "boleta": parte_boleta, "painel": parte_painel, "comparar": parte_comparar, "tempo": parte_tempo}

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
