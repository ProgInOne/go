# @proginone/go-runner

학습자 Go 코드를 컴파일하고 격리해 실행하는 실행기입니다.
설계와 이유는 [Go 코드 실행과 채점 설계](/docs/design/go-code-execution.md)와 [G-002](/docs/decisions.md#g-002-go-코드-실행과-채점--확정)에 있습니다.

- **도구 체인 찾기** (`findGoToolchain`): 설정의 경로, `PATH`, OS 표준 위치 순서로 `go`를 찾고, 버전(최소 1.22)과 `gofmt` 위치를 확인합니다.
- **컴파일** (`compileGo`): 학습자 파일만 있는 임시 모듈을 `GOOS=wasip1 GOARCH=wasm`으로 빌드합니다. 서버의 환경 변수를 물려주지 않고(`buildEnv`), 모듈 다운로드와 도구 체인 전환을 막고, 시간과 출력에 한도를 둡니다.
- **실행** (`runWasm`): 새 Worker 스레드에서 최소 WASI(`wasi.ts`)로 실행합니다. 표준 입출력, 가상 시계, 시드 난수, 종료만 열려 있습니다. Wasm 메모리 최대값을 고쳐 넣고(`limitWasmMemory`), 시간이 넘으면 Worker를 끝냅니다.
- **실행기** (`createGoRunner`): 위 두 단계를 묶고 동시 실행 수를 제한합니다. `prewarm()`으로 첫 빌드 캐시를 채우고, `format()`으로 `gofmt`를 실행합니다.

기본 한도:

| 항목 | 값 |
|---|---|
| 컴파일 시간 | 30초 |
| 실행 시간(벽시계) | 5초 |
| Wasm 메모리 | 256MB |
| 출력(표준 출력 + 표준 오류) | 64KB |
| 동시 실행 | 2 |
| `gofmt` | 2초, 256KB |

테스트는 실제 Go로 컴파일하고 실행합니다. CI는 `.go-version`의 Go를 설치하고, 로컬에 Go가 없으면 이 테스트를 건너뜁니다.

먼저 읽을 파일: `src/runner.ts`, `src/wasi.ts`.
