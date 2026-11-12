import {createRoot} from 'react-dom/client';
import {createRef} from 'react';
import ShareToGallery from './share-to-gallery';
import {apiFetch,watchUser,signIn,signOutUser} from './auth';

let signedIn=false,requestBusy=false;
let accessDialog:HTMLDialogElement;
export function setupAccess(){
 accessDialog=document.createElement('dialog');accessDialog.className='access-dialog';
 accessDialog.innerHTML=`<form><h2>참여 코드로 시작하기</h2><p>운영자에게 받은 공용 코드를 입력해 주세요.</p><label for="access-code">참여 코드</label><input id="access-code" type="password" autocomplete="off" minlength="8" maxlength="128" required><p role="alert" id="access-error"></p><div class="row"><button class="btn" type="button" id="access-close">닫기</button><button class="btn primary" type="submit">참여하기</button></div></form>`;
 document.body.append(accessDialog);
 const input=accessDialog.querySelector('input')!,error=accessDialog.querySelector('#access-error')!,submit=accessDialog.querySelector<HTMLButtonElement>('[type=submit]')!;
 accessDialog.addEventListener('close',()=>{input.value='';error.textContent='';});
 accessDialog.querySelector('#access-close')!.addEventListener('click',()=>accessDialog.close());
 accessDialog.querySelector('form')!.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;error.textContent='';try{await signIn(input.value);accessDialog.close();}catch(e){error.textContent=(e as Error).message;}finally{submit.disabled=false;}});
 const button=document.getElementById('participate') as HTMLButtonElement;
 watchUser(ready=>{signedIn=ready;button.textContent=ready?'참여 종료':'참여 코드 입력';});
 button.onclick=()=>{if(signedIn)void signOutUser();else accessDialog.showModal();};
}
export async function generateAI(kind:'copy'|'image',instruction:string){
 if(!signedIn){accessDialog.showModal();throw Error('참여 코드를 입력한 뒤 생성 버튼을 다시 눌러 주세요.');}
 if(requestBusy)throw Error('현재 생성이 끝나면 다시 시도해 주세요.');
 requestBusy=true;
 const controls=Array.from(document.querySelectorAll<HTMLButtonElement>('.step,.hist button,#to2,#to3,#to3b,#download'));
 const disabled=controls.map(b=>b.disabled);controls.forEach(b=>{b.disabled=true;});
 try{
  const r=await apiFetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,instruction:instruction.slice(0,1000),draft:{team:'우리 학교 배구부',title:'',subtitle:''}})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'생성하지 못했습니다. 다시 시도해 주세요.');
  if(kind==='image'&&typeof data.image!=='string')throw Error('이미지 응답을 확인하지 못했습니다.');
  if(kind==='copy'&&(typeof data.title!=='string'||typeof data.subtitle!=='string'))throw Error('문구 응답을 확인하지 못했습니다.');
  return data;
 }finally{requestBusy=false;controls.forEach((b,i)=>{b.disabled=disabled[i];});}
}
const galleryCanvas=createRef<HTMLCanvasElement>();
galleryCanvas.current=document.createElement('canvas');
let galleryRoot:ReturnType<typeof createRoot>|undefined,revision=0;
export async function refreshGallery(data:string|null,title:string){
 const current=++revision;
 galleryRoot??=createRoot(document.getElementById('gallery-root')!);
 galleryRoot.render(<ShareToGallery key={current} canvas={galleryCanvas} title={title} disabled/>);
 if(!data)return;
 const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(Error('미리보기를 불러오지 못했습니다.'));img.src=data;});
 if(current!==revision)return;
 const c=galleryCanvas.current!;c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d')!.drawImage(img,0,0);
 galleryRoot.render(<ShareToGallery key={current} canvas={galleryCanvas} title={title} disabled={false}/>);
}
export function downloadPoster(data:string){if(!data.startsWith('data:image/png;'))return;const a=document.createElement('a');a.href=data;a.download='spike-volleyball.png';a.click();}
