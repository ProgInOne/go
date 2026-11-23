# Go 기초 시작하기 모듈 AI 교차 검토 기록 (2026-11-23)

예시 과정 `go-basics`의 시작하기 모듈(`go-basics.start`, 레슨 2개, 문제 6개)을 독립 AI 검토자(`ai:reviewer`)가 검토한 기록입니다.
검토 방법, 문제별 판단, 직접 고친 내용과 남은 한계를 적습니다.

- 상태: 완료
- 검토: 독립 AI 검토자 (`ai:reviewer`, [JS D-027](https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md))
- 검토일: 2026-11-23
- 관련 문서: [콘텐츠 작성 가이드](/docs/guides/content-authoring.md), [결정 기록](/docs/decisions.md)

## 검토 범위와 방법

대상은 다음과 같습니다. 문제는 모두 `review.status: draft`, `draftedBy: ai:claude`였습니다.

| 대상 | 파일 |
|---|---|
| 레슨 `first-program` 첫 Go 프로그램 | `lesson.yaml`, `lesson.mdx`, 문제 3개 |
| 레슨 `variables` 변수 선언 | `lesson.yaml`, `lesson.mdx`, 문제 3개 |
| 개념 3개 | `content/concepts/go.yaml` |
| 오개념 4개 | `content/misconceptions/go.yaml` |

검토 절차:

1. 초안 작성 대화를 보지 않고, 원본 파일과 [콘텐츠 작성 가이드](/docs/guides/content-authoring.md), 공통 스키마(`@proginone/content-schema` 0.2.0의 `review` 필드), JavaScript 저장소의 이전 검토 기록만 읽었습니다.
1. 레슨마다 섹션 구성, 선수 개념 순서, 해요체 문장, 본문의 Go 동작 설명을 확인했습니다.
1. 문제마다 정답이 하나로 정해지는지(`mcq_single`), 정답 집합이 맞는지(`mcq_multi`), 참·거짓이 맞는지(`true_false`), 선택지 이유·힌트 3단계·해설이 서로 맞고 힌트가 정답을 너무 일찍 주지 않는지, 오개념 연결과 개념 태그, 난이도를 확인했습니다.
1. **본문과 문제의 Go 코드, 출력, 컴파일 오류 메시지를 `go1.27.3 darwin/arm64`로 직접 컴파일·실행했습니다.** 저장소 밖 임시 폴더(`$TMPDIR`)에 모듈을 만들고 `go run`으로 확인했습니다. 결과는 아래 표와 같습니다.
1. 수정 뒤 `pnpm content:check`(오류 0, 경고 0)와 `pnpm content:build`(문제 6개 포함, 미검토 제외 0)를 실행했습니다.

### 실행으로 확인한 내용

| 확인한 코드 | 결과 (go1.27.3) | 쓰인 곳 |
|---|---|---|
| 가장 짧은 프로그램(`fmt.Println("안녕하세요")`) | `안녕하세요` | `first-program` 본문 |
| `fmt.Println("안녕")`, `fmt.Println(3 + 4)`, `fmt.Println("합계:", 7)` | `안녕` / `7` / `합계: 7` | `first-program` 본문 표 |
| `fmt.Println("첫째 줄")`, `fmt.Println("둘째 줄", 2)` | `첫째 줄` / `둘째 줄 2` | `first-program` 예제·따라가기 |
| `greet`를 `main` 위에 둔 프로그램 | `시작` / `반가워요` | `mcq-where-execution-starts` |
| `import "fmt"` 없이 `fmt.Println` | `undefined: fmt` | `tf-println-needs-import`, 본문 Pitfall, 오개념 |
| `fmt.Println("합계:", 3+4)` | `합계: 7` | `check-println-two-values` |
| `name := "고퍼"`, `age := 3`과 `%T` | `고퍼 3`, `string int` | `variables` 본문 |
| `count := 1`, `count = 2` | `2` | `variables` 본문 |
| `price := 1000`, `price = price + 500` | `가격: 1500` | `variables` 예제·따라가기 |
| `score := 10` 다음 `score := 20` (`x := 1` 다음 `x := 2`도 같음) | `no new variables on left side of :=` | `mcq-change-value`, `multi-compile-errors`, 본문 Pitfall, 오개념 |
| `score := 10` 다음 `var score = 20` | `score redeclared in this block` | `mcq-change-value` |
| `score := 10` 다음 `score == 20` | `score == 20 (untyped bool value) is not used` | `mcq-change-value` |
| `score := 10` 다음 `score = 20`만 쓰고 출력하지 않음 | `declared and not used: score` | `mcq-change-value` 지문 수정의 근거 |
| `y := 5`만 쓰고 사용하지 않음 | `declared and not used: y` | `multi-compile-errors`, 본문 Pitfall, 오개념 |
| `z := 1`, `z = 2`, `fmt.Println(z)` / `name := "고퍼"`, `fmt.Println(name)` | 컴파일 성공, `2` / `고퍼` | `multi-compile-errors` 오답 보기 |
| 쓰지 않는 `import "os"` | `"os" imported and not used` | `variables` 실전 사례 |
| 쓰지 않는 패키지 수준 `var` | 컴파일 성공 | 본문의 "함수 안의" 한정이 맞는지 |
| 함수 밖의 `x := 1` | `syntax error: non-declaration statement outside function body` | 본문의 "`:=`는 함수 안에서만" |
| 패키지 변수 초기화와 `init`이 있는 프로그램 | `main`보다 먼저 실행됨 | 오개념 `go.mc.top-function-runs-first`의 단순화 범위 |

