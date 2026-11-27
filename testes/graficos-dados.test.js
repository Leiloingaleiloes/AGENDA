const test=require('node:test'),assert=require('node:assert/strict'),G=require('../graficos-dados.js');

test('britanico so puro',()=>{
  for(const r of ['ANGUS','Brangus','BRAFORD','HEREFORD','DEVON','RED ANGUS','BRANGUS PO']) assert.equal(G.grupoRaca(r,{}),'X',r);
  for(const r of ['½ ANGUS','1/2 BRANGUS','½ BRAFORD']) assert.equal(G.grupoRaca(r,{}),'C',r);
  assert.equal(G.grupoRaca('BRANGUS',{BRANGUS:'C'}),'X');
});
test('brancos e escolhas salvas',()=>{
  assert.equal(G.grupoRaca('NELORE',{}),'B');
  assert.equal(G.grupoRaca('½ TABAPUÃ',{}),'B');
  assert.equal(G.grupoRaca('ANELORADOS',{}),'B');
  assert.equal(G.grupoRaca('ANELORADOS',{ANELORADOS:'C'}),'C');
  assert.equal(G.grupoRaca('½ BRAHMAN',{}),'C');
  assert.equal(G.grupoRaca('',{}),null);
});
test('faixas e idades',()=>{
  assert.deepEqual([200,201,250,300,301,0].map(G.faixaPeso),['200','250','250','300','+300',null]);
  assert.deepEqual(['06/12 M','15/18 M','18/24 M','24/30 M','+36 M','12-15m',''].map(G.grupoIdade),['12','18','24','+24','+24','18',null]);
});
const sessao=()=>({id:'a',data:'2026-01-10',com:{comp:7.77},st:{1:'V',2:'R',4:'V'},la:{1:10,2:9},doa:{1:true},cp:{},qm:{1:'Ana'},
  L:[1,2,3,4].map(l=>({l,o:l,q:10,s:'M',r:'½ Angus',i:'06/12 M',p:200,v:''}))});
test('so vendidos, doacao entra, sem comissao',()=>{
  const r=G.registros(sessao(),{});
  assert.deepEqual(r.map(x=>x.lote),[1,4]);
  assert.deepEqual(r[0],{leilao:'a',data:'2026-01-10',lote:1,ordem:1,q:10,sexo:'M',raca:'½ ANGUS',grupo:'C',idade:'12',faixa:'200',peso:200,lance:10,vendedor:null,comprador:null,pisteiro:'Ana'});
  assert.equal(r[1].lance,null);
  assert.ok(!JSON.stringify(r).includes('7.77'));
});
test('mesma raca escrita de dois jeitos vira uma so',()=>{
  const s=sessao();s.L[3].r='1/2 ANGUS';
  assert.equal(new Set(G.registros(s,{}).map(x=>x.raca)).size,1);
});
test('leilao vazio ou incompleto nao quebra',()=>{
  assert.deepEqual(G.registros(null,{}),[]);
  assert.deepEqual(G.registros({id:'v'},null),[]);
});

