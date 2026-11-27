/* ---------- leitura do PDF (aqui mesmo, no navegador) ---------- */
/* pdf.js 3 (versão "legacy", que funciona em iPhones e navegadores mais antigos);
   se o CDN não carregar, usa a cópia mais nova guardada no próprio site */
var CDN3="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/legacy/build/";
var pdfjsLib=null;
async function biblioteca(){
  if(pdfjsLib)return pdfjsLib;
  if(window.pdfjsLib&&window.pdfjsLib.getDocument){
    pdfjsLib=window.pdfjsLib;pdfjsLib.GlobalWorkerOptions.workerSrc=CDN3+"pdf.worker.min.js";
  }else{
    pdfjsLib=await import("../vendor/pdfjs/pdf.min.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc=new URL("../vendor/pdfjs/pdf.worker.min.mjs",import.meta.url).href;
  }
  return pdfjsLib;
}

/* junta os pedaços da linha; pedaços grudados (sem espaço entre eles, ex.: "1" e "2" que formam o 12 da coluna Ord.) viram um só */
function juntaLinha(g){
  var its=g.its.slice().sort(function(a,b){return a.x-b.x;}),s="",ant=null;
  its.forEach(function(i){
    if(ant&&(i.x-ant.r)<Math.min(ant.cw,i.cw)*0.3&&(i.x-ant.r)>-Math.min(ant.cw,i.cw)*0.5)s+=i.s;
    else s+=(s?" ":"")+i.s;
    ant=i;
  });
  return s.replace(/\s+/g," ").trim();
}
var ULT_GRUPOS=[];
/* junta os pedaços de texto em linhas da folha (tolerando colunas um pouco acima ou abaixo) */
function linhasDaPagina(items){
  var its=items.filter(function(i){return i.str&&i.str.trim();}).map(function(i){
    var lead=i.str.length-i.str.replace(/^\s+/,"").length,cw=(i.width&&i.str.length)?i.width/i.str.length:5;
    var s=i.str.trim(),x=i.transform[4]+lead*cw;
    return {s:s,x:x,r:x+s.length*cw,y:i.transform[5],cw:cw};});
  ULT_GRUPOS=[];
  if(!its.length)return [];
  var ys=its.map(function(i){return i.y;}).sort(function(a,b){return b-a;});
  var dif=[];for(var k=1;k<ys.length;k++){var d=ys[k-1]-ys[k];if(d>1.5)dif.push(d);}
  dif.sort(function(a,b){return a-b;});
  var passo=dif.length?dif[Math.floor(dif.length/2)]:12, tol=Math.max(2,passo*0.42);
  its.sort(function(a,b){return b.y-a.y;});
  var grupos=[];
  /* âncoras: os números da coluna "Ord." (a mais à esquerda). Cada pedaço de texto vai para a
     linha do lote mais próxima, mesmo que Idade/Raça/Peso estejam bem mais acima ou abaixo */
  var nums=its.filter(function(i){return /^\d{1,3}º?$/.test(i.s);});
  if(nums.length){
    /* a coluna Ord. pode vir alinhada à direita: 1 a 9 ficam mais para dentro que 10 ou 100.
       Vale como âncora quem começa na borda esquerda OU termina na mesma borda direita dela. */
    /* acha a coluna Ord. pelo alinhamento (muitos números um embaixo do outro), não pelo número
       mais à esquerda: na 1ª folha um número solto do cabeçalho (página, data) ficava mais à
       esquerda e fazia sumir os primeiros lotes */
    function alinhados(a){return nums.filter(function(b){return Math.abs(b.x-a.x)<=4||Math.abs(b.r-a.r)<=4;}).length;}
    var cont=nums.map(alinhados),maxC=Math.max.apply(null,cont);
    var cand=nums.filter(function(i,k){return cont[k]>=Math.max(2,maxC*0.6);});
    if(!cand.length)cand=nums;
    var minX=Math.min.apply(null,cand.map(function(i){return i.x;}));
    var col=cand.filter(function(i){return i.x<=minX+8;});
    var rs=col.map(function(i){return i.r;}).sort(function(a,b){return a-b;}),rMed=rs[Math.floor(rs.length/2)];
    var anc=nums.filter(function(i){return (i.x>=minX-4&&i.x<=minX+8)||(Math.abs(i.r-rMed)<=4&&i.x>=minX-4&&i.x<minX+40);}).map(function(i){return i.y;});
    var ga=[];for(var a=1;a<anc.length;a++){var dd=Math.abs(anc[a-1]-anc[a]);if(dd>3)ga.push(dd);}
    ga.sort(function(p,q){return p-q;});
    var passoL=ga.length?ga[Math.floor(ga.length/2)]:Math.max(passo,12);
    var lim=passoL*0.5;
    anc.forEach(function(y){grupos.push({y:y,its:[],anc:true});});
    var resto=[];
    its.forEach(function(i){
      var best=null,bd=1e9;
      grupos.forEach(function(g){var d=Math.abs(g.y-i.y);if(d<bd){bd=d;best=g;}});
      /* fora das linhas de lote (título, cabeçalho, totais) ou abaixo do lote do lado esquerdo */
      if(best&&bd<lim&&!/Total|Ord\.|Vendedor|Peso\(|Idade|Ra[çc]a/i.test(i.s))best.its.push(i);else resto.push(i);
    });
    var outros=[];
    resto.forEach(function(i){
      var g=outros.length?outros[outros.length-1]:null;
      if(g&&Math.abs(g.y-i.y)<=tol){g.its.push(i);g.y=(g.y*(g.its.length-1)+i.y)/g.its.length;}
      else outros.push({y:i.y,its:[i]});
    });
    grupos=grupos.filter(function(g){return g.its.length;}).concat(outros).sort(function(p,q){return q.y-p.y;});
    ULT_GRUPOS=grupos;
    return grupos.map(juntaLinha);
  }
  its.forEach(function(i){
    var g=grupos.length?grupos[grupos.length-1]:null;
    if(g&&Math.abs(g.y-i.y)<=tol){g.its.push(i);g.y=(g.y*(g.its.length-1)+i.y)/g.its.length;}
    else grupos.push({y:i.y,its:[i]});
  });
  ULT_GRUPOS=grupos;
  return grupos.map(juntaLinha);
}
var RE_LINHA=/^(\d{1,4})\s+(\d{1,4})\s+(\d{1,4})\s*([MF])\s+(.+?)\s+((?:\d{1,2}\s*A\s*\d{1,2}|\d{1,2}\s*\/\s*\d{1,2})\s*M\w*|\+\s*\d{1,2}\s*M\w*)\s+(.+?)\s+(\d{2,4})(?:[.,]\d+)?(?:\s.*)?$/i;
var RE_CATALOGO=/^(\d{1,3})\s*º\s+(\d{1,4})\s+(.+?)\s+(\+?\d{1,2}(?:\s*\/\s*\d{1,2})?\s*M)\s+(Macho|F[êe]mea)\s+(\d{1,4})\s+(\d{2,4})\s*kg/i;
var RE_COMECO=/^(\d{1,4})\s+(\d{2,4})\s+\d/;
function interpretar(linhas){
  var out={leilao:"",data:"",totais:null,lotes:[],naoEntendi:[]};
  linhas.forEach(function(t){
    var m;
    /* Ord. partido em dois pedaços ("1 2 002 5 M ..." ou "1 152 152 2 M ..."): junta antes de ler */
    t=t.replace(/^(\d{1,3})\s+(\d{1,3})(?=\s+\d{2,4}\s+\d{1,4}\s*[MF]\b)/i,"$1$2");
    if(!out.leilao&&/LEIL[AÃ]O/i.test(t)&&!/ORDEM DE ENTRADA/i.test(t))out.leilao=t;
    if(!out.data&&(m=t.match(/\b(\d{2}\/\d{2}\/\d{4})\b/))&&!/\d{2}:\d{2}/.test(t))out.data=m[1];
    if((m=t.match(/Total de Animais:?\s*(\d+)/i))){
      out.totais=out.totais||{};out.totais.animais=+m[1];
      var mm=t.match(/Machos:?\s*(\d+)/i),ff=t.match(/F[êe]meas:?\s*(\d+)/i);
      if(mm)out.totais.machos=+mm[1];if(ff)out.totais.femeas=+ff[1];
      return;
    }
    if((m=t.match(RE_LINHA))){
      out.lotes.push({ord:+m[1],lote:m[2],qtde:+m[3],sexo:m[4].toUpperCase(),vendedor:m[5],idade:m[6],raca:m[7],peso:+m[8]});
    }else if((m=t.match(RE_CATALOGO))){
      out.catalogo=true;
      out.lotes.push({ord:+m[1],lote:m[2],qtde:+m[6],sexo:m[5].charAt(0).toUpperCase(),vendedor:"",idade:m[4],raca:m[3],peso:+m[7]});
    }else if((m=t.match(RE_COMECO))&&!/Ord\.|Lote/i.test(t)){
      out.naoEntendi.push(t);
      out.lotes.push({ord:+m[1],lote:m[2],qtde:null,sexo:"",vendedor:"",idade:"",raca:"",peso:null,duvida:true,bruto:t});
    }
  });
  return out;
}
var semWorker=false;
async function abrirDoc(bytes){
  var lib=await biblioteca();
  try{return await lib.getDocument({data:bytes.slice(0),isEvalSupported:false}).promise;}
  catch(e){
    if(semWorker||(e&&/password|Invalid PDF|corrupt/i.test(e.message||"")))throw e;
    /* alguns navegadores não abrem o leitor em segundo plano: tenta de novo na própria página */
    semWorker=true;
    try{lib.GlobalWorkerOptions.workerPort=null;}catch(_){}
    return await lib.getDocument({data:bytes.slice(0),isEvalSupported:false,disableWorker:true}).promise;
  }
}
/* leitura pela posição das colunas do cabeçalho (Ord. Lote Qtde Sx Vendedor Idade Raça Peso) */
var ROTULOS=[["ord",/^Ord/i],["lote",/^Lote/i],["qtde",/^Qtd/i],["sexo",/^(Sx|Sexo)$/i],["vendedor",/^Vend/i],["idade",/^Idade/i],["raca",/^Ra[çc]a/i],["peso",/^Peso/i],["nome",/^Nome/i]];
function palavras(g){
  var w=[];
  g.its.forEach(function(i){var re=/\S+/g,m;while((m=re.exec(i.s)))w.push({s:m[0],x:i.x+m.index*i.cw});});
  return w.sort(function(a,b){return a.x-b.x;});
}
function porColunas(grupos){
  var cols=null,lotes=[];
  grupos.forEach(function(g){
    var w=palavras(g);
    if(!cols){
      var c=[];w.forEach(function(p){ROTULOS.forEach(function(r){if(r[1].test(p.s)&&!c.some(function(x){return x.k===r[0];}))c.push({k:r[0],x:p.x});});});
      if(c.length>=5&&c.some(function(x){return x.k==="lote";})){cols=c.sort(function(a,b){return a.x-b.x;});}
      return;
    }
    if(!w.length||!/^\d{1,3}º?$/.test(w[0].s))return;
    var v={};
    w.forEach(function(p){
      var k=null;cols.forEach(function(c){if(c.x<=p.x+4)k=c.k;});
      if(!k)k=cols[0].k;
      v[k]=(v[k]?v[k]+" ":"")+p.s;
    });
    /* número de qtde e sexo às vezes vêm grudados ("7M") ou na coluna vizinha */
    var qs=((v.qtde||"")+" "+(v.sexo||"")).trim(),m=qs.match(/(\d{1,4})\s*([MF])\b/i);
    var lote=(v.lote||"").match(/\d{1,4}/);
    if(!lote||!m)return;
    lotes.push({ord:+((v.ord||"").match(/\d+/)||[0])[0]||null,lote:lote[0],qtde:+m[1],sexo:m[2].toUpperCase(),
      vendedor:(v.vendedor||"").trim(),idade:(v.idade||"").trim(),raca:(v.raca||"").trim(),peso:+(((v.peso||"").match(/\d{2,4}/)||[""])[0])||null});
  });
  return lotes;
}
async function lerPdf(file){
  var buf=new Uint8Array(await file.arrayBuffer());
  var doc=await abrirDoc(buf);
  var linhas=[],grupos=[];
  for(var p=1;p<=doc.numPages;p++){
    var page=await doc.getPage(p);
    var tc=await page.getTextContent();
    linhas=linhas.concat(linhasDaPagina(tc.items));
    grupos=grupos.concat(ULT_GRUPOS);
  }
  var info=interpretar(linhas);
  if(info.lotes.some(function(l){return l.duvida;})){
    var pc=porColunas(grupos);
    info.lotes=info.lotes.map(function(l){
      if(!l.duvida)return l;
      var a=pc.find(function(x){return loteN(x.lote)===loteN(l.lote);});
      return a||l;
    });
    info.naoEntendi=info.lotes.filter(function(l){return l.duvida;}).map(function(l){return l.bruto;});
  }
  return {linhas:linhas,info:info};
}
window.__fichas_interpretar=interpretar;

var $=function(id){return document.getElementById(id);};
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
var toastT=null;
function toast(t,ms){var e=$("toast");e.textContent=t;e.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){e.hidden=true;},ms||3500);}

/* ---------- estado (cópia neste navegador + nuvem no GitHub, quando conectado) ---------- */
var KEY="lotes-v2-teste";
var S={leilao:"",data:"",totais:null,rows:[]};
var files=[], seq=1, busy=false;
function salvar(){
  try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}
  if(window.__nuvemSalvar)window.__nuvemSalvar();
}
function carregarLocal(){
  try{var x=JSON.parse(localStorage.getItem(KEY)||"null");if(x&&Array.isArray(x.rows)){S=x;S.rows.forEach(function(r){r.id=seq++;});}}catch(e){}
}

/* ---------- normalização ---------- */
function num(v){if(v==null)return null;var m=String(v).replace(",",".").match(/\d+(\.\d+)?/);return m?Number(m[0]):null;}
function loteN(v){var n=num(v);return n==null?null:Math.round(n);}
function dois(n){return n==null||isNaN(n)?"":(n<10?"0"+n:String(n));}
function up(s){return String(s==null?"":s).trim().replace(/\s+/g," ").toUpperCase();}
function sexoN(s){s=up(s);return s.charAt(0)==="M"?"M":(s.charAt(0)==="F"?"F":s);}
function idadeFicha(s){
  s=up(s);var m;
  if((m=s.match(/^(\d+)\s*A\s*(\d+)\s*M/)))return m[1]+"/"+m[2]+" M";
  if((m=s.match(/^(\d+)\s*\/\s*(\d+)\s*M/)))return m[1]+"/"+m[2]+" M";
  if((m=s.match(/^\+\s*(\d+)/)))return "+"+m[1]+" M";
  return s;
}
function racaFicha(s){return up(s).replace(/^1\/2\s*/,"½ ");}