오류 메시지는 Go 1.20부터 `declared and not used: y`처럼 변수 이름이 뒤에 붙습니다. 본문과 해설은 앞부분 `declared and not used`만 인용하므로 그대로 두었습니다.

## 문제별 판단

| 문제 | 유형·난이도 | 판단 | 이유 |
|---|---|---|---|
| `first-program.mcq-where-execution-starts` | mcq_single · L1 | 승인 | 정답(`main` 안의 `fmt.Println("시작")`)이 하나로 정해지고 실행 순서를 확인함. 오답마다 이유가 있고 `greet` 보기는 오개념과 연결됨 |
| `first-program.tf-println-needs-import` | true_false · L1 | 승인 | 거짓이 맞음. import는 파일 단위라 같은 패키지의 다른 파일이 `fmt`를 가져와도 이 파일에서는 `undefined: fmt` |
| `first-program.check-println-two-values` | mcq_single · L1 · check | 수정 후 승인 | 정답 하나, 출력 확인. 코드를 `gofmt` 모양(`3+4`)으로 고침 |
| `variables.mcq-change-value` | mcq_single · L2 | 수정 후 승인 | 지문에 "아래에서 출력한다"가 없으면 정답 `score = 20`도 `declared and not used`로 컴파일되지 않아 정답이 없어짐. 지문 보강, `==` 보기 이유 보강, 힌트 3 완화 |
| `variables.multi-compile-errors` | mcq_multi · L2 | 승인 | 정답 집합 {`x := 2` 재선언, 쓰지 않는 `y`}이 실행 결과와 같음. 오답 두 보기는 컴파일됨. `missedMisconception` 연결이 알맞음 |
| `variables.check-reassign-operator` | true_false · L1 · check | 승인 | 참이 맞음. 본문 비교표와 같은 내용이라 확인 문제로 알맞음 |

레슨 2개와 개념 3개, 오개념 4개도 승인했습니다(오개념 1개는 설명 보강).

난이도는 L1 4개, L2 2개로, 입문 첫 모듈에 알맞습니다. 두 L2 문제는 `:=`·`var`·`=`·`==`를 구분하거나 보기 네 개의 컴파일 여부를 각각 판단해야 해 L1보다 한 단계 높게 둔 초안을 유지했습니다.

## 고친 내용

