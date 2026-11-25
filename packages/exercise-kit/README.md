# @proginone/exercise-kit

Go 저장소의 문제 유형 레지스트리와 경계 함수입니다.

공통 패키지 `@proginone/exercise-core`의 `createExerciseRegistry`로 레지스트리를 만들고([JS D-096](https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md)), 신뢰할 수 없는 입력(콘텐츠 원본, AI 출력, 학습자 답안)을 유형의 스키마로 검증한 뒤 순수 채점기를 부르는 함수(`checkSpec`, `redactSpec`, `gradeSubmission` 등)를 내보냅니다.

- 공통 선택형 3종(`mcq_single`, `mcq_multi`, `true_false`)과 Go 유형을 등록합니다([G-003](/docs/decisions.md#g-003-go-코드-문제의-채점-세부--확정)).
- `predict_output`(`src/types/predict-output.ts`): 빌드 때 실행한 결과가 정답이라 채점에 실행이 필요 없습니다. `expectedFromObservation`은 content-cli가 실행 결과에서 정답을 정할 때 씁니다.
- `implement_function`(`src/types/implement-function.ts`): `buildRunPlan`이 실행 계획(학습자 `main.go`, `entry`가 있으면 사례를 부르는 하네스 `zz_harness.go`)을 만들고, 서버가 실행한 결과로 채점합니다. 하네스는 결과 줄을 제출마다 다른 비밀 표지 뒤에 출력합니다.
- Go 러너 계약(`src/run-contract.ts`): 실행 계획과 결과의 형식, 결과 검증(`parseGoRun`, 레지스트리의 `parseRun`), 주입받은 실행 함수로 계획을 실행하는 `executeRunPlan`. 이 패키지는 I/O가 없으므로 실제 실행은 서버와 content-cli가 `@proginone/go-runner`로 합니다. 실제 Go로 하네스와 채점을 확인하는 테스트는 `tools/content-cli/src/code-grading.test.ts`에 있습니다.
- I/O 없는 순수 패키지입니다(`.dependency-cruiser.cjs`의 `pure-packages-no-io`).

먼저 읽을 파일: `src/index.ts`.
