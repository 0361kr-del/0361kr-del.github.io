import {generateAI,refreshGallery,downloadPoster,setupAccess} from './editor-bridge';

async function generateBackground({prompt,style}){const data=await generateAI('image',`${prompt||'배구부 홍보 포스터 배경'}. 느낌: ${STYLES.find(s=>s.id===style)?.label||style}. 글자 없이.`);return ['data:image/png;base64,'+data.image];}

/* ---------- 설정 ---------- */
const W = 1000;
const RATIOS = [
  {id:'4:5',  label:'세로',     h:1250},
  {id:'1:1',  label:'정사각형', h:1000},
  {id:'9:16', label:'긴 세로',  h:1778},
  {id:'a4',   label:'A4 종이',  h:1414}
];
const STYLES = [
  {id:'watercolor',label:'수채화'},{id:'neon',label:'네온'},{id:'minimal',label:'단순하게'},
  {id:'retro',label:'레트로'},{id:'space',label:'우주'},{id:'nature',label:'자연'}
];
const FONTS = [
  {id:'noto',  family:'Noto Sans KR',     weight:700, label:'고딕'},
  {id:'black', family:'Black Han Sans',   weight:400, label:'굵은 제목'},
  {id:'dohyeon',family:'Do Hyeon',        weight:400, label:'도현'},
  {id:'jua',   family:'Jua',              weight:400, label:'주아'},
  {id:'gaegu', family:'Gaegu',            weight:700, label:'손글씨'},
  {id:'pen',   family:'Nanum Pen Script', weight:400, label:'펜글씨'},
  {id:'myeongjo',family:'Nanum Myeongjo', weight:800, label:'명조'},
  {id:'gowun', family:'Gowun Dodum',      weight:400, label:'고운돋움'}
];
const COLORS = ['#FFFFFF','#15171F','#FFD234','#FF7A1A','#F23D4C','#FF6FB1','#8A4DFF','#2B4BFF','#37C3FF','#1FBF75'];
const COLOR_NAMES = ['흰색','검정','노랑','주황','빨강','분홍','보라','파랑','하늘','초록'];
const PRESETS = [
  {id:'title',  label:'큰 제목',   text:'제목',          font:'black', size:120, color:'#FFFFFF', shadow:true},
  {id:'body',   label:'설명 글',   text:'설명을 써요',   font:'noto',  size:46,  color:'#FFFFFF', shadow:true},
  {id:'hand',   label:'손글씨',    text:'손글씨',        font:'gaegu', size:80,  color:'#FFD234', shadow:true},
  {id:'sticker',label:'스티커',    text:'스티커',        font:'jua',   size:64,  color:'#15171F', box:true}
];

/* ---------- 상태 ---------- */
const state = {step:1, ratio:'4:5', bg:null, texts:[], sel:null, editing:null, style:'watercolor', starterAdded:false};
let scale = 1, uid = 1, hist = [], hidx = -1, candidates = [], editBefore = '';
const els = new Map();
const $ = id => document.getElementById(id);
const H = () => RATIOS.find(r=>r.id===state.ratio).h;
const fontOf = id => FONTS.find(f=>f.id===id) || FONTS[0];
const item = id => state.texts.find(t=>t.id===id);

/* ---------- 되돌리기 ---------- */
function snap(){return {ratio:state.ratio,bg:state.bg,texts:JSON.parse(JSON.stringify(state.texts))}}
function commit(){hist = hist.slice(0,hidx+1); hist.push(snap()); if(hist.length>60) hist.shift(); hidx = hist.length-1; histBtns(); persistDesign()}
function restore(s){
  state.ratio=s.ratio; state.bg=s.bg; state.texts=JSON.parse(JSON.stringify(s.texts));
  if(!item(state.sel)) state.sel=null; state.editing=null;
  renderAll();persistDesign();
}
function histBtns(){ $('undo').disabled = hidx<=0; $('redo').disabled = hidx>=hist.length-1 }
$('undo').onclick = ()=>{ if(hidx>0){ stopEdit(); hidx=Math.min(hidx,hist.length-1)-1; restore(hist[hidx]); histBtns() } };
$('redo').onclick = ()=>{ if(hidx<hist.length-1){ stopEdit(); restore(hist[++hidx]); histBtns() } };