/* ---------- arquivos ---------- */
function renderFiles(){
  var ul=$("files");ul.textContent="";
  files.forEach(function(f){
    var li=el("li",f.state==="done"?"ok":f.state==="err"?"err":f.state==="run"?"run":"");
    li.append(el("span","n",f.name),el("span","s",f.msg));
    if(f.det){var d=el("span","n",f.det);d.style.gridColumn="1 / -1";d.style.fontSize=".78rem";d.style.color="var(--muted)";li.append(d);}
    ul.append(li);
  });
}
async function addFiles(list){
  var novos=[];
  Array.prototype.forEach.call(list,function(f){
    if(!(f.type==="application/pdf"||/\.pdf$/i.test(f.name))){if(/^image\//.test(f.type)){abrirFoto(f);return;}toast("O arquivo "+f.name+" não é PDF.",6000);return;}
    var x={file:f,name:f.name,state:"run",msg:"lendo…"};files.push(x);novos.push(x);
  });
  renderFiles();
  var totalNovos=0,erros=0,semLotes=0,catalogo=false;
  for(var i=0;i<novos.length;i++){
    var f=novos[i];
    try{
      var r=await lerPdf(f.file);
      if(!r.info.lotes.length){f.state="err";f.msg="nenhum lote encontrado";semLotes++;}
      else{
        if(r.info.catalogo)catalogo=true;
        totalNovos+=juntar(r.info);
        f.state="done";f.msg=r.info.lotes.length+" lotes lidos"+(r.info.naoEntendi.length?" · "+r.info.naoEntendi.length+" para conferir":"");
      }
    }catch(e){
      var txt=String(e&&(e.name||"")+": "+(e.message||e)).slice(0,160);
      f.state="err";f.msg=/password/i.test(txt)?"PDF com senha":"não deu para abrir este PDF";f.det=txt;erros++;
      try{console.error("fichas:",e);}catch(_){}
    }
    renderFiles();
  }
  salvar();render();
  var st=$("status");
  if(erros||semLotes){st.className="status err";st.textContent=semLotes?"Não achei lotes neste PDF. Se ele for uma foto escaneada, mande para o Claude, que ele devolve um PDF com texto.":"Algum PDF não abriu. Tente baixar o PDF de novo do sistema.";}
  else if(catalogo){st.className="status err";st.textContent="Este PDF é a ordem de entrada do site dos lotes, que não tem o nome do vendedor. Os lotes entraram, mas o campo VEND. ficou vazio. Para as fichas completas, use o PDF do sistema.";}
  else{st.className="status";st.textContent=totalNovos?totalNovos+" lotes novos na tabela. Confira antes de gerar o Word.":"PDF lido. Nenhum lote novo; os que já estavam foram atualizados.";}
}
var drop=$("drop");
$("arq").addEventListener("change",function(e){addFiles(e.target.files);e.target.value="";});
["dragenter","dragover"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.add("on");});});
["dragleave","drop"].forEach(function(t){drop.addEventListener(t,function(e){e.preventDefault();drop.classList.remove("on");});});
drop.addEventListener("drop",function(e){if(e.dataTransfer&&e.dataTransfer.files)addFiles(e.dataTransfer.files);});

function juntar(r){
  if(!r||!Array.isArray(r.lotes))return 0;
  /* PDF de outro leilão (outra data): não misturar com a tabela do leilão anterior */
  if(S.rows.length&&r.data&&S.data&&String(r.data)!==String(S.data)){
    var novo=true;
    try{novo=window.confirm("A tabela tem os lotes do leilão de "+S.data+" e este PDF é do leilão de "+r.data+".\n\nOK = começar tabela nova só com este leilão\nCancelar = juntar com os lotes antigos");}catch(e){}
    if(novo)S={leilao:"",data:"",totais:null,rows:[]};
  }
  if(r.leilao&&!S.leilao)S.leilao=up(r.leilao);
  if(r.data&&!S.data)S.data=String(r.data);
  if(r.totais&&num(r.totais.animais))S.totais={animais:num(r.totais.animais),machos:num(r.totais.machos),femeas:num(r.totais.femeas)};
  var novos=0;
  S.rows.forEach(function(x){x.nova=false;});
  r.lotes.forEach(function(l){
    var n=loteN(l.lote);if(n==null)return;
    var d={lote:n,mang:n,qtde:loteN(l.qtde),sexo:sexoN(l.sexo),vendedor:up(l.vendedor),idade:up(l.idade),raca:up(l.raca),peso:loteN(l.peso),ord:loteN(l.ord),duvida:!!l.duvida,bruto:l.bruto||""};
    var ex=S.rows.find(function(x){return x.lote===n;});
    if(ex){
      var mangIgual=ex.mang===ex.lote||ex.mang==null;
      Object.keys(d).forEach(function(k){if(k!=="mang"&&k!=="duvida"&&d[k]!=null&&d[k]!=="")ex[k]=d[k];});
      if(mangIgual)ex.mang=ex.lote;
      ex.duvida=d.duvida;ex.bruto=d.bruto;
    }else{
      d.id=seq++;d.feita=false;d.sel=true;d.nova=true;S.rows.push(d);novos++;
    }
  });
  S.rows.sort(function(a,b){return (a.ord!=null&&b.ord!=null?a.ord-b.ord:0)||((a.lote||9999)-(b.lote||9999));});
  return novos;
}

/* ---------- conferência ---------- */
function problemas(r,dups){
  var p={};
  if(r.lote==null)p.lote="sem número";
  else if(dups[r.lote]>1)p.lote="número repetido";
  if(!(r.qtde>0))p.qtde="sem quantidade";
  if(r.sexo!=="M"&&r.sexo!=="F")p.sexo="sexo não é M nem F";
  if(!r.vendedor)p.vendedor="sem vendedor";
  if(!r.idade)p.idade="sem idade";
  if(!r.raca)p.raca="sem raça";
  if(r.peso==null)p.peso="sem peso";
  else if(r.peso<60||r.peso>900)p.peso="peso fora do normal";
  if(r.mang==null)p.mang="sem mangueira";
  return p;
}
function contaDups(){var d={};S.rows.forEach(function(r){if(r.lote!=null)d[r.lote]=(d[r.lote]||0)+1;});return d;}
function renderChecks(){
  var ul=$("checks");ul.textContent="";
  if(!S.rows.length)return;
  var add=function(cls,txt){var li=el("li",cls);li.append(el("span",null,txt));ul.append(li);};
  var cab=0,m=0,f=0;S.rows.forEach(function(r){var q=r.qtde||0;cab+=q;if(r.sexo==="M")m+=q;else if(r.sexo==="F")f+=q;});
  var t=S.totais;
  if(t){
    if(t.animais===cab&&(t.machos==null||t.machos===m)&&(t.femeas==null||t.femeas===f))add("ok","Os totais batem com a lista: "+cab+" animais, "+m+" machos e "+f+" fêmeas.");
    else add("bad","Os totais não batem. A lista diz "+t.animais+" animais ("+t.machos+" M, "+t.femeas+" F) e a tabela soma "+cab+" ("+m+" M, "+f+" F). Confira a quantidade e o sexo dos lotes.");
  }else if(S.rows.some(function(r){return r.ord!=null;}))add("warn","A lista lida não tinha a linha de totais. Se a última folha tiver, mande ela também para conferir a soma.");
  var dups=contaDups(),comProb=0,duv=0;
  S.rows.forEach(function(r){if(Object.keys(problemas(r,dups)).length)comProb++;if(r.duvida)duv++;});
  if(comProb)add("bad",comProb+(comProb>1?" lotes têm":" lote tem")+" campo vazio ou estranho. Estão marcados em vermelho na tabela.");
  if(duv)add("warn",duv+(duv>1?" lotes ficaram":" lote ficou")+" com leitura incerta na foto. Confira na folha os que estão marcados.");
  var br=S.rows.filter(function(r){return r.duvida&&r.bruto;}).slice(0,2);if(br.length)add("warn","Texto que a página leu (mande uma foto disto para o Claude): "+br.map(function(r){return "["+r.bruto+"]";}).join("  "));
  var ns=S.rows.map(function(r){return r.lote;}).filter(function(n){return n!=null;}).sort(function(a,b){return a-b;});
  if(ns.length){
    var falta=[];for(var n=ns[0];n<=ns[ns.length-1];n++){if(ns.indexOf(n)<0)falta.push(dois(n));}
    if(falta.length)add("warn","Não aparecem na lista os lotes "+falta.join(", ")+". Confira se pularam na folha mesmo.");
  }
  if(!comProb&&!duv&&t&&t.animais===cab)add("ok","Tudo conferido. Pode gerar o Word.");
}
function renderNums(){
  var cab=0,m=0,f=0;S.rows.forEach(function(r){var q=r.qtde||0;cab+=q;if(r.sexo==="M")m+=q;else if(r.sexo==="F")f+=q;});
  var h=$("nums");h.textContent="";
  [["Lotes",S.rows.length],["Animais",cab],["Machos",m],["Fêmeas",f]].forEach(function(x){var d=el("div");d.append(el("span","k",x[0]),el("b",null,String(x[1])));h.append(d);});
}

/* ---------- tabela ---------- */
var CAMPOS=[["mang","n",4],["qtde","n",4],["sexo","t",2],["vendedor","t",40],["idade","t",14],["raca","t",24],["peso","n",5]];
function render(){
  $("nomeLeilao").value=S.leilao||"";
  renderNums();renderChecks();
  var tb=$("tbody");tb.textContent="";
  var dups=contaDups();
  $("vazio").hidden=S.rows.length>0;
  tb.parentNode.hidden=!S.rows.length;
  S.rows.forEach(function(r){
    var p=problemas(r,dups);
    var tr=el("tr",(r.sel?"sel ":"")+(r.feita?"feita":""));tr.dataset.id=r.id;
    var td0=el("td","c"),cb=document.createElement("input");cb.type="checkbox";cb.checked=!!r.sel;cb.id="sel-"+r.id;
    cb.setAttribute("aria-label","Fazer ficha do lote "+dois(r.lote));cb.dataset.k="sel";td0.append(cb);
    var td1=el("td"),tg=el("span","tag"),li=document.createElement("input");li.value=dois(r.lote);li.id="lote-"+r.id;li.inputMode="numeric";li.dataset.k="lote";li.setAttribute("aria-label","Número do lote");
    if(p.lote){li.title=p.lote;tg.style.outline="2px solid var(--bad)";}
    tg.append(li);td1.append(tg);
    tr.append(td0,td1);
    CAMPOS.forEach(function(c){
      var td=el("td"),i=document.createElement("input");i.id=c[0]+"-"+r.id;i.dataset.k=c[0];
      var v=r[c[0]];i.value=v==null?"":(c[0]==="mang"?dois(v):String(v));
      if(c[1]==="n")i.inputMode="numeric";
      i.style.minWidth=(c[2]>20?19:c[2]>10?7.5:c[2]>4?4.5:3)+"em";
      i.setAttribute("aria-label",c[0]);
      if(p[c[0]]){i.classList.add("bad");i.title=p[c[0]];}
      td.append(i);tr.append(td);
    });
    var ts=el("td");
    ts.append(el("span","pill "+(r.feita?"f":"n"),r.feita?"Ficha feita":"Sem ficha"));
    if(r.nova){ts.append(document.createTextNode(" "));ts.append(el("span","pill new","Novo"));}
    if(r.duvida){ts.append(document.createTextNode(" "));ts.append(el("span","pill w","Conferir"));}
    tr.append(ts);
    var tx=el("td"),bx=el("button","x","×");bx.type="button";bx.dataset.k="del";bx.setAttribute("aria-label","Tirar o lote "+dois(r.lote)+" da tabela");tx.append(bx);tr.append(tx);
    tb.append(tr);
  });
  renderBar();
  if(window.__renderCam)window.__renderCam();
  if(window.__renderRel)window.__renderRel();
  if(window.__renderOrd)window.__renderOrd();
}
function renderBar(){
  var sel=S.rows.filter(function(r){return r.sel;});
  var cab=0;sel.forEach(function(r){cab+=r.qtde||0;});
  $("barSum").innerHTML="";
  var b=el("b",null,sel.length+(sel.length===1?" ficha":" fichas"));
  $("barSum").append(b,document.createTextNode(sel.length?" · "+cab+" animais · lotes "+resumoLotes(sel.map(function(r){return r.lote;})):" marcadas"));
  var g=$("gerar");g.disabled=!sel.length;g.textContent="Gerar Word"+(sel.length?" ("+sel.length+")":"");
}
function resumoLotes(ns){
  ns=ns.filter(function(n){return n!=null;}).sort(function(a,b){return a-b;});
  var out=[],i=0;
  while(i<ns.length){var a=ns[i],b=a;while(i+1<ns.length&&ns[i+1]===b+1){i++;b=ns[i];}out.push(a===b?dois(a):dois(a)+"–"+dois(b));i++;}
  return out.length>8?out.slice(0,8).join(", ")+"…":out.join(", ");
}
function achar(id){id=Number(id);return S.rows.find(function(r){return r.id===id;});}
$("tbody").addEventListener("change",function(e){
  var t=e.target,tr=t.closest("tr");if(!tr)return;var r=achar(tr.dataset.id);if(!r)return;var k=t.dataset.k;
  if(k==="sel"){r.sel=t.checked;tr.classList.toggle("sel",r.sel);salvar();renderBar();return;}
  if(k==="lote"){var antes=r.lote;r.lote=loteN(t.value);if(r.mang===antes||r.mang==null)r.mang=r.lote;}
  else if(k==="mang"||k==="qtde"||k==="peso")r[k]=loteN(t.value);
  else if(k==="sexo")r.sexo=sexoN(t.value);
  else r[k]=up(t.value);
  r.duvida=false;salvar();render();
  var n=$(t.id);if(n)n.focus();
});
$("tbody").addEventListener("click",function(e){
  var b=e.target.closest("[data-k=del]");if(!b)return;
  var tr=b.closest("tr"),r=achar(tr.dataset.id);if(!r)return;
  S.rows=S.rows.filter(function(x){return x!==r;});salvar();render();toast("Lote "+dois(r.lote)+" tirado da tabela.");
});
$("nomeLeilao").addEventListener("change",function(e){S.leilao=up(e.target.value);salvar();});
$("selFaltam").addEventListener("click",function(){S.rows.forEach(function(r){r.sel=!r.feita;});salvar();render();});
$("selTodos").addEventListener("click",function(){S.rows.forEach(function(r){r.sel=true;});salvar();render();});
$("selNenhum").addEventListener("click",function(){S.rows.forEach(function(r){r.sel=false;});salvar();render();});
var armado=false,armT=null;
$("limpar").addEventListener("click",function(){
  var b=$("limpar");
  if(!armado){armado=true;b.textContent="Toque de novo para limpar";clearTimeout(armT);armT=setTimeout(function(){armado=false;b.textContent="Limpar tudo";},4000);return;}
  armado=false;b.textContent="Limpar tudo";
  S={leilao:"",data:"",totais:null,rows:[]};files=[];salvar();render();renderFiles();$("status").textContent="";
});

