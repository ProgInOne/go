# @proginone/exercise-kit

Go 저장소의 문제 유형 레지스트리와 경계 함수입니다.

공통 패키지 `@proginone/exercise-core`의 `createExerciseRegistry`로 레지스트리를 만들고([JS D-096](https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md)), 신뢰할 수 없는 입력(콘텐츠 원본, AI 출력, 학습자 답안)을 유형의 스키마로 검증한 뒤 순수 채점기를 부르는 함수(`checkSpec`, `redactSpec`, `gradeSubmission` 등)를 내보냅니다.

- 지금은 공통 선택형 3종(`mcq_single`, `mcq_multi`, `true_false`)만 등록합니다. Go 코드 실행이 없어서 러너 계약(`parseRun`)도 없고, 실행 결과가 붙은 제출은 거부합니다([G-001](/docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)).
- Go 문제 유형과 러너 계약은 Go 전용 설계에서 정한 뒤 여기에 더합니다.
- I/O 없는 순수 패키지입니다(`.dependency-cruiser.cjs`의 `pure-packages-no-io`).

먼저 읽을 파일: `src/index.ts`.