/* ---------- 화면 배치 ---------- */
const stage=$('stage'), poster=$('poster'), clip=$('clip'), selBox=$('sel');
function layout(){
  const r = stage.getBoundingClientRect(), pad = r.width<600?14:28, h=H();
  scale = Math.max(.05, Math.min((r.width-pad*2)/W, (r.height-pad*2)/h));
  poster.style.height = h+'px';
  poster.style.transform = `translate(${(r.width-W*scale)/2}px,${(r.height-h*scale)/2}px) scale(${scale})`;
  poster.style.setProperty('--inv', 1/scale);
}
new ResizeObserver(layout).observe(stage);

function contrast(hex){
  const n=parseInt(hex.slice(1),16), r=n>>16&255, g=n>>8&255, b=n&255;
  return (0.299*r+0.587*g+0.114*b)>150 ? '#15171F' : '#FFFFFF';
}
function styleEl(el,t){
  const f=fontOf(t.font), s=el.style;
  s.left=t.x+'px'; s.top=t.y+'px'; s.transform=`translate(-50%,-50%) rotate(${t.rot}deg)`;
  s.fontFamily=`"${f.family}",var(--ui)`; s.fontWeight=f.weight; s.fontSize=t.size+'px';
  s.color=t.color; s.textAlign=t.align; s.zIndex=1+state.texts.indexOf(t);
  s.textShadow = t.shadow ? '0 .05em .16em rgba(0,0,0,.5)' : 'none';
  s.webkitTextStroke = t.stroke ? `.14em ${contrast(t.color)}` : '0';
  s.background = t.box ? contrast(t.color) : 'transparent';
  if(state.editing!==t.id && el.textContent!==t.text) el.textContent=t.text;
}
function renderTexts(){
  for(const [id,el] of els) if(!item(id)){ el.remove(); els.delete(id) }
  for(const t of state.texts){
    let el=els.get(t.id);
    if(!el){
      el=document.createElement('div'); el.className='t'; el.dataset.id=t.id; el.tabIndex=0;
      el.setAttribute('role','button'); el.setAttribute('aria-label','글자 상자');
      bindText(el); clip.appendChild(el); els.set(t.id,el);
    }
    styleEl(el,t);
  }
  updateSel();
}
function updateSel(){
  const t=item(state.sel), el=t&&els.get(t.id);
  if(!el){ selBox.style.display='none'; return }
  selBox.style.display='block';
  selBox.style.left=t.x+'px'; selBox.style.top=t.y+'px';
  selBox.style.width=el.offsetWidth+'px'; selBox.style.height=el.offsetHeight+'px';
  selBox.style.transform=`translate(-50%,-50%) rotate(${t.rot}deg)`;
  selBox.classList.toggle('editing', state.editing===t.id);
}
function renderBg(){
  const img=$('bgimg');
  if(state.bg){ if(img.src!==state.bg) img.src=state.bg; img.hidden=false; $('emptybg').hidden=true }
  else { img.hidden=true; $('emptybg').hidden=false }
}
function renderAll(){ layout(); renderBg(); renderTexts(); renderPanel(); renderRatios() }
if(document.fonts){ document.fonts.addEventListener('loadingdone', updateSel) }

/* ---------- 단계 ---------- */
function setStep(n){
  if(n!==2){ stopEdit(); state.sel=null; updateSel() }
  state.step=n;
  if(n===2 && !state.starterAdded && !state.texts.length){ addStarter() }
  renderPanel();
  if(n===3) enterSend();
  $('panel').scrollTop=0;
}
function renderPanel(){
  document.querySelectorAll('.step').forEach(b=>{
    if(+b.dataset.step===state.step) b.setAttribute('aria-current','step'); else b.removeAttribute('aria-current');
  });
  $('p-bg').hidden=state.step!==1; $('p-text').hidden=state.step!==2; $('p-send').hidden=state.step!==3;
  const t=item(state.sel);
  $('t-none').hidden=!!t; $('t-edit').hidden=!t;
  if(t) renderTools(t);
}
document.querySelectorAll('.step').forEach(b=>b.onclick=()=>setStep(+b.dataset.step));
$('to2').onclick=()=>setStep(2);
$('to3').onclick=$('to3b').onclick=()=>setStep(3);
$('more').onclick=()=>{ stopEdit(); state.sel=null; updateSel(); renderPanel(); $('panel').scrollTop=0 };

