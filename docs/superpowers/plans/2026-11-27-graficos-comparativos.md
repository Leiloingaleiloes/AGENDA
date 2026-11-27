# Gráficos comparativos dos leilões Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gráficos animados, escolhidos pelo usuário, no Relatório pós-leilão (um leilão) e no Comparar leilões (vários leilões e linha do tempo).

**Architecture:** As contas ficam em um módulo puro, sem tela (`graficos-dados.js`), testado com Node. O desenho fica em `graficos.js` + `graficos.css`, com DOM e SVG. `boleta-nova.html` só entrega os leilões e reencaixa o mesmo nó de gráficos a cada redesenho.

**Tech Stack:** HTML, CSS e JS puro, sem build e sem biblioteca de gráficos. Testes: `node --test` (Node 22) e Playwright para Python com o Chrome do sistema (`channel="chrome"`).

**Spec:** https://claude.ai/artifact/EHdbSjJHeLLGHU1wkKFWdr ("Plano: gráficos comparativos dos leilões")

## Global Constraints

- Ler `CLAUDE.md` do repositório. Textos em português do Brasil, sem jargão.
- Repositório público: nenhum dado real de leilão, nome de pessoa, valor ou percentual de comissão em código, testes ou exemplos.
- Entram só lotes vendidos (`st[l]==="V"`), inclusive doação. Retorno e sem marcação ficam fora.
- Valor do lote = `lance × 3 × q`. R$/kg do lote = `lance × 3 / p`. R$/kg do grupo = média dos lotes (ignora o seletor "por kg vendido").
- Valor por cabeça = faturamento ÷ cabeças. Peso médio = soma(`q × p`) ÷ cabeças.
- Faixas de peso: até 200, 200/250, 250/300, +300 kg.
- Idade, pela maior idade registrada: até 12, 12 a 18, 18 a 24, mais de 24 meses.
- Britânico: só puros (Angus, Brangus, Braford, Hereford, Devon). O ½ sangue deles é cruzado. ½ Tabapuã continua branco.
- Os gráficos nunca mostram comissão.
- Animação sempre; com `prefers-reduced-motion`, só um esmaecer de até 150 ms.
- Nada passa da largura em 390×844, 820×1180, 1180×820 e 1366×768.
- Nunca push direto na `main`: branch `graficos-comparativos`, PR para o Rafael aprovar.
- Relatório por categoria, PDF e contas já existentes não mudam.

## Review Focus

1. Lote vendido sem lance ou sem peso: fica fora das medidas que dependem do dado, com aviso; nunca aparece `NaN` (Tarefa 2).
2. Leilão sem venda ou filtro que não sobra nada: "Sem dados para esse cruzamento", sem destaque (Tarefas 2 e 3).
3. Sincronização redesenha a tela a cada 10 s: cartões não reiniciam, a animação não repete e a lista aberta não fecha (Tarefa 5).
4. Muitos grupos e nomes longos no celular: 10 primeiros e "Ver todos", rosca com "Outros", sem rolagem lateral (Tarefas 3 e 4).
5. Configuração salva estragada ou antiga: volta ao padrão sem quebrar a Boleta (Tarefa 2).

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `graficos-dados.js` (novo) | Registros, classificação, somas, séries, validação da configuração |
| `graficos.js` (novo) | Cartões, atalhos, tipos de gráfico, animação, salvar no aparelho |
| `graficos.css` (novo) | Aparência |
| `boleta-nova.html` | Ligar nas telas `relatorio(m)` e `comparar(m)` |
| `testes/graficos-dados.test.js` (novo) | Testes das contas |
| `testes/graficos-tela.py` e `testes/graficos-demo.html` (novos) | Testes de tela com leilões inventados |

---

## Etapa 1: Relatório pós-leilão

### Task 1: Registros e classificação

**Files:** Create `graficos-dados.js`, `testes/graficos-dados.test.js`

