/* Cartões de gráficos animados. Depende de graficos-dados.js. */
(function(){
"use strict";
var D=window.GraficosDados;
var KG="leiloinga-graficos-v1";
var ROT_DIM={lote:"Lote",grupo:"Grupo de raça",raca:"Raça",sexo:"Sexo",faixa:"Faixa de peso",idade:"Idade",vendedor:"Vendedor",comprador:"Comprador",pisteiro:"Pisteiro"};
var ROT_MED={rkg:"R$/kg",cabeca:"Valor por cabeça",peso:"Peso médio",fat:"Faturamento",cab:"Cabeças vendidas"};
var ROT_TIPO={barras:"Barras em ranking",colunas:"Colunas",rosca:"Rosca (pizza)",dispersao:"Dispersão peso × R$/kg",linha:"Linha",colunasTempo:"Colunas por leilão"};
var ROT_FILTRO={sexo:"Sexo",grupo:"Grupo de raça",faixa:"Faixa de peso"};
var ATALHOS=[
  {k:"raca",t:"Raça × Preço",c:{dim:"grupo",medida:"rkg",tipo:"barras"}},
  {k:"sexo",t:"Macho × Fêmea",c:{dim:"sexo",medida:"rkg",tipo:"barras"}},
  {k:"faixa",t:"Peso × Preço",c:{dim:"faixa",medida:"rkg",tipo:"barras"}},
  {k:"lotes",t:"Melhores lotes",c:{dim:"lote",medida:"rkg",tipo:"barras"}},
  {k:"tempo",t:"Linha do tempo",c:{dim:"sexo",medida:"rkg",tipo:"linha"},entre:true}
];
/* categorias que fazem sentido ao longo do tempo (só no comparar) */
var CATEG=["grupo","raca","sexo","faixa","idade"];
function noTempo(t){return t==="linha"||t==="colunasTempo";}
function ajusta(cfg,entre){if(noTempo(cfg.tipo)&&(!entre||CATEG.indexOf(cfg.dim)<0))cfg.tipo="barras";return cfg;}
var PADRAO={dim:"grupo",medida:"rkg",tipo:"barras"};
var LIMITE=10;

/* ---------- utilidades ---------- */
function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function botao(cls,txt){var b=el("button",cls,txt);b.type="button";return b;}
function reduz(){return !!(window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches);}
/* animação de uma vez só (não repete se o cartão sair e voltar para a tela) */
function anima(e,quadros,ms,atraso){
  if(!e.animate)return null;
  if(reduz())return e.animate([{opacity:.4},{opacity:1}],{duration:150});
  return e.animate(quadros,{duration:ms,delay:atraso||0,easing:"cubic-bezier(.2,.7,.2,1)",fill:"backwards"});
}
function num(v,casas){return v.toLocaleString("pt-BR",{minimumFractionDigits:casas,maximumFractionDigits:casas});}
function formata(v,m){
  if(m==="rkg")return "R$ "+num(v,2)+"/kg";
  if(m==="cabeca")return "R$ "+num(v,0)+"/cab.";
  if(m==="peso")return num(v,0)+" kg";
  if(m==="fat")return "R$ "+num(v,0);
  return num(v,0)+" cab.";
}
function txtLotes(n){return n+(n===1?" lote":" lotes");}
/* número que conta até o valor */
function conta(e,v,m){
  var de=e._v||0;e._v=v;
  if(de===v&&e.textContent)return;
  cancelAnimationFrame(e._raf);
  if(reduz()){e.textContent=formata(v,m);return;}
  var t0=null;e.textContent=formata(de,m);
  e._raf=requestAnimationFrame(function passo(t){
    if(t0===null)t0=t;var p=Math.min(1,(t-t0)/700),s=1-Math.pow(1-p,3);
    e.textContent=formata(de+(v-de)*s,m);if(p<1)e._raf=requestAnimationFrame(passo);});
}
/* paleta validada (graficos.css): --gc1 a --gc8, mais o cinza --gcx e o verde --gcv */
var VAGAS=8,VERDE="var(--gcv)",CINZA="var(--gcx)";
function vaga(i){return "var(--gc"+(i+1)+")";}
/* a cor acompanha o item: fixa para sexo, grupo, faixa e idade; nas outras, cada item guarda a sua enquanto está na tela */
function cores(dim,chaves,guarda){
  var o=D.ORDEM[dim],r={},usadas={};
  if(o){chaves.forEach(function(k){r[k]=vaga(Math.max(0,o.indexOf(k)));});return r;}
  chaves.forEach(function(k){var i=guarda[k];if(i!=null&&!usadas[i]){usadas[i]=1;r[k]=vaga(i);}});
  var livre=0;
  chaves.forEach(function(k){if(r[k])return;while(usadas[livre])livre++;
    if(livre>=VAGAS){r[k]=CINZA;return;}usadas[livre]=1;guarda[k]=livre;r[k]=vaga(livre);});
  return r;
}
function svg(tag,attrs){var e=document.createElementNS("http://www.w3.org/2000/svg",tag);for(var k in attrs)e.setAttribute(k,attrs[k]);return e;}
/* muda o estilo e anima do valor antigo para o novo */
function muda(e,novos,ms,atraso){
  var a={},b={},igual=true;
  for(var k in novos){a[k]=e.style[k];b[k]=novos[k];if(a[k]!==b[k])igual=false;}
  if(igual)return;for(k in novos)e.style[k]=novos[k];anima(e,[a,b],ms,atraso);
}
function medidaTamanho(prop,e,pct){
  var antes=e.style[prop]||"0%",novo=pct+"%";if(antes===novo)return;
  e.style[prop]=novo;var a={},b={};a[prop]=antes;b[prop]=novo;anima(e,[a,b],700);
}

/* ---------- guardar no aparelho ---------- */
function ler(){try{var x=JSON.parse(localStorage.getItem(KG)||"{}");return x&&typeof x==="object"?x:{};}catch(e){return {};}}
function gravar(chave,valor){try{var x=ler();x[chave]=valor;localStorage.setItem(KG,JSON.stringify(x));}catch(e){}}
function cartoesSalvos(ctx){
  var s=ler()[ctx];
  if(Array.isArray(s)){var ok=s.map(D.normalizaCfg).filter(Boolean).map(function(c){return ajusta(c,ctx==="cmp");});if(ok.length||!s.length)return ok;}
  return [D.normalizaCfg(PADRAO)];
}

/* ---------- um cartão ---------- */
function Cartao(cfg,dono){
  var eu=this;eu.cfg=cfg;eu.dono=dono;eu.cores={};
  var no=eu.no=el("article","gfx-card");no.dataset.id=cfg.id;
  var topo=el("header","gfx-topo");eu.titulo=el("h3");var x=botao("gfx-x","✕");x.dataset.excluir="";x.setAttribute("aria-label","Excluir este gráfico");
  x.onclick=function(){dono.excluir(eu);};topo.append(eu.titulo,x);
  var campos=el("div","gfx-campos");eu.sel={};
  [["tipo","Tipo"],["dim","Mostrar por"],["sub","Dividir por"],["medida","Medida"]].forEach(function(c){
    var l=el("label","gfx-campo"),s=el("select");s.dataset.campo=c[0];l.append(el("span",null,c[1]),s);campos.append(l);eu.sel[c[0]]=s;
    s.onchange=function(){eu.cfg[c[0]]=s.value||null;eu.mudou();};});
  var filtros=el("details","gfx-filtros");eu.resumoFiltro=el("summary",null,"Filtros");filtros.append(eu.resumoFiltro);eu.chips=[];
  Object.keys(ROT_FILTRO).forEach(function(k){
    var g=el("div","gfx-chips");g.dataset.filtro=k;g.append(el("span",null,ROT_FILTRO[k]));
    D.ORDEM[k].forEach(function(v){
      var b=botao("gfx-chip",D.NOMES[k][v]);b.dataset.v=v;eu.chips.push({k:k,v:v,b:b});
      b.onclick=function(){var l=eu.cfg.filtro[k],i=l.indexOf(v);if(i<0)l.push(v);else l.splice(i,1);eu.mudou();};g.append(b);});
    filtros.append(g);});
  eu.destaque=el("p","gfx-destaque");eu.aviso=el("p","gfx-aviso");eu.area=el("div","gfx-area");
  eu.vazio=el("p","gfx-vazio","Sem dados para esse cruzamento");eu.mais=botao("gfx-mais");eu.mais.dataset.todos="";
  eu.mais.onclick=function(){eu.cfg.todos=!eu.cfg.todos;eu.mudou();};
  no.append(topo,campos,filtros,eu.destaque,eu.area,eu.vazio,eu.mais,eu.aviso);
}
Cartao.prototype.mudou=function(){
  var n=D.normalizaCfg(this.cfg);if(n)Object.assign(this.cfg,ajusta(n,this.dono.entre));
  if(this.assinCor!==this.cfg.dim+"|"+this.cfg.sub){this.assinCor=this.cfg.dim+"|"+this.cfg.sub;this.cores={};}
  this.dono.salvar();this.pintar();
};
Cartao.prototype.opcoes=function(campo,pares,valor){
  var s=this.sel[campo],assin=JSON.stringify(pares);
  if(s._assin!==assin){s._assin=assin;s.textContent="";pares.forEach(function(p){var o=el("option",null,p[1]);o.value=p[0];s.append(o);});}
  s.value=valor||"";
};
Cartao.prototype.controles=function(){
  var c=this.cfg,tempo=noTempo(c.tipo),tipos=D.tiposValidos(c,"cruzamento");
  if(this.dono.entre&&CATEG.indexOf(c.dim)>=0)tipos=tipos.concat(D.tiposValidos(c,"tempo"));
  this.opcoes("tipo",tipos.map(function(t){return [t,ROT_TIPO[t]];}),c.tipo);
  this.opcoes("dim",(tempo?CATEG:D.DIMS).map(function(d){return [d,ROT_DIM[d]];}),c.dim);
  this.sel.dim.previousSibling.textContent=tempo?"Categoria":"Mostrar por";
  this.sel.sub.parentNode.hidden=tempo;
  var pontos=c.tipo==="dispersao";
  this.opcoes("sub",pontos?[["","Sexo"],["grupo","Grupo de raça"]]:[["","Nada"]].concat(D.DIMS.filter(function(d){return d!=="lote"&&d!==c.dim;}).map(function(d){return [d,ROT_DIM[d]];})),
    pontos&&c.sub!=="grupo"?"":c.sub);
  this.sel.sub.previousSibling.textContent=pontos?"Cor por":"Dividir por";
  this.sel.medida.parentNode.hidden=pontos;
  this.opcoes("medida",D.MEDIDAS.map(function(m){return [m,ROT_MED[m]];}),c.medida);
  var n=0;this.chips.forEach(function(x){var on=c.filtro[x.k].indexOf(x.v)>=0;if(on)n++;x.b.setAttribute("aria-pressed",on);});
  this.resumoFiltro.textContent=n?"Filtros ("+n+")":"Filtros";
  this.titulo.textContent=pontos?"Peso × R$/kg por lote":ROT_MED[c.medida]+" por "+ROT_DIM[c.dim].toLowerCase()+(c.sub?" e "+ROT_DIM[c.sub].toLowerCase():"")+(tempo?" · linha do tempo":"");
};
Cartao.prototype.pintar=function(){
  this.controles();
  if(noTempo(this.cfg.tipo)){this.pintarTempo();return;}
  var c=this.cfg,tipo=c.tipo==="colunas"||c.tipo==="rosca"||c.tipo==="dispersao"?c.tipo:"barras";
  var pontos=tipo==="dispersao"?D.dispersao(this.dono.regs,c.filtro):null;
  var a=D.agregar(this.dono.regs,pontos?{dim:"lote",sub:null,medida:"rkg",filtro:c.filtro}:c);
  var vazio=pontos?!pontos.length:!a.grupos.length;
  this.vazio.hidden=!vazio;this.area.hidden=vazio;this.destaque.hidden=vazio;
  if(!vazio&&pontos){
    var caro=pontos[0],pesado=pontos[0];
    pontos.forEach(function(p){if(p.y>caro.y)caro=p;if(p.x>pesado.x)pesado=p;});
    this.destaque.textContent="🏆 Maior preço: "+caro.rotulo+" ("+formata(caro.y,"rkg")+") · Mais pesado: "+pesado.rotulo+" ("+formata(pesado.x,"peso")+")";
  }else if(a.destaque){
    var d=a.destaque;this.destaque.textContent="🏆 Destaque: "+d.rotulo+" · "+formata(d.valor,c.medida)+" ("+txtLotes(d.lotes)+")";
  }
  this.aviso.hidden=!a.semDados;
  this.aviso.textContent=a.semDados?txtLotes(a.semDados)+" sem dados para esta conta "+(a.semDados===1?"ficou":"ficaram")+" de fora.":"";
  var corta=(tipo==="barras"||tipo==="colunas")&&a.grupos.length>LIMITE;
  this.mais.hidden=!corta;this.mais.textContent=c.todos?"Ver só os 10 primeiros":"Ver todos ("+a.grupos.length+")";
  if(vazio)return;
  this.preparar(tipo);
  if(pontos)this.pontos(pontos);
  else if(tipo==="rosca")this.rosca(a.grupos);
  else this.barras(corta&&!c.todos?a.grupos.slice(0,LIMITE):a.grupos,tipo==="colunas",c.sub);
};
function dataBR(d){return String(d||"").split("-").reverse().join("/");}
function avisoFora(n){return n?txtLotes(n)+" sem dados para esta conta "+(n===1?"ficou":"ficaram")+" de fora.":"";}
/* evolução leilão a leilão: linha ou colunas */
Cartao.prototype.pintarTempo=function(){
  var c=this.cfg,regs=this.dono.regs,base={dim:c.dim,sub:null,medida:c.medida,filtro:c.filtro};
  var s=D.serie(regs,c),lotes={};
  D.agregar(regs,base).grupos.forEach(function(g){lotes["k:"+g.chave]=g.lotes;});
  /* no máximo 8 categorias no desenho: ficam as que têm mais lotes */
  var linhas=s.linhas,fora=0;
  if(linhas.length>VAGAS){
    var ficam=linhas.slice().sort(function(a,b){return (lotes["k:"+b.chave]||0)-(lotes["k:"+a.chave]||0);}).slice(0,VAGAS);
    fora=linhas.length-VAGAS;linhas=linhas.filter(function(l){return ficam.indexOf(l)>=0;});
  }
  var vazio=!linhas.length;
  this.vazio.hidden=!vazio;this.area.hidden=vazio;this.destaque.hidden=vazio;this.mais.hidden=true;
  var avisos=[avisoFora(s.semDados),fora?"Aparecem as "+VAGAS+" categorias com mais lotes; "+fora+" ficaram de fora (use os filtros).":""].filter(Boolean);
  this.aviso.hidden=!avisos.length;this.aviso.textContent=avisos.join(" ");
  if(vazio)return;
  var u=s.datas.length-1;
  while(u>0&&!linhas.some(function(l){return l.pontos[u]!==null;}))u--;
  var melhor=null,alta=null;
  linhas.forEach(function(l){
    if(l.pontos[u]!==null&&(!melhor||l.pontos[u]>melhor.v))melhor={r:l.rotulo,v:l.pontos[u]};
    var m=mudanca(l,s.datas);if(m&&m.pct>0.05&&(!alta||m.pct>alta.pct))alta={r:l.rotulo,pct:m.pct};});
  this.destaque.textContent="🏆 Destaque em "+dataBR(s.datas[u].data)+": "+melhor.r+" · "+formata(melhor.v,c.medida)+(alta?" · Maior alta: "+alta.r+" (+"+num(alta.pct,1)+"%)":"");
  if(c.tipo==="linha"){this.preparar("evolucao");this.evolucao(s.datas,linhas);return;}
  this.preparar("colunasTempo","colunas");
  var mostra=linhas.map(function(l){return l.chave;});
  var grupos=s.datas.map(function(d){
    var g=D.agregar(regs.filter(function(r){return r.leilao===d.id;}),base).grupos.filter(function(x){return mostra.indexOf(x.chave)>=0;});
    g.sort(function(a,b){return mostra.indexOf(a.chave)-mostra.indexOf(b.chave);});
    return {chave:d.id,rotulo:dataBR(d.data),series:g,valor:0};
  }).filter(function(g){return g.series.length;});
  this.barras(grupos,true,c.dim);
};
/* quanto a categoria mudou do primeiro ao último leilão em que apareceu */
function mudanca(l,datas){
  var i=[];l.pontos.forEach(function(v,k){if(v!==null)i.push(k);});
  if(i.length<2||!l.pontos[i[0]])return null;
  return {pct:(l.pontos[i[i.length-1]]/l.pontos[i[0]]-1)*100,desde:datas[i[0]].data};
}
function curto(v,m){
  if(Math.abs(v)>=1e6)return num(v/1e6,1)+" mi";
  if(Math.abs(v)>=1e4)return num(v/1e3,0)+" mil";
  return num(v,m==="rkg"?2:0);
}
Cartao.prototype.evolucao=function(datas,linhas){
  var eu=this,c=this.cfg,tela=this.tela,n=datas.length,A=250,E=46,F=14,T=12,B=40;
  tela.textContent="";
  var legenda=el("div","gfx-legenda gfx-evol"),s=svg("svg",{viewBox:"0 0 "+LARG+" "+A,class:"gfx-plano"}),info=el("p","gfx-info","Toque no gráfico para ver cada leilão.");
  if(n<2)tela.append(el("p","gfx-nota","Com um leilão só ainda não dá para ver evolução."));
  tela.append(legenda,s,info);
  var X=function(i){return n>1?E+8+i*(LARG-E-8-F)/(n-1):(E+LARG-F)/2;};
  var todos=[];linhas.forEach(function(l){l.pontos.forEach(function(v){if(v!==null)todos.push(v);});});
  var ly=limites(todos),Y=function(v){return A-B-(v-ly[0])/(ly[1]-ly[0])*(A-T-B);};
  var eixos=svg("g",{class:"gfx-eixos"});s.append(eixos);
  function escreve(x,y,t,cls){var e=svg("text",{x:x,y:y,class:cls});e.textContent=t;eixos.append(e);}
  for(var i=0;i<4;i++){var v=ly[0]+(ly[1]-ly[0])*i/3;eixos.append(svg("line",{x1:E,x2:LARG-F,y1:Y(v),y2:Y(v)}));escreve(E-5,Y(v)+3,curto(v,c.medida),"gfx-ey");}
  /* datas: no máximo 6 rótulos, contando a partir do último */
  var passo=Math.max(1,Math.ceil(n/6)),anos=datas.some(function(d){return d.data.slice(0,4)!==datas[0].data.slice(0,4);});
  datas.forEach(function(d,k){if((n-1-k)%passo)return;
    escreve(X(k),A-B+15,dataBR(d.data).slice(0,5),"gfx-data");if(anos)escreve(X(k),A-B+27,d.data.slice(0,4),"gfx-ano");});
  var guia=svg("line",{class:"gfx-guia",y1:T,y2:A-B,x1:0,x2:0});guia.style.display="none";s.append(guia);
  var cor=cores(c.dim,linhas.map(function(l){return l.chave;}),this.cores),tracos={},itens={};
  var parte=function(k){return n>1?k/(n-1):0;};
  linhas.forEach(function(l){
    var k=l.chave+"",g=svg("g",{class:"gfx-serie-t"});g.dataset.chave=k;tracos[k]=g;s.append(g);
    var trecho=[];
    l.pontos.concat([null]).forEach(function(v,i){
      if(v!==null){trecho.push([X(i),Y(v),i]);return;}
      if(trecho.length>1){
        var compr=0;trecho.forEach(function(p,j){if(j)compr+=Math.hypot(p[0]-trecho[j-1][0],p[1]-trecho[j-1][1]);});
        var t=svg("path",{class:"gfx-traco",d:trecho.map(function(p,j){return (j?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1);}).join("")});
        t.style.stroke=cor[l.chave];compr=Math.ceil(compr)+1;g.append(t);
        var de=parte(trecho[0][2]),ate=parte(trecho[trecho.length-1][2]);
        anima(t,[{strokeDasharray:compr,strokeDashoffset:compr},{strokeDasharray:compr,strokeDashoffset:0}],(ate-de)*1000,de*1000);
      }
      trecho=[];
    });
    l.pontos.forEach(function(v,i){if(v===null)return;
      var p=svg("circle",{class:"gfx-no",cx:X(i).toFixed(1),cy:Y(v).toFixed(1),r:4.5});p.style.fill=cor[l.chave];g.append(p);
      anima(p,[{opacity:0},{opacity:1}],250,parte(i)*1000);});
    var it=botao("gfx-item");it.dataset.chave=k;it.onclick=function(){eu.marcar(k);};itens[k]=it;
    var q=el("i");q.style.background=cor[l.chave];
    var ult=null;l.pontos.forEach(function(v){if(v!==null)ult=v;});
    var m=mudanca(l,datas),txt="aparece em um leilão só";
    if(m)txt=(Math.abs(m.pct)<0.05?"sem mudança":(m.pct>0?"▲ ":"▼ ")+num(Math.abs(m.pct),1)+"%")+" desde "+dataBR(m.desde).slice(0,5);
    it.append(q,el("span",null,l.rotulo),el("b",null,formata(ult,c.medida)),el("small",null,txt));legenda.append(it);
  });
  var meio=n>1?(X(1)-X(0))/2:(LARG-E-F)/2;
  datas.forEach(function(d,i){
    var r=svg("rect",{class:"gfx-faixa",x:(X(i)-meio).toFixed(1),y:T,width:(meio*2).toFixed(1),height:A-B-T});
    r.onclick=r.onmouseenter=function(){
      guia.setAttribute("x1",X(i));guia.setAttribute("x2",X(i));guia.style.display="";
      info.textContent=dataBR(d.data)+" — "+linhas.filter(function(l){return l.pontos[i]!==null;}).map(function(l){return l.rotulo+": "+formata(l.pontos[i],c.medida);}).join(" · ");
    };
    s.append(r);
  });
  this.alvos=[tracos,itens];if(!tracos[this.marcada])this.marcada=null;this.apagar();
};
/* ao trocar de tipo, o desenho antigo esmaece enquanto o novo entra */
Cartao.prototype.preparar=function(tipo,classe){
  if(this.desenhado===tipo)return;
  var velha=this.tela;this.marcada=null;
  this.tela=el("div","gfx-desenho gfx-"+(classe||tipo));this.desenhado=tipo;this.area.append(this.tela);
  if(!velha)return;
  var a=this.area.isConnected&&anima(velha,[{opacity:1},{opacity:0}],250);
  if(!a){velha.remove();return;}
  velha.classList.add("gfx-fantasma");velha.setAttribute("aria-hidden","true");a.onfinish=function(){velha.remove();};
  anima(this.tela,[{opacity:0},{opacity:1}],350);
};
/* pizza com furo: as 8 maiores fatias e o resto somado em "Outros" */
Cartao.prototype.rosca=function(grupos){
  var eu=this,c=this.cfg,tela=this.tela;
  if(!tela.firstChild){
    var s=svg("svg",{viewBox:"0 0 200 200",class:"gfx-pizza"});
    this.total=svg("text",{x:100,y:101,class:"gfx-total"});var sub=svg("text",{x:100,y:118,class:"gfx-total-sub"});sub.textContent="no total";
    s.append(this.total,sub);tela.append(s,el("div","gfx-legenda"));this.fatias={};this.itens={};this.marcada=null;
  }
  var desenho=tela.firstChild,legenda=tela.lastChild;
  var lista=grupos.slice(0,VAGAS).map(function(g){return {chave:g.chave+"",bruta:g.chave,rotulo:g.rotulo,valor:g.valor,lotes:g.lotes};});
  if(grupos.length>VAGAS){
    var resto={chave:"__outros",rotulo:"Outros",valor:0,lotes:0};
    grupos.slice(VAGAS).forEach(function(g){resto.valor+=g.valor;resto.lotes+=g.lotes;});lista.push(resto);
  }
  var soma=lista.reduce(function(t,g){return t+g.valor;},0),cor=cores(c.dim,lista.filter(function(g){return g.chave!=="__outros";}).map(function(g){return g.bruta;}),this.cores);
  var R=70,C=2*Math.PI*R,inicio=0,velhas=this.fatias,velhos=this.itens;this.fatias={};this.itens={};
  this.total.textContent=formata(soma,c.medida);
  lista.forEach(function(g){
    var parte=soma?g.valor/soma:0,tam=Math.max(.5,parte*C-(lista.length>1?2:0)),tinta=g.chave==="__outros"?CINZA:cor[g.bruta];
    var f=velhas[g.chave],nova=!f;delete velhas[g.chave];
    if(nova){f=svg("circle",{cx:100,cy:100,r:R,class:"gfx-fatia"});f.dataset.chave=g.chave;f.onclick=function(){eu.marcar(g.chave);};}
    eu.fatias[g.chave]=f;desenho.append(f);
    var traco=tam+" "+C,giro="rotate("+(inicio/ (soma||1)*360-90)+"deg)";
    f.style.stroke=tinta;
    if(nova){f.style.strokeDasharray=traco;f.style.transform=giro;anima(f,[{strokeDashoffset:tam},{strokeDashoffset:0}],800);}
    else muda(f,{strokeDasharray:traco,transform:giro},700);
    inicio+=g.valor;
    var it=velhos[g.chave],novo=!it;delete velhos[g.chave];
    if(novo){it=botao("gfx-item");it.dataset.chave=g.chave;it.append(el("i"),el("span"),el("b"),el("small"));it.onclick=function(){eu.marcar(g.chave);};}
    eu.itens[g.chave]=it;
    var q=it.children;q[0].style.background=tinta;q[1].textContent=g.rotulo;conta(q[2],g.valor,c.medida);
    q[3].textContent=num(parte*100,parte<.1?1:0)+"% · "+txtLotes(g.lotes);
    legenda.append(it);if(novo)anima(it,[{opacity:0},{opacity:1}],400);
  });
  Object.keys(velhas).forEach(function(k){velhas[k].remove();});Object.keys(velhos).forEach(function(k){velhos[k].remove();});
  this.alvos=[this.fatias,this.itens];if(!this.fatias[this.marcada])this.marcada=null;this.apagar();
};
Cartao.prototype.marcar=function(k){this.marcada=this.marcada===k?null:k;this.apagar();};
Cartao.prototype.apagar=function(){
  var m=this.marcada;
  this.alvos.forEach(function(o){Object.keys(o).forEach(function(k){o[k].classList.toggle("gfx-apagada",m!==null&&k!==m);});});
};
/* um ponto por lote: peso na horizontal, R$/kg na vertical */
var LARG=340,ALT=260,ESQ=40,DIR=12,TOPO=10,BASE=38;
function limites(v){
  var a=Math.min.apply(null,v),b=Math.max.apply(null,v),folga=(b-a)*.08||Math.abs(b)*.1||1;
  return [Math.max(0,a-folga),b+folga];
}
Cartao.prototype.pontos=function(lista){
  var eu=this,c=this.cfg,tela=this.tela;
  if(!tela.firstChild){
    var s=svg("svg",{viewBox:"0 0 "+LARG+" "+ALT,class:"gfx-plano"});
    s.append(svg("g",{class:"gfx-eixos"}),svg("g",{}));
    tela.append(el("div","gfx-legenda gfx-chaves"),s,el("p","gfx-info"));this.marcas={};this.escolhido=null;
  }
  var legenda=tela.children[0],desenho=tela.children[1],eixos=desenho.firstChild,camada=desenho.lastChild;
  var por=c.sub==="grupo"?"grupo":"sexo";
  var lx=limites(lista.map(function(p){return p.x;})),ly=limites(lista.map(function(p){return p.y;}));
  var X=function(v){return ESQ+(v-lx[0])/(lx[1]-lx[0])*(LARG-ESQ-DIR);},Y=function(v){return ALT-BASE-(v-ly[0])/(ly[1]-ly[0])*(ALT-TOPO-BASE);};
  eixos.textContent="";
  function escreve(x,y,t,cls){var e=svg("text",{x:x,y:y,class:cls||""});e.textContent=t;eixos.append(e);}
  for(var i=0;i<4;i++){
    var vy=ly[0]+(ly[1]-ly[0])*i/3,vx=lx[0]+(lx[1]-lx[0])*i/3;
    eixos.append(svg("line",{x1:ESQ,x2:LARG-DIR,y1:Y(vy),y2:Y(vy)}));
    escreve(ESQ-5,Y(vy)+3,num(vy,1),"gfx-ey");escreve(X(vx),ALT-BASE+14,num(vx,0),i===3?"gfx-ef":"");
  }
  escreve((ESQ+LARG-DIR)/2,ALT-6,"Peso médio (kg)","gfx-nome");
  var nomeY=svg("text",{class:"gfx-nome",transform:"translate(9 "+((ALT-BASE)/2)+") rotate(-90)"});nomeY.textContent="R$/kg";eixos.append(nomeY);
  legenda.textContent="";
  D.ORDEM[por].forEach(function(k,i){
    if(!lista.some(function(p){return p[por]===k;}))return;
    var it=el("span","gfx-item");var q=el("i");q.style.background=vaga(i);it.append(q,el("span",null,D.NOMES[por][k]));legenda.append(it);});
  if(lista.some(function(p){return D.ORDEM[por].indexOf(p[por])<0;})){
    var it=el("span","gfx-item"),q=el("i");q.style.background=CINZA;it.append(q,el("span",null,"Sem informação"));legenda.append(it);}
  var velhas=this.marcas;this.marcas={};
  lista.forEach(function(p,i){
    var k=p.chave+"",m=velhas[k],nova=!m;delete velhas[k];
    if(nova){m=svg("g",{class:"gfx-marca"});m.append(svg("circle",{r:5,class:"gfx-ponto"}),svg("circle",{r:11,class:"gfx-alvo"}));}
    eu.marcas[k]=m;
    var j=D.ORDEM[por].indexOf(p[por]);m.firstChild.style.fill=j<0?CINZA:vaga(j);
    var lugar="translate("+X(p.x).toFixed(1)+"px,"+Y(p.y).toFixed(1)+"px)";
    if(nova){m.style.transform=lugar;anima(m.firstChild,[{opacity:0,transform:"scale(0)"},{opacity:1,transform:"scale(1)"}],400,Math.min(i*25,1000));}
    else muda(m,{transform:lugar},700);
    var texto=p.rotulo+" · "+formata(p.x,"peso")+" · "+formata(p.y,"rkg")+(D.NOMES.sexo[p.sexo]?" · "+D.NOMES.sexo[p.sexo]:"")+(D.NOMES.grupo[p.grupo]?" · "+D.NOMES.grupo[p.grupo]:"");
    m.dataset.texto=texto;
    m.lastChild.onclick=m.lastChild.onmouseenter=function(){eu.escolher(k);};
    camada.append(m);
  });
  Object.keys(velhas).forEach(function(k){velhas[k].remove();});
  this.escolher(this.marcas[this.escolhido]?this.escolhido:null);
};
Cartao.prototype.escolher=function(k){
  var eu=this;this.escolhido=k;
  Object.keys(this.marcas).forEach(function(x){eu.marcas[x].classList.toggle("gfx-escolhida",x===k);});
  this.tela.lastChild.textContent=k===null?"Toque em um ponto para ver o lote.":this.marcas[k].dataset.texto;
};
/* barras deitadas ou colunas; as linhas são reaproveitadas para animar a troca de posição */
Cartao.prototype.barras=function(grupos,emPe,porSerie){
  var eu=this,c=this.cfg,area=this.tela,velhas={},antes={};
  Array.prototype.forEach.call(area.children,function(n){velhas[n.dataset.chave]=n;if(area.isConnected)antes[n.dataset.chave]=n.getBoundingClientRect();});
  var sub=[],vistos={};
  if(porSerie)grupos.forEach(function(g){g.series.forEach(function(s){if(!vistos["k:"+s.chave]){vistos["k:"+s.chave]=1;sub.push(s.chave);}});});
  var cor=porSerie?cores(porSerie,sub,this.cores):null,fixa=D.ORDEM[c.dim]?cores(c.dim,grupos.map(function(g){return g.chave;}),{}):null;
  var max=0;grupos.forEach(function(g){(porSerie?g.series:[g]).forEach(function(s){max=Math.max(max,s.valor);});});
  grupos.forEach(function(g,i){
    var k=g.chave+"",n=velhas[k],nova=!n;
    if(nova){n=el("div","gfx-linha");n.dataset.chave=k;n.append(el("div","gfx-rotulo"),el("div","gfx-series"));}
    delete velhas[k];
    n.firstChild.textContent=g.rotulo;n.firstChild.title=g.rotulo;
    /* na coluna, cada grupo pede a largura das suas séries; se não couber, quebra de linha */
    var qs=porSerie?g.series.length:1;n.style.flexBasis=emPe?"min(100%, "+(qs*70+(qs-1)*4)+"px)":"";
    var caixa=n.lastChild,antigas={};
    Array.prototype.forEach.call(caixa.children,function(s){antigas[s.dataset.chave]=s;});
    (porSerie?g.series:[g]).forEach(function(s){
      var sk=porSerie?s.chave+"":"",l=antigas[sk];
      if(!l){l=el("div","gfx-serie");l.dataset.chave=sk;
        var t=el("div","gfx-trilho");t.append(el("i","gfx-barra"));
        l.append(el("span","gfx-sub"),t,el("b","gfx-valor"),el("small","gfx-n"));}
      delete antigas[sk];
      var q=l.children;
      q[0].textContent=porSerie?s.rotulo:"";q[0].hidden=!porSerie;
      var barra=q[1].firstChild;
      barra.style.background=porSerie?cor[s.chave]:fixa?fixa[g.chave]:VERDE;
      medidaTamanho(emPe?"height":"width",barra,max?Math.max(1,s.valor/max*100):0);
      conta(q[2],s.valor,c.medida);q[3].textContent=txtLotes(s.lotes);
      caixa.append(l);
    });
    Object.keys(antigas).forEach(function(x){antigas[x].remove();});
    area.append(n);
    if(nova)anima(n,[{opacity:0},{opacity:1}],400,Math.min(i*40,400));
  });
  Object.keys(velhas).forEach(function(k){velhas[k].remove();});
  /* quem trocou de posição desliza até o novo lugar */
  if(area.isConnected&&!reduz())Array.prototype.forEach.call(area.children,function(n){
    var a=antes[n.dataset.chave];if(!a)return;var d=n.getBoundingClientRect(),dx=a.left-d.left,dy=a.top-d.top;
    if(Math.abs(dx)>1||Math.abs(dy)>1)anima(n,[{transform:"translate("+dx+"px,"+dy+"px)"},{transform:"none"}],600);});
};

/* ---------- o conjunto ---------- */
function criar(ctx){
  var no=el("section","gfx");
  var barra=el("div","gfx-atalhos"),grade=el("div","gfx-grade");
  var aviso=el("div","gfx-desfaz");aviso.hidden=true;
  var vazio=el("p","gfx-vazio gfx-nenhum","Nenhum gráfico na tela. Toque em um atalho ou em “Adicionar gráfico”.");
  var assin=null,tAviso=null;
  var dono={regs:[],lista:[],entre:ctx==="cmp",
    salvar:function(){gravar(ctx,dono.lista.map(function(c){return c.cfg;}));vazio.hidden=!!dono.lista.length;},
    excluir:function(c){
      var i=dono.lista.indexOf(c);if(i<0)return;dono.lista.splice(i,1);dono.salvar();
      var fim=function(){c.no.remove();};
      var a=anima(c.no,[{opacity:1,transform:"none"},{opacity:0,transform:"scale(.96)"}],250);
      if(a){a.onfinish=fim;}else fim();
      aviso.textContent="";aviso.append(el("span",null,"Gráfico excluído."));
      var d=botao(null,"Desfazer");d.dataset.desfazer="";aviso.append(d);aviso.hidden=false;
      d.onclick=function(){if(a)a.onfinish=null;if(a)a.cancel();dono.lista.splice(Math.min(i,dono.lista.length),0,c);aviso.hidden=true;dono.salvar();dono.ordenar();c.pintar();anima(c.no,[{opacity:0},{opacity:1}],250);};
      clearTimeout(tAviso);tAviso=setTimeout(function(){aviso.hidden=true;},8000);
    },
    ordenar:function(){dono.lista.forEach(function(c){grade.append(c.no);});},
    novo:function(base){
      var cfg=D.normalizaCfg(JSON.parse(JSON.stringify(base)));if(!cfg)return;ajusta(cfg,dono.entre);
      var c=new Cartao(cfg,dono);dono.lista.push(c);grade.append(c.no);dono.salvar();c.pintar();
      anima(c.no,[{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],250);
      if(c.no.scrollIntoView&&c.no.isConnected)c.no.scrollIntoView({block:"nearest",behavior:reduz()?"auto":"smooth"});
    }};
  ATALHOS.filter(function(a){return !a.entre||dono.entre;}).forEach(function(a){var b=botao("gfx-atalho",a.t);b.dataset.atalho=a.k;b.onclick=function(){dono.novo(a.c);};barra.append(b);});
  var add=botao("gfx-add","+ Adicionar gráfico");add.dataset.add="";add.onclick=function(){dono.novo(PADRAO);};barra.append(add);
  /* no comparar: quais leilões entram nas contas (guarda só os desmarcados, então leilão novo já entra) */
  var entre=ctx==="cmp",todos=[],fora=[],escolha=null,resumo=null,caixas=null,assinLeiloes=null;
  if(entre){
    var f=ler().cmpFora;if(Array.isArray(f))fora=f.filter(function(i){return typeof i==="string";});
    escolha=el("details","gfx-leiloes");resumo=el("summary");caixas=el("div","gfx-lista");escolha.append(resumo,caixas);
    no.append(el("h3","gfx-secao","Cruzar informações entre os leilões"),escolha);
  }
  function separa(){dono.regs=entre?todos.filter(function(r){return fora.indexOf(String(r.leilao))<0;}):todos;}
  function pinta(){dono.lista.forEach(function(c){c.pintar();});}
  function montaEscolha(leiloes){
    var s=JSON.stringify(leiloes);if(s===assinLeiloes)return;
    if(assinLeiloes===null)escolha.open=leiloes.length<=6;assinLeiloes=s;caixas.textContent="";
    function conta(){var n=leiloes.filter(function(l){return fora.indexOf(String(l.id))<0;}).length;resumo.textContent="Leilões nos gráficos: "+n+" de "+leiloes.length;}
    leiloes.forEach(function(l){
      var rot=el("label","gfx-leilao"),c=el("input"),id=String(l.id);c.type="checkbox";c.dataset.leilao=id;c.checked=fora.indexOf(id)<0;
      c.onchange=function(){var i=fora.indexOf(id);if(c.checked){if(i>=0)fora.splice(i,1);}else if(i<0)fora.push(id);gravar("cmpFora",fora);conta();separa();pinta();};
      rot.append(c,el("span",null,l.rotulo));caixas.append(rot);});
    conta();
  }
  function dosRegistros(regs){
    var visto={},l=[];
    regs.forEach(function(r){if(visto["k:"+r.leilao])return;visto["k:"+r.leilao]=1;l.push({id:r.leilao,rotulo:"Leilão de "+String(r.data||"").split("-").reverse().join("/")});});
    return l;
  }
  no.append(barra,vazio,grade,aviso);
  cartoesSalvos(ctx).forEach(function(cfg){var c=new Cartao(cfg,dono);dono.lista.push(c);grade.append(c.no);});
  vazio.hidden=!!dono.lista.length;
  return {no:no,atualizar:function(regs,leiloes){
    var s=JSON.stringify([regs,leiloes||null]);if(s===assin)return;assin=s;
    todos=regs;if(entre)montaEscolha(leiloes||dosRegistros(regs));separa();pinta();
  }};
}
window.Graficos={criar:criar};
})();