/* ---------- 1 배경 ---------- */
function renderRatios(){
  $('ratios').innerHTML=RATIOS.map(r=>`<button class="chip" data-r="${r.id}" aria-pressed="${r.id===state.ratio}">${r.label}</button>`).join('');
}
$('ratios').onclick=e=>{
  const b=e.target.closest('[data-r]'); if(!b||b.dataset.r===state.ratio) return;
  const old=H(); state.ratio=b.dataset.r; const k=H()/old;
  state.texts.forEach(t=>t.y=Math.round(t.y*k));
  candidates=[]; $('bgresult').hidden=true; $('gen').textContent='배경 만들기';
  renderAll(); commit();
};
$('styles').innerHTML=STYLES.map(s=>`<button class="chip" data-s="${s.id}" aria-pressed="${s.id===state.style}">${s.label}</button>`).join('');
$('styles').onclick=e=>{
  const b=e.target.closest('[data-s]'); if(!b) return; state.style=b.dataset.s;
  $('styles').querySelectorAll('.chip').forEach(c=>c.setAttribute('aria-pressed', c===b));
};
$('gen').onclick=async()=>{
  const btn=$('gen'); btn.disabled=true; $('bgloading').hidden=false; $('bgresult').hidden=true;
  try{
    candidates=await generateBackground({prompt:$('prompt').value.trim(), style:state.style, ratio:{w:W,h:H()}, count:1});
    $('thumbs').innerHTML=candidates.map((u,i)=>`<button class="thumb" data-i="${i}" aria-pressed="${i===0}" aria-label="배경 ${i+1}"><img src="${u}" alt=""></button>`).join('');
    $('bgresult').hidden=false; state.bg=candidates[0]; renderBg(); commit();
    btn.textContent='다시 만들기';
  }catch(err){ toast(err.message || '배경을 만들지 못했어요.') }
  $('bgloading').hidden=true; btn.disabled=false;
};
$('thumbs').onclick=e=>{
  const b=e.target.closest('[data-i]'); if(!b) return;
  $('thumbs').querySelectorAll('.thumb').forEach(c=>c.setAttribute('aria-pressed', c===b));
  state.bg=candidates[+b.dataset.i]; renderBg(); commit();
};

/* ---------- 2 글자 ---------- */
function newText(o){
  const t=Object.assign({id:'t'+(uid++),text:'글자',x:W/2,y:H()/2,size:64,rot:0,font:'noto',color:'#FFFFFF',align:'center',shadow:false,stroke:false,box:false,ph:false},o);
  state.texts.push(t); return t;
}
function addStarter(){
  state.starterAdded=true;
  const c = state.bg ? '#FFFFFF' : '#15171F', sh=!!state.bg;
  newText({text:'제목을 써 보세요',font:'black',size:104,y:Math.round(H()*.2),color:c,shadow:sh,ph:true});
  newText({text:'날짜와 장소를 써 보세요',font:'noto',size:44,y:Math.round(H()*.86),color:c,shadow:sh,ph:true});
  renderTexts(); commit();
}
$('presets').innerHTML=PRESETS.map(p=>{
  const f=fontOf(p.font);
  return `<button class="preset" data-p="${p.id}" style="font-family:'${f.family}',var(--ui);font-weight:${f.weight};color:${p.color}${p.box?';background:#FFD234':''}">${p.label}</button>`;
}).join('');
$('presets').onclick=e=>{
  const b=e.target.closest('[data-p]'); if(!b) return;
  const p=PRESETS.find(x=>x.id===b.dataset.p);
  const n=state.texts.length;
  const t=newText({text:p.text,font:p.font,size:p.size,color:p.color,shadow:!!p.shadow,box:!!p.box,ph:true,
    y:Math.round(H()*(.35+.1*(n%4)))});
  renderTexts(); select(t.id); commit(); startEdit(t.id);
};

