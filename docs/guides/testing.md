# 테스트 가이드

ProgInOne Go 저장소의 테스트 종류와 실행 방법입니다. 테스트 작성 규칙은 [JavaScript 저장소의 테스트 가이드](https://github.com/ProgInOne/javascript/blob/develop/docs/guides/testing.md)를 따르고, 이 문서에는 Go 저장소에서 다른 점만 적습니다.

## 테스트 종류

| 종류 | 위치 | 명령 | CI 검사 |
|---|---|---|---|
| 단위·API·컴포넌트 | `apps/*/src`, `packages/*/src`, `tools/*` 의 `*.test.ts(x)` | `pnpm test` | `lint · typecheck · test · build` |
| 콘텐츠 검사 | `content/` | `pnpm content:check` | `lint · typecheck · test · build` |
| 콘텐츠 실행 검증 | `content/`의 `<RunnableExample>` | `pnpm content:check:run` | `lint · typecheck · test · build` |
| 브라우저 E2E·접근성 | `e2e/tests/*.spec.ts` | `pnpm test:e2e` | `e2e · visual · a11y` |
| 시각 회귀 | `e2e/tests/visual.spec.ts` 등의 `@visual` 테스트 | `pnpm test:e2e:visual` | `e2e · visual · a11y` |

두 CI 검사는 모두 필수입니다([G-001](/docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)).

## Go가 필요한 테스트

`packages/go-runner`의 테스트는 실제 Go로 `wasip1` Wasm을 컴파일하고 실행합니다([G-002](/docs/decisions.md#g-002-go-코드-실행과-채점--확정)).

- CI의 `lint · typecheck · test · build` 검사는 `actions/setup-go`로 `.go-version`의 Go를 설치합니다. CI에서 Go를 찾지 못하면 테스트가 실패합니다.
- 로컬에서 Go를 찾지 못하면 이 테스트를 건너뜁니다.
- 첫 테스트는 빈 빌드 캐시에 표준 라이브러리를 컴파일하므로 몇 초 더 걸립니다.
- 서버의 `/go` 라우트 테스트와 E2E의 `go-run.spec.ts`(레슨 실행 예제, 설정 > Go 실행 환경)도 실제 Go를 씁니다. CI의 `e2e · visual · a11y` 검사도 같은 방법으로 Go를 설치합니다.

## E2E

`pnpm test:e2e`는 프로덕션 빌드를 만든 뒤 Playwright(Chromium)로 실제 서버와 웹을 시험합니다.

- 서버는 임시 데이터 폴더와 픽스처 콘텐츠(`e2e/fixtures/content`, 빌드 때 검토 전 문제도 포함)로 세 개를 띄웁니다. 실제 학습 데이터는 건드리지 않습니다.
  - `4491`: 온보딩을 마친 학습자. 대부분의 테스트가 씁니다.
  - `4492`: 새 학습자의 첫 실행과 한 달 학습 여정(`journey.spec.ts`)
  - `4493`: 설정 > 데이터의 복원·초기화, 과정 진도, 선수 개념 경고처럼 학습자를 처음부터 다시 만드는 테스트
- 포트는 JavaScript 앱(`4310`)과 그 E2E 서버(`4391`부터), 이 앱(`4311`)과 겹치지 않습니다. `E2E_PORT`로 첫 포트를 바꿀 수 있습니다.
- AI는 결정적인 가짜 제공자(`PROGINONE_AI_PROVIDER=mock`)를 씁니다.
- 픽스처의 문제는 모두 선택형입니다. Go 코드 실행, 프로젝트, 템플릿 테스트는 Go 전용 설계 단계에서 더합니다.

## 시각 회귀

화면 비교는 글꼴 렌더링이 운영체제마다 달라서, CI와 같은 컨테이너 이미지(`mcr.microsoft.com/playwright:v1.65.1-noble`)에서만 돌립니다(`PW_VISUAL=1`). 로컬의 `pnpm test:e2e`는 `@visual` 테스트를 건너뜁니다.

- `pnpm test:e2e:visual`: Docker로 같은 이미지에서 전체 E2E를 돌리고 기준 이미지와 비교합니다.
- `pnpm test:e2e:visual --update`: 기준 이미지를 다시 만듭니다. 바뀐 이미지를 직접 보고 커밋합니다.
- Docker를 쓸 수 없으면 GitHub Actions의 `visual-baselines` 워크플로를 실행하고, 결과 아티팩트를 `e2e/tests/__screenshots__`에 받아 커밋합니다. CI의 E2E가 실패하면 새로 찍은 화면도 `playwright-report` 아티팩트에 함께 올라갑니다.
