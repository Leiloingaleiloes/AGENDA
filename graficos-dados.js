/* Contas dos gráficos comparativos (sem tela). Usado pela boleta-nova.html e pelos testes. */
(function(raiz){
"use strict";

function up(s){return String(s==null?"":s).trim().replace(/\s+/g," ").toUpperCase();}
function semAc(s){return up(s).normalize("NFD").replace(/[̀-ͯ]/g,"");}

/* ---------- raça: mesma chave e mesmas listas do relatorio-novo.html ---------- */
function chaveRaca(r){return semAc(r).replace(/^½\s*/,"1/2 ").replace(/\s+/g," ");}
var BRITANICO=/^(ABERDEEN |RED |POLLED )?(ANGUS|BRANGUS|BRAFORD|HEREFORD|DEVON)( PURO| PO)?$/;
var RACA_PADRAO=[
  [/^NELORE\b/,"B"],[/^(1\/2\s*|½\s*)?TABAPUA\b/,"B"],
  [/CRUZAD|INDUSTRIAL|CRUZ\.?\s*IND/,"C"],[/ANGUS|BRANGUS|BRAFORD|HEREFORD|CARACU|CHAROL|SIMENTAL|LIMOUSIN|SENEPOL|WAGYU|DEVON|CANCHI|GIROLANDO|HOLAND|JERSEY/,"C"]
];
function palpite(k){return /ANELORAD|BRAHMAN|GIR\b|GUZERA|SINDI|ZEBU/.test(k)&&!/1\/2|½|MEIO/.test(k)?"B":"C";}
/* "B" branco · "C" cruzado · "X" britânico (só puro) */
function grupoRaca(raca,salvas){
  var k=chaveRaca(raca);if(!k)return null;
  if(BRITANICO.test(k))return "X";
  if(salvas&&salvas[k])return salvas[k];
  for(var i=0;i<RACA_PADRAO.length;i++)if(RACA_PADRAO[i][0].test(k))return RACA_PADRAO[i][1];
  return palpite(k);
}

function faixaPeso(p){
  if(!(p>0))return null;
  return p<=200?"200":p<=250?"250":p<=300?"300":"+300";
}
/* pela maior idade registrada: "06/12 M" → até 12; "+36 M" → mais de 24 */
function grupoIdade(txt){
  var s=String(txt==null?"":txt).trim(),n=(s.match(/\d+/g)||[]).map(Number);
  if(!n.length)return null;
  var m=Math.max.apply(null,n)+(s.charAt(0)==="+"?1:0);
  return m<=12?"12":m<=18?"18":m<=24?"24":"+24";
}

/* ---------- um registro por lote VENDIDO (doação entra); nada de comissão ---------- */
function texto(v){var s=String(v==null?"":v).trim();return s||null;}
function registros(sessao,salvas){
  if(!sessao||!sessao.L)return [];
  var st=sessao.st||{},la=sessao.la||{},cp=sessao.cp||{},qm=sessao.qm||{};
  return sessao.L.filter(function(x){return st[x.l]==="V";}).map(function(x){
    var raca=texto(x.r)?chaveRaca(x.r).replace(/^1\/2 /,"½ "):null,peso=x.p>0?x.p:null;
    return {leilao:sessao.id,data:sessao.data||"",lote:x.l,ordem:x.o!=null?x.o:null,q:x.q||0,
      sexo:x.s==="M"||x.s==="F"?x.s:null,raca:raca,grupo:grupoRaca(x.r,salvas),idade:grupoIdade(x.i),
      faixa:faixaPeso(peso),peso:peso,lance:la[x.l]>0?la[x.l]:null,
      vendedor:texto(x.v),comprador:texto(cp[x.l]),pisteiro:texto(qm[x.l])};
  });
}

/* ---------- nomes e ordem ---------- */
var DIMS=["lote","grupo","raca","sexo","faixa","idade","vendedor","comprador","pisteiro"];
var MEDIDAS=["rkg","cabeca","peso","fat","cab"];
var TEMPO=["linha","colunasTempo"];
var NOMES={
  grupo:{B:"Branco",C:"Cruzado",X:"Britânico"},
  sexo:{M:"Macho",F:"Fêmea"},
  faixa:{"200":"Até 200 kg","250":"200/250 kg","300":"250/300 kg","+300":"+300 kg"},
  idade:{"12":"Até 12 meses","18":"12 a 18 meses","24":"18 a 24 meses","+24":"Mais de 24 meses"}
};
var ORDEM={grupo:["B","C","X"],sexo:["M","F"],faixa:["200","250","300","+300"],idade:["12","18","24","+24"]};
function ddmm(d){var m=/^\d{4}-(\d{2})-(\d{2})/.exec(d||"");return m?m[2]+"/"+m[1]:"";}
function variosLeiloes(regs){return regs.some(function(r){return r.leilao!==regs[0].leilao;});}
/* {chave,rotulo} do lote na dimensão, ou null se o dado não foi preenchido */
function grupoNa(r,dim,varios){
  if(dim==="lote"){var n=r.lote<10?"0"+r.lote:""+r.lote;
    return {chave:r.leilao+"#"+r.lote,rotulo:"Lote "+n+(varios&&ddmm(r.data)?" · "+ddmm(r.data):"")};}
  var v=r[dim];if(v==null||v==="")return null;
  if(NOMES[dim])return {chave:v,rotulo:NOMES[dim][v]||v};
  return {chave:semAc(v),rotulo:v};
}
function ordena(dim,lista){
  var o=ORDEM[dim];
  return lista.sort(function(a,b){return o?o.indexOf(a.chave)-o.indexOf(b.chave):a.rotulo.localeCompare(b.rotulo,"pt-BR");});
}

/* ---------- contas ---------- */
function filtrar(regs,f){
  f=f||{};
  return regs.filter(function(r){return ["sexo","grupo","faixa"].every(function(k){return !f[k]||!f[k].length||f[k].indexOf(r[k])>=0;});});
}
function temDado(r,m){
  if(m==="rkg")return r.lance>0&&r.peso>0;
  if(m==="cabeca")return r.lance>0&&r.q>0;
  if(m==="peso")return r.peso>0&&r.q>0;
  if(m==="fat")return r.lance>0;
  return true;
}
function valorDe(rs,m){
  var soma=function(f){return rs.reduce(function(a,r){return a+f(r);},0);};
  if(m==="rkg")return soma(function(r){return r.lance*3/r.peso;})/rs.length;   /* média dos lotes */
  if(m==="cabeca")return soma(function(r){return r.lance*3*r.q;})/soma(function(r){return r.q;});
  if(m==="peso")return soma(function(r){return r.q*r.peso;})/soma(function(r){return r.q;});
  if(m==="fat")return soma(function(r){return r.lance*3*r.q;});
  return soma(function(r){return r.q;});
}
/* junta por chave, mantendo a ordem de chegada */
function juntar(rs,dim,varios){
  var por={},lista=[];
  rs.forEach(function(r){var g=grupoNa(r,dim,varios);if(!g)return;
    var k="k:"+g.chave;if(!por[k]){por[k]={chave:g.chave,rotulo:g.rotulo,regs:[]};lista.push(por[k]);}por[k].regs.push(r);});
  return lista;
}
function medido(g,m){return {chave:g.chave,rotulo:g.rotulo,valor:valorDe(g.regs,m),lotes:g.regs.length};}

function agregar(regs,cfg){
  var varios=regs.length>0&&variosLeiloes(regs),semDados=0;
  var uteis=filtrar(regs,cfg.filtro).filter(function(r){
    var ok=temDado(r,cfg.medida)&&grupoNa(r,cfg.dim,varios)&&(!cfg.sub||grupoNa(r,cfg.sub,varios));
    if(!ok)semDados++;return ok;});
  var grupos=juntar(uteis,cfg.dim,varios).map(function(g){
    var o=medido(g,cfg.medida);
    o.series=cfg.sub?ordena(cfg.sub,juntar(g.regs,cfg.sub,varios)).map(function(s){return medido(s,cfg.medida);}):[];
    return o;});
  grupos.sort(function(a,b){return b.valor-a.valor||a.rotulo.localeCompare(b.rotulo,"pt-BR",{numeric:true});});
  var destaque=null;
  if(grupos.length){
    var cand=[];
    if(cfg.dim==="lote")cand=[grupos[0]];
    else grupos.forEach(function(g){
      if(!cfg.sub)cand.push(g);else g.series.forEach(function(s){cand.push({rotulo:g.rotulo+" · "+s.rotulo,valor:s.valor,lotes:s.lotes});});});
    var firmes=cand.filter(function(c){return c.lotes>=2;});
    var d=(firmes.length?firmes:cand).reduce(function(a,b){return b.valor>a.valor?b:a;});
    destaque={rotulo:d.rotulo,valor:d.valor,lotes:d.lotes};
  }
  return {grupos:grupos,semDados:semDados,destaque:destaque};
}

function dispersao(regs,filtro){
  var varios=regs.length>0&&variosLeiloes(regs);
  return filtrar(regs,filtro).filter(function(r){return temDado(r,"rkg");}).map(function(r){
    var g=grupoNa(r,"lote",varios);
    return {x:r.peso,y:r.lance*3/r.peso,chave:g.chave,rotulo:g.rotulo,sexo:r.sexo,grupo:r.grupo};});
}

function serie(regs,cfg){
  var visto={},datas=[];
  regs.forEach(function(r){if(!visto["k:"+r.leilao]){visto["k:"+r.leilao]=1;datas.push({id:r.leilao,data:r.data});}});
  datas.sort(function(a,b){return (a.data||"").localeCompare(b.data||"")||String(a.id).localeCompare(String(b.id));});
  var semDados=0;
  var uteis=filtrar(regs,cfg.filtro).filter(function(r){var ok=temDado(r,cfg.medida)&&grupoNa(r,cfg.dim,true);if(!ok)semDados++;return !!ok;});
  var linhas=ordena(cfg.dim,juntar(uteis,cfg.dim,true)).map(function(g){
    return {chave:g.chave,rotulo:g.rotulo,pontos:datas.map(function(d){
      var rs=g.regs.filter(function(r){return r.leilao===d.id;});return rs.length?valorDe(rs,cfg.medida):null;})};});
  return {datas:datas,linhas:linhas,semDados:semDados};
}

/* ---------- tipos de gráfico e configuração salva ---------- */
function tiposValidos(cfg,modo){
  if(modo==="tempo")return TEMPO.slice();
  var t=["barras","colunas"];
  if((cfg.medida==="fat"||cfg.medida==="cab")&&!cfg.sub)t.push("rosca");
  if(cfg.dim==="lote")t.push("dispersao");
  return t;
}
var seq=0;
function novoId(){return "g"+Date.now().toString(36)+(++seq).toString(36)+Math.random().toString(36).slice(2,5);}
function normalizaCfg(x){
  if(!x||typeof x!=="object"||DIMS.indexOf(x.dim)<0||MEDIDAS.indexOf(x.medida)<0)return null;
  var tempo=TEMPO.indexOf(x.tipo)>=0&&x.dim!=="lote",f=x.filtro&&typeof x.filtro==="object"?x.filtro:{};
  var lista=function(v,dim){return Array.isArray(v)?v.filter(function(i){return ORDEM[dim].indexOf(i)>=0;}):[];};
  var c={id:typeof x.id==="string"&&/^[\w-]+$/.test(x.id)?x.id:novoId(),tipo:x.tipo,dim:x.dim,
    sub:!tempo&&x.sub!=="lote"&&x.sub!==x.dim&&DIMS.indexOf(x.sub)>=0?x.sub:null,medida:x.medida,
    filtro:{sexo:lista(f.sexo,"sexo"),grupo:lista(f.grupo,"grupo"),faixa:lista(f.faixa,"faixa")},todos:x.todos===true};
  if(tiposValidos(c,tempo?"tempo":"cruzamento").indexOf(c.tipo)<0)c.tipo="barras";
  return c;
}

var API={chaveRaca:chaveRaca,grupoRaca:grupoRaca,faixaPeso:faixaPeso,grupoIdade:grupoIdade,registros:registros,
  DIMS:DIMS,MEDIDAS:MEDIDAS,NOMES:NOMES,ORDEM:ORDEM,filtrar:filtrar,agregar:agregar,dispersao:dispersao,serie:serie,
  tiposValidos:tiposValidos,normalizaCfg:normalizaCfg,novoId:novoId};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
if(raiz)raiz.GraficosDados=API;
})(typeof window!=="undefined"?window:null);
