# 시작하기

ProgInOne Go 앱(서버와 웹)을 내 컴퓨터에서 실행하는 방법입니다. 지금은 뼈대 단계라 Go 코드 실행 없이 레슨과 선택형 문제만 있습니다([G-001](/docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)).

- 대상: 기여자(개발)
- 최종 수정: 2026-11-24 (웹 뼈대)

## 필요한 도구

| 도구 | 버전 | 확인 |
|---|---|---|
| Node.js | 24 LTS 이상(`.nvmrc`) | `node --version` |
| pnpm | `package.json`의 `packageManager` 버전 | `pnpm --version` |
| Codex CLI | AI 튜터를 쓸 때만 | `codex --version` |

`pnpm install`에는 공통 패키지(`@proginone/*`)를 받을 GitHub 토큰이 필요합니다. 설정 방법은 [README](/README.md#빠른-시작)에 있습니다.

## 실행

```shell
pnpm install
pnpm content:build       # 예시 과정으로 content/dist/content.db 만들기
pnpm dev                 # 개발 모드: 서버(:4311) + Vite(:5174). http://127.0.0.1:5174
pnpm build && pnpm start # 프로덕션 모드: http://127.0.0.1:4311 (브라우저 자동 열림)
```

- 서버는 `http://127.0.0.1:4311`, 개발 모드의 Vite는 `http://127.0.0.1:5174`에서 시작합니다. JavaScript 앱(`4310`, `5173`)과 함께 띄울 수 있게 포트를 나눴습니다.
- 개발 모드에서는 Vite가 `/api` 요청을 서버로 넘깁니다. 웹만 고칠 때도 서버가 함께 떠 있어야 합니다.
- 개발 모드의 데이터는 저장소의 `.data/`에 저장되며 git에 올라가지 않습니다. 처음부터 다시 시작하려면 서버를 끄고 `.data/`를 지웁니다.
- 프로덕션 모드(`pnpm start`)의 데이터는 OS 표준 위치의 `ProgInOne Go` 폴더에 저장됩니다(macOS: `~/Library/Application Support/ProgInOne Go/`). JavaScript 앱의 `ProgInOne` 폴더와 섞이지 않습니다.
- 이미 실행 중이면 새로 띄우지 않고 실행 중인 주소를 알려 줍니다. 끄려면 `Ctrl+C`를 누릅니다.
- API는 세션 토큰이 있어야 응답합니다. 개발 모드에서는 서버가 `.data/dev-session.json`에 토큰을 씁니다.

## 콘텐츠

서버는 `content/dist/content.db`(또는 `PROGINONE_CONTENT_DB`)를 읽습니다. 검토 전(`draft`) 문제까지 넣어 보려면 `pnpm content:build:dev`를 씁니다. 자세한 내용은 [콘텐츠 작성 가이드](/docs/guides/content-authoring.md)에 있습니다.

## 설정

설정 우선순위는 **환경 변수 > `<데이터 위치>/config.json` > 기본값**입니다.

| 환경 변수 | 기본값 | 설명 |
|---|---|---|
| `PROGINONE_PORT` | `4311` | 서버 포트 |
| `PROGINONE_DATA_DIR` | OS 표준 위치의 `ProgInOne Go`(개발: `.data/`) | 학습 데이터 위치 |
| `PROGINONE_BACKUP_DIR` | `<데이터 위치>/backups` | 백업 위치 |
| `PROGINONE_CONTENT_DB` | `content/dist/content.db` | 콘텐츠 위치 |
| `PROGINONE_LOG_LEVEL` | `info` | `debug`/`info`/`warn`/`error` |
| `PROGINONE_OPEN_BROWSER` | 프로덕션 `true`, 개발 `false` | 시작 시 브라우저 열기 |
| `PROGINONE_AI_PROVIDER` | `codex` | `codex` 또는 `mock`(테스트용) |
| `PROGINONE_CODEX_PATH` | `codex` | Codex CLI 경로 |

## 테스트

```shell
pnpm test    # 단위·API·컴포넌트 테스트(서버는 임시 폴더의 user.db와 테스트용 content.db, 웹은 jsdom과 가짜 API)
pnpm check   # lint, 포맷, 타입, 의존 규칙, 테스트, 콘텐츠 검사, 문서 링크
pnpm build && pnpm check:bundle   # 첫 화면 번들 예산
```
