export function explainProviderError(status:number,raw:unknown){
 const e=(raw as {error?:{message?:unknown;code?:unknown;param?:unknown}})?.error;
 const message=typeof e?.message==='string'?e.message.toLowerCase():'';
 let reason='REQUEST_REJECTED',text='AI가 요청을 거절했습니다. 운영자에게 진단 코드를 알려 주세요.';
 if(status===401){reason='API_KEY_INVALID';text='서버 API 키 인증에 실패했습니다.';}
 else if(/verif/.test(message)&&/organization|organisation/.test(message)){reason='ORG_VERIFICATION_REQUIRED';text='OpenAI 조직 인증이 필요합니다. API 키를 발급한 조직의 인증 상태를 확인해 주세요.';}
 else if(/billing|quota|balance|credit/.test(message)||e?.code==='insufficient_quota'){reason='BILLING_OR_QUOTA';text='OpenAI 프로젝트의 결제·잔액·사용 한도를 확인해 주세요.';}
 else if(/safety|moderation/.test(message)||e?.code==='content_policy_violation'){reason='CONTENT_REJECTED';text='이미지 설명이 안전 기준에 의해 거절됐습니다. 요청 내용을 확인해 주세요.';}
 else if(status===403||status===404||/model.*(access|not found|not exist|deprecated|retired)/.test(message)){reason='MODEL_ACCESS';text='이 OpenAI 프로젝트에서 이미지 또는 문구 모델을 사용할 수 없습니다. 모델 접근 권한을 확인해 주세요.';}
 else if(status===429){reason='RATE_LIMIT';text='OpenAI 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.';}
 else if(e?.param){reason='INVALID_PARAMETER';text='AI 요청의 옵션이 거절됐습니다. 운영자에게 진단 코드를 알려 주세요.';}
 return {reason,error:`${text} (진단: ${reason} / HTTP ${status})`};
}
