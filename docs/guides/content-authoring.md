# 콘텐츠 작성 가이드

Go 과정의 콘텐츠를 쓰고 검사하고 `content.db`로 빌드하는 방법입니다.

파일 형식과 필드, 섹션 규칙, 문제 유형의 스펙은 세 저장소가 함께 쓰는 공통 스키마(`@proginone/content-schema`, `@proginone/exercise-core`)를 따릅니다. 자세한 작성 규칙과 예시는 [JavaScript 저장소의 콘텐츠 작성 가이드](https://github.com/ProgInOne/javascript/blob/develop/docs/guides/content-authoring.md)가 원천입니다. 이 문서에는 Go 저장소에서 다른 점만 적습니다.

## 지금 쓸 수 있는 것

레슨의 실행 예제는 학습자의 Go로 로컬 서버에서 실행합니다([G-002](/docs/decisions.md#g-002-go-코드-실행과-채점--확정)). 코드를 채점하는 문제 유형은 아직 없어서, 문제는 선택형만 씁니다.

| 항목 | 지금 | 이유 |
|---|---|---|
| 레슨 본문 | MDX. 읽기만 하는 코드는 ` ```go ` 펜스 코드 블록, 실행하는 코드는 `<RunnableExample>` | |
| 문제 유형 | `mcq_single`, `mcq_multi`, `true_false` | 공통 선택형만 등록됨(`packages/exercise-kit`) |
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
pnpm content:check:run   # 위 검사 + 레슨 실행 예제를 실제 Go로 실행하고 gofmt 형식 확인(Go 1.22 이상 필요)
pnpm content:build       # 승인된 문제만 content/dist/content.db로 빌드하고 공개 slug 목록 갱신
pnpm content:build:dev   # 개발용: 검토 전(draft) 문제도 포함
```

CI는 `pnpm content:check`와 `.go-version`의 Go로 `pnpm content:check:run`을 실행합니다. MDX와 `content/`는 Prettier 대상이 아닙니다.

## 예시 과정

`content/courses/go-basics`는 뼈대를 확인하기 위한 예시 과정입니다. 레슨 2개와 선택형 문제 8개가 있고, 문제는 독립 AI 검토자가 승인했습니다(검토 기록: [처음 6개](/docs/reviews/2026-11-23-go-basics-start-review.md), [난이도 3 문제 2개](/docs/reviews/2026-11-24-go-basics-level3-review.md)). 그래서 `pnpm content:build`에 문제 8개가 모두 들어갑니다.

연습 세트는 난이도 구간(준비 1~2, 중심 2~3, 도전 3~4)에서 문제를 고르므로, 레슨마다 난이도 3 이상 연습 문제를 하나 이상 둡니다. `importance: core` 레슨은 난이도 3 이상 문제를 처음 시도에 하나 이상 맞혀야 통과하므로 반드시 필요합니다.
