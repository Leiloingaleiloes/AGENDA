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
  {k:"lotes",t:"Melhores lotes",c:{dim:"lote",medida:"rkg",tipo:"barras"}}
];
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
  if(Array.isArray(s)){var ok=s.map(D.normalizaCfg).filter(Boolean);if(ok.length||!s.length)return ok;}
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
  var n=D.normalizaCfg(this.cfg);if(n)Object.assign(this.cfg,n);
  if(this.assinCor!==this.cfg.dim+"|"+this.cfg.sub){this.assinCor=this.cfg.dim+"|"+this.cfg.sub;this.cores={};}
  this.dono.salvar();this.pintar();
};
Cartao.prototype.opcoes=function(campo,pares,valor){
  var s=this.sel[campo],assin=JSON.stringify(pares);
  if(s._assin!==assin){s._assin=assin;s.textContent="";pares.forEach(function(p){var o=el("option",null,p[1]);o.value=p[0];s.append(o);});}
  s.value=valor||"";
};
Cartao.prototype.controles=function(){
  var c=this.cfg,modo="cruzamento";
  this.opcoes("tipo",D.tiposValidos(c,modo).map(function(t){return [t,ROT_TIPO[t]];}),c.tipo);
  this.opcoes("dim",D.DIMS.map(function(d){return [d,ROT_DIM[d]];}),c.dim);
  var pontos=c.tipo==="dispersao";
  this.opcoes("sub",pontos?[["","Sexo"],["grupo","Grupo de raça"]]:[["","Nada"]].concat(D.DIMS.filter(function(d){return d!=="lote"&&d!==c.dim;}).map(function(d){return [d,ROT_DIM[d]];})),
    pontos&&c.sub!=="grupo"?"":c.sub);
  this.sel.sub.previousSibling.textContent=pontos?"Cor por":"Dividir por";
  this.sel.medida.parentNode.hidden=pontos;
  this.opcoes("medida",D.MEDIDAS.map(function(m){return [m,ROT_MED[m]];}),c.medida);
  var n=0;this.chips.forEach(function(x){var on=c.filtro[x.k].indexOf(x.v)>=0;if(on)n++;x.b.setAttribute("aria-pressed",on);});
  this.resumoFiltro.textContent=n?"Filtros ("+n+")":"Filtros";
  this.titulo.textContent=pontos?"Peso × R$/kg por lote":ROT_MED[c.medida]+" por "+ROT_DIM[c.dim].toLowerCase()+(c.sub?" e "+ROT_DIM[c.sub].toLowerCase():"");
};
Cartao.prototype.pintar=function(){
  this.controles();
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
  else this.barras(corta&&!c.todos?a.grupos.slice(0,LIMITE):a.grupos,tipo==="colunas");
};
/* ao trocar de tipo, o desenho antigo esmaece enquanto o novo entra */
Cartao.prototype.preparar=function(tipo){
  if(this.desenhado===tipo)return;
  var velha=this.tela;
  this.tela=el("div","gfx-desenho gfx-"+tipo);this.desenhado=tipo;this.area.append(this.tela);
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
  if(!this.fatias[this.marcada])this.marcada=null;this.apagar();
};
Cartao.prototype.marcar=function(k){this.marcada=this.marcada===k?null:k;this.apagar();};
Cartao.prototype.apagar=function(){
  var m=this.marcada;
  [this.fatias,this.itens].forEach(function(o){Object.keys(o).forEach(function(k){o[k].classList.toggle("gfx-apagada",m!==null&&k!==m);});});
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
Cartao.prototype.barras=function(grupos,emPe){
  var eu=this,c=this.cfg,area=this.tela,velhas={},antes={};
  Array.prototype.forEach.call(area.children,function(n){velhas[n.dataset.chave]=n;if(area.isConnected)antes[n.dataset.chave]=n.getBoundingClientRect();});
  var sub=[],vistos={};
  if(c.sub)grupos.forEach(function(g){g.series.forEach(function(s){if(!vistos["k:"+s.chave]){vistos["k:"+s.chave]=1;sub.push(s.chave);}});});
  var cor=c.sub?cores(c.sub,sub,this.cores):null,fixa=D.ORDEM[c.dim]?cores(c.dim,grupos.map(function(g){return g.chave;}),{}):null;
  var max=0;grupos.forEach(function(g){(c.sub?g.series:[g]).forEach(function(s){max=Math.max(max,s.valor);});});
  grupos.forEach(function(g,i){
    var k=g.chave+"",n=velhas[k],nova=!n;
    if(nova){n=el("div","gfx-linha");n.dataset.chave=k;n.append(el("div","gfx-rotulo"),el("div","gfx-series"));}
    delete velhas[k];
    n.firstChild.textContent=g.rotulo;n.firstChild.title=g.rotulo;
    /* na coluna, cada grupo pede a largura das suas séries; se não couber, quebra de linha */
    var qs=c.sub?g.series.length:1;n.style.flexBasis=emPe?"min(100%, "+(qs*70+(qs-1)*4)+"px)":"";
    var caixa=n.lastChild,antigas={};
    Array.prototype.forEach.call(caixa.children,function(s){antigas[s.dataset.chave]=s;});
    (c.sub?g.series:[g]).forEach(function(s){
      var sk=c.sub?s.chave+"":"",l=antigas[sk];
      if(!l){l=el("div","gfx-serie");l.dataset.chave=sk;
        var t=el("div","gfx-trilho");t.append(el("i","gfx-barra"));
        l.append(el("span","gfx-sub"),t,el("b","gfx-valor"),el("small","gfx-n"));}
      delete antigas[sk];
      var q=l.children;
      q[0].textContent=c.sub?s.rotulo:"";q[0].hidden=!c.sub;
      var barra=q[1].firstChild;
      barra.style.background=c.sub?cor[s.chave]:fixa?fixa[g.chave]:VERDE;
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
  var dono={regs:[],lista:[],
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
      var cfg=D.normalizaCfg(JSON.parse(JSON.stringify(base)));if(!cfg)return;
      var c=new Cartao(cfg,dono);dono.lista.push(c);grade.append(c.no);dono.salvar();c.pintar();
      anima(c.no,[{opacity:0,transform:"translateY(14px)"},{opacity:1,transform:"none"}],250);
      if(c.no.scrollIntoView&&c.no.isConnected)c.no.scrollIntoView({block:"nearest",behavior:reduz()?"auto":"smooth"});
    }};
  ATALHOS.forEach(function(a){var b=botao("gfx-atalho",a.t);b.dataset.atalho=a.k;b.onclick=function(){dono.novo(a.c);};barra.append(b);});
  var add=botao("gfx-add","+ Adicionar gráfico");add.dataset.add="";add.onclick=function(){dono.novo(PADRAO);};barra.append(add);
  no.append(barra,vazio,grade,aviso);
  cartoesSalvos(ctx).forEach(function(cfg){var c=new Cartao(cfg,dono);dono.lista.push(c);grade.append(c.no);});
  vazio.hidden=!!dono.lista.length;
  return {no:no,atualizar:function(regs){
    var s=JSON.stringify(regs);if(s===assin)return;assin=s;
    dono.regs=regs;dono.lista.forEach(function(c){c.pintar();});
  }};
}
window.Graficos={criar:criar};
})();
