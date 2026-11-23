# 변경 이력

이 프로젝트의 주요 변경 사항을 기록합니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

### Added

- 콘텐츠 도구 `tools/content-cli`(`pnpm content:check`, `content:build`, `content:build:dev`): JavaScript 저장소의 도구에서 코드 실행 검증, 예측 문제 기대값, 문제 템플릿, 수량 기준 보고서, JS 전용 MDX 컴포넌트를 뺐음. 과정 언어는 `go`, 개념 참고 문서는 go.dev·pkg.go.dev 주소. 실행이 필요한 `usage: try`·`project`와 프로젝트 단원은 오류로 알림(G-001)
- 문제 유형 레지스트리 `packages/exercise-kit`: 공통 선택형 3종만 등록
- 예시 과정 `go-basics`(레슨 2개, 선택형 문제 6개): 프로그램의 모양과 `fmt.Println`, `:=`와 `=`
- `go-basics` 시작하기 모듈의 AI 교차 검토: 문제 6개 승인(배포용 `content.db`에 포함), 지문·선택지 이유·힌트 일부 수정([검토 기록](/docs/reviews/2026-11-23-go-basics-start-review.md))
- CI에 콘텐츠 검사 단계 추가
- 저장소 뼈대: pnpm 작업 공간, TypeScript·ESLint·Prettier·Vitest·dependency-cruiser 설정, CI(`lint · typecheck · test · build`), 문서(결정 기록, 용어집, 기여 가이드)
- 문서: Go 앱의 형태와 저장소 운영(G-001)
