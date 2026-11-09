import json, re, unicodedata, datetime, collections, sys
src, out = sys.argv[1], sys.argv[2]
d = json.load(open(src))
A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
def ts(code):
    n = 0
    for ch in code[:11]: n = n*64 + A.index(ch)
    return datetime.datetime.utcfromtimestamp(((n >> 23) + 1314220021721)/1000)
def sem(s): return ''.join(c for c in unicodedata.normalize('NFD', s) if unicodedata.category(c) != 'Mn').lower()
CIDADES = ["Laranjeiras do Sul","Nova Laranjeiras","Cantagalo","Palmital","Marquinho","Guaraniaçu","Guarariaçu","Toledo","Ivaiporã","Porto Barreiro","Rio Bonito do Iguaçu","Virmond","Candói","Goioxim","Campina do Simão","Pitanga","Quedas do Iguaçu","Espigão Alto do Iguaçu","Diamante do Sul","Catanduvas","Ibema","Três Barras do Paraná","Nova Cantu","Laranjal","Guarapuava","Cascavel","Reserva do Iguaçu","Pinhão","Mato Rico","Roncador","Boa Ventura de São Roque","Turvo","Altamira do Paraná","Manoel Ribas","Santa Maria do Oeste","Prudentópolis","Corbélia","Campo Bonito","Foz do Jordão"]
CS = [(c, sem(c)) for c in CIDADES]
MES = {m:i+1 for i,m in enumerate(['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])}
res = []
for x in d:
    t = x['alt'] or ''; s = sem(t); pub = ts(x['c'])
    evento = re.search(r'leil[aã]o|leiloes|feira|remate|oferta de gado|venda especial', s)
    quando = re.search(r'🗓|📅|⏰|\b\d{1,2}/\d{1,2}\b|\b\d{1,2} de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)|\bhoje\b|amanha|domingo|sabado|\d{1,2}h\b|\d{1,2}:\d{2}', s)
    resultado = re.search(r'movimenta|faturou|faturamento|marcaram|marcou|foi um sucesso|agradec|obrigad|parabens|feliz natal|feliz ano|ferias coletivas|completa \d+ anos|celebrar \d+ anos', s)
    convite = re.search(r'\bhoje\b|amanha|vem ai|participe|prepare|convid|anote|faltam?\b|grande dia|neste (sabado|domingo|sexta|quarta|quinta)|nesta (quarta|quinta|sexta)|transmissao ao vivo|lances|nao perca|garanta|esperamos|venha', s)
    tipo = 'propaganda' if (evento and quando and (convite or not resultado)) else ('resultado/outros' if evento else 'outros')
    # cidade: prioriza linha com 📍
    cid = None
    loc = re.search(r'📍([^\n]*)', t)
    for zona in ([sem(loc.group(1))] if loc else []) + [s]:
        best = None
        for c, cs in CS:
            i = zona.find(cs)
            if i >= 0 and (best is None or i < best[0] or (i == best[0] and len(cs) > len(best[2]))): best = (i, c, cs)
        if best:
            # "laranjeiras do sul" contém em "nova laranjeiras"? tratar
            cid = 'Guaraniaçu' if best[1]=='Guarariaçu' else best[1]; break
    # data do leilão
    dl = None
    m = re.search(r'\b(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?\b', s)
    if m:
        dd, mm, yy = int(m.group(1)), int(m.group(2)), m.group(3)
        if 1 <= dd <= 31 and 1 <= mm <= 12: dl = (dd, mm, int(yy) if yy else None)
    if not dl:
        m = re.search(r'\b(\d{1,2}) de (janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?: de (\d{4}))?', s)
        if m: dl = (int(m.group(1)), MES[m.group(2)], int(m.group(3)) if m.group(3) else None)
    data = None
    if dl:
        dd, mm, yy = dl
        if yy and yy < 100: yy += 2000
        if not yy:
            yy = pub.year
            try:
                if datetime.date(yy, mm, dd) < pub.date() - datetime.timedelta(days=20): yy += 1
            except ValueError: pass
        try: data = datetime.date(yy, mm, dd).isoformat()
        except ValueError: data = None
    nome = None
    m = re.search(r'(\d+\s*[ºª°]?\s*)?(leil[ãa]o|feira)[^\n!.,:]{0,70}', t, re.I)
    if m: nome = re.sub(r'\s+', ' ', m.group(0)).strip(' -–')
    res.append({"codigo": x['c'], "tipo_post": x['k'], "publicado": pub.date().isoformat(), "categoria": tipo, "cidade": cid, "data_leilao": data, "nome": nome, "legenda": t})
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
c = collections.Counter(r['categoria'] for r in res); print(c)
p = [r for r in res if r['categoria'] == 'propaganda']
print('sem cidade', sum(1 for r in p if not r['cidade']), 'sem data', sum(1 for r in p if not r['data_leilao']))
print(collections.Counter(r['cidade'] for r in p).most_common())
print('anos', collections.Counter(r['publicado'][:4] for r in res))
