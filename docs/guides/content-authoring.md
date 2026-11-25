# 콘텐츠 작성 가이드

Go 과정의 콘텐츠를 쓰고 검사하고 `content.db`로 빌드하는 방법입니다.

파일 형식과 필드, 섹션 규칙, 문제 유형의 스펙은 세 저장소가 함께 쓰는 공통 스키마(`@proginone/content-schema`, `@proginone/exercise-core`)를 따릅니다. 자세한 작성 규칙과 예시는 [JavaScript 저장소의 콘텐츠 작성 가이드](https://github.com/ProgInOne/javascript/blob/develop/docs/guides/content-authoring.md)가 원천입니다. 이 문서에는 Go 저장소에서 다른 점만 적습니다.

## 지금 쓸 수 있는 것

레슨의 실행 예제는 학습자의 Go로 로컬 서버에서 실행합니다([G-002](/docs/decisions.md#g-002-go-코드-실행과-채점--확정)). 문제는 선택형, 출력 예측(`predict_output`), 코드 작성(`implement_function`)을 씁니다([G-003](/docs/decisions.md#g-003-go-코드-문제의-채점-세부--확정)).

| 항목 | 지금 | 이유 |
|---|---|---|
| 레슨 본문 | MDX. 읽기만 하는 코드는 ` ```go ` 펜스 코드 블록, 실행하는 코드는 `<RunnableExample>` | |
| 문제 유형 | `mcq_single`, `mcq_multi`, `true_false`, `predict_output`, `implement_function` | 나머지 코드 유형은 G-003 순서대로 더함(`packages/exercise-kit`) |
| `usage` | `practice`, `check`(본문의 이해도 확인), `assessment`, `worked_example` | `try`와 `project`는 코드 채점이 필요함 |
| 단원 종류 | `lesson`, `assessment` | `project`는 코드 채점이 필요함 |
| 문제 템플릿(`templates/`) | 쓸 수 없음 | Go 템플릿 형식은 Go 전용 설계에서 정함 |

MDX 컴포넌트는 `Section`, `RunnableExample`, `InlineExercise`, `Callout`, `CompareTable`/`Row`, `ConceptLink`, `Pitfall`/`Wrong`/`Actual`/`Right`, `Diagram`, `Figure`, `Reveal`, `Key`만 씁니다. JavaScript 저장소의 `TryIt`은 코드 채점이 필요하고, `ValueTrace`와 `MdnLink`는 JavaScript 전용이라 없습니다.

### 실행 예제

`<RunnableExample>`은 학습자가 "실행"을 눌러 로컬 서버에서 돌려 보는 Go 프로그램입니다.

````mdx
<RunnableExample id="sum" lang="go" predict>

```go
package main

import "fmt"

func main() {
	fmt.Println("합계:", 3+4)
}
```

</RunnableExample>
````

| 속성 | 설명 |
|---|---|
| `id` | 레슨 안에서 겹치지 않는 이름. 소문자, 숫자, 하이픈 |
| `lang` | `go`만 씀 |
| `predict` | 처음 실행하기 전에 출력을 예측해 적게 함 |
| `editable` | 학습자가 코드를 고쳐 다시 실행할 수 있음. 기본값은 켬이고, 끄려면 `editable={false}` |
| `expectError` | 컴파일 오류를 보여 주려는 예제. 실행 결과에 그 뜻을 알림 |

- 코드는 `package main`과 `func main()`이 있는 완전한 프로그램이어야 합니다. 표준 라이브러리만 쓸 수 있고, 파일·네트워크·프로세스 실행은 동작하지 않습니다.
- `time.Sleep`은 실제로 기다리지 않고 가상 시계를 앞으로 보냅니다. `time.Now()`는 2009-11-10 23:00:00 UTC에서 시작합니다.
- `pnpm content:check:run`이 모든 예제(검토 전 포함)를 실제 Go로 컴파일·실행합니다. 예제는 gofmt 형식이어야 하고, 오류 없이 끝나야 합니다. `expectError` 예제는 컴파일 오류가 나야 합니다. panic이나 0이 아닌 종료 코드로 끝나는 예제는 아직 쓸 수 없습니다.

섹션 종류는 JavaScript 저장소와 같습니다. 다만 `walkthrough` 섹션은 실행 결과가 아니라 예제를 한 줄씩 따라가는 해설로 씁니다. 화면 제목은 "단계별 해설"이고, 레슨 화면에서는 `examples`와 함께 "예제 따라가기" 단계로 묶입니다.

### 출력 예측 문제

`predict_output`은 프로그램이 무엇을 출력하는지 예측하는 문제입니다([G-003](/docs/decisions.md#g-003-go-코드-문제의-채점-세부--확정)).

```yaml
type: predict_output
spec:
  code: |
    package main

    import "fmt"

    func main() {
    	fmt.Println("합계:", 3+4)
    }
  answerKind: output          # 출력 전체를 적게 함. choice면 보기를 고르게 함
  # stdin: "고퍼\n"           # 프로그램이 읽을 표준 입력(선택)
  # choices:                  # answerKind: choice일 때
  #   - { id: a, text: '`합계: 7`' }
  #   - { id: b, text: 컴파일 오류가 난다, outcome: compile-error }   # 또는 outcome: panic
  misconceptionByAnswer:      # 흔한 오답(출력 텍스트, choice면 보기 ID) → 오개념
    '합계: 3+4': go.mc.expr-printed-as-text
```

- `code`는 `package main`과 `func main()`이 있는 완전한 프로그램이고, gofmt 형식이어야 합니다.
- 정답(`spec.expected`)은 쓰지 않습니다. `pnpm content:check:run`이 실제로 실행해 `content/.generated/predict-expected.json`에 기록하고, `check`와 `build`가 그 값을 씁니다. 코드를 고치면 다시 실행해 이 파일도 함께 커밋합니다. 승인된 문제에 최신 기대값이 없으면 오류입니다.
- 실행할 때마다 결과가 같아야 합니다. 맵을 순회하며 출력하거나 난수를 출력하는 코드는 쓸 수 없습니다.
- `output` 문제의 프로그램은 정상으로 끝나야 합니다. 컴파일 오류나 panic을 묻고 싶으면 `choice`로 쓰고, 그 결과를 뜻하는 보기에 `outcome`을 붙입니다. `choice`에서는 실제 결과와 맞는 보기가 정확히 하나여야 합니다.
- 보기 텍스트는 Markdown 인라인입니다. 출력은 백틱으로 감쌉니다.

### 코드 작성 문제

`implement_function`은 학습자가 Go 코드를 쓰고, 서버가 실행해 사례마다 채점하는 문제입니다.

```yaml
type: implement_function
spec:
  entry: Add                  # 이 함수를 완성하게 함. 없으면 프로그램 전체를 쓰게 함
  starter: |                  # 에디터의 시작 코드
    package main

    func Add(a, b int) int {
    	return 0
    }
  solution: |                 # 모범 답안(학습자에게 보내지 않음)
    package main

    func Add(a, b int) int {
    	return a + b
    }
  checks:
    - { id: small, kind: call, args: ['3', '4'], want: ['7'] }
    - { id: big, kind: call, args: ['1000', '2000'], want: ['3000'], hidden: true }
```

- `entry`가 있으면 `call` 체크만 씁니다. `args`와 `want`는 한 줄짜리 Go 식입니다. 반환값이 여럿이면 `want`도 여럿이고, `error` 결과는 보통 `nil`이나 `errors.New("…")`입니다. 기대값은 함수의 반환 타입으로 맞춰 비교하므로 타입을 적지 않아도 됩니다. 식에서 `errors`, `math`, `strings`, `strconv`, `time`, `unicode` 패키지를 쓸 수 있습니다.
- `entry`가 있는 문제의 `starter`와 `solution`에는 `main` 함수를 두지 않습니다. 학습자가 `main`을 쓰면 "함수만 작성해요"라고 알려 줍니다.
- `entry`가 없으면 `stdout` 체크만 씁니다. `text`는 기대 출력이고 `match`는 `exact`(기본, 줄 끝 공백과 끝 빈 줄 무시)나 `contains`입니다. `stdin`으로 표준 입력을 줄 수 있습니다(서로 다른 입력은 10개까지).
- `hidden: true` 사례는 학습자에게 이름("숨겨진 사례 N")만 보이고, 실패해도 입력과 기대값을 보여 주지 않습니다. 보이는 사례를 하나 이상 둡니다.
- `pnpm content:check:run`이 `starter`와 `solution`이 gofmt 형식인지, `solution`이 모든 사례를 통과하는지, `starter`가 적어도 하나를 통과하지 못하는지 서버와 같은 방법으로 채점해 확인합니다.
- 컴파일 오류, panic, 시간 초과(5초)는 그 사례의 실패로 채점합니다. 지금은 컴파일 결과나 종료 코드를 따로 묻는 체크(`compile`, `exit`)가 없습니다. 버그 고치기 같은 다음 유형에서 더합니다.

## 디렉터리 구조

```text
content/
├── pack.yaml                   # 콘텐츠 팩: 트랙과 과정 순서
├── concepts/go.yaml            # 개념 목록
├── misconceptions/go.yaml      # 오개념 목록
└── courses/go-basics/
    ├── course.yaml             # language: go
    └── modules/01-start/
        ├── module.yaml
        └── lessons/01-first-program/
            ├── lesson.yaml
            ├── lesson.mdx
            └── exercises/*.yaml
```

- 과정의 `language`는 `go`만 쓸 수 있습니다.
- 개념의 참고 문서는 `doc`에 `https://go.dev/` 또는 `https://pkg.go.dev/` 주소로 적습니다. 빌드하면 `concepts.doc_url`에 들어갑니다.
- 문제 검토 규칙은 JavaScript 저장소와 같습니다([JS D-027](https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md)). 사람이나 독립된 AI 검토자가 승인한 문제(`review.status: approved`)만 배포용 `content.db`에 들어갑니다.

## 검사와 빌드

```shell
pnpm content:check       # 스키마, 참조 무결성, 문제 스펙, 섹션 규칙 검사
pnpm content:check:run   # 위 검사 + 레슨 실행 예제, 출력 예측, 코드 작성 문제를 실제 Go로 실행(Go 1.22 이상 필요)
                         # 출력 예측의 기대값 파일을 갱신. --frozen이면 갱신 대신 실패(CI)
pnpm content:build       # 승인된 문제만 content/dist/content.db로 빌드하고 공개 slug 목록 갱신
pnpm content:build:dev   # 개발용: 검토 전(draft) 문제도 포함
```

CI는 `pnpm content:check`와 `.go-version`의 Go로 `pnpm content:check:run`을 실행합니다. MDX와 `content/`는 Prettier 대상이 아닙니다.

## 예시 과정

`content/courses/go-basics`는 뼈대를 확인하기 위한 예시 과정입니다. 레슨 2개에 실행 예제 3개, 문제 12개(선택형 8개, 출력 예측 2개, 코드 작성 2개)가 있고, 문제는 독립 AI 검토자가 승인했습니다(검토 기록: [처음 6개](/docs/reviews/2026-11-23-go-basics-start-review.md), [난이도 3 문제 2개](/docs/reviews/2026-11-24-go-basics-level3-review.md), [실행 예제와 코드 문제 4개](/docs/reviews/2026-11-25-go-basics-code-review.md)). 그래서 `pnpm content:build`에 문제 12개가 모두 들어갑니다.

연습 세트는 난이도 구간(준비 1~2, 중심 2~3, 도전 3~4)에서 문제를 고르므로, 레슨마다 난이도 3 이상 연습 문제를 하나 이상 둡니다. `importance: core` 레슨은 난이도 3 이상 문제를 처음 시도에 하나 이상 맞혀야 통과하므로 반드시 필요합니다.
