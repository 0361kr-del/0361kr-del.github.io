import{initializeApp}from'firebase/app';import{getAuth,onAuthStateChanged,GoogleAuthProvider,signInWithPopup,setPersistence,browserLocalPersistence,signOut}from'firebase/auth';
let connection:Promise<ReturnType<typeof getAuth>>|undefined;
async function auth(){return connection??=(async()=>{const r=await fetch('/__/firebase/init.json');if(!r.ok)throw Error('Firebase Hosting에서 접속해 주세요.');const a=getAuth(initializeApp(await r.json()));await a.authStateReady();return a;})();}
export function watchUser(fn:(v:boolean)=>void){let gone=false,off:(()=>void)|undefined;auth().then(a=>{if(!gone)off=onAuthStateChanged(a,u=>fn(!!u));}).catch(()=>fn(false));return()=>{gone=true;off?.();};}
export async function signIn(){const a=await auth();await setPersistence(a,browserLocalPersistence);await signInWithPopup(a,new GoogleAuthProvider());}
export async function signOutUser(){await signOut(await auth());}
export async function apiFetch(url:string,options:RequestInit={}){const a=await auth();const headers=new Headers(options.headers);if(a.currentUser)headers.set('Authorization','Bearer '+await a.currentUser.getIdToken());return fetch(url,{...options,headers});}