**Interfaces:**
- Produces: `window.GraficosDados` e `module.exports` com o mesmo objeto.
- `chaveRaca(r: string): string` (igual a `relatorio-novo.html`: sem acento, maiúscula, `½` vira `1/2 `)
- `grupoRaca(raca: string, salvas: object): "B"|"C"|"X"|null` (`X` = britânico)
- `faixaPeso(p): "200"|"250"|"300"|"+300"|null`
- `grupoIdade(txt): "12"|"18"|"24"|"+24"|null`
- `registros(sessao, salvas): Reg[]`, com `Reg = {leilao, data, lote, ordem, q, sexo, raca, grupo, idade, faixa, peso, lance, vendedor, comprador, pisteiro}`; campos vazios são `null`.

- [ ] **Step 1: Escrever os testes**

```js
const test=require('node:test'),assert=require('node:assert/strict'),G=require('../graficos-dados.js');
test('britanico so puro',()=>{
  for(const r of ['ANGUS','Brangus','BRAFORD','HEREFORD','DEVON']) assert.equal(G.grupoRaca(r,{}),'X',r);
  for(const r of ['½ ANGUS','1/2 BRANGUS','½ BRAFORD']) assert.equal(G.grupoRaca(r,{}),'C',r);
  assert.equal(G.grupoRaca('BRANGUS',{BRANGUS:'C'}),'X');
});
test('brancos e escolhas salvas',()=>{
  assert.equal(G.grupoRaca('NELORE',{}),'B');
  assert.equal(G.grupoRaca('½ TABAPUÃ',{}),'B');
  assert.equal(G.grupoRaca('ANELORADOS',{ANELORADOS:'C'}),'C');
  assert.equal(G.grupoRaca('',{}),null);
});
test('faixas e idades',()=>{
  assert.deepEqual([200,201,250,300,301,0].map(G.faixaPeso),['200','250','250','300','+300',null]);
  assert.deepEqual(['06/12 M','15/18 M','18/24 M','24/30 M','+36 M','12-15m',''].map(G.grupoIdade),['12','18','24','+24','+24','18',null]);
});
test('so vendidos, doacao entra, sem comissao',()=>{
  const s={id:'a',data:'2026-01-10',com:{comp:1},st:{1:'V',2:'R',4:'V'},la:{1:10,2:9},doa:{1:true},cp:{},qm:{1:'Ana'},
    L:[1,2,3,4].map(l=>({l,o:l,q:10,s:'M',r:'NELORE',i:'06/12 M',p:200,v:''}))};
  const r=G.registros(s,{});
  assert.deepEqual(r.map(x=>x.lote),[1,4]);
  assert.equal(r[1].lance,null);assert.equal(r[0].vendedor,null);assert.equal(r[0].pisteiro,'Ana');
  assert.ok(!JSON.stringify(r).includes('com'+'p":1'));
});
```

- [ ] **Step 2:** `node --test testes/graficos-dados.test.js` → FAIL (`Cannot find module`).
- [ ] **Step 3:** Implementar as funções da Interface. Precedência em `grupoRaca`: britânico puro (nome exato, aceitando "ABERDEEN ANGUS", "RED ANGUS" e sufixo "PURO"/"PO"), depois `salvas[chave]`, depois as listas `RACA_PADRAO` e `palpite` copiadas de `relatorio-novo.html`.
- [ ] **Step 4:** `node --test testes/graficos-dados.test.js` → PASS.
- [ ] **Step 5:** Commit `graficos: registros e classificação`.

### Task 2: Somas, destaque, séries e configuração

**Files:** Modify `graficos-dados.js`, `testes/graficos-dados.test.js`

**Interfaces:**
- Consumes: `Reg[]`.
- `Cfg = {id, tipo, dim, sub, medida, filtro:{sexo:[],grupo:[],faixa:[]}, todos:boolean}`; lista vazia no filtro = tudo.
- `dim`/`sub`: `lote|grupo|raca|sexo|faixa|idade|vendedor|comprador|pisteiro` (`sub` pode ser `null`; nunca `lote`).
- `medida`: `rkg|cabeca|peso|fat|cab`. `tipo`: `barras|colunas|rosca|dispersao|linha|colunasTempo`.
- `agregar(regs, cfg): {grupos:[{chave,rotulo,valor,lotes,series:[{chave,rotulo,valor,lotes}]}], semDados:number, destaque:{rotulo,valor,lotes}|null}`; grupos em ordem decrescente de valor.
- `dispersao(regs, filtro): [{x:peso, y:rkg, chave, rotulo, sexo, grupo}]`
- `serie(regs, cfg): {datas:[{id,data}], linhas:[{chave,rotulo,pontos:(number|null)[]}]}`
- `tiposValidos(cfg, modo:"cruzamento"|"tempo"): string[]`
- `normalizaCfg(qualquer): Cfg|null`

