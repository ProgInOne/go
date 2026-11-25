# ProgInOne Go

> 로컬에서 실행되는 AI 기반 개인 맞춤형 Go 학습 플랫폼

ProgInOne은 체계적인 커리큘럼, 충분한 문제은행, 실습 환경, AI 튜터를 하나의 화면에 결합한 학습 플랫폼입니다. 이 저장소는 Go를 배우는 앱입니다. 웹 개발(JavaScript·HTML·CSS) 앱은 [ProgInOne/javascript](https://github.com/ProgInOne/javascript), 두 앱이 함께 쓰는 패키지는 [ProgInOne/core](https://github.com/ProgInOne/core)에 있습니다.

**핵심 철학: AI는 학습을 돕고, 학습 상태와 교육 과정의 관리 책임은 애플리케이션이 진다.**

## 현재 상태

🟡 **개발 중**: 뼈대(도구, CI, 콘텐츠 파이프라인과 예시 과정, 서버, 웹, E2E)를 갖췄습니다([G-001](docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)). 레슨의 Go 예제를 실행하고, 선택형·출력 예측·코드 작성 문제를 풀 수 있습니다. Go 코드는 학습자 컴퓨터의 Go로 격리해 실행하고 서버가 채점합니다([G-002](docs/decisions.md#g-002-go-코드-실행과-채점--확정), [G-003](docs/decisions.md#g-003-go-코드-문제의-채점-세부--확정), [설계](docs/design/go-code-execution.md)).

## 문서

모든 문서는 [문서 지도](docs/README.md)에서 찾을 수 있습니다. 콘텐츠는 [콘텐츠 작성 가이드](docs/guides/content-authoring.md)를 따릅니다. 기여 방법은 [기여 가이드](CONTRIBUTING.md)를 참고하세요.

## 빠른 시작

필요한 도구: Node.js 24 LTS 이상(`.nvmrc`), pnpm(`package.json`의 `packageManager` 버전).

```shell
pnpm install
pnpm check           # lint, 포맷, 타입, 의존 규칙, 테스트, 콘텐츠 검사, 문서 링크 검사
pnpm content:build   # content/dist/content.db 빌드 (콘텐츠 작성 가이드 참고)
```

`@proginone/*` 패키지는 GitHub Packages에서 받습니다. 사용자 설정(`~/.npmrc`)에 `read:packages` 권한의 토큰을 넣어 두세요([JS D-094](https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md)).

## 기술 방향 (요약)

- 로컬 웹앱: Node 로컬 서버 + Vite·React·TypeScript(strict) 웹. 학습 내용만 Go입니다.
- 학습 엔진, 콘텐츠 스키마, 문제 유형 틀, UI, AI 작업 실행은 공통 패키지 `@proginone/*`를 씁니다.
- 앱 데이터 폴더는 `ProgInOne Go`, 서버 포트는 `4311`이라 JavaScript 앱과 함께 실행할 수 있습니다.
- Go 코드는 학습자 컴퓨터의 Go(1.22 이상)로 WebAssembly(`wasip1`)로 컴파일해, 로컬 서버가 파일·네트워크 없이 격리해 실행하고 채점합니다.
