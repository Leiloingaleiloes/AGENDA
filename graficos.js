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
var CORES=["#14843A","#E0A100","#1F6FB2","#B4502B","#7A5AA6","#2A9D8F","#8D99AE","#C2185B"];
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
/* cor fixa para sexo, grupo, faixa e idade; nas outras, pela ordem de aparição */
function corDe(dim,chave,mapa){
  var o=D.ORDEM[dim];if(o)return CORES[Math.max(0,o.indexOf(chave))%CORES.length];
  if(!(chave in mapa))mapa[chave]=Object.keys(mapa).length;
  return CORES[mapa[chave]%CORES.length];
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
  this.opcoes("sub",[["","Nada"]].concat(D.DIMS.filter(function(d){return d!=="lote"&&d!==c.dim;}).map(function(d){return [d,ROT_DIM[d]];})),c.sub);
  this.opcoes("medida",D.MEDIDAS.map(function(m){return [m,ROT_MED[m]];}),c.medida);
  var n=0;this.chips.forEach(function(x){var on=c.filtro[x.k].indexOf(x.v)>=0;if(on)n++;x.b.setAttribute("aria-pressed",on);});
  this.resumoFiltro.textContent=n?"Filtros ("+n+")":"Filtros";
  this.titulo.textContent=ROT_MED[c.medida]+" por "+ROT_DIM[c.dim].toLowerCase()+(c.sub?" e "+ROT_DIM[c.sub].toLowerCase():"");
};
Cartao.prototype.pintar=function(){
  this.controles();
  var c=this.cfg,a=D.agregar(this.dono.regs,c),vazio=!a.grupos.length;
  this.vazio.hidden=!vazio;this.area.hidden=vazio;this.destaque.hidden=vazio;
  if(a.destaque){
    var d=a.destaque;this.destaque.textContent="🏆 Destaque: "+d.rotulo+" · "+formata(d.valor,c.medida)+" ("+txtLotes(d.lotes)+")";
  }
  this.aviso.hidden=!a.semDados;
  this.aviso.textContent=a.semDados?txtLotes(a.semDados)+" sem dados para esta conta "+(a.semDados===1?"ficou":"ficaram")+" de fora.":"";
  var corta=a.grupos.length>LIMITE&&c.dim==="lote";
  var muitos=a.grupos.length>LIMITE;
  this.mais.hidden=!muitos;this.mais.textContent=c.todos?"Ver só os 10 primeiros":"Ver todos ("+a.grupos.length+")";
  var grupos=muitos&&!c.todos?a.grupos.slice(0,LIMITE):a.grupos;
  var tipo=c.tipo==="colunas"?"colunas":"barras";
  if(this.desenhado!==tipo){this.area.textContent="";this.area.className="gfx-area gfx-"+tipo;this.desenhado=tipo;anima(this.area,[{opacity:0},{opacity:1}],300);}
  this.barras(grupos,tipo==="colunas");
};
/* barras deitadas ou colunas; as linhas são reaproveitadas para animar a troca de posição */
Cartao.prototype.barras=function(grupos,emPe){
  var eu=this,c=this.cfg,area=this.area,velhas={},antes={};
  Array.prototype.forEach.call(area.children,function(n){velhas[n.dataset.chave]=n;if(area.isConnected)antes[n.dataset.chave]=n.getBoundingClientRect();});
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
      barra.style.background=c.sub?corDe(c.sub,s.chave,eu.cores):corDe(c.dim,g.chave,eu.cores);
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