/* ---------- Word (.docx): uma ficha por página, folha deitada, Times New Roman, preto no branco ---------- */
function xe(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
var DOCX_W=16838,DOCX_H=11906,DOCX_M=850;
function fc(w,span,text,o){
  o=o||{};
  var b="";["top","left","bottom","right"].forEach(function(s){b+='<w:'+s+' w:val="single" w:sz="8" w:space="0" w:color="000000"/>';});
  var sz=o.sz||72;
  var rpr='<w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="'+sz+'"/><w:szCs w:val="'+sz+'"/></w:rPr>';
  return '<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+(span>1?'<w:gridSpan w:val="'+span+'"/>':'')+
    '<w:tcBorders>'+b+'</w:tcBorders><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/>'+
    '<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr>'+
    '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/>'+(o.center?'<w:jc w:val="center"/>':'')+'</w:pPr>'+
    (text===""||text==null?"":'<w:r>'+rpr+'<w:t xml:space="preserve">'+xe(text)+'</w:t></w:r>')+'</w:p></w:tc>';
}
function frow(cells){return '<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="1800" w:hRule="atLeast"/></w:trPr>'+cells+'</w:tr>';}
function lotXml(l,first){
  var G=[3100,1900,1900,1300,3300,3638],soma=function(a,b){return a+b;},resto=G.slice(1).reduce(soma,0);
  var vend=up(l.vendedor),szV=vend.length>34?44:vend.length>26?52:64;
  var rows=[
    frow(fc(G[0],1,"LOTE")+fc(G[1],1,dois(l.lote),{center:1})+fc(G[2]+G[3],2,"")+fc(G[4],1,"MANG.")+fc(G[5],1,dois(l.mang),{center:1})),
    frow(fc(G[0],1,"VEND.")+fc(resto,5,vend,{sz:szV,center:1})),
    frow(fc(G[0],1,"RAÇA")+fc(resto,5,racaFicha(l.raca),{sz:72,center:1})),
    frow(fc(G[0],1,"IDADE")+fc(G[1]+G[2]+G[3],3,idadeFicha(l.idade),{center:1})+fc(G[4],1,"SEXO")+fc(G[5],1,sexoN(l.sexo),{center:1})),
    frow(fc(G[0],1,"QTDE")+fc(G[1]+G[2]+G[3],3,dois(l.qtde),{center:1})+fc(G[4],1,"PESO")+fc(G[5],1,l.peso==null?"":String(l.peso),{center:1}))
  ];
  var x=first?"":'<w:p><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr></w:p>';
  return x+'<w:tbl><w:tblPr><w:tblW w:w="'+G.reduce(soma,0)+'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+G.map(function(c){return '<w:gridCol w:w="'+c+'"/>';}).join("")+'</w:tblGrid>'+rows.join("")+'</w:tbl>';
}
var CRC_T=null;
function crc32(b){
  if(!CRC_T){CRC_T=[];for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);CRC_T[n]=c>>>0;}}
  var crc=0xFFFFFFFF;for(var i=0;i<b.length;i++)crc=CRC_T[(crc^b[i])&0xFF]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;
}
function zipStore(fs){
  var enc=new TextEncoder(),parts=[],central=[],offset=0;
  fs.forEach(function(f){
    var name=enc.encode(f.name),data=enc.encode(f.data),crc=crc32(data);
    var h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);
    h.setUint16(10,0,true);h.setUint16(12,0x21,true);h.setUint32(14,crc,true);
    h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),name,data);
    var c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);
    c.setUint16(12,0,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);
    c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
    central.push(new Uint8Array(c.buffer),name);offset+=30+name.length+data.length;
  });
  var cd=0;central.forEach(function(p){cd+=p.length;});
  var e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,fs.length,true);e.setUint16(10,fs.length,true);e.setUint32(12,cd,true);e.setUint32(16,offset,true);
  return new Blob(parts.concat(central,[new Uint8Array(e.buffer)]),{type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}
function buildDocx(arr){
  var NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  var body=arr.map(function(l,i){return lotXml(l,i===0);}).join("")+'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr></w:p>';
  var doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+
    '<w:sectPr><w:pgSz w:w="'+DOCX_W+'" w:h="'+DOCX_H+'" w:orient="landscape"/><w:pgMar w:top="'+DOCX_M+'" w:right="'+DOCX_M+'" w:bottom="'+DOCX_M+'" w:left="'+DOCX_M+'" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>';
  return zipStore([
    {name:"[Content_Types].xml",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
    {name:"_rels/.rels",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:"word/document.xml",data:doc}
  ]);
}
function nomeArquivo(sel){
  var base=(S.leilao||"leilao").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/leilao especial|gado de corte/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40)||"leilao";
  var ns=sel.map(function(r){return r.lote;}).filter(function(n){return n!=null;}).sort(function(a,b){return a-b;});
  return "fichas-"+base+(ns.length?"-lotes-"+dois(ns[0])+"-a-"+dois(ns[ns.length-1]):"")+".docx";
}
$("gerar").addEventListener("click",async function(){
  var sel=S.rows.filter(function(r){return r.sel;}).slice().sort(function(a,b){return (a.lote||0)-(b.lote||0);});
  if(!sel.length)return;
  var dups=contaDups(),ruins=sel.filter(function(r){return Object.keys(problemas(r,dups)).length;});
  if(ruins.length&&!this.dataset.ok){
    this.dataset.ok="1";var me=this;setTimeout(function(){delete me.dataset.ok;renderBar();},5000);
    this.textContent="Tem campo vermelho. Toque de novo para gerar assim";return;
  }
  delete this.dataset.ok;
  try{
    var url=URL.createObjectURL(buildDocx(sel)),a=document.createElement("a");
    a.href=url;a.download=nomeArquivo(sel);document.body.append(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},60000);
    sel.forEach(function(r){r.feita=true;r.sel=false;r.nova=false;});salvar();render();
    toast(sel.length+(sel.length>1?" fichas baixadas":" ficha baixada")+" em Word.");
  }catch(e){
    toast("Não foi possível gerar o Word agora. Tente de novo.",5000);
  }
});


/* ---------- digitar lote à mão (com a foto da lista ao lado, se quiser) ---------- */
var IDADES=["6/12 M","12/15 M","12/18 M","15/18 M","15/20 M","18/20 M","20/24 M","24/36 M","+36 M"];
var RACAS=["NELORE","½ TABAPUÃ","TABAPUÃ","½ ANGUS","BRANGUS","CRUZ. INDUSTRIAL","CRUZADOS","½ BRAFORD"];
var M={sexo:"",confirmar:null};
var CAMPO_ID={mang:"m-mang",qtde:"m-qtde",vendedor:"m-vend",idade:"m-idade",raca:"m-raca",peso:"m-peso"};
var NOME_CAMPO={lote:"número do lote",mang:"mangueira",qtde:"quantidade",sexo:"sexo",vendedor:"vendedor",idade:"idade",raca:"raça",peso:"peso"};
var TXT_ADD=$("m-add").textContent;
/* ao mexer de novo nos campos, volta ao "Adicionar lote" normal */
["m-lote","m-mang","m-qtde","m-peso","m-vend","m-idade","m-raca"].forEach(function(id){$(id).addEventListener("input",function(){$(id).classList.remove("bad");});});
function opcoes(box,lista,inp){
  lista.forEach(function(v){var b=el("button",null,v);b.type="button";b.dataset.v=v;b.setAttribute("aria-pressed","false");box.append(b);});
  box.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;e.preventDefault();inp.value=b.dataset.v;marcar(box,inp.value);});
  inp.addEventListener("input",function(){marcar(box,inp.value);});
}
function marcar(box,v){[].forEach.call(box.children,function(b){b.setAttribute("aria-pressed",up(b.dataset.v)===up(v)?"true":"false");});}
opcoes($("o-idade"),IDADES,$("m-idade"));
opcoes($("o-raca"),RACAS,$("m-raca"));
$("o-sexo").addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;e.preventDefault();M.sexo=b.dataset.v;marcar($("o-sexo"),M.sexo);});
function proximoLote(){var max=0;S.rows.forEach(function(r){if(r.lote>max)max=r.lote;});return max+1;}
function limparMan(){
  ["m-mang","m-qtde","m-peso","m-vend","m-idade","m-raca"].forEach(function(id){$(id).value="";$(id).classList.remove("bad");});
  $("m-lote").value=dois(proximoLote());M.sexo="";marcar($("o-sexo"),"");marcar($("o-idade"),"");marcar($("o-raca"),"");
  $("o-sexo").classList.remove("bad");M.confirmar=null;$("m-alerta").hidden=true;$("m-add").textContent=TXT_ADD;
}
$("m-limpar").addEventListener("click",function(){limparMan();$("m-status").textContent="";});
$("m-add").addEventListener("click",function(){
  var n=loteN($("m-lote").value);
  $("m-lote").classList.toggle("bad",n==null);
  if(n==null){$("m-status").className="status err";$("m-status").textContent="Coloque o número do lote.";$("m-lote").focus();return;}
  var mg=loteN($("m-mang").value);
  var d={lote:n,mang:mg==null?n:mg,qtde:loteN($("m-qtde").value),sexo:M.sexo,vendedor:up($("m-vend").value),
    idade:up($("m-idade").value),raca:up($("m-raca").value),peso:loteN($("m-peso").value),ord:null,duvida:false};
  /* alerta: diz o que falta e só adiciona assim mesmo no segundo toque */
  var prob=problemas(d,{}),faltas=Object.keys(prob);
  Object.keys(CAMPO_ID).forEach(function(k){var x=$(CAMPO_ID[k]);if(x)x.classList.toggle("bad",!!prob[k]);});
  $("o-sexo").classList.toggle("bad",!!prob.sexo);
  var assin=n+"|"+faltas.join(",");
  if(faltas.length&&M.confirmar!==assin){
    M.confirmar=assin;
    var al=$("m-alerta");al.hidden=false;al.textContent="";
    al.append(el("b",null,"Atenção: falta "+(faltas.length>1?"preencher ":"")+faltas.map(function(k){return NOME_CAMPO[k];}).join(", ")+"."),
      el("span",null,"Complete os campos em vermelho, ou toque em \u201cAdicionar mesmo assim\u201d."));
    $("m-add").textContent="Adicionar mesmo assim";
    var pri=$(CAMPO_ID[faltas[0]]);if(pri)pri.focus();
    return;
  }
  M.confirmar=null;$("m-alerta").hidden=true;$("m-add").textContent=TXT_ADD;
  var ex=S.rows.find(function(x){return x.lote===n;});
  S.rows.forEach(function(x){x.nova=false;});
  if(ex){Object.keys(d).forEach(function(k){if(k!=="ord")ex[k]=d[k];});ex.sel=true;ex.nova=true;}
  else{d.id=seq++;d.feita=false;d.sel=true;d.nova=true;S.rows.push(d);}
  S.rows.sort(function(a,b){return (a.ord!=null&&b.ord!=null?a.ord-b.ord:0)||((a.lote||9999)-(b.lote||9999));});
  salvar();render();
  var falta=Object.keys(problemas(d,{})).length;
  $("m-status").className="status"+(falta?" err":"");
  $("m-status").textContent="Lote "+dois(n)+(ex?" atualizado":" adicionado")+(falta?" sem "+faltas.map(function(k){return NOME_CAMPO[k];}).join(", ")+". Está em vermelho na tabela para completar depois.":".");
  limparMan();$("m-lote").focus();
});
/* Enter num campo passa para o próximo; no último, adiciona */
var ordemCampos=["m-lote","m-mang","m-qtde","m-peso","m-vend","m-idade","m-raca"];
ordemCampos.forEach(function(id,i){$(id).addEventListener("keydown",function(e){
  if(e.key!=="Enter")return;e.preventDefault();
  if(i<ordemCampos.length-1)$(ordemCampos[i+1]).focus();else $("m-add").click();
});});

var fotoUrl=null;
function abrirFoto(f){
  if(fotoUrl)URL.revokeObjectURL(fotoUrl);
  fotoUrl=URL.createObjectURL(f);$("fotoImg").src=fotoUrl;$("fotoVis").classList.remove("z");
  $("man").classList.add("comfoto");$("man").scrollIntoView({behavior:"smooth",block:"start"});
  toast("Foto aberta ao lado dos campos. Digite os lotes olhando para ela.",5000);
}
$("fotoArq").addEventListener("change",function(e){if(e.target.files[0])abrirFoto(e.target.files[0]);e.target.value="";});
$("fotoImg").addEventListener("click",function(){$("fotoVis").classList.toggle("z");});
$("fotoFechar").addEventListener("click",function(){$("man").classList.remove("comfoto");$("fotoImg").removeAttribute("src");if(fotoUrl){URL.revokeObjectURL(fotoUrl);fotoUrl=null;}});

/* ---------- nuvem: dados do ADM num repositório PRIVADO do GitHub ---------- */
var DONO="Leiloingaleiloes", PUB="LOTES", ARQ="fichas-teste.json";
/* TESTE: tudo o que vai para o LOTES fica na pasta teste-v2/, que o site dos produtores não mostra */
var PUB_DIR="teste-v2/";
var RAWPUB="https://raw.githubusercontent.com/"+DONO+"/"+PUB+"/main/"+PUB_DIR;
var GH={token:"",repo:"ADM"};
try{var gx=JSON.parse(localStorage.getItem("leiloinga-adm-gh")||"null");if(gx&&gx.token){GH.token=gx.token;GH.repo=gx.repo||"ADM";}}catch(e){}
var nuvem={sha:null,etag:null,base:null,sujo:false,enviando:false,timer:null};

