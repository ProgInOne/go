# @proginone/exercise-kit

Go 저장소의 문제 유형 레지스트리와 경계 함수입니다.

공통 패키지 `@proginone/exercise-core`의 `createExerciseRegistry`로 레지스트리를 만들고([JS D-096](https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md)), 신뢰할 수 없는 입력(콘텐츠 원본, AI 출력, 학습자 답안)을 유형의 스키마로 검증한 뒤 순수 채점기를 부르는 함수(`checkSpec`, `redactSpec`, `gradeSubmission` 등)를 내보냅니다.

- 공통 선택형 3종(`mcq_single`, `mcq_multi`, `true_false`)과 Go 유형을 등록합니다([G-003](/docs/decisions.md#g-003-go-코드-문제의-채점-세부--확정)).
- `predict_output`(`src/types/predict-output.ts`): 빌드 때 실행한 결과가 정답이라 채점에 실행이 필요 없습니다. `expectedFromObservation`은 content-cli가 실행 결과에서 정답을 정할 때 씁니다.
- 실행 결과로 채점하는 유형(`implement_function`)과 러너 계약(`parseRun`)은 다음 단계에서 더합니다. 그때까지 실행 결과가 붙은 제출은 거부합니다.
- I/O 없는 순수 패키지입니다(`.dependency-cruiser.cjs`의 `pure-packages-no-io`).

먼저 읽을 파일: `src/index.ts`.