- [ ] **Step 1: Escrever os testes**

```js
const reg=o=>Object.assign({leilao:'a',data:'2026-01-10',lote:1,q:10,sexo:'M',raca:'NELORE',grupo:'B',idade:'12',faixa:'200',peso:200,lance:1000,vendedor:null,comprador:null,pisteiro:null},o);
const cfg=o=>Object.assign({id:'1',tipo:'barras',dim:'sexo',sub:null,medida:'rkg',filtro:{sexo:[],grupo:[],faixa:[]},todos:false},o);
test('rkg e media dos lotes; cabeca e peso ponderados',()=>{
  const r=[reg({}),reg({lote:2,q:30,peso:300,lance:1000})];
  assert.equal(G.agregar(r,cfg({})).grupos[0].valor,(15+10)/2);
  assert.equal(G.agregar(r,cfg({medida:'cabeca'})).grupos[0].valor,3000);
  assert.equal(G.agregar(r,cfg({medida:'peso'})).grupos[0].valor,275);
});
test('sem lance ou sem peso nao vira NaN',()=>{
  const r=[reg({}),reg({lote:2,lance:null}),reg({lote:3,peso:null,faixa:null})];
  const a=G.agregar(r,cfg({}));
  assert.equal(a.grupos[0].lotes,1);assert.equal(a.semDados,2);
  assert.equal(G.agregar(r,cfg({medida:'cab'})).grupos[0].valor,30);
  assert.equal(G.agregar(r,cfg({medida:'cabeca'})).grupos[0].valor,3000);
});
test('vazio nao tem destaque',()=>{
  const a=G.agregar([reg({})],cfg({dim:'comprador'}));
  assert.deepEqual([a.grupos.length,a.destaque,a.semDados],[0,null,1]);
});
test('destaque prefere 2 lotes; por lote vale o primeiro',()=>{
  const r=[reg({lote:1,sexo:'F',lance:2000}),reg({lote:2}),reg({lote:3})];
  assert.equal(G.agregar(r,cfg({})).destaque.rotulo,'Macho');
  assert.equal(G.agregar(r,cfg({dim:'lote'})).destaque.rotulo,'Lote 01');
});
test('serie com buraco',()=>{
  const r=[reg({}),reg({leilao:'b',data:'2026-02-10',sexo:'F'})];
  const s=G.serie(r,cfg({tipo:'linha'}));
  assert.deepEqual(s.datas.map(d=>d.id),['a','b']);
  assert.deepEqual(s.linhas.find(l=>l.chave==='M').pontos,[15,null]);
});
test('tipos',()=>{
  assert.ok(!G.tiposValidos(cfg({medida:'rkg'}),'cruzamento').includes('rosca'));
  assert.ok(G.tiposValidos(cfg({medida:'fat'}),'cruzamento').includes('rosca'));
  assert.ok(!G.tiposValidos(cfg({medida:'fat',sub:'grupo'}),'cruzamento').includes('rosca'));
  assert.ok(G.tiposValidos(cfg({dim:'lote'}),'cruzamento').includes('dispersao'));
  assert.deepEqual(G.tiposValidos(cfg({}),'tempo'),['linha','colunasTempo']);
});
test('configuracao estragada',()=>{
  for(const x of [null,5,'x',{}, {dim:'xx',medida:'rkg'}]) assert.equal(G.normalizaCfg(x),null);
  assert.equal(G.normalizaCfg({dim:'sexo',medida:'rkg',tipo:'rosca'}).tipo,'barras');
});
```