function select(id){
  state.sel=id;
  if(id){ const t=item(id), i=state.texts.indexOf(t); if(i<state.texts.length-1){ state.texts.splice(i,1); state.texts.push(t); renderTexts() } }
  if(id && state.step!==2){ state.step=2 }
  renderPanel(); updateSel();
}
function renderTools(t){
  $('fonts').innerHTML=FONTS.map(f=>`<button class="font-chip" data-f="${f.id}" aria-pressed="${f.id===t.font}" style="font-family:'${f.family}',var(--ui);font-weight:${f.weight}"><b>가나다</b><small>${f.label}</small></button>`).join('');
  $('size').value=t.size;
  const custom=!COLORS.includes(t.color.toUpperCase());
  $('colors').innerHTML=COLORS.map((c,i)=>`<button class="sw" data-c="${c}" style="background:${c}" aria-label="${COLOR_NAMES[i]}" aria-pressed="${c===t.color.toUpperCase()}"></button>`).join('')
    +`<label class="sw-custom">다른 색<input type="color" id="ccustom" value="${t.color}"></label>`;
  document.querySelectorAll('[data-fx]').forEach(b=>b.setAttribute('aria-pressed', !!t[b.dataset.fx]));
  document.querySelectorAll('[data-align]').forEach(b=>b.setAttribute('aria-pressed', t.align===b.dataset.align));
  const pressed=$('fonts').querySelector('[aria-pressed="true"]'); if(pressed) pressed.scrollIntoView({block:'nearest',inline:'nearest'});
}
function change(fn){ const t=item(state.sel); if(!t) return; fn(t); renderTexts(); renderTools(t); commit() }
$('fonts').onclick=e=>{ const b=e.target.closest('[data-f]'); if(b) change(t=>t.font=b.dataset.f) };
$('colors').onclick=e=>{ const b=e.target.closest('[data-c]'); if(b) change(t=>t.color=b.dataset.c) };
$('colors').addEventListener('input',e=>{ if(e.target.id==='ccustom'){ const t=item(state.sel); if(t){ t.color=e.target.value; renderTexts() } } });
$('colors').addEventListener('change',e=>{ if(e.target.id==='ccustom') change(t=>t.color=e.target.value) });
$('size').addEventListener('input',e=>{ const t=item(state.sel); if(t){ t.size=+e.target.value; renderTexts() } });
$('size').addEventListener('change',()=>commit());
document.querySelectorAll('[data-fx]').forEach(b=>b.onclick=()=>change(t=>t[b.dataset.fx]=!t[b.dataset.fx]));
document.querySelectorAll('[data-align]').forEach(b=>b.onclick=()=>change(t=>t.align=b.dataset.align));
$('edit').onclick=()=>{ if(state.sel) startEdit(state.sel) };
$('dup').onclick=()=>{
  const t=item(state.sel); if(!t) return;
  const c=newText(Object.assign({},t,{id:'t'+(uid++),x:Math.min(W,t.x+40),y:Math.min(H(),t.y+40)}));
  renderTexts(); select(c.id); commit();
};
$('del').onclick=()=>removeSel();
function removeSel(){
  const t=item(state.sel); if(!t) return;
  state.editing=null; state.texts=state.texts.filter(x=>x!==t); state.sel=null;
  renderTexts(); renderPanel(); commit();
}

/* 문구 고치기 */
const PT=(()=>{ const d=document.createElement('div'); try{ d.contentEditable='plaintext-only' }catch(e){} return d.contentEditable==='plaintext-only' ? 'plaintext-only' : 'true' })();
function readText(el){ return el.innerText.replace(/\r/g,'').replace(/\n$/,'') }
function startEdit(id){
  const t=item(id), el=els.get(id); if(!t||!el) return;
  if(state.editing && state.editing!==id) stopEdit();
  state.editing=id; editBefore=t.text;
  el.classList.add('editing'); el.contentEditable=PT; el.focus();
  const r=document.createRange(); r.selectNodeContents(el); if(!t.ph) r.collapse(false);
  const s=getSelection(); s.removeAllRanges(); s.addRange(r);
  updateSel();
}
function stopEdit(){ const el=els.get(state.editing); if(el) el.blur() }
function endEdit(el){
  const id=el.dataset.id, t=item(id);
  el.contentEditable='false'; el.classList.remove('editing');
  if(state.editing===id) state.editing=null;
  if(!t) return;
  t.text=readText(el);
  if(!t.text.trim()){ state.texts=state.texts.filter(x=>x!==t); if(state.sel===id) state.sel=null; renderTexts(); renderPanel(); commit(); return }
  if(t.text!==editBefore){ t.ph=false; commit() }
  el.textContent=t.text; updateSel();
}

