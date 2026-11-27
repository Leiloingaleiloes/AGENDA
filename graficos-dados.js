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

var API={chaveRaca:chaveRaca,grupoRaca:grupoRaca,faixaPeso:faixaPeso,grupoIdade:grupoIdade,registros:registros};
if(typeof module!=="undefined"&&module.exports)module.exports=API;
if(raiz)raiz.GraficosDados=API;
})(typeof window!=="undefined"?window:null);
