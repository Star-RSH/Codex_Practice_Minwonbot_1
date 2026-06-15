# progress.md — 진행 기록

> 각 STEP 끝에 한 줄씩. "배포됨 ≠ 동작됨"을 구분해 적는다.

- [ ] STEP1 폴더 세팅
- [ ] STEP2 기획 문서 첨부·맥락
- [ ] STEP3 .env·.gitignore
- [ ] STEP4 Supabase 표·검색
- [ ] STEP5 화면
- [ ] STEP6 디자인(design.md 확정)
- [ ] STEP7 검색(RAG)
- [ ] STEP8 AI Hub·분류기
- [ ] STEP9 답변(LLM)
- [ ] STEP10 테스트(test_cases.md)
- [ ] STEP11 배포
- [ ] STEP12 발표

- 2026-06-15 STEP2 문서 기준선 확인 완료: PRD·customer·architecture·AGENTS 기준으로 목표, 입력→처리→출력, 완료 정의, 안전 규칙 요약 정리.
- 2026-06-15 STEP2 정리 완료: 기존 D5 문서/데이터를 samsung-minwon-bot 구조(data, docs, skills, tests, 루트 문서)로 이동하고 원본 폴더를 제거.
- 2026-06-15 STEP5 초안 추가: index.html에 질문 입력·답변 카드·참고 FAQ·안전 규칙 화면을 만들고, /api/answer 미연동 시 실패 상태와 상담사 연결 배지가 보이도록 확인.
- 2026-06-15 STEP4 초안 완료: 기존 Supabase 프로젝트에 public.faqs 테이블과 공개 읽기 정책(RLS)을 만들고, sample_faqs.csv의 더미 FAQ 15건 적재 및 로컬 .env 연결을 확인.
- 2026-06-15 STEP7·STEP9 초안 완료: /api/answer 서버와 공용 answer-service를 추가해 Supabase FAQ 검색, 근거 FAQ 반환, 금액·보장 질문 상담사 연결, BizRouter 연동 및 fallback 답변까지 로컬 검증.
- 2026-06-15 실행 정리: 번들 Node 경로를 감싸는 run.ps1을 추가해 PowerShell에서 한 번에 로컬 서버를 시작할 수 있게 정리.
- 2026-06-15 ML 초안 완료: AI Hub 민원 질의응답 ZIP에서 instruction·consulting_category를 추출해 data/faqs.csv를 생성하고, 녹취특정·'했어?' 질문을 제외한 해시 기반 경량 분류기와 정확도 리포트를 ml/에 저장.
