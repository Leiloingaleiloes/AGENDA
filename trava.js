/* Senhas do sistema Leiloingá.
   Geral: pedida ao abrir qualquer página do sistema (vale 30 dias neste aparelho).
   Comissão: pedida para ver a aba Comissão (vale 12 horas).
   Fica guardado só um código embaralhado (SHA-256) das senhas, nunca a senha em si.
   É uma tranca contra quem pega o aparelho; não é um cofre. */
(function(){
  var H={geral:"558cbc93fca17621a8f32b91e93ed050e01a0bd2923d97031fd4a4be86736e68",com:"fb8453c60ae66364f9ebdeacccf6d9b809c65970493bd7de10b44032e70295fd"};
  var DUR={geral:30*864e5,com:12*36e5},K="leiloinga-trava-";
  function ok(t){try{var v=+localStorage.getItem(K+t);return v&&v>Date.now();}catch(e){return false;}}
  async function hash(s){var b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode("leiloinga:"+String(s).trim().toLowerCase()));return Array.prototype.map.call(new Uint8Array(b),function(x){return ("0"+x.toString(16)).slice(-2);}).join("");}
  async function confere(t,s){if(await hash(s)!==H[t])return false;try{localStorage.setItem(K+t,String(Date.now()+DUR[t]));}catch(e){}return true;}
  function sair(){try{localStorage.removeItem(K+"geral");localStorage.removeItem(K+"com");}catch(e){}location.reload();}
  /* formulário de senha dentro de um elemento (usado aqui e na aba Comissão) */
  function form(alvo,t,titulo,texto,depois){
    alvo.innerHTML='<form class="trv-cx" autocomplete="off"><div class="trv-ic">🔒</div><h2>'+titulo+'</h2><p>'+texto+'</p>'+
      '<input type="password" class="trv-in" aria-label="Senha" placeholder="Senha" autocomplete="current-password">'+
      '<button type="submit" class="trv-bt">Entrar</button><div class="trv-er" role="alert"></div></form>';
    var f=alvo.querySelector("form"),i=f.querySelector("input"),er=f.querySelector(".trv-er");
    setTimeout(function(){i.focus();},50);
    f.addEventListener("submit",async function(e){e.preventDefault();if(!i.value)return;
      if(await confere(t,i.value)){depois();}else{er.textContent="Senha errada.";i.value="";i.focus();f.classList.remove("trv-sh");void f.offsetWidth;f.classList.add("trv-sh");}});
  }
  var css='.trv-cx{max-width:340px;margin:0 auto;text-align:center;font-family:Poppins,system-ui,sans-serif;padding:28px 22px;border-radius:18px;background:#fff;color:#14201a;box-shadow:0 20px 50px rgba(0,0,0,.25)}'+
    '.trv-ic{font-size:2.2rem}.trv-cx h2{font:700 1.4rem Oswald,Poppins,sans-serif;text-transform:uppercase;margin:6px 0 4px;letter-spacing:.02em}.trv-cx p{margin:0 0 16px;color:#5c6b62;font-size:.92rem}'+
    '.trv-in{width:100%;box-sizing:border-box;font:inherit;font-size:1.05rem;padding:12px 14px;border:1.5px solid #cfd9d2;border-radius:12px;text-align:center}.trv-in:focus{outline:none;border-color:#24B53B;box-shadow:0 0 0 3px rgba(36,181,59,.2)}'+
    '.trv-bt{width:100%;margin-top:10px;font:600 1rem Poppins,sans-serif;padding:12px;border:0;border-radius:12px;background:#1f8a35;color:#fff;cursor:pointer}.trv-er{min-height:1.2em;margin-top:8px;color:#c0392b;font-size:.88rem}'+
    '.trv-sh{animation:trvsh .35s}@keyframes trvsh{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}'+
    '#trava{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:16px;background:radial-gradient(circle at 30% 20%,#1d3a26,#0b120d 70%)}'+
    'html.trv-fechado body>*:not(#trava){display:none!important}';
  var st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
  window.TRAVA={ok:ok,form:form,sair:sair};
  if(ok("geral"))return;
  document.documentElement.classList.add("trv-fechado");
  function monta(){var d=document.createElement("div");d.id="trava";document.body.appendChild(d);
    form(d,"geral","Leiloingá","Digite a senha para entrar no sistema.",function(){d.remove();document.documentElement.classList.remove("trv-fechado");
      try{window.dispatchEvent(new Event("resize"));}catch(e){}});}
  if(document.body)monta();else document.addEventListener("DOMContentLoaded",monta);
})();
