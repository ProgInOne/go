# 콘텐츠 작성 가이드

Go 과정의 콘텐츠를 쓰고 검사하고 `content.db`로 빌드하는 방법입니다.

파일 형식과 필드, 섹션 규칙, 문제 유형의 스펙은 세 저장소가 함께 쓰는 공통 스키마(`@proginone/content-schema`, `@proginone/exercise-core`)를 따릅니다. 자세한 작성 규칙과 예시는 [JavaScript 저장소의 콘텐츠 작성 가이드](https://github.com/ProgInOne/javascript/blob/develop/docs/guides/content-authoring.md)가 원천입니다. 이 문서에는 Go 저장소에서 다른 점만 적습니다.

## 지금 쓸 수 있는 것

이 저장소는 아직 Go 코드를 실행하지 않습니다([G-001](/docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)). 그래서 실행 없이 다룰 수 있는 콘텐츠만 씁니다.

| 항목 | 지금 | 이유 |
|---|---|---|
| 레슨 본문 | MDX. 코드는 ` ```go ` 펜스 코드 블록으로 보여 줌 | 실행하지 않고 읽기만 함 |
| 문제 유형 | `mcq_single`, `mcq_multi`, `true_false` | 공통 선택형만 등록됨(`packages/exercise-kit`) |
| `usage` | `practice`, `check`(본문의 이해도 확인), `assessment`, `worked_example` | `try`와 `project`는 코드 실행이 필요함 |
| 단원 종류 | `lesson`, `assessment` | `project`는 코드 실행이 필요함 |
| 문제 템플릿(`templates/`) | 쓸 수 없음 | Go 템플릿 형식은 Go 전용 설계에서 정함 |

MDX 컴포넌트는 `Section`, `InlineExercise`, `Callout`, `CompareTable`/`Row`, `ConceptLink`, `Pitfall`/`Wrong`/`Actual`/`Right`, `Diagram`, `Figure`, `Reveal`, `Key`만 씁니다. JavaScript 저장소의 `RunnableExample`, `TryIt`, `ValueTrace`, `MdnLink`는 실행이 필요하거나 JavaScript 전용이라 없습니다. 실행 예제와 "직접 써 보기"는 Go 코드 실행 방식과 함께 정합니다.

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
pnpm content:build       # 승인된 문제만 content/dist/content.db로 빌드하고 공개 slug 목록 갱신
pnpm content:build:dev   # 개발용: 검토 전(draft) 문제도 포함
```

CI는 `pnpm content:check`를 실행합니다. MDX와 `content/`는 Prettier 대상이 아닙니다.

## 예시 과정

`content/courses/go-basics`는 뼈대를 확인하기 위한 예시 과정입니다. 레슨 2개와 선택형 문제 6개가 있고, 문제는 아직 검토 전(draft)입니다. 그래서 `pnpm content:build`에는 문제가 들어가지 않고, 앱에서 문제를 보려면 `pnpm content:build:dev`로 빌드합니다.
