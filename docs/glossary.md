# 용어집

ProgInOne Go 저장소에서 쓰는 용어의 정의입니다.

과정, 레슨, 개념, 숙련도, 문제 유형처럼 세 저장소가 함께 쓰는 용어는 [JavaScript 저장소의 용어집](https://github.com/ProgInOne/javascript/blob/develop/docs/glossary.md)이 원천입니다. 이 문서에는 Go 저장소에만 있는 용어를 적습니다.

| 용어 | 코드 식별자 | 정의 |
|---|---|---|
| 공통 패키지 | `@proginone/*` | [ProgInOne/core](https://github.com/ProgInOne/core)에서 배포하는 패키지. 학습 엔진, 콘텐츠 스키마, UI, 문제 유형 틀, AI 작업 실행이 들어 있음 |
| Go 결정 | `G-nnn` | 이 저장소의 [결정 기록](/docs/decisions.md) 항목. JavaScript 저장소의 결정은 `JS D-nnn`으로 적음 |
| Go 실행기 | `packages/go-runner` | 학습자 코드를 `wasip1` Wasm으로 컴파일하고 최소 WASI로 격리해 실행하는 패키지. 서버와 콘텐츠 도구가 함께 씀([설계](/docs/design/go-code-execution.md)) |
| 최소 WASI | — | Go 실행기가 직접 구현한 WASI preview1 함수 묶음. 표준 입출력, 가상 시계, 난수, 종료만 열고 파일·네트워크·환경 변수는 주지 않음 |
| 가상 시계 | — | 실행 중 `time.Now()`가 고정 시각에서 시작하고 `time.Sleep`이 실제로 기다리지 않고 시각만 앞으로 보내는 시계. 채점과 검증을 빠르고 결정론적으로 만듦 |
| 하네스 | — | `call` 체크를 위해 서버가 문제의 사례 표에서 생성하는 Go 파일. 학습자 함수를 부르고 사례별 결과를 출력함 |