const reg=o=>Object.assign({leilao:'a',data:'2026-01-10',lote:1,q:10,sexo:'M',raca:'NELORE',grupo:'B',idade:'12',faixa:'200',peso:200,lance:1000,vendedor:null,comprador:null,pisteiro:null},o);
const cfg=o=>Object.assign({id:'1',tipo:'barras',dim:'sexo',sub:null,medida:'rkg',filtro:{sexo:[],grupo:[],faixa:[]},todos:false},o);
test('rkg e media dos lotes; cabeca e peso ponderados',()=>{
  const r=[reg({}),reg({lote:2,q:30,peso:300,lance:1000})];
  assert.equal(G.agregar(r,cfg({})).grupos[0].valor,(15+10)/2);
  assert.equal(G.agregar(r,cfg({medida:'cabeca'})).grupos[0].valor,3000);
  assert.equal(G.agregar(r,cfg({medida:'peso'})).grupos[0].valor,275);
  assert.equal(G.agregar(r,cfg({medida:'fat'})).grupos[0].valor,120000);
});
test('sem lance ou sem peso nao vira NaN',()=>{
  const r=[reg({}),reg({lote:2,lance:null}),reg({lote:3,peso:null,faixa:null})];
  const a=G.agregar(r,cfg({}));
  assert.equal(a.grupos[0].lotes,1);assert.equal(a.semDados,2);
  assert.equal(G.agregar(r,cfg({medida:'cab'})).grupos[0].valor,30);
  assert.equal(G.agregar(r,cfg({medida:'cabeca'})).grupos[0].valor,3000);
});
test('filtro vale para a conta',()=>{
  const r=[reg({}),reg({lote:2,sexo:'F',grupo:'C',faixa:'250'})];
  for(const f of [{sexo:['F']},{grupo:['C']},{faixa:['250']}]){
    const a=G.agregar(r,cfg({medida:'cab',filtro:Object.assign({sexo:[],grupo:[],faixa:[]},f)}));
    assert.deepEqual(a.grupos.map(g=>[g.chave,g.valor]),[['F',10]]);
  }
});
test('subgrupo e destaque do par',()=>{
  const r=[reg({lote:1}),reg({lote:2}),reg({lote:3,grupo:'C',lance:1100}),reg({lote:4,grupo:'C',lance:1100})];
  const a=G.agregar(r,cfg({dim:'grupo',sub:'sexo'}));
  assert.deepEqual(a.grupos.map(g=>g.rotulo),['Cruzado','Branco']);
  assert.equal(a.grupos[0].series[0].rotulo,'Macho');
  assert.equal(a.destaque.rotulo,'Cruzado · Macho');
});
test('vazio nao tem destaque',()=>{
  const a=G.agregar([reg({})],cfg({dim:'comprador'}));
  assert.deepEqual([a.grupos.length,a.destaque,a.semDados],[0,null,1]);
  assert.equal(G.agregar([],cfg({})).destaque,null);
});
test('destaque prefere 2 lotes; por lote vale o primeiro',()=>{
  const r=[reg({lote:1,sexo:'F',lance:2000}),reg({lote:2}),reg({lote:3})];
  assert.equal(G.agregar(r,cfg({})).destaque.rotulo,'Macho');
  assert.equal(G.agregar(r,cfg({dim:'lote'})).destaque.rotulo,'Lote 01');
});
test('lote de leiloes diferentes nao se mistura',()=>{
  const r=[reg({}),reg({leilao:'b',data:'2026-02-10'})];
  assert.deepEqual(G.agregar(r,cfg({dim:'lote'})).grupos.map(g=>g.rotulo).sort(),['Lote 01 · 10/01','Lote 01 · 10/02']);
});
test('dispersao so com peso e lance',()=>{
  const d=G.dispersao([reg({}),reg({lote:2,lance:null}),reg({lote:3,peso:null})],cfg({}).filtro);
  assert.deepEqual(d.map(p=>[p.x,p.y,p.rotulo]),[[200,15,'Lote 01']]);
});
test('serie com buraco',()=>{
  const r=[reg({leilao:'b',data:'2026-02-10',sexo:'F'}),reg({})];
  const s=G.serie(r,cfg({tipo:'linha'}));
  assert.deepEqual(s.datas.map(d=>d.id),['a','b']);
  assert.deepEqual(s.linhas.find(l=>l.chave==='M').pontos,[15,null]);
});
test('tipos',()=>{
  assert.ok(!G.tiposValidos(cfg({medida:'rkg'}),'cruzamento').includes('rosca'));
  assert.ok(G.tiposValidos(cfg({medida:'fat'}),'cruzamento').includes('rosca'));
  assert.ok(!G.tiposValidos(cfg({medida:'fat',sub:'grupo'}),'cruzamento').includes('rosca'));
  assert.ok(G.tiposValidos(cfg({dim:'lote'}),'cruzamento').includes('dispersao'));
  assert.ok(!G.tiposValidos(cfg({}),'cruzamento').includes('dispersao'));
  assert.deepEqual(G.tiposValidos(cfg({}),'tempo'),['linha','colunasTempo']);
});
test('configuracao estragada',()=>{
  for(const x of [null,5,'x',{}, {dim:'xx',medida:'rkg'},{dim:'sexo',medida:'zz'}]) assert.equal(G.normalizaCfg(x),null);
  const n=G.normalizaCfg({dim:'sexo',medida:'rkg',tipo:'rosca',sub:'lote',filtro:{sexo:'M'}});
  assert.equal(n.tipo,'barras');assert.equal(n.sub,null);assert.deepEqual(n.filtro,{sexo:[],grupo:[],faixa:[]});assert.ok(n.id);
  assert.equal(G.normalizaCfg({dim:'sexo',medida:'rkg',tipo:'linha'}).tipo,'linha');
  assert.equal(G.normalizaCfg({dim:'lote',medida:'rkg',tipo:'linha'}).tipo,'barras');
});