- **`variables.mcq-change-value` 지문.** 초안은 "`score := 10` 바로 다음 줄에서 값을 20으로 바꾸려면"만 물었습니다. 같은 레슨에서 "쓰지 않는 변수는 컴파일 오류"를 배우는데, `score = 20`만 있고 `score`를 읽지 않으면 실제로 `declared and not used: score`가 납니다(대입은 사용으로 치지 않음). 레슨을 잘 이해한 학습자일수록 정답이 없다고 볼 수 있어, 지문에 "아래쪽에서 `fmt.Println(score)`로 `score`를 출력해요"를 넣었습니다.
- **같은 문제의 `==` 보기 이유와 해설.** "`==`는 비교 연산자라 값을 바꾸지 않아요"에 더해, 한 줄로만 적으면 `score == 20 (untyped bool value) is not used` 컴파일 오류도 난다는 점을 적었습니다.
- **같은 문제의 힌트 3.** "이미 있는 변수에 값을 넣는 기호는 하나예요"는 "글자 하나짜리 기호"로 읽혀 정답을 거의 그대로 알려 줬습니다. "`=`, `:=`, `==`가 각각 무엇을 하는지 떠올려 보세요"로 바꿨습니다.
- **`first-program.check-println-two-values`의 코드 모양.** `fmt.Println("합계:", 3 + 4)`는 `gofmt`가 `3+4`로 고치는 모양입니다. 지문, 보기(`합계: 3+4`), 이유, 해설을 `gofmt` 결과에 맞췄습니다. 인수가 하나인 본문 표의 `fmt.Println(3 + 4)`는 `gofmt`가 그대로 두므로 바꾸지 않았습니다.
- **오개념 `go.mc.top-function-runs-first`의 `reality`.** "프로그램은 `main` 함수에서 시작한다"는 입문 설명으로 알맞지만, 패키지 변수 초기화와 `init` 함수는 `main`보다 먼저 실행됩니다(실행으로 확인). 레슨 본문은 그대로 두고, AI 튜터 등이 참고하는 `reality`에만 이 범위를 괄호로 밝혔습니다.
- 문제 6개에 `review.status: approved`, `reviewedBy: ai:reviewer`를 넣었습니다. `draftedBy: ai:claude`는 그대로 둡니다. 스키마의 `review`는 `status`, `draftedBy`, `reviewedBy`만 받으므로(검토일 필드 없음) 검토일은 이 기록에 남깁니다.
- `pnpm content:build`가 `content/.published-slugs.txt`에 문제 slug 6개를 더했습니다.
- [콘텐츠 작성 가이드](/docs/guides/content-authoring.md)의 "예시 과정" 문단(검토 전이라 문제가 빌드에 들어가지 않는다)을 승인 상태에 맞게 고쳤습니다.

## 그대로 둔 판단

- **"실행은 언제나 `main` 함수에서 시작해요"(레슨 본문, `mcq-where-execution-starts` 해설).** `init`과 패키지 변수 초기화를 아직 배우지 않는 단계이고, 이 모듈의 프로그램에는 둘 다 없어 학습자가 보는 범위에서는 맞습니다. 오개념 `reality`에만 범위를 밝혔습니다.
- **`mcq-where-execution-starts`의 `import "fmt"` 보기 이유("실행되는 문장이 아니에요").** 엄밀히는 import한 패키지의 초기화가 실행되지만, `import` 선언 자체는 문장(statement)이 아니고 출력도 하지 않으므로 맞는 설명입니다.
- **`package main`을 "실행할 수 있는 프로그램이라는 표시"로 설명한 것.** 실행 파일이 되려면 `func main`도 필요하지만, 바로 다음 줄에서 `func main`을 함께 설명하므로 충분합니다.
- **`variables.multi-compile-errors`의 `x := 2` 보기.** `x`를 어디에도 쓰지 않아 `declared and not used`도 함께 날 수 있지만, 어느 쪽이든 컴파일 오류라 정답 판단은 같습니다.

## 남은 한계와 후속 제안

1. **코드를 실행하지 않는 문제만 있습니다.** 이 저장소는 아직 Go 코드를 실행하지 않아([G-001](/docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)) 검사 도구가 본문 코드와 오류 메시지를 자동으로 확인하지 못합니다. 이번 확인은 검토자가 손으로 실행한 것이라, Go 버전이 바뀌면 메시지가 달라질 수 있습니다. 코드 실행 검증을 도입할 때 이 모듈의 오류 메시지 인용(`undefined: fmt`, `no new variables on left side of :=`, `declared and not used`, `score redeclared in this block`)을 자동 검사 대상에 넣길 권합니다.
1. **렌더링은 확인하지 않았습니다.** 이 저장소에는 아직 앱이 없어 레슨과 문제 화면을 캡처하지 못했습니다.
1. **L3 이상 문제가 없습니다.** 뼈대용 예시 과정이라 문제가 레슨당 3개뿐입니다. 과정을 늘릴 때 난이도 분포와 개념별 최소 문제 수를 다시 맞춰야 합니다.
