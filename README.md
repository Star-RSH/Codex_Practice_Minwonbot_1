# ○○생명 민원 지식봇 (수강생 빌드)

질문 → (분류) → 검색(Supabase) → 답변(BizRouter, 서버 /api/answer) → 근거·상담사 연결. 공개·가상·더미.

## 실행
1. `.env`에 키 입력(`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `BIZROUTER_API_KEY`)
2. PowerShell에서 `.\run.ps1`
3. 브라우저에서 `http://127.0.0.1:4173`
4. Vercel 배포 시 같은 환경변수 등록 후 Redeploy

직접 실행이 필요하면 `node server.mjs` 대신 번들 Node 경로를 써도 됩니다.

## 현재 동작
- `index.html`이 `/api/answer`로 질문을 보냅니다.
- 서버는 Supabase `public.faqs`에서 관련 FAQ를 찾고, 근거 FAQ 목록을 돌려줍니다.
- `BIZROUTER_API_KEY`가 있으면 BizRouter로 답변 초안을 생성합니다.
- `BIZROUTER_API_KEY`가 비어 있으면 FAQ 기반 안전 템플릿 답변으로 fallback 합니다.

## 산출물
docs/(prd·customer·architecture·design·progress) · AGENTS.md · tests/test_cases.md · skills/minwon-answer/SKILL.md · index.html · `api/answer.js` · `lib/answer-service.mjs` · `server.mjs` · data/