/* 끌어서 옮기기 */
let drag=null;
function pt(e){ const r=poster.getBoundingClientRect(); return {x:(e.clientX-r.left)/scale, y:(e.clientY-r.top)/scale} }
function bindText(el){
  el.addEventListener('pointerdown',e=>{
    const id=el.dataset.id;
    if(state.editing===id) return;
    e.preventDefault(); e.stopPropagation();
    if(state.editing) stopEdit();
    const was=state.sel===id; select(id);
    const t=item(id), p=pt(e);
    drag={id,was,moved:false,sx:p.x,sy:p.y,ox:t.x,oy:t.y};
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==el.dataset.id) return;
    const t=item(drag.id), p=pt(e), dx=p.x-drag.sx, dy=p.y-drag.sy;
    if(!drag.moved && Math.hypot(dx,dy)*scale<5) return;
    drag.moved=true;
    let x=drag.ox+dx, y=drag.oy+dy; const h=H(), th=10/scale;
    const sv=Math.abs(x-W/2)<th, sh=Math.abs(y-h/2)<th;
    if(sv) x=W/2; if(sh) y=h/2;
    $('gv').style.display=sv?'block':'none'; $('gh').style.display=sh?'block':'none';
    t.x=Math.round(Math.max(0,Math.min(W,x))); t.y=Math.round(Math.max(0,Math.min(h,y)));
    styleEl(el,t); updateSel();
  });
  const up=e=>{
    if(!drag||drag.id!==el.dataset.id) return;
    const d=drag; drag=null; $('gv').style.display=$('gh').style.display='none';
    if(d.moved) commit(); else if(d.was && e.type==='pointerup') startEdit(d.id);
  };
  el.addEventListener('pointerup',up); el.addEventListener('pointercancel',up);
  el.addEventListener('blur',()=>{ if(state.editing===el.dataset.id) endEdit(el) });
  el.addEventListener('input',()=>{ const t=item(el.dataset.id); if(t){ t.text=readText(el); updateSel() } });
  el.addEventListener('keydown',e=>{
    const id=el.dataset.id;
    if(state.editing===id){
      e.stopPropagation();
      if(e.key==='Escape'){ el.blur() }
      else if(e.key==='Enter' && PT==='true'){ e.preventDefault(); document.execCommand('insertLineBreak') }
      return;
    }
    if(e.key==='Enter'){ e.preventDefault(); select(id); startEdit(id) }
    else if(e.key===' '){ e.preventDefault(); select(id) }
  });
  el.addEventListener('paste',e=>{
    if(PT==='true'){ e.preventDefault(); document.execCommand('insertText',false,(e.clipboardData||window.clipboardData).getData('text/plain')) }
  });
}
stage.addEventListener('pointerdown',e=>{
  if(e.target.closest('.t')||e.target.closest('.hd')) return;
  if(state.editing) stopEdit();
  if(state.sel){ state.sel=null; updateSel(); renderPanel() }
});

/* 크기, 돌리기 손잡이 */
function handle(btn,onMove){
  let h=null;
  btn.addEventListener('pointerdown',e=>{
    const t=item(state.sel); if(!t) return;
    e.preventDefault(); e.stopPropagation();
    const p=pt(e); h={t,d0:Math.hypot(p.x-t.x,p.y-t.y)||1,size0:t.size};
    btn.setPointerCapture(e.pointerId);
  });
  btn.addEventListener('pointermove',e=>{
    if(!h) return; const p=pt(e); onMove(h,p);
    styleEl(els.get(h.t.id),h.t); updateSel(); $('size').value=h.t.size;
  });
  const up=()=>{ if(h){ h=null; commit() } };
  btn.addEventListener('pointerup',up); btn.addEventListener('pointercancel',up);
}
handle($('hsize'),(h,p)=>{
  h.t.size=Math.round(Math.max(24,Math.min(400,h.size0*Math.hypot(p.x-h.t.x,p.y-h.t.y)/h.d0)));
});
handle($('hrot'),(h,p)=>{
  let a=Math.atan2(p.y-h.t.y,p.x-h.t.x)*180/Math.PI-90;
  a=((a+180)%360+360)%360-180;
  for(const s of [0,90,-90,180,-180]) if(Math.abs(a-s)<5) a=s;
  h.t.rot=Math.round(a);
});