function api(path,opt){
  opt=opt||{};
  var h={"Accept":"application/vnd.github+json","Authorization":"Bearer "+GH.token,"X-GitHub-Api-Version":"2022-11-28"};
  if(opt.headers)Object.keys(opt.headers).forEach(function(k){h[k]=opt.headers[k];});
  return fetch("https://api.github.com"+path,{method:opt.method||"GET",headers:h,body:opt.body,cache:"no-store"});
}
function b64enc(str){var b=new TextEncoder().encode(str),s="";for(var i=0;i<b.length;i+=0x8000)s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(s);}
function b64dec(b){var s=atob(String(b).replace(/\s/g,"")),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return new TextDecoder().decode(u);}
function caminho(repo,p){if(repo===PUB)p=PUB_DIR+p;return "/repos/"+DONO+"/"+repo+"/contents/"+p.split("/").map(encodeURIComponent).join("/");}
function erroGH(r){var e=new Error("GitHub "+r.status);e.status=r.status;if(r.status===409||r.status===422)e.conflito=true;return e;}
async function lerArq(repo,p,etag){
  var r=await api(caminho(repo,p),etag?{headers:{"If-None-Match":etag}}:{});
  if(r.status===304)return {naoMudou:true};
  if(r.status===404)return {naoExiste:true};
  if(!r.ok)throw erroGH(r);
  var j=await r.json();
  return {sha:j.sha,texto:j.content?b64dec(j.content):"",etag:r.headers.get("ETag")};
}
async function gravarArq(repo,p,b64,sha,msg){
  var body={message:msg||("Atualiza "+p),content:b64};if(sha)body.sha=sha;
  var r=await api(caminho(repo,p),{method:"PUT",body:JSON.stringify(body),headers:{"Content-Type":"application/json"}});
  if(!r.ok)throw erroGH(r);
  var j=await r.json();return j.content.sha;
}
async function apagarArq(repo,p,msg){
  var r=await api(caminho(repo,p));if(!r.ok)return;var j=await r.json();
  await api(caminho(repo,p),{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg||("Apaga "+p),sha:j.sha})});
}
/* grava texto só se mudou; se outro aparelho gravou antes, lê de novo e tenta outra vez */
async function gravarTexto(repo,p,texto,msg){
  for(var t=0;t<4;t++){
    var rr=await lerArq(repo,p);
    if(!rr.naoExiste&&rr.texto===texto)return;
    try{await gravarArq(repo,p,b64enc(texto),rr.sha||null,msg);return;}
    catch(e){if(!e.conflito||t===3)throw e;}
  }
}

function limpo(st){
  st=st||{};
  return {leilao:st.leilao||"",data:st.data||"",totais:st.totais||null,
    rows:(st.rows||[]).map(function(r){var o={};Object.keys(r).forEach(function(k){if(k!=="id")o[k]=r[k];});return o;})};
}
function porLote(st){var m={};((st&&st.rows)||[]).forEach(function(r){if(r.lote!=null)m[r.lote]=r;});return m;}
function js(x){return JSON.stringify(x==null?null:x);}
/* junta as mudanças deste aparelho (desde a última sincronização) com o que está na nuvem */
function mesclar(base,local,remoto){
  base=base||{rows:[]};remoto=remoto||{rows:[]};
  var B=porLote(base),L=porLote(local),res=porLote(remoto);
  Object.keys(L).forEach(function(k){if(js(L[k])!==js(B[k]))res[k]=L[k];});
  Object.keys(B).forEach(function(k){if(!L[k])delete res[k];});
  var out={
    leilao:local.leilao!==base.leilao?local.leilao:(remoto.leilao||""),
    data:local.data!==base.data?local.data:(remoto.data||""),
    totais:js(local.totais)!==js(base.totais)?local.totais:(remoto.totais||null),
    rows:Object.keys(res).map(function(k){return res[k];})
  };
  (local.rows||[]).forEach(function(r){if(r.lote==null)out.rows.push(r);});
  out.rows.sort(function(a,b){return (a.ord!=null&&b.ord!=null?a.ord-b.ord:0)||((a.lote||9999)-(b.lote||9999));});
  return out;
}
function aplicarEstado(novo){
  var x=limpo(novo);x.rows.forEach(function(r){r.id=seq++;});
  S=x;try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}
  render();
}

function estadoNuvem(st){
  var b=$("nuvemBtn"),t=$("nuvemTxt");
  var txt={off:"Só neste aparelho · Conectar",carregando:"Carregando…",salvando:"Salvando…",ok:"Salvo na nuvem",erro:"Sem conexão · tentando"}[st]||st;
  b.className="nuvem "+(st==="ok"?"ok":st==="off"?"off":st==="erro"?"erro":"sync");t.textContent=txt;
}

window.__nuvemSalvar=function(){
  if(!GH.token||!nuvem.base)return;
  nuvem.sujo=true;estadoNuvem("salvando");
  clearTimeout(nuvem.timer);nuvem.timer=setTimeout(enviar,1200);
};
async function enviar(){
  if(nuvem.enviando){clearTimeout(nuvem.timer);nuvem.timer=setTimeout(enviar,800);return;}
  if(!nuvem.sujo)return;
  nuvem.enviando=true;nuvem.sujo=false;
  var inicio=limpo(S),local=inicio;
  try{
    for(var t=0;t<4;t++){
      try{
        nuvem.sha=await gravarArq(GH.repo,ARQ,b64enc(JSON.stringify(local)),nuvem.sha,"Lotes: "+(local.leilao||"fichas"));
        nuvem.base=local;nuvem.etag=null;break;
      }catch(e){
        if(!e.conflito||t===3)throw e;
        var rr=await lerArq(GH.repo,ARQ);
        var remoto={rows:[]};try{remoto=rr.naoExiste?{rows:[]}:JSON.parse(rr.texto||"{}");}catch(_){}
        nuvem.sha=rr.sha||null;
        local=mesclar(nuvem.base,local,remoto);
      }
    }
    /* se outro aparelho mudou algo, mostra aqui sem perder o que foi digitado enquanto enviava */
    if(js(local)!==js(inicio)){aplicarEstado(mesclar(inicio,limpo(S),local));nuvem.sujo=nuvem.sujo||js(limpo(S))!==js(local);}
    estadoNuvem(nuvem.sujo?"salvando":"ok");
  }catch(e){
    nuvem.sujo=true;
    if(e.status===401||e.status===403){estadoNuvem("erro");toast("A chave do GitHub não tem permissão para salvar. Toque no botão da nuvem para conferir.",8000);}
    else{estadoNuvem("erro");clearTimeout(nuvem.timer);nuvem.timer=setTimeout(enviar,10000);}
  }finally{nuvem.enviando=false;if(nuvem.sujo&&!nuvem.timer)nuvem.timer=setTimeout(enviar,1500);}
}
function editando(){if(window.__arrastando)return true;var a=document.activeElement;return !!(a&&(a.tagName==="INPUT"||a.tagName==="TEXTAREA")&&a.closest("#tbody,#man,.leilao,#ordCorpo"));}
async function puxar(){
  if(!GH.token||!nuvem.base||nuvem.sujo||nuvem.enviando||document.hidden||editando())return;
  try{
    var rr=await lerArq(GH.repo,ARQ,nuvem.etag);
    if(rr.naoMudou||rr.naoExiste)return;
    nuvem.etag=rr.etag;
    if(rr.sha===nuvem.sha||nuvem.sujo||nuvem.enviando)return;
    var remoto=JSON.parse(rr.texto||"{}");
    nuvem.sha=rr.sha;nuvem.base=limpo(remoto);aplicarEstado(remoto);
    estadoNuvem("ok");toast("Lotes atualizados pelo outro aparelho.");
  }catch(e){}
  if(MID.carregado)carregarMidia();
}
setInterval(puxar,15000);
document.addEventListener("visibilitychange",function(){if(!document.hidden)puxar();});

async function iniciarNuvem(){
  if(!GH.token){estadoNuvem("off");renderCam();return;}
  estadoNuvem("carregando");
  try{
    var rr=await lerArq(GH.repo,ARQ),local=limpo(S);
    if(rr.naoExiste){nuvem.sha=null;nuvem.base={rows:[]};nuvem.sujo=true;await enviar();}
    else{
      var remoto={rows:[]};try{remoto=JSON.parse(rr.texto||"{}");}catch(e){}
      nuvem.sha=rr.sha;nuvem.etag=rr.etag;
      if(local.rows.length&&!(remoto.rows||[]).length){nuvem.base=limpo(remoto);nuvem.sujo=true;await enviar();}
      else{nuvem.base=limpo(remoto);aplicarEstado(remoto);estadoNuvem("ok");}
    }
  }catch(e){
    estadoNuvem("erro");
    if(e.status===401)toast("A chave do GitHub expirou ou está errada. Toque no botão da nuvem para colar outra.",8000);
  }
  carregarMidia();
}

/* ---------- janela de conexão ---------- */
function abrirConexao(){
  $("c-token").value=GH.token?"••••••••••••":"";$("c-repo").value=GH.repo||"ADM";
  $("c-erro").hidden=true;$("c-sair").hidden=!GH.token;$("conexao").hidden=false;
  setTimeout(function(){$("c-token").focus();},50);
}
function erroConexao(t){var a=$("c-erro");a.textContent=t;a.hidden=false;}
$("nuvemBtn").addEventListener("click",abrirConexao);
$("c-fechar").addEventListener("click",function(){$("conexao").hidden=true;});
$("conexao").addEventListener("click",function(e){if(e.target===$("conexao"))$("conexao").hidden=true;});
$("c-token").addEventListener("focus",function(){if(/^•+$/.test(this.value))this.value="";});
$("c-sair").addEventListener("click",function(){
  try{localStorage.removeItem("leiloinga-adm-gh");}catch(e){}
  GH.token="";nuvem.base=null;nuvem.sha=null;MID.carregado=false;
  $("conexao").hidden=true;estadoNuvem("off");renderCam();toast("Este aparelho foi desconectado da nuvem.");
});
$("c-ok").addEventListener("click",async function(){
  var tok=$("c-token").value.trim(),repo=$("c-repo").value.trim().replace(/^.*\//,"")||"ADM";
  if(/^•+$/.test(tok)||!tok){if(GH.token&&/^•+$/.test(tok)){tok=GH.token;}else return erroConexao("Cole a chave do GitHub (começa com github_pat_).");}
  var b=this;b.disabled=true;b.textContent="Conferindo…";
  var antes={token:GH.token,repo:GH.repo};GH.token=tok;GH.repo=repo;
  try{
    var r1=await api("/repos/"+DONO+"/"+repo);
    if(r1.status===401)throw new Error("A chave está errada ou venceu. Gere outra no GitHub e cole aqui.");
    if(r1.status===404)throw new Error("Não achei o repositório "+DONO+"/"+repo+". Confira o nome e se a chave dá acesso a ele.");
    if(!r1.ok)throw new Error("O GitHub não respondeu ("+r1.status+"). Tente de novo.");
    var j1=await r1.json();
    if(!j1.private)throw new Error("O repositório "+repo+" está público. Os dados têm o nome dos vendedores: deixe ele privado (Settings → Change visibility) e tente de novo.");
    var r2=await api("/repos/"+DONO+"/"+PUB);
    if(!r2.ok)throw new Error("A chave não dá acesso ao repositório "+PUB+" (site dos produtores). Inclua ele na chave.");
    try{localStorage.setItem("leiloinga-adm-gh",JSON.stringify({token:tok,repo:repo}));}catch(e){}
    $("conexao").hidden=true;
    await iniciarNuvem();
    if($("nuvemBtn").classList.contains("ok"))toast("Conectado. Os lotes agora ficam iguais em todos os aparelhos conectados.",6000);
  }catch(e){GH.token=antes.token;GH.repo=antes.repo;erroConexao(e.message||"Não deu para conectar.");}
  finally{b.disabled=false;b.textContent="Conectar";}
});

/* ---------- abas ---------- */
var VIEW="fichas";
try{VIEW=localStorage.getItem("lotes-v2-view")||(window.innerWidth<760?"cam":"fichas");}catch(e){}
function mostrar(v){
  VIEW=v;$("v-fichas").hidden=v!=="fichas";$("v-cam").hidden=v!=="cam";$("v-rel").hidden=v!=="rel";$("v-ord").hidden=v!=="ord";
  document.querySelectorAll(".abas button").forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.v===v));});
  if(window.__depoisMostrar)window.__depoisMostrar(v);
  try{localStorage.setItem("lotes-v2-view",v);}catch(e){}
  if(v==="cam")renderCam();
  if(v==="rel")renderRel();
  if(v==="ord")renderOrd();
}
document.querySelectorAll(".abas button").forEach(function(b){b.addEventListener("click",function(){mostrar(b.dataset.v);});});

