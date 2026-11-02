import{createHash,timingSafeEqual}from'node:crypto';
export function validAccessCode(candidate:unknown,secret:string){if(typeof candidate!=='string'||candidate.length<8||candidate.length>128||secret.trim().length<8)return false;return timingSafeEqual(createHash('sha256').update(candidate.trim()).digest(),createHash('sha256').update(secret.trim()).digest());}