/* 키보드 */
document.addEventListener('keydown',e=>{
  const typing=/^(INPUT|TEXTAREA)$/.test(e.target.tagName)||state.editing;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!typing){ e.preventDefault(); (e.shiftKey?$('redo'):$('undo')).click(); return }
  if(typing) return;
  const t=item(state.sel); if(!t) return;
  if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); removeSel() }
  else if(e.key==='Escape'){ state.sel=null; updateSel(); renderPanel() }
  else if(e.key.startsWith('Arrow')){
    e.preventDefault(); const d=e.shiftKey?20:4;
    if(e.key==='ArrowLeft') t.x-=d; if(e.key==='ArrowRight') t.x+=d;
    if(e.key==='ArrowUp') t.y-=d; if(e.key==='ArrowDown') t.y+=d;
    t.x=Math.max(0,Math.min(W,t.x)); t.y=Math.max(0,Math.min(H(),t.y));
    renderTexts(); clearTimeout(document._nt); document._nt=setTimeout(commit,400);
  }
});

/* ---------- 3 보내기: 포스터를 한 장의 그림으로 합치기 ---------- */
function loadImg(src){ return new Promise((res,rej)=>{ const i=new Image(); i.crossOrigin='anonymous'; i.onload=()=>res(i); i.onerror=rej; i.src=src }) }
async function composePoster(outW=1080){
  const h=H(), k=outW/W, c=document.createElement('canvas'); c.width=outW; c.height=Math.round(h*k);
  const x=c.getContext('2d'); x.scale(k,k);
  x.fillStyle='#E3E7F3'; x.fillRect(0,0,W,h);
  if(state.bg){
    const im=await loadImg(state.bg), s=Math.max(W/im.width,h/im.height), dw=im.width*s, dh=im.height*s;
    x.drawImage(im,(W-dw)/2,(h-dh)/2,dw,dh);
  }
  if(document.fonts) await Promise.all(state.texts.map(t=>{ const f=fontOf(t.font); return document.fonts.load(`${f.weight} ${t.size}px "${f.family}"`,t.text).catch(()=>{}) }));
  for(const t of state.texts){
    const f=fontOf(t.font), lines=t.text.split('\n'), lh=t.size*1.25, px=t.size*.45, py=t.size*.2;
    x.save(); x.translate(t.x,t.y); x.rotate(t.rot*Math.PI/180);
    x.font=`${f.weight} ${t.size}px "${f.family}", "Noto Sans KR", sans-serif`;
    const ws=lines.map(l=>x.measureText(l).width), mw=Math.max(...ws,t.size*.6-px*2), bh=lines.length*lh+py*2;
    const m=x.measureText('가'), asc=m.fontBoundingBoxAscent||t.size*.88, desc=m.fontBoundingBoxDescent||t.size*.12;
    const cc=contrast(t.color);
    if(t.box){
      x.fillStyle=cc; x.beginPath();
      if(x.roundRect) x.roundRect(-mw/2-px,-bh/2,mw+px*2,bh,t.size*.2); else x.rect(-mw/2-px,-bh/2,mw+px*2,bh);
      x.fill();
    }
    x.textBaseline='alphabetic'; x.textAlign=t.align; x.lineJoin='round';
    const ax=t.align==='left'?-mw/2:t.align==='right'?mw/2:0;
    const setShadow=on=>{ x.shadowColor=on?'rgba(0,0,0,.5)':'transparent'; x.shadowBlur=on?t.size*.16*k:0; x.shadowOffsetX=0; x.shadowOffsetY=on?t.size*.05*k:0 };
    lines.forEach((l,i)=>{
      const by=-bh/2+py+i*lh+(lh-(asc+desc))/2+asc;
      if(t.stroke){ setShadow(t.shadow); x.strokeStyle=cc; x.lineWidth=t.size*.14; x.strokeText(l,ax,by); setShadow(false) }
      else setShadow(t.shadow);
      x.fillStyle=t.color; x.fillText(l,ax,by); setShadow(false);
    });
    x.restore();
  }
  return c.toDataURL('image/png');
}
let renderVersion=0;
async function enterSend(){
 const version=++renderVersion;$('phwarn').hidden=!state.texts.some(t=>t.ph);
 $('download').disabled=true;refreshGallery(null,'');
 try{const data=await composePoster(1080);if(version!==renderVersion||state.step!==3)return;$('preview').src=data;await refreshGallery(data,state.texts.find(t=>!t.ph)?.text||'나의 배구부 포스터');$('download').disabled=false;}
 catch(e){toast('완성 이미지를 만들지 못했습니다. 다시 시도해 주세요.');}
}
$('fixph').onclick=()=>{const t=state.texts.find(t=>t.ph);setStep(2);if(t){select(t.id);startEdit(t.id)}};
$('download').onclick=()=>downloadPoster($('preview').src);
$('upload').onchange=e=>{const f=e.target.files[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>8*1024*1024){toast('PNG, JPG, WEBP 이미지를 8MB 이하로 올려 주세요.');return;}const reader=new FileReader();reader.onload=()=>{state.bg=reader.result;renderBg();commit();};reader.readAsDataURL(f);e.target.value='';};
$('clearbg').onclick=()=>{state.bg=null;renderBg();commit();};
$('copy-gen').onclick=async()=>{const instruction=$('copy-prompt').value.trim();if(!instruction){toast('원하는 문구를 설명해 주세요.');return;}stopEdit();const b=$('copy-gen');b.disabled=true;b.textContent='문구 만드는 중…';try{const d=await generateAI('copy',instruction);state.texts=state.texts.filter(t=>!t.ph);newText({text:d.title,font:'black',size:104,y:Math.round(H()*.22),shadow:true});newText({text:d.subtitle,size:46,y:Math.round(H()*.72),shadow:true});state.starterAdded=true;renderTexts();commit();toast('AI 문구를 추가했어요. 글자를 눌러 수정하세요.');}catch(e){toast(e.message);}finally{b.disabled=false;b.textContent='AI 문구 만들기';}};
setupAccess();