/* ---------- câmera: fotos e vídeos de cada lote para o site dos produtores ---------- */
var MID={dados:{},carregado:false};
var ST={};          /* situação do envio, por lote */
async function carregarMidia(){
  if(!GH.token)return;
  try{var rr=await lerArq(PUB,"midia.json");var d={};try{d=JSON.parse(rr.texto||"{}");}catch(e){}MID.dados=d;MID.carregado=true;renderCam();}catch(e){}
}
async function mexerMidia(fn,msg){
  for(var t=0;t<4;t++){
    var rr=await lerArq(PUB,"midia.json"),d={};
    try{d=JSON.parse(rr.texto||"{}");}catch(e){}
    fn(d);
    try{await gravarArq(PUB,"midia.json",b64enc(JSON.stringify(d,null,1)+"\n"),rr.sha||null,msg);MID.dados=d;MID.carregado=true;return;}
    catch(e){if(!e.conflito||t===3)throw e;}
  }
}
function blobB64(b){return new Promise(function(ok,no){var fr=new FileReader();fr.onload=function(){ok(String(fr.result).split(",")[1]);};fr.onerror=function(){no(new Error("leitura"));};fr.readAsDataURL(b);});}
function abrirImg(file){return new Promise(function(ok,no){var u=URL.createObjectURL(file),i=new Image();i.onload=function(){ok({i:i,u:u});};i.onerror=function(){URL.revokeObjectURL(u);no(new Error("Esta foto não abriu. Tente tirar de novo."));};i.src=u;});}
function reduzir(img,max,q){
  var w=img.naturalWidth,h=img.naturalHeight,s=Math.min(1,max/Math.max(w,h)),c=document.createElement("canvas");
  c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  return new Promise(function(ok){c.toBlob(ok,"image/jpeg",q);});
}
function capaVideo(file){
  return new Promise(function(ok){
    var u=URL.createObjectURL(file),v=document.createElement("video"),feito=false;
    v.muted=true;v.playsInline=true;v.setAttribute("playsinline","");v.preload="auto";
    var fim=function(b){if(feito)return;feito=true;try{v.pause();}catch(e){}v.removeAttribute("src");URL.revokeObjectURL(u);ok(b);};
    var tirar=function(){
      try{
        var w=v.videoWidth,h=v.videoHeight;if(!w)return fim(null);
        var s=Math.min(1,960/Math.max(w,h)),c=document.createElement("canvas");
        c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext("2d").drawImage(v,0,0,c.width,c.height);
        c.toBlob(function(b){fim(b);},"image/jpeg",.8);
      }catch(e){fim(null);}
    };
    v.addEventListener("loadeddata",function(){try{v.currentTime=Math.min(.6,(v.duration||2)/3);}catch(e){tirar();}});
    v.addEventListener("seeked",tirar,{once:true});
    v.addEventListener("error",function(){fim(null);});
    setTimeout(function(){if(!feito)tirar();},9000);
    setTimeout(function(){fim(null);},15000);
    v.src=u;try{var p=v.play();if(p&&p.then)p.then(function(){v.pause();}).catch(function(){});}catch(e){}
  });
}
function idCurto(){return Math.random().toString(16).slice(2,10);}
function mb(n){return (n/1048576).toFixed(n>10485760?0:1).replace(".",",")+" MB";}
function statusLote(n,txt,cls){ST[n]={t:txt,c:cls||""};pintarStatus(n);}
function pintarStatus(n){var e=document.querySelector('.lc[data-l="'+n+'"] .lc-st');if(e){var s=ST[n]||{t:"",c:""};e.className="lc-st "+s.c;e.textContent=s.t;}}

var fila=Promise.resolve();
function naFila(fn){var p=fila.then(fn);fila=p.catch(function(){});return p;}

function csvPublico(){
  var L=["LOTE;RAÇA;IDADE;SEXO;QTDE;PESO MÉDIO;MANGUEIRA;OBSERVAÇÃO"];
  S.rows.filter(function(r){return r.lote!=null;}).slice().sort(function(a,b){return a.lote-b.lote;}).forEach(function(r){
    var sx=r.sexo==="M"?"Macho":r.sexo==="F"?"Fêmea":"";
    L.push([r.lote,racaFicha(r.raca),idadeFicha(r.idade),sx,r.qtde==null?"":r.qtde,r.peso==null?"":r.peso,r.mang==null?"":r.mang,""]
      .map(function(x){return String(x).replace(/;/g,",");}).join(";"));
  });
  return L.join("\n")+"\n";
}
/* manda para o site dos produtores só o que é público: sem o nome do vendedor */
async function publicarDados(){
  await gravarTexto(PUB,"lotes.csv",csvPublico(),"Lotes: dados do leilão "+(S.leilao||""));
  /* se a sugestão da aba "Ordem de entrada" já foi mandada pro site (botão), ela vale; senão, a ordem do PDF do sistema */
  var pubs=S.rows.filter(function(r){return r.osPub!=null&&r.lote!=null;});
  var ord=pubs.length?pubs.sort(function(a,b){return a.osPub-b.osPub;}):S.rows.filter(function(r){return r.ord!=null&&r.lote!=null;}).sort(function(a,b){return a.ord-b.ord;});
  if(ord.length)await gravarTexto(PUB,"ordem.txt",ord.map(function(r){return r.lote;}).join("\n")+"\n","Lotes: ordem de entrada");
  await gravarTexto(PUB,"leilao.json",JSON.stringify({nome:S.leilao||"",data:S.data||""})+"\n","Lotes: leilão atual");
}
var LEILAO_PUB=null;
async function lerLeilaoPub(){var rr=await lerArq(PUB,"leilao.json");var x={};try{x=JSON.parse(rr.texto||"{}");}catch(e){}LEILAO_PUB=x;return x;}
/* antes de mandar fotos de um leilão novo, tira do site as do leilão anterior */
async function conferirLeilaoNovo(){
  var pub=LEILAO_PUB||await lerLeilaoPub();
  if(!S.data||!pub.data||pub.data===S.data)return true;
  var ok=window.confirm("A pasta de teste ainda mostra o leilão de "+pub.data+(pub.nome?" ("+pub.nome+")":"")+".\n\nOK = começar o leilão de "+S.data+" no site (as fotos e vídeos do leilão anterior saem do site)\nCancelar = não enviar agora");
  if(!ok)return false;
  await mexerMidia(function(d){Object.keys(d).forEach(function(k){delete d[k];});},"Lotes: começa o leilão de "+S.data);
  await publicarDados();LEILAO_PUB={nome:S.leilao||"",data:S.data||""};
  return true;
}

async function enviarArquivos(n,lista){
  if(!GH.token){abrirConexao();return;}
  lista=Array.prototype.slice.call(lista||[]);if(!lista.length)return;
  return naFila(async function(){
    try{
      if(!(await conferirLeilaoNovo())){statusLote(n,"Envio cancelado.","err");return;}
      var dir="midia/lote-"+dois(n)+"/",feitos=0;
      for(var i=0;i<lista.length;i++){
        var f=lista[i],id=idCurto(),qual=lista.length>1?" ("+(i+1)+" de "+lista.length+")":"";
        var ehVideo=/^video\//.test(f.type)||/\.(mov|mp4|m4v|webm|3gp)$/i.test(f.name||"");
        if(ehVideo){
          if(f.size>95*1048576){statusLote(n,"Vídeo de "+mb(f.size)+" é grande demais (máximo 95 MB). Grave mais curto ou em 1080p.","err");continue;}
          statusLote(n,"Preparando vídeo"+qual+"…","run");
          var capa=await capaVideo(f);
          var ext=((f.name||"").match(/\.(mov|mp4|m4v|webm|3gp)$/i)||[0,/quicktime/.test(f.type)?"mov":"mp4"])[1].toLowerCase();if(ext==="m4v")ext="mp4";
          var src=dir+"video-"+id+"."+ext;
          statusLote(n,"Enviando vídeo"+qual+" · "+mb(f.size)+"… não feche a página","run");
          await gravarArq(PUB,src,await blobB64(f),null,"Lote "+dois(n)+": vídeo");
          var capaP="";
          if(capa){capaP=dir+"video-"+id+"-capa.jpg";await gravarArq(PUB,capaP,await blobB64(capa),null,"Lote "+dois(n)+": capa do vídeo");}
          await mexerMidia(function(d){var m=d[String(n)]=d[String(n)]||{};m.fotos=m.fotos||[];m.videos=m.videos||[];m.videos.push({src:src,capa:capaP});},"Lote "+dois(n)+": novo vídeo");
        }else{
          statusLote(n,"Preparando foto"+qual+"…","run");
          var im=await abrirImg(f),grande=await reduzir(im.i,1600,.82),mini=await reduzir(im.i,520,.74);URL.revokeObjectURL(im.u);
          var fs=dir+"foto-"+id+".jpg",fm=dir+"foto-"+id+"-mini.jpg";
          statusLote(n,"Enviando foto"+qual+"…","run");
          await gravarArq(PUB,fs,await blobB64(grande),null,"Lote "+dois(n)+": foto");
          await gravarArq(PUB,fm,await blobB64(mini),null,"Lote "+dois(n)+": miniatura");
          await mexerMidia(function(d){var m=d[String(n)]=d[String(n)]||{};m.fotos=m.fotos||[];m.videos=m.videos||[];m.fotos.push({src:fs,mini:fm});},"Lote "+dois(n)+": nova foto");
        }
        feitos++;renderCam();
      }
      if(feitos){
        statusLote(n,"Atualizando os dados no site…","run");
        await publicarDados();
        statusLote(n,"✓ Enviado para a pasta de teste (não aparece no site dos produtores).","");
      }
    }catch(e){
      statusLote(n,e.status===401||e.status===403?"A chave do GitHub não deixou enviar. Toque no botão da nuvem.":(e.message&&!/^GitHub/.test(e.message)?e.message:"Não enviou. Confira a internet e tente de novo."),"err");
    }
    renderCam();
  });
}
async function removerMidia(n,tipo,idx){
  return naFila(async function(){
    var m=(MID.dados[String(n)]||{})[tipo]||[],item=m[idx];if(!item)return;
    statusLote(n,"Tirando do site…","run");
    try{
      await mexerMidia(function(d){var x=d[String(n)];if(!x||!x[tipo])return;x[tipo]=x[tipo].filter(function(it){return it.src!==item.src;});
        if(!(x.fotos||[]).length&&!(x.videos||[]).length)delete d[String(n)];},"Lote "+dois(n)+": tira "+(tipo==="videos"?"vídeo":"foto"));
      [item.src,item.mini,item.capa].filter(Boolean).forEach(function(p){apagarArq(PUB,p,"Lote "+dois(n)+": apaga arquivo").catch(function(){});});
      statusLote(n,"Tirado do site.","");
    }catch(e){statusLote(n,"Não deu para tirar agora. Tente de novo.","err");}
    renderCam();
  });
}

/* campos de arquivo fixos (fora dos cartões), para o iPhone abrir a câmera com segurança */
var ARQ_CAM=null,ARQ_GAL=null,LOTE_ESCOLHIDO=null;
function criarArq(cam){
  var i=document.createElement("input");i.type="file";i.className="arqcam";i.accept="image/*,video/*";i.tabIndex=-1;i.setAttribute("aria-hidden","true");
  if(cam)i.setAttribute("capture","environment");else i.multiple=true;
  i.addEventListener("change",function(){var n=LOTE_ESCOLHIDO,fs=Array.prototype.slice.call(this.files||[]);this.value="";if(n!=null&&fs.length)enviarArquivos(n,fs);});
  document.body.appendChild(i);return i;
}
function escolher(n,modo){
  if(!GH.token){abrirConexao();return;}
  LOTE_ESCOLHIDO=n;
  if(!ARQ_CAM)ARQ_CAM=criarArq(true);
  if(!ARQ_GAL)ARQ_GAL=criarArq(false);
  (modo==="cam"?ARQ_CAM:ARQ_GAL).click();
}
var CAM_CHAVE="",CAM_SEXO="";
window.__camSexo=function(s){CAM_SEXO=s||"";renderCam();};
window.__renderCam=renderCam;
function renderCam(){
  var box=$("cams");if(!box||$("v-cam").hidden)return;
  /* só redesenha se algo mudou (não atrapalha quem está tocando nos botões) */
  var chave=JSON.stringify([!!GH.token,S.leilao,S.data,$("camBusca").value,$("camSo").checked,CAM_SEXO,S.rows.map(function(r){return [r.lote,r.qtde,r.sexo,r.peso,r.raca,r.idade,r.vendedor];}),MID.dados]);
  if(chave===CAM_CHAVE&&box.childElementCount)return;
  CAM_CHAVE=chave;
  var aviso=$("camAviso");
  if(!GH.token){
    aviso.hidden=false;aviso.innerHTML="";
    aviso.append(el("span",null,"Para enviar fotos e vídeos ao site, conecte este aparelho à nuvem (uma vez só)."));
    var bc=el("button","btn pri","Conectar");bc.type="button";bc.onclick=abrirConexao;aviso.append(bc);
  }else aviso.hidden=true;
  $("camLeilao").textContent=S.leilao?(S.leilao+(S.data?" · "+S.data:"")):"";
  var q=($("camBusca").value||"").replace(/\D/g,""),so=$("camSo").checked;
  var rows=S.rows.filter(function(r){return r.lote!=null;}).slice().sort(function(a,b){return a.lote-b.lote;});
  var foco=document.activeElement&&document.activeElement.closest&&document.activeElement.closest(".lc");
  box.textContent="";
  if(!rows.length){
    var v=el("div","vazio2");v.append(el("b",null,"Nenhum lote ainda"),document.createTextNode("Os lotes aparecem aqui depois que entram nas fichas (PDF da ordem de entrada ou digitados)."));box.append(v);return;
  }
  var mostrados=0;
  rows.forEach(function(r){
    var m=MID.dados[String(r.lote)]||{},fotos=m.fotos||[],videos=m.videos||[],tem=fotos.length+videos.length>0;
    if(q&&String(r.lote).indexOf(String(Number(q)))!==0&&dois(r.lote).indexOf(q)!==0)return;
    if(so&&tem)return;
    if(CAM_SEXO&&r.sexo!==CAM_SEXO)return;
    mostrados++;
    var c=el("div","lc"+(tem?" tem":""));c.dataset.l=r.lote;
    /* linha 1: número do lote, sexo e se já tem foto · linha 2: cabeças e peso · linha 3: raça e idade · linha 4: vendedor */
    var h=el("div","lc-h"),tg=el("span","tag",dois(r.lote));
    var sx=el("span","lc-sexo"+(r.sexo==="M"?" m":r.sexo==="F"?" f":""),r.sexo==="M"?"Machos":r.sexo==="F"?"Fêmeas":"Sem sexo");
    var qm=[fotos.length?fotos.length+(fotos.length>1?" fotos":" foto"):"",videos.length?videos.length+(videos.length>1?" vídeos":" vídeo"):""].filter(Boolean).join(" · ");
    h.append(tg,sx,el("span","lc-sit"+(tem?" ok":""),tem?"📷 "+qm:"⚪ Falta foto"));c.append(h);
    var inf=el("div","lc-info");
    inf.append(el("b",null,[r.qtde!=null?r.qtde+" cab.":"",r.peso!=null?r.peso+" kg":""].filter(Boolean).join(" · ")||"Lote "+dois(r.lote)));
    var rc=[racaFicha(r.raca),idadeFicha(r.idade)].filter(Boolean).join(" · ");if(rc)inf.append(el("span","lc-raca",rc));
    if(r.vendedor)inf.append(el("span","lc-vend",r.vendedor));
    c.append(inf);
    if(tem){
      var th=el("div","thumbs");
      videos.forEach(function(it,i){th.append(miniatura(r.lote,"videos",i,it.capa,"VÍDEO"));});
      fotos.forEach(function(it,i){th.append(miniatura(r.lote,"fotos",i,it.mini||it.src,"FOTO"));});
      c.append(th);
    }
    var a=el("div","lc-a");
    var l1=el("button","btn cam","📷 Filmar / foto");l1.type="button";l1.setAttribute("aria-label","Filmar ou fotografar o lote "+dois(r.lote));
    l1.addEventListener("click",function(){escolher(r.lote,"cam");});
    var l2=el("button","btn","Da galeria");l2.type="button";l2.setAttribute("aria-label","Escolher da galeria para o lote "+dois(r.lote));
    l2.addEventListener("click",function(){escolher(r.lote,"gal");});
    a.append(l1,l2);c.append(a);
    var st=el("div","lc-st");c.append(st);
    box.append(c);pintarStatus(r.lote);
  });
  if(!mostrados){var v2=el("div","vazio2");v2.append(el("b",null,q?"Nenhum lote "+q:so?"Todos estes lotes já têm mídia":"Nenhum lote neste filtro"));box.append(v2);}
}
function miniatura(n,tipo,i,src,rot){
  var d=el("div","th");
  if(src){var im=document.createElement("img");im.loading="lazy";im.alt=rot+" do lote "+dois(n);im.src=RAWPUB+src;d.append(im);}
  d.append(el("span","tipo",rot));
  var b=el("button","rm","×");b.type="button";b.setAttribute("aria-label","Tirar do site");
  b.addEventListener("click",function(){
    if(!b.classList.contains("armado")){b.classList.add("armado");b.textContent="Tirar";setTimeout(function(){b.classList.remove("armado");b.textContent="×";},4000);return;}
    removerMidia(n,tipo,i);
  });
  d.append(b);return d;
}
$("camBusca").addEventListener("input",renderCam);
$("camSo").addEventListener("change",renderCam);
$("pubDados").addEventListener("click",async function(){
  if(!GH.token){abrirConexao();return;}
  var b=this;b.disabled=true;b.textContent="Atualizando…";
  try{await naFila(publicarDados);toast("Dados dos lotes atualizados na pasta de teste (sem o nome do vendedor).");}
  catch(e){toast("Não deu para atualizar o site agora. Tente de novo.",6000);}
  finally{b.disabled=false;b.textContent="Atualizar dados no site";}
});
var novoArm=false;
$("novoLeilao").addEventListener("click",async function(){
  if(!GH.token){abrirConexao();return;}
  var b=this;
  if(!novoArm){novoArm=true;b.textContent="Toque de novo: tira todas as fotos e vídeos do site";setTimeout(function(){novoArm=false;b.textContent="Começar leilão novo no site";},5000);return;}
  novoArm=false;b.disabled=true;b.textContent="Limpando…";
  try{
    await naFila(async function(){await mexerMidia(function(d){Object.keys(d).forEach(function(k){delete d[k];});},"Lotes: começa leilão novo");await publicarDados();LEILAO_PUB={nome:S.leilao||"",data:S.data||""};});
    toast("Pasta de teste zerada para o leilão novo.",6000);renderCam();
  }catch(e){toast("Não deu para limpar o site agora. Tente de novo.",6000);}
  finally{b.disabled=false;b.textContent="Começar leilão novo no site";}
});


