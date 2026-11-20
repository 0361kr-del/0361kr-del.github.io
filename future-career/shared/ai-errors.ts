// Only fixed diagnostic codes may cross the server/client boundary.
export const aiErrors: Record<string, string> = {
  AI_NOT_CONFIGURED: '서버 비밀키 설정이 비어 있습니다.',
  AI_KEY_INVALID: 'OpenAI에서 API 키 인증을 거절했습니다.',
  AI_RATE_LIMIT: 'OpenAI 사용량 한도 또는 잔액을 확인해야 합니다.',
  AI_ACCESS_FORBIDDEN: 'OpenAI 프로젝트 또는 API 키의 모델 사용 권한을 확인해야 합니다.',
  AI_MODEL_UNAVAILABLE: '설정된 OpenAI 모델에 접근할 수 없습니다.',
  AI_REQUEST_REJECTED: 'OpenAI가 서버의 요청 형식을 거절했습니다.',
  AI_PROVIDER_ERROR: 'OpenAI 서버 오류가 발생했습니다.',
  AI_NETWORK_ERROR: '서버에서 OpenAI로 연결하지 못했거나 응답 시간이 초과됐습니다.',
  AI_INCOMPLETE: 'AI 응답이 완성되기 전에 종료됐습니다.',
  AI_INVALID_OUTPUT: 'AI 응답이 지정한 형식이나 길이 조건에 맞지 않습니다.',
  AI_UNSUPPORTED_QUOTE: '인터뷰에 없는 인용문이 생성되어 결과를 차단했습니다.',
  AI_REFUSED: 'AI가 이 요청에 대한 응답을 거절했습니다.',
  PERSONAL_DATA_DETECTED: '개인정보로 보이는 내용이 감지됐습니다.',
  MINIMUM_ANSWERS: '기사 생성에는 답변이 3개 이상 필요합니다.',
  INTERVIEW_LIMIT_REACHED: '설정된 인터뷰 답변 수에 도달했습니다.',
  AI_UNAVAILABLE: '서버 처리 중 오류가 발생했습니다.',
};
export function safeAiError(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return Object.hasOwn(aiErrors, code) ? code : 'AI_UNAVAILABLE';
}
