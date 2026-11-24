# apps/web

ProgInOne Go의 웹 앱(React SPA)입니다. JavaScript 앱의 `apps/web`을 복사한 뒤 코드 실행 화면을 걷어 냈습니다([G-001](/docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)).

## 실행

- 개발: 루트에서 `pnpm dev`를 실행하면 서버(`:4311`)와 Vite(`:5174`)가 함께 뜹니다. 브라우저에서 `http://127.0.0.1:5174`를 엽니다. Vite는 `/api`를 `4311` 서버로 넘기고, 서버가 `.data/dev-session.json`에 쓴 세션 토큰을 페이지에 넣습니다. JavaScript 앱(`:5173`, `:4310`)과 함께 띄울 수 있습니다.
- 프로덕션: `pnpm build` 뒤 `pnpm start`. 서버가 `apps/web/dist`를 `http://127.0.0.1:4311`에서 제공합니다.

## 구성

| 위치 | 내용 |
|---|---|
| `src/routes/` | TanStack Router 파일 라우트. `routeTree.gen.ts`는 Vite 플러그인이 만듭니다 |
| `src/api/` | API 클라이언트(세션 토큰, 오류 형식)와 TanStack Query 조회·변경 |
| `src/features/lesson-reader/` | 레슨 본문(content-cli가 검증한 MDX 트리)과 본문 안 이해도 확인 |
| `src/features/practice/` | 연습 세트, 채점·피드백·힌트·정답 보기. `exercise.tsx`가 이 저장소의 문제 유형 모델입니다 |
| `src/features/tutor/` | AI 튜터 드로어, AI 힌트, 오답 설명 |
| `src/features/` 그 밖 | 대시보드, 복습, 개념, 목표, 설정, 데이터(백업·복원) |
| `src/test/` | jsdom 설정과 가짜 API 데이터 |

## 문제 유형

지금은 공통 선택형 3종(`mcq_single`, `mcq_multi`, `true_false`)만 있습니다. 렌더러, 답안 모델, 확신도·힌트·피드백 위젯은 공통 패키지 `@proginone/exercise-ui`에서 받고, `src/features/practice/exercise.tsx`가 이 앱의 이름으로 묶습니다. Go 코드를 쓰는 유형, 에디터, 실행 결과 화면은 Go 전용 설계 단계에서 추가합니다.

## 걷어 낸 것

JavaScript 앱에서 다음을 뺐습니다. 서버에도 해당 API가 없습니다.

- 러너(샌드박스 iframe), 코드 실행·콘솔·미리보기, 실행 예제(`RunnableExample`)와 예측 후 실행
- 직접 써 보기(`TryIt`), 프로젝트 화면, 코드 초안 저장
- JS 문제 유형 렌더러(`@proginone/exercise-kit-ui`), 코드 에디터와 문제·작업 패널 나누기
- 설정의 "자동 완성"과 "예측 후 실행", 단축키 도움말의 실행·포맷 항목
- `MdnLink` 컴포넌트. 개념의 참고 문서 링크는 "참고 문서"로 표시합니다

## 규칙

- 웹은 학습 엔진(`@proginone/learning-engine`)에 의존하지 않습니다. 학습 판단은 서버가 합니다(ESLint 규칙).
- 웹은 서버 코드를 직접 가져오지 않습니다. API 타입은 `@proginone/shared`로 공유합니다(dependency-cruiser 규칙).
- 레슨 트리와 AI 출력은 신뢰할 수 없는 입력입니다. 모르는 노드는 그리지 않고, 링크는 http(s)와 앱 안 경로만 허용하며, raw HTML 경로가 없습니다.
- 첫 화면 번들 예산은 `pnpm check:bundle`이 확인합니다(JavaScript 앱과 같은 예산).