/* ---------- relatório: machos e fêmeas por faixa de peso ---------- */
var FAIXAS=[{t:"Até 200 kg",f:function(p){return p<=200;}},{t:"De 201 a 300 kg",f:function(p){return p>200&&p<=300;}},{t:"Acima de 300 kg",f:function(p){return p>300;}}];
function fmtKg(n){return Math.round(n).toLocaleString("pt-BR");}
window.__renderRel=renderRel;
function renderRel(){
  var box=$("relCorpo");if(!box||$("v-rel").hidden)return;
  box.textContent="";
  $("relLeilao").textContent=S.leilao?(S.leilao+(S.data?" · "+S.data:"")):"";
  var rows=S.rows.filter(function(r){return r.lote!=null;});
  if(!rows.length){var v=el("div","vazio2");v.append(el("b",null,"Nenhum lote ainda"),document.createTextNode("O relatório aparece quando os lotes entram nas fichas."));box.append(v);return;}
  var validos=rows.filter(function(r){return (r.sexo==="M"||r.sexo==="F")&&r.peso!=null&&r.qtde>0;});
  var fora=rows.filter(function(r){return validos.indexOf(r)<0;});
  var cab=0,soma=0;validos.forEach(function(r){cab+=r.qtde;soma+=r.qtde*r.peso;});
  var tot=el("div","reltotal");
  [["Lotes",String(validos.length)],["Animais",String(cab)],["Peso médio geral",cab?fmtKg(soma/cab)+" kg":"–"],["Peso total",cab?fmtKg(soma)+" kg":"–"]].forEach(function(x){var d=el("div");d.append(el("span","k",x[0]),el("b",null,x[1]));tot.append(d);});
  box.append(tot);
  if(fora.length){box.append(el("div","relaviso","Ficaram de fora "+fora.length+(fora.length>1?" lotes":" lote")+" sem sexo, peso ou quantidade: "+fora.map(function(r){return dois(r.lote);}).join(", ")+". Complete na aba Fichas."));}
  [["M","Machos"],["F","Fêmeas"]].forEach(function(sx){
    var dosexo=validos.filter(function(r){return r.sexo===sx[0];});
    var cs=0,ps=0;dosexo.forEach(function(r){cs+=r.qtde;ps+=r.qtde*r.peso;});
    var sec=el("section","relsexo"),h=el("h3",null,sx[1]);
    h.append(el("small",null,dosexo.length+" lotes · "+cs+" animais"+(cs?" · média "+fmtKg(ps/cs)+" kg":"")));
    sec.append(h);
    var g=el("div","relgrid");
    FAIXAS.forEach(function(fx){
      var ls=dosexo.filter(function(r){return fx.f(r.peso);}).sort(function(a,b){return a.lote-b.lote;});
      var c=0,p=0;ls.forEach(function(r){c+=r.qtde;p+=r.qtde*r.peso;});
      var card=el("div","faixa"+(ls.length?"":" vazia"));
      card.append(el("div","ft",sx[1]+" · "+fx.t));
      var md=el("div","media");md.append(el("b",null,c?fmtKg(p/c):"–"),el("span",null,c?"kg de média":"sem lotes"));card.append(md);
      var mi=el("div","mini");
      [["Animais",String(c)],["Lotes",String(ls.length)]].forEach(function(x){var d=el("div");d.append(el("span","k",x[0]),el("b",null,x[1]));mi.append(d);});
      card.append(mi);
      if(ls.length){var lt=el("div","lotes");lt.append(el("b",null,"Lotes: "),document.createTextNode(ls.map(function(r){return dois(r.lote)+" ("+r.qtde+" × "+r.peso+")";}).join(", ")));card.append(lt);}
      g.append(card);
    });
    sec.append(g);box.append(sec);
  });
}
/* ---------- sugestão de ordem de entrada (editável: número, arrastar ou setinhas) ---------- */
/* a posição fica em cada lote (campo "os"), então sincroniza na nuvem junto com as fichas */
function semAcento(s){return up(s).normalize("NFD").replace(/[̀-ͯ]/g,"");}
function grupoRaca(raca){
  var s=semAcento(raca).replace(/^(½|1\/2)\s*/,"");
  if(/ANELORAD/.test(s))return 1;
  if(/NELORE|TABAPUA/.test(s))return 0;
  if(/BRAHMAN|GIR\b|GUZERA/.test(s))return 1;
  if(/ANGUS|BRANGUS|BRAFORD|HEREFORD|CHAROL|SIMENTAL|LIMOUSIN|SENEPOL|WAGYU|DEVON/.test(s))return 2;
  if(/INDUSTRIAL/.test(s))return 3;
  if(/CANCHI/.test(s))return 4;
  if(/CRUZAD/.test(s))return 6;
  return 5;
}
function ehVaca(r){var s=up(r.idade),m;if(/^\+/.test(s))return true;if((m=s.match(/^(\d+)/))&&+m[1]>=36)return true;return /VACA/.test(up(r.raca));}
function chaveOrd(r){
  var sx=r.sexo==="M"?0:r.sexo==="F"?1:2;
  var balde=r.peso==null?3:ehVaca(r)?2:(r.qtde!=null&&r.qtde<=2)?1:0;
  return [sx,balde,grupoRaca(r.raca),r.peso==null?9999:r.peso,r.lote==null?9999:r.lote];
}
function cmpOrd(a,b){var x=chaveOrd(a),y=chaveOrd(b);for(var i=0;i<x.length;i++){if(x[i]!==y[i])return x[i]-y[i];}return 0;}
function ordLista(){return S.rows.filter(function(r){return r.lote!=null&&r.os!=null;}).sort(function(a,b){return a.os-b.os;});}
/* dá posição aos lotes que ainda não têm: se já existe uma ordem, encaixa cada lote novo onde a regra mandaria */
var ORD_NOVOS={};
function garantirOrdem(){
  var rows=S.rows.filter(function(r){return r.lote!=null;});
  var com=rows.filter(function(r){return r.os!=null;}).sort(function(a,b){return a.os-b.os;});
  var sem=rows.filter(function(r){return r.os==null;}).sort(cmpOrd);
  var lista=com.slice();
  sem.forEach(function(n){
    if(com.length)ORD_NOVOS[n.id]=true;
    var i=lista.findIndex(function(x){return cmpOrd(n,x)<0;});
    if(i<0)lista.push(n);else lista.splice(i,0,n);
  });
  var mudou=false;
  lista.forEach(function(r,i){if(r.os!==i+1){r.os=i+1;mudou=true;}});
  S.rows.forEach(function(r){if(r.lote==null&&r.os!=null){delete r.os;mudou=true;}});
  return {mudou:mudou,novos:com.length?sem.length:0};
}
function moverPara(r,pos){
  var l=ordLista(),i=l.indexOf(r);if(i<0)return false;
  pos=Math.max(0,Math.min(l.length-1,pos));if(pos===i)return false;
  l.splice(i,1);l.splice(pos,0,r);l.forEach(function(x,k){x.os=k+1;});return true;
}
var ORD_FOCO=null;   /* {id, alvo:"mexe"|"on"} para devolver o foco depois de redesenhar */
function depoisDeMover(r,alvo){ORD_FOCO={id:r.id,alvo:alvo};salvar();renderOrd();}
window.__renderOrd=renderOrd;
function renderOrd(){
  var box=$("ordCorpo");if(!box||$("v-ord").hidden||window.__arrastando)return;
  var g=garantirOrdem();
  if(g.mudou)salvar();
  if(g.novos)toast(g.novos+(g.novos>1?" lotes novos foram encaixados":" lote novo foi encaixado")+" na ordem pela regra.",5000);
  var l=ordLista(),cab=0;l.forEach(function(r){cab+=r.qtde||0;});
  situacaoSite(l);
  $("ordLeilao").textContent=[S.leilao,S.data,l.length?l.length+" lotes · "+cab+" cabeças":""].filter(Boolean).join(" · ");
  box.textContent="";
  if(!l.length){var v=el("div","vazio2");v.append(el("b",null,"Nenhum lote ainda"),document.createTextNode("A sugestão aparece quando os lotes entram nas fichas (PDF da ordem de entrada ou digitados)."));box.append(v);return;}
  var cabec=el("div","ocab");
  ["Ordem","","Lote","Sexo","Raça","Idade","Qtde","Peso","Vendedor"].forEach(function(t){cabec.append(el("span",null,t));});
  box.append(cabec);
  var ol=el("ol","olist");ol.id="olist";
  /* separador a cada troca de sexo (Machos / Fêmeas), com a conta daquele trecho */
  var i=0;
  while(i<l.length){
    var sx=l[i].sexo,j=i,cs=0;while(j<l.length&&l[j].sexo===sx){cs+=l[j].qtde||0;j++;}
    var sep=el("li","osep",sx==="M"?"Machos":sx==="F"?"Fêmeas":"Sem sexo");sep.setAttribute("aria-hidden","true");
    sep.append(el("small",null,(j-i)+(j-i>1?" lotes":" lote")+" · "+cs+" cab."));ol.append(sep);
    for(var k=i;k<j;k++)ol.append(linhaOrd(l[k],l.length));
    i=j;
  }
  box.append(ol);
  if(ORD_FOCO){
    var f=ORD_FOCO;ORD_FOCO=null;
    var li=ol.querySelector('.orow[data-id="'+f.id+'"]');
    if(li){li.classList.add("pisca");var alvo=li.querySelector(f.alvo==="on"?".on":".mexe");if(alvo){alvo.focus({preventScroll:true});}
      var rc=li.getBoundingClientRect();if(rc.top<60||rc.bottom>window.innerHeight-20)li.scrollIntoView({block:"center",behavior:"smooth"});}
  }
  Object.keys(ORD_NOVOS).forEach(function(id){var li=ol.querySelector('.orow[data-id="'+id+'"]');if(li)li.classList.add("pisca");});
  ORD_NOVOS={};
}
function linhaOrd(r,total){
  var li=el("li","orow");li.dataset.id=r.id;
  var on=document.createElement("input");on.className="on";on.value=String(r.os);on.inputMode="numeric";on.autocomplete="off";
  on.setAttribute("aria-label","Ordem de entrada do lote "+dois(r.lote)+" (1 a "+total+")");
  var mx=el("button","mexe");mx.type="button";mx.title="Arraste para mudar a ordem. Toque na seta de cima para subir, na de baixo para descer.";
  mx.setAttribute("aria-label","Mover o lote "+dois(r.lote)+": arraste, ou use as setas do teclado");
  mx.append(el("span",null,"▲"),el("span",null,"▼"));
  var sx=r.sexo==="M"?el("span","pill m","Macho"):r.sexo==="F"?el("span","pill fe","Fêmea"):el("span","pill w","?");
  var cSx=el("span","cel");cSx.append(sx);
  var desc=el("div","desc");
  desc.append(el("b",null,[r.sexo==="M"?"Macho":r.sexo==="F"?"Fêmea":"",racaFicha(r.raca),idadeFicha(r.idade)].filter(Boolean).join(" · ")||"Lote "+dois(r.lote)));
  desc.append(el("span",null,[r.qtde!=null?r.qtde+" cab.":"",r.peso!=null?r.peso+" kg":"sem peso",r.vendedor].filter(Boolean).join(" · ")));
  li.append(on,mx,el("span","tag",dois(r.lote)),cSx,el("span","cel",racaFicha(r.raca)||"–"),el("span","cel",idadeFicha(r.idade)||"–"),
    el("span","cel",r.qtde!=null?dois(r.qtde):"–"),el("span","cel",r.peso!=null?r.peso+" kg":"–"),el("span","cel vend",r.vendedor||""),desc);
  return li;
}
/* digitar o número da ordem */
$("ordCorpo").addEventListener("change",function(e){
  var t=e.target;if(!t.classList.contains("on"))return;
  var r=achar(t.closest(".orow").dataset.id);if(!r)return;
  var n=parseInt(String(t.value).replace(/\D/g,""),10);
  if(!(n>0)){t.value=String(r.os);return;}
  if(moverPara(r,n-1))depoisDeMover(r,"on");else t.value=String(r.os);
});
$("ordCorpo").addEventListener("keydown",function(e){
  var t=e.target;
  if(t.classList.contains("on")&&e.key==="Enter"){e.preventDefault();t.blur();return;}
  if(t.classList.contains("mexe")&&(e.key==="ArrowUp"||e.key==="ArrowDown")){
    e.preventDefault();var r=achar(t.closest(".orow").dataset.id);if(!r)return;
    if(moverPara(r,r.os-1+(e.key==="ArrowUp"?-1:1)))depoisDeMover(r,"mexe");
  }
});
$("ordCorpo").addEventListener("focusin",function(e){if(e.target.classList.contains("on"))e.target.select();});
/* arrastar pelo botão ▲▼ (mouse, dedo ou caneta); toque curto = sobe ou desce uma posição */
var DR=null,DR_T=null;
function ordReposicionar(){
  if(!DR)return;
  var ol=$("olist");if(!ol)return;
  var rows=[].filter.call(ol.querySelectorAll(".orow"),function(x){return x!==DR.li;});
  var alvo=null;
  for(var i=0;i<rows.length;i++){var rc=rows[i].getBoundingClientRect();if(DR.y<rc.top+rc.height/2){alvo=rows[i];break;}}
  if(alvo){if(DR.li.nextElementSibling!==alvo)ol.insertBefore(DR.li,alvo);}
  else if(ol.lastElementChild!==DR.li)ol.appendChild(DR.li);
}
$("ordCorpo").addEventListener("pointerdown",function(e){
  var h=e.target.closest(".mexe");if(!h||(e.button!=null&&e.button>0))return;
  e.preventDefault();
  DR={h:h,li:h.closest(".orow"),pid:e.pointerId,y0:e.clientY,y:e.clientY,moveu:false};
  try{h.setPointerCapture(e.pointerId);}catch(_){}
});
document.addEventListener("pointermove",function(e){
  if(!DR||e.pointerId!==DR.pid)return;
  DR.y=e.clientY;
  if(!DR.moveu&&Math.abs(DR.y-DR.y0)>6){
    DR.moveu=true;window.__arrastando=true;DR.li.classList.add("arrasta");
    clearInterval(DR_T);
    DR_T=setInterval(function(){
      if(!DR)return;
      var m=70,v=0;if(DR.y<m)v=-Math.ceil((m-DR.y)/4);else if(DR.y>window.innerHeight-m)v=Math.ceil((DR.y-(window.innerHeight-m))/4);
      if(v){window.scrollBy(0,v);ordReposicionar();}
    },16);
  }
  if(DR.moveu){e.preventDefault();ordReposicionar();}
},{passive:false});
function ordSoltar(e){
  if(!DR||e.pointerId!==DR.pid)return;
  clearInterval(DR_T);DR_T=null;
  var d=DR;DR=null;window.__arrastando=false;d.li.classList.remove("arrasta");
  try{d.h.releasePointerCapture(d.pid);}catch(_){}
  var r=achar(d.li.dataset.id);if(!r){renderOrd();return;}
  if(d.moveu){
    var ids=[].map.call($("olist").querySelectorAll(".orow"),function(x){return Number(x.dataset.id);});
    ids.forEach(function(id,k){var x=achar(id);if(x)x.os=k+1;});
    depoisDeMover(r,"mexe");
  }else if(e.type==="pointerup"){
    var rc=d.h.getBoundingClientRect(),subir=e.clientY<rc.top+rc.height/2;
    if(moverPara(r,r.os-1+(subir?-1:1)))depoisDeMover(r,"mexe");
    else{toast(subir?"O lote "+dois(r.lote)+" já é o primeiro.":"O lote "+dois(r.lote)+" já é o último.");}
  }else renderOrd();
}
document.addEventListener("pointerup",ordSoltar);
document.addEventListener("pointercancel",ordSoltar);
var ordArm=false,ordArmT=null;
$("ordRefazer").addEventListener("click",function(){
  var b=this;
  if(!ordArm){ordArm=true;b.textContent="Toque de novo: desfaz as mudanças à mão";clearTimeout(ordArmT);ordArmT=setTimeout(function(){ordArm=false;b.textContent="Refazer sugestão";},4500);return;}
  ordArm=false;clearTimeout(ordArmT);b.textContent="Refazer sugestão";
  S.rows.forEach(function(r){delete r.os;});
  renderOrd();toast("Ordem refeita pela regra.");
});
$("ordImprimir").addEventListener("click",function(){window.print();});

