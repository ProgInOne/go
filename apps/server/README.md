# @proginone/server

ProgInOne Go의 로컬 서버(Hono)입니다. 학습 콘텐츠(`content.db`)를 읽고, 학습 기록(`user.db`)을 쓰고, 웹 앱에 API(`/api/v1`)를 제공합니다.

JavaScript 앱의 서버(`ProgInOne/javascript`의 `apps/server`)를 복사한 뒤 Go 뼈대에 맞게 걷어 냈습니다([G-001](/docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)). 두 서버에서 실제로 겹치는 부분은 Go 웹 뼈대까지 만든 뒤 확인해 `ProgInOne/core`로 옮깁니다.

## 실행

```shell
pnpm content:build:dev   # 예시 과정(검토 전 문제 포함)으로 content/dist/content.db 만들기
pnpm dev                 # 개발 모드: http://127.0.0.1:4311, 데이터는 저장소의 .data/
pnpm start               # 프로덕션 모드: OS 표준 위치의 ProgInOne Go 폴더
```

자세한 내용은 [시작하기](/docs/guides/getting-started.md)를 참고하세요.

## 있는 것

- 과정·모듈·레슨 조회, 레슨 읽기 진행과 학습 시간
- 연습 세트(레슨, 복습, 약점, 단원 평가, 추가 연습)와 채점, 힌트, 정답 보기, 오답 노트, 신고
- 학습 엔진(`@proginone/learning-engine`): 숙련도, FSRS 복습, 오늘의 학습, 목표와 진도, 적응형 다음 문제
- AI 튜터와 기억(`@proginone/ai`, Go 튜터 프로필 `src/ai/tutor-profile.ts`)
- 설정, 백업·복원·초기화, `user.db` 마이그레이션, 로그, 단일 실행 잠금
- Go 실행(`/go`, G-002): 학습자 Go 찾기와 상태(`GET /go/toolchain`, `POST /go/toolchain/refresh`), `main.go` 하나의 자유 실행(`POST /go/run`), `gofmt`(`POST /go/format`). 실행기는 `@proginone/go-runner`, 서비스는 `src/services/go/go-service.ts`

문제 채점은 이 저장소의 `@proginone/exercise-kit`(공통 선택형 3종)으로 합니다.

## 아직 없는 것

코드 작성 문제(`implement_function`)는 `POST /attempts`가 먼저 문제 유형의 실행 계획을 학습자의 Go로 실행하고(`AttemptService.submitGraded`, `GoService.runPlan`) 그 결과로 채점합니다. 클라이언트가 보낸 실행 결과는 받지 않습니다(400). 아직 다음은 없습니다.

- 실행 계획(`/exercises/:id/run-plan`), 직접 써 보기(`/exercises/:id/try-attempts`), 프로젝트 화면, 예제 코드 초안
- 러너 셸(`/sandbox/*`)과 그 하위 도메인 허용. 호스트는 `127.0.0.1`·`localhost`만 받습니다.
- 문제 템플릿 변형(content-cli가 아직 템플릿을 빌드하지 않음)

채점 요청에 실행 결과(`runResult`)가 붙어 있으면 무시하지 않고 400(`VALIDATION_RUN_RESULT_INVALID`)으로 거부합니다.

`user.db` 스키마와 마이그레이션은 JavaScript 앱과 같게 두었습니다. 실행 결과 열(`submissions.run_result_json`)과 프로젝트·초안 표는 지금은 비어 있습니다. 공통화할 때 같은 스키마를 옮기기 쉽게 하려는 선택입니다.

## 먼저 읽을 파일

| 파일 | 내용 |
|---|---|
| `src/main.ts` | 시작 순서: 설정, 잠금, 마이그레이션, 콘텐츠, 서비스, HTTP |
| `src/http/app.ts` | 라우트 구성과 보안 미들웨어 |
| `src/config/load.ts` | 설정 우선순위(환경 변수 > `config.json` > 기본값), 포트 4311, 데이터 폴더 |
| `src/services/practice/attempt-service.ts` | 채점과 학습 기록 반영 |
| `src/db/user/schema.ts` | `user.db` 스키마(Drizzle) |
| `src/test/content-fixture.ts` | 테스트용 `content.db`(선택형 문제만) |
