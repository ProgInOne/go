# Go 기초 실행 예제·코드 문제 AI 교차 검토 기록 (2026-11-25)

예시 과정 `go-basics`의 시작하기 모듈에 새로 더한 레슨 실행 예제 3개와 코드 문제 4개(출력 예측 2개, 코드 작성 2개)를 독립 AI 검토자(`ai:reviewer`)가 검토한 기록입니다.
검토 방법, 항목별 판단, 직접 고친 내용과 남은 한계를 적습니다.

- 상태: 완료
- 검토: 독립 AI 검토자 (`ai:reviewer`, [JS D-027](https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md))
- 검토일: 2026-11-25
- 관련 문서: [콘텐츠 작성 가이드](/docs/guides/content-authoring.md), [G-002](/docs/decisions.md#g-002-go-코드-실행과-채점--확정), [G-003](/docs/decisions.md#g-003-go-코드-문제의-채점-세부--확정), [이전 검토 기록](/docs/reviews/2026-11-24-go-basics-level3-review.md)

## 검토 범위와 방법

대상은 다음과 같습니다. 문제는 모두 `review.status: draft`, `draftedBy: ai:claude`였습니다.

| 대상 | 파일 |
|---|---|
| 실행 예제 `two-lines`(`predict`)와 앞뒤 문장 | `lessons/01-first-program/lesson.mdx` |
| 실행 예제 `price`(`predict`), `redeclare`(`expectError`)와 앞뒤 문장 | `lessons/02-variables/lesson.mdx` |
| `first-program.predict-call-order` | `lessons/01-first-program/exercises/004-predict-call-order.yaml` |
| `first-program.write-two-lines` | `lessons/01-first-program/exercises/005-write-two-lines.yaml` |
| `variables.predict-redeclare` | `lessons/02-variables/exercises/004-predict-redeclare.yaml` |
| `variables.write-price` | `lessons/02-variables/exercises/005-write-price.yaml` |

검토 절차:

1. 초안 작성 대화를 보지 않고, `git diff develop -- content/`로 레슨 변경을 확인하고, 두 레슨의 `lesson.yaml`·`lesson.mdx`, 같은 레슨의 기존 문제, `content/concepts/go.yaml`, `content/misconceptions/go.yaml`, [콘텐츠 작성 가이드](/docs/guides/content-authoring.md)의 실행 예제·출력 예측·코드 작성 절, [G-002](/docs/decisions.md#g-002-go-코드-실행과-채점--확정)·[G-003](/docs/decisions.md#g-003-go-코드-문제의-채점-세부--확정), 이전 검토 기록 두 개를 읽었습니다. 채점 방식은 `packages/exercise-kit`의 `predict_output`(오답→오개념 대응, 줄 비교)과 웹의 `RunnableExampleBlock`(버튼 이름 "코드 수정", 기본값 `editable`)에서 확인했습니다.
1. 문제마다 정답이 하나로 정해지는지, 지문이 요구하는 출력을 정확히 말하는지, 힌트 3단계가 차례로 좁혀 가는지, 해설이 실제 동작과 맞는지, 오개념 연결(`misconceptions`, `misconceptionByAnswer`)과 개념 태그, 난이도, 레슨 본문만으로 풀 수 있는지를 확인했습니다. 예측 예제는 실행 전에 출력이 드러나지 않는지 봤습니다.
1. `pnpm content:check:run`으로 예제 3개, 출력 예측 2개, 코드 작성 2개를 실제 Go(`go1.27.3`)로 실행했습니다(gofmt 형식, 모범 답안 통과, 시작 코드 실패, 출력 예측 정답 기록).
1. **학습자가 낼 법한 오답을 검토자가 직접 만들어 `go1.27.3 darwin/arm64`로 실행했습니다.** 초안 파일은 직접 실행하지 않고(콘텐츠 검사의 샌드박스 실행만), 저장소 밖 임시 폴더(`$TMPDIR`)에 모듈을 만들어 `go run`과 `gofmt -l`로 확인했습니다.
1. 수정 뒤 `pnpm content:check:run --frozen`(예제 3/3, 출력 예측 2/2, 코드 작성 2/2 통과, 오류 0, 경고 0), `pnpm content:build`(문제 12개 포함, 미검토 제외 0), `pnpm check:links`(깨진 링크 0)를 실행했습니다. `content:build`가 `content/.published-slugs.txt`에 문제 slug 4개를 더했습니다.

### 실행으로 확인한 내용

| 확인한 코드 | 결과 (go1.27.3) | 쓰인 곳 |
|---|---|---|
| 예제 `two-lines` | `첫째 줄` / `둘째 줄 2` | 단계별 해설의 출력 |
| 예제 `price` | `가격: 1500` | 단계별 해설의 출력 |
| 예제 `redeclare`(`x := 1` 다음 `x := 2`) | `./main.go:7:4: no new variables on left side of :=` 하나만 | "몇 번째 줄의 무엇이 문제인지 메시지에 나와 있어요" |
| `predict-call-order` 지문 | `시작` / `안녕` / `끝` | 정답(`predict-expected.json`과 같음) |
| 같은 지문에서 `greet()` 호출을 뺌 | `시작` / `끝` | `greet`는 불러야 실행됨. 오답 `안녕`/`시작`/`끝`은 파일 순서대로 실행된다는 오개념의 답 |
| `write-two-lines` 모범 답안 | `안녕, Go!` / `1 + 2 = 3` | 체크 통과 |
| `fmt.Println("1 + 2 = ", 1+2)` | `1 + 2 =  3`(공백 두 개) | 틀림. 줄 끝 공백만 무시하므로 중간 공백은 채점에서 걸림. 해설에 더함 |
| `fmt.Println("1 + 2 = 1+2")` | `1 + 2 = 1+2` | 틀림(따옴표 안의 식) |
| `fmt.Println("1 + 2 =" + 1 + 2)` | `invalid operation: "1 + 2 =" + 1 (mismatched types untyped string and untyped int)` | 틀림(컴파일 오류) |
| 첫 줄을 `fmt.Print`로 씀 | `안녕, Go!1 + 2 = 3` | 틀림(줄 바꿈 없음) |
| `fmt.Println("1 + 2 = 3")` | `안녕, Go!` / `1 + 2 = 3` | **통과함.** 출력 검사로는 "`1+2`를 계산해서"를 강제할 수 없음(남은 한계 1) |
| `predict-redeclare` 지문(`score := 10` 다음 `score := 20`) | `./main.go:7:8: no new variables on left side of :=` | 정답 d(`predict-expected.json`의 `choiceId: d`와 같음) |
| 둘째 줄을 `score = 20`으로 | `20` | 해설의 고치는 방법 |
| `write-price` 모범 답안 | `가격: 1300` | 체크 통과 |
| `write-price` 시작 코드 | `가격:` | 체크 실패 |
| 둘째 줄을 `price := price + 300`으로 | `no new variables on left side of :=` | 해설 |
| 둘째 줄을 `price + 300`만 | `price + 300 (value of type int) is not used` | 해설에 더함 |
| `price = price + 300` 뒤 `fmt.Println("가격: 1300")` | 컴파일 성공, `가격: 1300` | **초안 해설과 다름.** `price = price + 300`이 `price`를 읽으므로 `declared and not used`가 나지 않음 |
| `price = 1300` 뒤 `fmt.Println("가격: 1300")` | `declared and not used: price` | `price`를 한 번도 읽지 않을 때만 이 오류가 남 |
| `price := 1000` 뒤 `fmt.Println("가격:", price+300)` / 변수 없이 `fmt.Println("가격:", 1300)` | `가격: 1300` | 통과함(남은 한계 1) |
| 위 프로그램 전체에 `gofmt -l` | 출력 없음 | 예제·지문 코드 모양 |

## 항목별 판단

| 항목 | 유형·난이도 | 판단 | 이유 |
|---|---|---|---|
| 예제 `two-lines`, `price` | 실행 예제(`predict`) | 승인 | 원래 예제 아래의 "출력은 …예요" 문장을 지우고 단계별 해설로 옮겨, 실행 전에 출력이 드러나지 않음. "두 줄을 출력해요"는 `Println`이 두 번이라 코드에서 바로 보이는 정보라 그대로 둠 |
| 예제 `redeclare` | 실행 예제(`expectError`) | 승인 | 바로 위 Pitfall과 같은 코드이고, 실제 메시지에 줄·열(`7:4`)과 원인이 나옴. 웹은 컴파일 오류 줄도 표시함 |
| `first-program.predict-call-order` | predict_output(output) · L2 | 승인 | 정답 출력이 하나로 정해짐. `misconceptionByAnswer`의 `안녕\n시작\n끝`은 파일 순서대로 실행된다는 `go.mc.top-function-runs-first`의 답과 정확히 맞음. 같은 레슨의 L3 `mcq-trace-two-functions`보다 판단할 것이 적어(호출 순서가 곧 `main` 문장 순서) L2가 알맞음 |
| `first-program.write-two-lines` | implement_function(프로그램) · L2 | 해설 보강 후 승인 | 기대 출력이 지문에 그대로 있고 레슨의 `Println` 표(여러 값 사이 공백, 식 계산)만으로 풀 수 있음. 시작 코드가 구조를 주므로 `go.basics.println` 하나만 둔 것이 맞음 |
| `variables.predict-redeclare` | predict_output(choice) · L2 | 힌트 순서 조정 후 승인 | 실제 결과와 맞는 보기가 d 하나(`outcome: compile-error`). 오답 a에 `go.mc.short-decl-reassigns` 연결이 맞음. 레슨의 `redeclare` 예제와 같은 상황이라 쉬운 편이지만 같은 레슨 L2 `mcq-change-value`와 같은 수준의 준비 구간 문제로 봄 |
| `variables.write-price` | implement_function(프로그램) · L3 → L2 | 해설·힌트·난이도·오개념 수정 후 승인 | 초안 해설과 힌트 3의 "`price`를 출력하지 않으면 `declared and not used`"가 실제 동작과 다름(위 표). 지문이 세 줄의 할 일과 셋째 줄 코드까지 주고 레슨 예제와 숫자만 다르므로 L3 기준("L1·L2보다 판단할 것이 많음")에 맞지 않음 |

## 고친 내용

- **`write-price` 해설·힌트.** 초안은 "마지막에 `price`를 출력하지 않으면 `declared and not used` 오류가 나요"(해설), "쓰지 않는 변수는 컴파일 오류예요"(힌트 3)라고 적었지만, `price = price + 300`이 `price`를 읽으므로 출력 줄에서 빼도 컴파일됩니다. 이 문장을 지우고, 실제로 나는 흔한 실수인 "`price + 300`만 쓰고 다시 넣지 않음"(`… is not used`)을 해설에 넣었습니다.
- **`write-price` 힌트 2·3.** 초안 힌트 2가 둘째 줄 코드 `price = price + 300`을 그대로 줘서, 힌트 2는 "`=` 오른쪽에 지금 값과 `300`을 더하는 식"으로 좁히고, 코드는 힌트 3에서 출력 줄과 함께 줍니다.
- **`write-price` 오개념 목록.** 위 이유로 이 문제의 오답이 `go.mc.unused-variable-ok`로 이어지지 않으므로 빼고 `go.mc.short-decl-reassigns`만 둡니다.
- **`write-price` 난이도 3 → 2.** 두 레슨 모두 난이도 3 연습 문제(`mcq-trace-*`)가 이미 있어 도전 구간은 비지 않습니다.
- **`write-two-lines` 해설.** 힌트 2("여러 값 사이에 공백")를 보고 `"1 + 2 = "`처럼 따옴표 안에도 공백을 넣으면 `1 + 2 =  3`이 되어 틀린다는 점을 더했습니다. 채점은 줄 끝 공백만 무시합니다.
- **`predict-redeclare` 힌트 2·3 순서.** 초안 힌트 2("같은 이름의 새 변수를 같은 범위에서 또 만들 수 있을까요?")가 힌트 3("값을 바꿀 때 쓰는 기호와 비교")보다 정답에 가까워 순서를 바꿨습니다. 프로그램·보기는 바꾸지 않아 기대값은 그대로입니다.
- **`variables` 레슨 `next` 섹션.** "Go 코드를 직접 실행하는 실습은 Go 전용 설계 이후에 더해요"는 이번 추가로 사실이 아니게 되어 지웠습니다.
- **두 레슨의 `practice.targetCount` 3 → 5.** 승인 뒤 `pnpm content:check:run`이 "승인된 문제 5개 / 목표 3개" 경고를 내서 실제 수에 맞췄습니다.
- 네 문제에 `review.status: approved`, `reviewedBy: ai:reviewer`를 넣었습니다. `draftedBy: ai:claude`는 그대로 둡니다.
- [콘텐츠 작성 가이드](/docs/guides/content-authoring.md)의 "예시 과정" 문단의 수(실행 예제 3개, 문제 12개)와 이 기록의 링크를 고쳤습니다.

## 그대로 둔 판단

- **`predict-call-order` 힌트 3.** "`greet()`를 만나면 … 끝나면 `main`으로 돌아와요"는 정답에 가깝지만 셋째 힌트라 괜찮다고 봤습니다. 레슨은 함수 호출을 "불러야 실행돼요"로만 다루지만, 같은 레슨의 기존 문제 둘이 이미 `greet()` 호출을 쓰므로 범위 밖이 아닙니다.
- **`predict-redeclare`의 보기 문구.** `'`20`을 출력한다'`처럼 출력이 아닌 설명 문구입니다. 프로그램이 컴파일되지 않아 출력 보기는 정답 계산에 쓰이지 않고, E2E 픽스처도 같은 모양이라 그대로 둡니다. 출력이 나오는 프로그램의 `choice` 문제라면 보기 텍스트가 실제 출력과 같아야 합니다.
- **`predict-redeclare`와 레슨 `redeclare` 예제가 거의 같은 것.** 레슨에서 오류를 직접 읽은 뒤 같은 상황을 다른 이름으로 다시 판단하게 하는 준비 구간 문제로 봤습니다.
- **`write-two-lines` 지문의 "`1+2`를 계산해서".** 출력 검사로 강제할 수는 없지만 학습 의도를 알려 주는 문장이라 둡니다.

## 남은 한계와 후속 제안

1. **프로그램 작성 문제는 출력만 채점합니다.** `fmt.Println("1 + 2 = 3")`, `fmt.Println("가격:", 1300)`처럼 지문의 방법(식 계산, `:=` 다음 `=`)을 따르지 않아도 통과합니다. G-002에서 나중으로 미룬 소스 구조 검사가 생기면 `write-price`에 "`:=`와 `=`를 모두 씀" 같은 체크를 더하길 권합니다. 그 전까지는 지문을 따르는지 학습자에게 맡깁니다.
1. **렌더링과 앱 흐름은 확인하지 않았습니다.** 예측 입력란, 컴파일 오류 표시, 코드 작성 작업대에서 이 문제들이 어떻게 보이는지는 앱에서 확인해야 합니다.
1. **`predict-call-order`의 오개념 연결은 오답 하나뿐입니다.** `시작`/`끝`(호출한 함수의 출력을 빠뜨림) 같은 다른 오답은 오개념으로 이어지지 않고 줄별 피드백만 받습니다. 학습자 오답 기록이 쌓이면 흔한 답을 `misconceptionByAnswer`에 더하길 권합니다.