/* ---------- ordem: mandar pro site dos produtores (só quando tocar no botão) ---------- */
function situacaoSite(l){
  var e=$("ordSiteSit");if(!e)return;
  var pub=S.rows.filter(function(r){return r.osPub!=null&&r.lote!=null;});
  if(!pub.length){e.className="";e.textContent="· esta ordem ainda não foi pro site";return;}
  var igual=pub.length===l.length&&l.every(function(r){return r.osPub===r.os;});
  e.className=igual?"ok":"dif";e.textContent=igual?"· ✓ o site está com esta ordem":"· o site está com a ordem antiga (mudou depois de mandar)";
}
var siteArm=false,siteArmT=null;
$("ordSite").addEventListener("click",async function(){
  if(!GH.token){abrirConexao();return;}
  var l=ordLista();if(!l.length){toast("Ainda não tem lotes na ordem.");return;}
  var b=this;
  if(!siteArm){siteArm=true;b.textContent="Toque de novo para mandar pro site";clearTimeout(siteArmT);siteArmT=setTimeout(function(){siteArm=false;b.textContent="Mandar esta ordem pro site";},5000);return;}
  siteArm=false;clearTimeout(siteArmT);b.disabled=true;b.textContent="Mandando…";
  var antes={};S.rows.forEach(function(r){antes[r.id]=r.osPub;});
  try{
    await naFila(async function(){
      if(!(await conferirLeilaoNovo()))throw new Error("cancelado");
      S.rows.forEach(function(r){if(r.lote!=null&&r.os!=null)r.osPub=r.os;else delete r.osPub;});
      await publicarDados();
    });
    salvar();renderOrd();
    toast("Ordem de entrada mandada para a pasta de teste. O site dos produtores não muda.",6000);
  }catch(e){
    S.rows.forEach(function(r){if(antes[r.id]==null)delete r.osPub;else r.osPub=antes[r.id];});
    if(!(e&&e.message==="cancelado"))toast(e&&(e.status===401||e.status===403)?"A chave do GitHub não deixou mandar. Toque no botão da nuvem.":"Não deu para mandar pro site agora. Confira a internet e tente de novo.",7000);
  }finally{b.disabled=false;b.textContent="Mandar esta ordem pro site";}
});