- [ ] **Step 2:** `node --test testes/graficos-dados.test.js` → os novos FALHAM.
- [ ] **Step 3:** Implementar. `semDados` conta lotes filtrados que não têm o dado da dimensão ou da medida. Destaque: maior valor entre grupos (ou pares grupo · subgrupo) com `lotes>=2`; se não houver, o maior; com `dim==="lote"`, o primeiro. Chave de lote = `leilao+"#"+lote`; com mais de um leilão o rótulo ganha " · dd/mm".
- [ ] **Step 4:** `node --test testes/graficos-dados.test.js` → PASS.
- [ ] **Step 5:** Commit `graficos: somas e séries`.

### Task 3: Cartões, barras e colunas

**Files:** Create `graficos.js`, `graficos.css`, `testes/graficos-tela.py`, `testes/graficos-demo.html`

**Interfaces:**
- Consumes: `GraficosDados`.
- `Graficos.criar(contexto:"rel"|"cmp"): {no:HTMLElement, atualizar(regs:Reg[]):void}`
- Guarda em `localStorage["leiloinga-graficos-v1"] = {rel:Cfg[], cmp:Cfg[], cmpFora:string[]}`, sempre com `try/catch`.
- Seletores para teste: `.gfx`, `.gfx-card[data-id]`, `[data-atalho]`, `[data-add]`, `[data-excluir]`, `[data-desfazer]`, `[data-campo="tipo|dim|sub|medida"]`, `[data-filtro="sexo|grupo|faixa"]`, `.gfx-barra`.

- [ ] **Step 1:** Escrever em `graficos-tela.py` (servidor local, dados inventados na página de demonstração) estes casos: primeiro uso mostra 1 cartão (grupo × R$/kg); cada atalho adiciona um cartão (`Raça × Preço`: grupo/rkg; `Macho × Fêmea`: sexo/rkg; `Peso × Preço`: faixa/rkg; `Melhores lotes`: lote/rkg); excluir remove e "Desfazer" traz de volta na mesma posição; recarregar mantém os cartões; excluir todos e recarregar continua vazio; o filtro de sexo, grupo de raça e faixa muda os valores e continua depois de recarregar; comprador vazio mostra "Sem dados para esse cruzamento"; com 30 lotes por lote aparecem 10 barras e "Ver todos"; `scrollWidth <= clientWidth` nos 4 tamanhos; nenhum `pageerror`; nenhum texto "NaN".
- [ ] **Step 2:** `python3 testes/graficos-tela.py` → FAIL.
- [ ] **Step 3:** Implementar. Grade de 2 colunas a partir de 900 px, 1 abaixo. Barras reaproveitadas por `data-chave`: largura/altura por transição CSS (700 ms), troca de posição pela técnica FLIP, números contando com `requestAnimationFrame`, entrada e saída do cartão com 250 ms. Textos sempre por `textContent`. Cada barra mostra o número de lotes.
- [ ] **Step 4:** `python3 testes/graficos-tela.py` → PASS; ver os prints.
- [ ] **Step 5:** Commit `graficos: cartões animados`.

### Task 4: Rosca e dispersão

**Files:** Modify `graficos.js`, `graficos.css`, `testes/graficos-tela.py`

**Interfaces:** Consumes `tiposValidos`, `dispersao`. Seletores `.gfx-fatia`, `.gfx-ponto`.

- [ ] **Step 1:** Testes: o seletor Tipo lista só os válidos; trocar a medida de faturamento para R$/kg com rosca volta para barras; 30 vendedores em rosca viram 8 fatias + "Outros"; dispersão tem um ponto por lote com peso e lance e, ao tocar, mostra lote, peso e R$/kg; 4 tamanhos sem rolagem lateral.
- [ ] **Step 2:** `python3 testes/graficos-tela.py` → FAIL.
- [ ] **Step 3:** SVG com `viewBox`. Fatias abrem por `stroke-dashoffset`; pontos surgem com atraso de 25 ms cada (teto de 1 s). Trocar de tipo faz o gráfico antigo esmaecer e o novo entrar.
- [ ] **Step 4:** PASS e conferir os prints.
- [ ] **Step 5:** Commit `graficos: rosca e dispersão`.

### Task 5: Ligar no Relatório pós-leilão

**Files:** Modify `boleta-nova.html` (`<head>`; `relatorio(m)` perto da linha 862; `puxaNuvem` perto da linha 1347), `testes/graficos-tela.py`

