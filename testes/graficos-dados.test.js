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
