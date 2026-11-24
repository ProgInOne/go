# 변경 이력

이 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

### Added

- 웹 뼈대(`apps/web`): JavaScript 앱의 웹을 복사해 코드 실행 화면(러너, 콘솔, 미리보기, 실행 예제, 직접 써 보기, 프로젝트, 코드 초안, 에디터)을 걷어 냄(G-001). 과정·레슨 읽기, 본문 이해도 확인, 연습 세트와 선택형 3종 채점·피드백·힌트·정답 보기, 대시보드·복습·개념·목표·설정·백업, AI 튜터를 제공. 문제 렌더러와 위젯은 공통 패키지 `@proginone/exercise-ui`. 개발 모드 Vite 포트 `5174`(서버의 개발 출처 허용도 `5174`로)
- CI에 첫 화면 번들 예산 검사(`pnpm check:bundle`) 추가
- 문서: 웹 README, 시작하기 가이드에 웹 실행
- 서버 뼈대(`apps/server`): JavaScript 앱의 서버를 복사해 Go 코드 실행 부분을 걷어 냄(G-001). 과정·레슨·선택형 문제 채점·학습 엔진 흐름(숙련도, 복습, 오늘의 학습, 목표)·AI 튜터(Go 튜터 프로필)·설정·백업을 제공. 포트 `4311`, 프로덕션 데이터 폴더 `ProgInOne Go`. 실행 결과가 붙은 채점 요청은 거부
- 문서: 시작하기 가이드, 서버 README
- 콘텐츠 도구 `tools/content-cli`(`pnpm content:check`, `content:build`, `content:build:dev`): JavaScript 저장소의 도구에서 코드 실행 검증, 예측 문제 기대값, 문제 템플릿, 수량 기준 보고서, JS 전용 MDX 컴포넌트를 뺐음. 과정 언어는 `go`, 개념 참고 문서는 go.dev·pkg.go.dev 주소. 실행이 필요한 `usage: try`·`project`와 프로젝트 단원은 오류로 알림(G-001)
- 문제 유형 레지스트리 `packages/exercise-kit`: 공통 선택형 3종만 등록
- 예시 과정 `go-basics`(레슨 2개, 선택형 문제 6개): 프로그램의 모양과 `fmt.Println`, `:=`와 `=`
- `go-basics` 시작하기 모듈의 AI 교차 검토: 문제 6개 승인(배포용 `content.db`에 포함), 지문·선택지 이유·힌트 일부 수정([검토 기록](/docs/reviews/2026-11-23-go-basics-start-review.md))
- CI에 콘텐츠 검사 단계 추가
- 저장소 뼈대: pnpm 작업 공간, TypeScript·ESLint·Prettier·Vitest·dependency-cruiser 설정, CI(`lint · typecheck · test · build`), 문서(결정 기록, 용어집, 기여 가이드)
- 문서: Go 앱의 형태와 저장소 운영(G-001)

### Changed

- 웹에 남아 있던 코드 실행 흔적을 정리함(G-001): 설정 > 화면의 "작업대 테마"(에디터·콘솔 색)를 숨김(설정 값은 공통 스키마에 그대로 있음), AI 설정의 "보내는 것"에서 쓰지 않는 "내 코드와 마지막 실행 결과"를 뺌, 레슨 `walkthrough` 섹션 제목을 "단계별 해설"로, 레슨 단계 "직접 해 보기"를 "예제 따라가기"로 바꿈, 쓰이지 않는 실습 분할·직접 써 보기·실행 예제·프로젝트 CSS를 지움