**Interfaces:** Consumes `Graficos.criar("rel")`, `registros(S, salvas)`. `salvas` vem de `localStorage["leiloinga-relatorio-racas"]`, completado por `racas.json` do ADM quando há `GH.token`.

- [ ] **Step 1:** Testes com `localStorage["leiloinga-boleta-v1"]` inventado e `leiloinga-trava-geral` no futuro: botões "Tabela" e "Gráficos" (Tabela é o padrão); a tabela segue editando; em Gráficos, chamar `render()` não troca o nó do cartão nem reinicia a animação; um lance alterado na tabela aparece no gráfico; trocar de leilão atualiza os dados; Comissão não aparece em `.gfx`.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Criar o controlador uma só vez, guardar em variável e reencaixar `no` a cada redesenho; `atualizar` não faz nada se os registros forem iguais. Em `puxaNuvem`, incluir `.gfx` no `closest(".tw,.cmw")`. Os eventos da tabela só são ligados quando ela está na tela. Incluir `graficos-dados.js?v=1`, `graficos.js?v=1`, `graficos.css?v=1`.
- [ ] **Step 4:** `node --test testes/graficos-dados.test.js` e `python3 testes/graficos-tela.py` → PASS.
- [ ] **Step 5:** Commit, push da branch, abrir o PR da Etapa 1 e mandar o link ao Rafael.

---

## Etapa 2: Comparar leilões

### Task 6: Cruzamentos entre leilões

**Files:** Modify `boleta-nova.html` (`comparar(m)`, perto da linha 995), `graficos.js`, `testes/graficos-tela.py`

**Interfaces:** Consumes `comparar(m)` e sua lista `lst` (`DB.pos` + `CMP.extra` com vendas). `atualizar` do contexto `cmp` recebe os registros de todos esses leilões; a escolha usa `cmpFora`. Seletor `[data-leilao]`.

- [ ] **Step 1:** Testes: gráfico e tabela atuais continuam; todos os leilões começam marcados; desmarcar um muda os valores e persiste; desmarcar todos mostra "Sem dados para esse cruzamento"; trazer um leilão da nuvem o acrescenta já marcado; por lote o rótulo traz a data.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Implementar abaixo de `.ctb`, com o mesmo cuidado de reencaixar o nó.
- [ ] **Step 4:** PASS.
- [ ] **Step 5:** Commit `graficos: comparar leilões`.

### Task 7: Linha do tempo

**Files:** Modify `graficos.js`, `graficos.css`, `testes/graficos-tela.py`

**Interfaces:** Consumes `serie`. Atalho `Linha do tempo` (sexo/rkg/linha), só no contexto `cmp`. Categorias: `grupo|raca|sexo|faixa|idade`.

- [ ] **Step 1:** Testes: uma linha por categoria; categoria sem venda fica sem ponto e a linha não cai a zero; com 1 leilão aparecem os pontos e o aviso "Com um leilão só ainda não dá para ver evolução"; alternar Linha e Colunas por leilão; 12 leilões cabem em 390 px (rótulos alternados); animação desenha da esquerda para a direita; com movimento reduzido nenhuma passa de 150 ms.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** SVG; linha por `stroke-dashoffset` em 1 s; buraco quebra o traço; legenda tocável destaca a linha.
- [ ] **Step 4:** PASS e prints nos 4 tamanhos.
- [ ] **Step 5:** Commit `graficos: linha do tempo`.

### Task 8: Conferência final e publicação

**Files:** Modify `CLAUDE.md` (seção "Páginas": uma linha sobre os gráficos e os testes), `sistema-novo.html` (descrição do menu `comparar`: "Compare leilões, cruze categorias e veja a evolução do preço")

- [ ] **Step 1:** `node --test testes/graficos-dados.test.js` e `python3 testes/graficos-tela.py` → PASS.
- [ ] **Step 2:** Abrir pelo `sistema-novo.html`, áreas Pós-leilão e Comparar, nos 4 tamanhos; conferir à mão um R$/kg de grupo contra a conta dos lotes.
- [ ] **Step 3:** Revisão independente de ponta a ponta por um agente que não viu o trabalho.
- [ ] **Step 4:** Commit, push e PR da Etapa 2 com o link para o Rafael.