let toastT; function toast(msg){ const t=$('toast'); t.textContent=msg; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,2600) }

function persistDesign(){try{localStorage.setItem('spike-editor-design',JSON.stringify({ratio:state.ratio,texts:state.texts}));}catch{}}
/* ---------- 시작 ---------- */
try{
 const saved=JSON.parse(localStorage.getItem('spike-editor-design')||'null');
 if(saved&&RATIOS.some(r=>r.id===saved.ratio)&&Array.isArray(saved.texts)){
  state.ratio=saved.ratio;
  for(const t of saved.texts.slice(0,100)){
   if(!t||typeof t.text!=='string'||!FONTS.some(f=>f.id===t.font)||!/^#[0-9a-f]{6}$/i.test(t.color)||![t.x,t.y,t.size,t.rot].every(Number.isFinite))continue;
   newText({text:t.text.slice(0,2000),x:Math.max(0,Math.min(W,t.x)),y:Math.max(0,Math.min(H(),t.y)),size:Math.max(24,Math.min(400,t.size)),rot:t.rot%360,font:t.font,color:t.color,align:['left','center','right'].includes(t.align)?t.align:'center',shadow:!!t.shadow,stroke:!!t.stroke,box:!!t.box,ph:!!t.ph});
  }
 }else{
  const old=JSON.parse(localStorage.getItem('spike-draft')||'null');
  if(old){state.ratio=old.size==='square'?'1:1':old.size==='story'?'9:16':'a4';
   const rows=[['team',.08,32],['title',.25,104],['subtitle',.7,48],['date',.8,32],['place',.87,32],['contact',.94,32]];
   rows.forEach(([key,y,size])=>{if(typeof old[key]==='string'&&old[key].trim())newText({text:old[key].slice(0,100),y:H()*y,size,color:'#15171F',font:key==='title'?'black':'noto'});});
  }
 }
 state.starterAdded=!!state.texts.length;
}catch{}
renderAll(); commit();
