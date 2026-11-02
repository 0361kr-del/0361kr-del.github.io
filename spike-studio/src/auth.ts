const storageKey='spike-participation-code';
const listeners=new Set<(ready:boolean)=>void>();
let code='';
function emit(){for(const listener of listeners)listener(!!code);}
export function watchUser(fn:(ready:boolean)=>void){listeners.add(fn);fn(!!code);if(!code){try{const stored=sessionStorage.getItem(storageKey);if(stored)void signIn(stored).catch(()=>{});}catch{}}return()=>{listeners.delete(fn);};}
export async function signIn(value:string){const candidate=value.trim();if(candidate.length<8||candidate.length>128)throw Error('참여 코드는 8~128자로 입력해 주세요.');const response=await fetch('/api/generate',{method:'POST',headers:{'Content-Type':'application/json','X-Participation-Code':candidate},body:JSON.stringify({kind:'verify'})});const data=await response.json();if(!response.ok)throw Error(data.error||'참여 코드를 확인해 주세요.');code=candidate;try{sessionStorage.setItem(storageKey,code);}catch{}emit();}
export async function signOutUser(){code='';try{sessionStorage.removeItem(storageKey);}catch{}emit();}
export async function apiFetch(url:string,options:RequestInit={}){const headers=new Headers(options.headers);if(code)headers.set('X-Participation-Code',code);const response=await fetch(url,{...options,headers});if(response.status===401)await signOutUser();return response;}