/* ---------- ordem: só os números dos lotes, em PDF ou Word, para mandar pelo WhatsApp ---------- */
function ordTitulo(){return [S.leilao,S.data].filter(Boolean).join(" · ");}
function ordNomeArq(ext){
  var base=(S.leilao||"leilao").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/gado de corte/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,40)||"leilao";
  return "ordem-de-entrada-"+base+"."+ext;
}
/* colunas: até 31 lotes por coluna, até 4 colunas por folha */
var ORD_POR_COL=31;
function pdfEsc(s){
  var o="";
  for(var i=0;i<s.length;i++){
    var c=s.charCodeAt(i),ch=s.charAt(i);
    if(ch==="("||ch===")"||ch==="\\")o+="\\"+ch;
    else if(c>=32&&c<127)o+=ch;
    else{var w={8211:150,8212:151,8226:149,8220:147,8221:148,8216:145,8217:146}[c]||(c>=160&&c<256?c:63);o+="\\"+("00"+w.toString(8)).slice(-3);}
  }
  return o;
}
function ordPdf(l){
  var W=595,H=842,M=42,colW=(W-2*M)/4,porPag=ORD_POR_COL*4,pags=[];
  for(var p=0;p*porPag<l.length;p++){
    var pedaco=l.slice(p*porPag,(p+1)*porPag),c=[];
    var t=function(x,y,fonte,tam,txt,cinza){c.push("BT /"+fonte+" "+tam+" Tf "+(cinza?"0.38 0.42 0.39 rg":"0.07 0.15 0.10 rg")+" "+x.toFixed(1)+" "+y.toFixed(1)+" Td ("+pdfEsc(txt)+") Tj ET");};
    t(M,H-58,"F2",22,"ORDEM DE ENTRADA");
    var sub=ordTitulo();if(sub)t(M,H-80,"F1",12,sub,true);
    t(M,H-98,"F1",11,l.length+" lotes"+(pags.length||l.length>porPag?" · folha "+(p+1)+" de "+Math.ceil(l.length/porPag):""),true);
    c.push("0.12 0.54 0.26 RG 1.5 w "+M+" "+(H-110)+" m "+(W-M)+" "+(H-110)+" l S");
    pedaco.forEach(function(r,k){
      var col=Math.floor(k/ORD_POR_COL),lin=k%ORD_POR_COL,x=M+col*colW,y=H-138-lin*22;
      t(x,y,"F1",11,r.os+"º",true);
      t(x+40,y,"F2",15,dois(r.lote));
    });
    pags.push(c.join("\n"));
  }
  var objs=[],n=pags.length;
  objs[1]="<< /Type /Catalog /Pages 2 0 R >>";
  var kids=[];for(var i=0;i<n;i++)kids.push((5+2*i)+" 0 R");
  objs[2]="<< /Type /Pages /Kids ["+kids.join(" ")+"] /Count "+n+" >>";
  objs[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objs[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  pags.forEach(function(s,i){
    objs[5+2*i]="<< /Type /Page /Parent 2 0 R /MediaBox [0 0 "+W+" "+H+"] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents "+(6+2*i)+" 0 R >>";
    objs[6+2*i]="<< /Length "+s.length+" >>\nstream\n"+s+"\nendstream";
  });
  var out="%PDF-1.4\n",off=[];
  for(var j=1;j<objs.length;j++){off[j]=out.length;out+=j+" 0 obj\n"+objs[j]+"\nendobj\n";}
  var xref=out.length;
  out+="xref\n0 "+objs.length+"\n0000000000 65535 f \n";
  for(var k=1;k<objs.length;k++)out+=("000000000"+off[k]).slice(-10)+" 00000 n \n";
  out+="trailer\n<< /Size "+objs.length+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n";
  return new Blob([out],{type:"application/pdf"});
}
function ordDocx(l){
  var NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  var run=function(txt,sz,b,cor){return '<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>'+(b?'<w:b/>':'')+(cor?'<w:color w:val="'+cor+'"/>':'')+'<w:sz w:val="'+sz+'"/><w:szCs w:val="'+sz+'"/></w:rPr><w:t xml:space="preserve">'+xe(txt)+'</w:t></w:r>';};
  var par=function(r,after){return '<w:p><w:pPr><w:spacing w:before="0" w:after="'+(after||0)+'"/></w:pPr>'+r+'</w:p>';};
  var cols=Math.max(1,Math.min(4,Math.ceil(l.length/ORD_POR_COL))),linhas=Math.ceil(l.length/cols);
  var wO=900,wL=1650,sem='<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>';
  var cel=function(w,conteudo){return '<w:tc><w:tcPr><w:tcW w:w="'+w+'" w:type="dxa"/>'+sem+'<w:vAlign w:val="center"/></w:tcPr>'+par(conteudo)+'</w:tc>';};
  var rows="";
  for(var i=0;i<linhas;i++){
    var cs="";
    for(var c=0;c<cols;c++){var r=l[c*linhas+i];cs+=cel(wO,r?run(r.os+"º",22,false,"5F6B63"):"")+cel(wL,r?run(dois(r.lote),30,true):"");}
    rows+='<w:tr><w:trPr><w:cantSplit/><w:trHeight w:val="400" w:hRule="atLeast"/></w:trPr>'+cs+'</w:tr>';
  }
  var grid="";for(var g=0;g<cols;g++)grid+='<w:gridCol w:w="'+wO+'"/><w:gridCol w:w="'+wL+'"/>';
  var body=par(run("ORDEM DE ENTRADA",40,true),60)+(ordTitulo()?par(run(ordTitulo(),24,false,"5F6B63"),20):"")+par(run(l.length+" lotes",22,false,"5F6B63"),240)+
    '<w:tbl><w:tblPr><w:tblW w:w="'+(cols*(wO+wL))+'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+grid+'</w:tblGrid>'+rows+'</w:tbl>'+par("");
  var doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document '+NS+'><w:body>'+body+
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>';
  return zipStore([
    {name:"[Content_Types].xml",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'},
    {name:"_rels/.rels",data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:"word/document.xml",data:doc}
  ]);
}
function baixarBlob(blob,nome){
  var url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=nome;document.body.append(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(url);},60000);
}
/* no celular abre o "Compartilhar" (aí é só escolher o WhatsApp); no computador baixa o arquivo para anexar */
async function mandarZap(tipo){
  var l=ordLista();if(!l.length){toast("Ainda não tem lotes na ordem.");return;}
  var pdf=tipo==="pdf",nome=ordNomeArq(pdf?"pdf":"docx"),blob=pdf?ordPdf(l):ordDocx(l);
  var mime=pdf?"application/pdf":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",arq=null;
  try{arq=new File([blob],nome,{type:mime});}catch(e){}
  if(arq&&navigator.canShare&&navigator.share){
    var pode=false;try{pode=navigator.canShare({files:[arq]});}catch(e){}
    if(pode){
      try{await navigator.share({files:[arq],title:"Ordem de entrada"});return;}
      catch(e){if(e&&e.name==="AbortError")return;}
    }
  }
  baixarBlob(blob,nome);
  toast("Arquivo "+nome+" baixado. No WhatsApp, toque no clipe (ou +) e anexe ele.",9000);
}
$("ordZapPdf").addEventListener("click",function(){mandarZap("pdf");});
$("ordZapDoc").addEventListener("click",function(){mandarZap("docx");});
window.__ordPdf=function(){return ordPdf(ordLista());};
window.__ordDocx=function(){return ordDocx(ordLista());};

/* ---------- início ---------- */
carregarLocal();mostrar(VIEW);render();renderFiles();limparMan();iniciarNuvem();
window.__fichas_estado=function(){return S;};

/* ---------- v2: modo Escritório / Mangueira (só muda o que aparece na tela) ---------- */
var TITULOS={fichas:"Fichas",cam:"Lotes e câmera",rel:"Relatório",ord:"Ordem de entrada"};
var MODO="";
try{MODO=localStorage.getItem("lotes-v2-modo")||"";}catch(e){}
if(MODO!=="esc"&&MODO!=="mang")MODO=window.innerWidth<760?"mang":"esc";
window.__depoisMostrar=function(v){
  var t=$("telaTitulo");if(t)t.textContent=TITULOS[v]||"";
  document.body.dataset.tela=v;
};
function aplicarModo(m){
  MODO=m;document.body.dataset.modo=m;
  try{localStorage.setItem("lotes-v2-modo",m);}catch(e){}
  var b=$("modoBtn");
  b.innerHTML=m==="mang"?"💻 <span class=\"lg\">Modo </span>escritório":"🐂 <span class=\"lg\">Modo </span>mangueira";
  b.setAttribute("aria-label",m==="mang"?"Trocar para o modo escritório, com todas as funções":"Trocar para o modo mangueira, com letras grandes e só a câmera");
  /* na mangueira não tem a tela de Fichas (PDF, tabela e Word) */
  if(m==="mang"&&VIEW==="fichas")mostrar("cam");else window.__depoisMostrar(VIEW);
}
$("modoBtn").addEventListener("click",function(){
  aplicarModo(MODO==="mang"?"esc":"mang");
  window.scrollTo(0,0);
  toast(MODO==="mang"?"Modo mangueira: letras grandes e só o essencial.":"Modo escritório: todas as funções.");
});
document.querySelectorAll(".abas button").forEach(function(b){b.addEventListener("click",function(){window.scrollTo(0,0);});});
/* filtro por sexo na lista de lotes */
$("camSexo").addEventListener("click",function(e){
  var b=e.target.closest("button");if(!b)return;
  [].forEach.call(this.children,function(x){x.setAttribute("aria-pressed",String(x===b));});
  window.__camSexo(b.dataset.s);
});
/* a parte "Digitar um lote à mão" abre sozinha quando uma foto da lista é aberta */
new MutationObserver(function(){if($("man").classList.contains("comfoto"))$("manDobra").open=true;}).observe($("man"),{attributes:true,attributeFilter:["class"]});
aplicarModo(MODO);

/* ---------- v2: juntar os vídeos dos lotes num vídeo só ----------
   O trabalho pesado é feito pelo GitHub (tarefa juntar-videos.yml do repositório LOTES).
   Ordem: machos e depois fêmeas, cada grupo pelo número do lote. Cada lote tem "LOTE 03" na tela.
   O vídeo pronto fica no ramo "videos-teste" (teste) ou "videos" (site) do LOTES. */
var JV={wf:"juntar-videos.yml",ramo:PUB_DIR?"videos-teste":"videos",chave:"lotes-v2-juntar",timer:null,url:null,arq:null,ocupado:false};
var JV_SRC=/^midia\/lote-\d{2,3}\/video-[A-Za-z0-9]{4,40}\.(mov|mp4|m4v|webm|3gp)$/;
function jvLista(){
  var por={};S.rows.forEach(function(r){if(r.lote!=null)por[r.lote]=r;});
  var itens=[],semSexo=[],ruins=[];
  Object.keys(MID.dados||{}).forEach(function(k){
    var n=Number(k),vids=((MID.dados[k]||{}).videos)||[];
    if(!vids.length||!(n>=0))return;
    var sx=por[n]?por[n].sexo:"";
    if(sx!=="M"&&sx!=="F"){semSexo.push(n);return;}
    vids.forEach(function(v){if(v&&JV_SRC.test(v.src||""))itens.push({lote:n,sexo:sx,src:v.src});else ruins.push(n);});
  });
  itens.sort(function(a,b){return (a.sexo===b.sexo?0:a.sexo==="M"?-1:1)||a.lote-b.lote;});
  var nums=function(l){return l.sort(function(a,b){return a-b;}).map(dois).join(", ");};
  return {itens:itens,semSexo:nums(semSexo),ruins:nums(ruins)};
}
function jvGuardar(x){try{if(x)localStorage.setItem(JV.chave,JSON.stringify(x));else localStorage.removeItem(JV.chave);}catch(e){}}
function jvLer(){try{return JSON.parse(localStorage.getItem(JV.chave)||"null");}catch(e){return null;}}
function jvPainel(txt,cls,botoes){
  $("juntarPainel").hidden=false;
  var t=$("juntarTxt");t.className="juntar-txt"+(cls?" "+cls:"");t.textContent=txt;
  var a=$("juntarAcoes");a.textContent="";
  (botoes||[]).forEach(function(b){a.append(b);});
}
function jvBotao(txt,cls,fn){var b=el("button","btn "+(cls||""),txt);b.type="button";b.addEventListener("click",fn);return b;}
function jvFechar(){
  clearTimeout(JV.timer);JV.timer=null;$("juntarPainel").hidden=true;
  var v=$("juntarVideo");v.hidden=true;v.removeAttribute("src");
}
function jvTempo(ms){var s=Math.max(0,Math.round(ms/1000));return Math.floor(s/60)+" min "+(s%60<10?"0":"")+(s%60)+" s";}

$("juntarBtn").addEventListener("click",function(){
  if(JV.ocupado){$("juntarPainel").hidden=false;return;}
  if(!GH.token){abrirConexao();return;}
  if(!MID.carregado){
    jvPainel("Carregando a lista de vídeos…","run");
    carregarMidia().then(function(){
      if(MID.carregado)$("juntarBtn").click();
      else jvPainel("Não deu para carregar a lista de vídeos. Confira a internet e tente de novo.","err",[jvBotao("Fechar","",jvFechar)]);
    });
    return;
  }
  var L=jvLista();
  if(!L.itens.length){
    jvPainel("Nenhum lote com vídeo ainda."+(L.semSexo?"\nOs lotes "+L.semSexo+" têm vídeo, mas estão sem sexo na tabela.":""),"",[jvBotao("Fechar","",jvFechar)]);return;
  }
  var m=L.itens.filter(function(i){return i.sexo==="M";}).length,f=L.itens.length-m;
  var txt=L.itens.length+(L.itens.length>1?" vídeos":" vídeo")+": "+m+" de machos e "+f+" de fêmeas, nesta ordem, cada grupo pelo número do lote.\nO GitHub leva uns 2 a 5 minutos para juntar.";
  if(L.semSexo)txt+="\n⚠️ Ficam de fora (sem sexo na tabela): lotes "+L.semSexo+".";
  if(L.ruins)txt+="\n⚠️ Ficam de fora (arquivo com nome estranho): lotes "+L.ruins+".";
  jvPainel(txt,"",[jvBotao("🎬 Gerar o vídeo","pri",function(){jvPedir(L.itens);}),jvBotao("Cancelar","",jvFechar)]);
});

async function jvPedir(itens){
  var pedido=(Date.now().toString(36)+Math.random().toString(36).slice(2,6)).toLowerCase().replace(/[^a-z0-9]/g,"");
  var lista=itens.map(function(i){return i.lote+":"+i.src;}).join(";");
  JV.ocupado=true;jvPainel("Mandando o pedido para o GitHub…","run");
  try{
    var r=await api("/repos/"+DONO+"/"+PUB+"/actions/workflows/"+JV.wf+"/dispatches",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ref:"main",inputs:{pasta:PUB_DIR,lista:lista,pedido:pedido}})});
    if(r.status===403||r.status===404){
      JV.ocupado=false;
      jvPainel("A chave do GitHub ainda não tem permissão para juntar vídeos.\n\nNo GitHub: Settings → Developer settings → Fine-grained tokens → abra a chave → Edit → em \"Repository permissions\", mude \"Actions\" para \"Read and write\" → Update.\n\nNão precisa gerar outra chave."+(r.status===404?"\n(Se a permissão já está certa, a tarefa de juntar vídeos ainda não foi colocada no LOTES.)":""),"err",[jvBotao("Fechar","",jvFechar)]);
      return;
    }
    if(!r.ok)throw new Error("GitHub "+r.status);
    jvGuardar({pedido:pedido,t:Date.now(),n:itens.length});
    jvAcompanhar();
  }catch(e){
    JV.ocupado=false;
    jvPainel("Não deu para mandar o pedido. Confira a internet e tente de novo.","err",[jvBotao("Fechar","",jvFechar)]);
  }
}

async function jvAcompanhar(){
  clearTimeout(JV.timer);JV.timer=null;
  var p=jvLer();if(!p){JV.ocupado=false;return;}
  JV.ocupado=true;
  var passou=Date.now()-p.t,rep=function(){JV.timer=setTimeout(jvAcompanhar,6000);};
  try{
    var r=await api("/repos/"+DONO+"/"+PUB+"/actions/workflows/"+JV.wf+"/runs?event=workflow_dispatch&per_page=20");
    if(!r.ok)throw new Error("GitHub "+r.status);
    var j=await r.json(),run=(j.workflow_runs||[]).find(function(x){return x.display_title==="Juntar videos "+p.pedido;});
    if(!run){
      if(passou>4*60000)return jvErro("O GitHub não começou a tarefa. Tente de novo daqui a pouco.",null);
      jvPainel("Pedido enviado. Esperando o GitHub começar… ("+jvTempo(passou)+")","run");return rep();
    }
    if(run.status!=="completed"){
      jvPainel((run.status==="in_progress"?"Juntando os "+p.n+" vídeos…":"Na fila do GitHub…")+" ("+jvTempo(passou)+")\nPode deixar o celular de lado: o trabalho é feito no GitHub.","run");
      return rep();
    }
    if(run.conclusion!=="success")return jvErro("O GitHub não conseguiu juntar os vídeos.",run.html_url);
    await jvBaixar(p);
  }catch(e){
    if(passou>40*60000)return jvErro("Demorou demais. Tente de novo.",null);
    jvPainel("Sem conexão com o GitHub. Tentando de novo… ("+jvTempo(passou)+")","run");rep();
  }
}
function jvErro(txt,link){
  jvGuardar(null);JV.ocupado=false;
  var bs=[jvBotao("Tentar de novo","pri",function(){jvFechar();$("juntarBtn").click();}),jvBotao("Fechar","",jvFechar)];
  jvPainel(txt,"err",bs);
  if(link){var a=document.createElement("a");a.href=link;a.target="_blank";a.rel="noopener";a.textContent="Ver detalhes no GitHub";$("juntarAcoes").append(a);}
}

async function jvBaixar(p){
  jvPainel("Pronto no GitHub. Baixando o vídeo…","run");
  var r=await api("/repos/"+DONO+"/"+PUB+"/contents/juntos.json?ref="+JV.ramo);
  if(!r.ok)throw new Error("GitHub "+r.status);
  var info=JSON.parse(b64dec((await r.json()).content||""));
  if(info.pedido!==p.pedido)return jvErro("O vídeo pronto não é deste pedido (outro pedido passou na frente). Tente de novo.",null);
  var urls=["https://raw.githubusercontent.com/"+DONO+"/"+PUB+"/"+JV.ramo+"/"+info.arquivo],blob=null;
  for(var t=0;t<3&&!blob;t++){
    try{blob=await jvBaixarArquivo(urls[0],info.mb);}catch(e){await new Promise(function(ok){setTimeout(ok,4000);});}
  }
  if(!blob)throw new Error("download");
  jvGuardar(null);JV.ocupado=false;
  if(JV.url)URL.revokeObjectURL(JV.url);
  JV.url=URL.createObjectURL(blob);
  var nome="videos-lotes"+(S.data?"-"+S.data.replace(/\//g,"-"):"")+".mp4";
  try{JV.arq=new File([blob],nome,{type:"video/mp4"});}catch(e){JV.arq=null;}
  var v=$("juntarVideo");v.src=JV.url;v.hidden=false;
  var bs=[];
  var podeComp=false;try{podeComp=!!(JV.arq&&navigator.canShare&&navigator.share&&navigator.canShare({files:[JV.arq]}));}catch(e){}
  /* no iPhone, o "Compartilhar" abre as opções do celular (WhatsApp); o arquivo já está pronto, então abre na hora */
  if(podeComp)bs.push(jvBotao("📤 Compartilhar","pri",async function(){
    try{await navigator.share({files:[JV.arq],title:"Vídeos dos lotes"});}
    catch(e){if(!(e&&e.name==="AbortError"))toast("Não deu para abrir o compartilhar. Use “Baixar vídeo”.",6000);}
  }));
  bs.push(jvBotao("⬇ Baixar vídeo",podeComp?"":"pri",function(){
    var a=document.createElement("a");a.href=JV.url;a.download=nome;document.body.append(a);a.click();a.remove();
  }));
  bs.push(jvBotao("Fechar","",jvFechar));
  jvPainel("✓ Vídeo pronto: "+info.lotes.length+" lotes · "+jvTempo(info.duracao*1000)+" de vídeo · "+String(info.mb).replace(".",",")+" MB","ok",bs);
}
async function jvBaixarArquivo(url,mb){
  var r=await fetch(url,{cache:"no-store"});
  if(!r.ok)throw new Error("HTTP "+r.status);
  if(!r.body||!r.body.getReader)return await r.blob();
  var total=Number(r.headers.get("Content-Length"))||(mb||0)*1048576,lido=0,partes=[],rd=r.body.getReader(),ult=0;
  for(;;){
    var x=await rd.read();if(x.done)break;
    partes.push(x.value);lido+=x.value.length;
    if(total&&Date.now()-ult>400){ult=Date.now();$("juntarTxt").textContent="Pronto no GitHub. Baixando o vídeo… "+Math.min(99,Math.round(lido*100/total))+"%";}
  }
  return new Blob(partes,{type:"video/mp4"});
}
/* se a página foi fechada no meio, continua acompanhando o pedido ao abrir de novo */
(function(){var p=jvLer();if(p&&GH.token&&Date.now()-p.t<40*60000)jvAcompanhar();else if(p)jvGuardar(null);})();
