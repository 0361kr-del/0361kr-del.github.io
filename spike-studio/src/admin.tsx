import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged,setPersistence,browserLocalPersistence,type Auth,type User} from 'firebase/auth';
import './admin.css';
type Prompts={imagePrompt:string;copyPrompt:string};
type Settings=Prompts&{version:number;updatedAt:string|null};
type Dashboard={settings:Settings;defaults:Prompts;models:{image:string;copy:string};usage:{date:string;image:number;copy:number}[]};
const owner='0361kr@gmail.com';
async function request(user:User,body?:unknown){
 const response=await fetch('/api/admin',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+await user.getIdToken(),'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const result=await response.json().catch(()=>({error:'관리자 API를 불러오지 못했습니다. Functions 배포 상태를 확인해 주세요.'}));
 if(!response.ok)throw Error(result.error||'요청을 처리하지 못했습니다.');return result;
}
function App(){
 const [auth,setAuth]=useState<Auth|null>(null),[user,setUser]=useState<User|null>(null),[boot,setBoot]=useState(true);
 const [data,setData]=useState<Dashboard|null>(null),[form,setForm]=useState<Settings|null>(null);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
 const dirty=!!data&&!!form&&(data.settings.imagePrompt!==form.imagePrompt||data.settings.copyPrompt!==form.copyPrompt);
 useEffect(()=>{
  let stop=()=>{},live=true;
  (async()=>{
   const r=await fetch('/__/firebase/init.json');if(!r.ok)throw Error('Firebase Hosting에서 관리자 화면을 열어 주세요.');
   const config=await r.json();if(config.projectId!=='spike-studio-0361kr')throw Error('관리자 Firebase 프로젝트 설정이 올바르지 않습니다.');
   const a=getAuth(initializeApp(config,'spike-admin'));await setPersistence(a,browserLocalPersistence);
   if(!live)return;setAuth(a);stop=onAuthStateChanged(a,u=>{setUser(u);setBoot(false);setData(null);setForm(null);setError('');setNotice('');});
  })().catch(e=>{if(live){setError(e.message);setBoot(false);}});
  return()=>{live=false;stop();};
 },[]);
 useEffect(()=>{
  if(!user)return;let live=true;setLoading(true);
  request(user).then(d=>{if(live){setData(d);setForm(d.settings);}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});
  return()=>{live=false;};
 },[user]);
 useEffect(()=>{if(!dirty)return;const f=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',f);return()=>window.removeEventListener('beforeunload',f);},[dirty]);
 async function login(){if(!auth)return;setBusy(true);setError('');try{const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,p);}catch(e){const code=(e as {code?:string}).code;setError(code==='auth/operation-not-allowed'?'Firebase Authentication에서 Google 로그인을 활성화해 주세요.':code==='auth/unauthorized-domain'?'Firebase Authentication의 승인된 도메인에 현재 사이트를 추가해 주세요.':code==='auth/popup-closed-by-user'?'로그인 창이 닫혔습니다. 다시 로그인해 주세요.':'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.');}finally{setBusy(false);}}
 async function refresh(){if(!user)return;if(dirty&&!window.confirm('저장하지 않은 지침을 버리고 다시 불러올까요?'))return;setBusy(true);setError('');try{const d=await request(user);setData(d);setForm(d.settings);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function save(){if(!user||!form||!data)return;setBusy(true);setError('');setNotice('');try{const result=await request(user,{imagePrompt:form.imagePrompt,copyPrompt:form.copyPrompt,version:form.version});setForm(result.settings);setData({...data,settings:result.settings});setNotice('저장했습니다. 다음 생성 요청부터 적용됩니다.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const totals=data?.usage.reduce((sum,d)=>({image:sum.image+d.image,copy:sum.copy+d.copy}),{image:0,copy:0});
 return <><header><a href="/">스파이크 스튜디오 <small>관리자</small></a><nav><a href="/">포스터 만들기 ↗</a>{user&&<button disabled={busy} onClick={()=>{if(dirty&&!window.confirm('저장하지 않은 지침을 버리고 로그아웃할까요?'))return;void signOut(auth!).catch(()=>setError('로그아웃하지 못했습니다. 다시 시도해 주세요.'));}}>로그아웃</button>}</nav></header><main>
 <div className="intro"><p className="eyebrow">STUDIO CONTROL</p><h1>우리 수업에 맞게,<br/>AI의 방향을 정하세요.</h1><p>생성 지침과 사용량을 한곳에서 관리합니다.</p></div>
 {error&&<div role="alert" className="message error">{error}</div>}{notice&&<div role="status" className="message">{notice}</div>}
 {boot?<p role="status">로그인 상태 확인 중…</p>:!user?<section className="login"><h2>소유자 로그인</h2><p>{owner} Google 계정으로 관리할 수 있어요.<br/>학생용 참여 코드는 관리자 권한을 부여하지 않습니다.</p><button className="primary" disabled={busy||!auth} onClick={()=>void login()}>Google 계정으로 로그인</button></section>:<>
 <div className="account"><span>{user.email}</span><button disabled={busy||loading} onClick={()=>void refresh()}>새로고침</button></div>
 {loading?<p role="status">관리자 설정 불러오는 중…</p>:data&&form?<>
 <div className="metrics"><section><p>이미지 요청</p><strong>{totals?.image.toLocaleString()}</strong><small>최근 집계 최대 30일</small></section><section><p>문구 요청</p><strong>{totals?.copy.toLocaleString()}</strong><small>최근 집계 최대 30일</small></section><section><p>필드 테스트</p><strong className="unlimited">횟수 제한 없음</strong><small>사이트 일일 한도 · 정상 참여자 IP 한도</small></section></div>
 <form onSubmit={e=>{e.preventDefault();void save();}}>
 <div className="section-heading"><div><h2>AI 생성 지침</h2><p>학생 입력은 아래 지침과 함께 전달됩니다. 입력 내용은 서버에서 관리합니다.</p></div><span className="badge">소유자 전용</span></div>
 <div className="prompts">{(['imagePrompt','copyPrompt'] as const).map(key=><section key={key}><div className="prompt-heading"><h3>{key==='imagePrompt'?'이미지 생성 지침':'홍보 문구 생성 지침'}</h3><button type="button" disabled={busy} onClick={()=>{if(window.confirm('이 항목을 기본 지침으로 바꿀까요? 저장을 눌러야 적용됩니다.'))setForm({...form,[key]:data.defaults[key]});}}>기본값 불러오기</button></div><p>{key==='imagePrompt'?'배경의 소재, 구도, 글자 포함 여부 등을 정합니다. 이미지 API에는 사용자 요청과 합친 프롬프트로 전달됩니다.':'홍보 문구의 말투, 대상, 금지할 표현 등을 정합니다. 제목·부제 각 50자와 JSON 출력 규칙은 서버가 유지합니다.'}</p><label htmlFor={key}>{key==='imagePrompt'?'이미지 프롬프트':'문구 시스템 프롬프트'}</label><textarea id={key} required maxLength={6000} rows={12} disabled={busy} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/><div className="field-meta"><span>{form[key].length.toLocaleString()} / 6,000자</span><span>모델: {key==='imagePrompt'?data.models.image:data.models.copy}</span></div></section>)}</div>
 <div className="save-bar"><span>{dirty?'저장하지 않은 변경 사항이 있습니다.':form.updatedAt?'마지막 저장 '+new Date(form.updatedAt).toLocaleString('ko-KR'):'기본 지침 사용 중'}</span><button className="primary" disabled={busy||!dirty||!form.imagePrompt.trim()||!form.copyPrompt.trim()}>{busy?'저장 중…':'지침 저장'}</button></div></form>
 <section className="usage"><h2>일별 생성 요청</h2><p>실패를 포함한 요청 횟수입니다. 실제 성공 수·청구 비용과 다릅니다. 날짜는 UTC 기준으로 한국 시간 오전 9시에 바뀝니다. OpenAI 자체 한도와 서버 동시 처리 용량은 별도로 적용됩니다.</p><div className="table-scroll"><table><thead><tr><th>집계 날짜 (UTC)</th><th>이미지</th><th>문구</th><th>합계</th></tr></thead><tbody>{data.usage.map(d=><tr key={d.date}><td>{d.date}</td><td>{d.image}</td><td>{d.copy}</td><td>{d.image+d.copy}</td></tr>)}</tbody></table>{!data.usage.length&&<p>아직 생성 요청 기록이 없습니다.</p>}</div></section>
 </>:null}</>}
 </main><footer>SPIKE STUDIO · 관리자 설정</footer></>;
}
createRoot(document.getElementById('admin-root')!).render(<App/>);
