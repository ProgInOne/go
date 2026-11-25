# 결정 기록 (Decision Log)

ProgInOne Go 저장소에서 합의한 제품·아키텍처 결정을 기록합니다. 결정을 바꿀 때는 기존 항목을 지우지 않고 상태를 `대체됨`으로 바꾼 뒤 새 항목을 추가합니다.

- 상태: `확정` / `잠정`(검증 후 확정) / `대체됨`
- 번호: 이 저장소의 결정은 `G-001`부터 매깁니다. JavaScript 저장소의 결정 기록과 번호가 겹치지 않게 하려고 접두사를 다르게 씁니다.
- 공통 결정: 세 저장소(javascript, core, go)에 함께 적용되는 결정과 그 이전의 제품 결정은 [JavaScript 저장소의 결정 기록][js-decisions]에 있습니다. 이 문서에서는 "JS D-090"처럼 적고 링크합니다. 특히 다음 결정이 이 저장소의 출발점입니다.
  - [JS D-090][js-decisions]: 공통 패키지 저장소 `ProgInOne/core`, 배포 방식, `develop`/`main` 브랜치
  - [JS D-092][js-decisions]: 공통 스키마의 언어 값은 열어 두고 언어 저장소가 좁힘
  - [JS D-096][js-decisions], [JS D-097][js-decisions]: 문제 유형 레지스트리 팩토리와 언어별 주입 지점(튜터 프로필, 에디터 언어, 체크 문구)

[js-decisions]: https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md

---

## G-001. Go 앱의 형태와 저장소 운영 — `확정`
- 2026-11-23, 사용자 결정(두 번째 학습 언어 Go 작업. JS D-090의 2단계 "Go 저장소 뼈대").
- **앱은 TypeScript 로컬 웹앱입니다.** JavaScript 앱과 같이 Node 로컬 서버와 React 웹으로 만들고, 학습 내용만 Go입니다. 공통 패키지(`@proginone/*`)를 그대로 쓰고 서버·웹 코드를 JavaScript 앱과 맞춰 둘 수 있어서, Go로 앱을 새로 쓰는 방법은 고르지 않았습니다.
- **서버와 웹은 JavaScript 저장소의 `apps/server`, `apps/web`을 복사한 뒤 JS 전용 부분을 걷어 내 시작합니다.** 두 앱에서 실제로 겹치는 부분은 뼈대가 생긴 뒤 확인하고, 그때 core로 옮깁니다(JS D-090의 3차 분리). 겹치는 범위를 추측해 먼저 떼어 내지 않습니다.
- **JavaScript 앱과 함께 실행할 수 있게 데이터 위치와 포트를 나눕니다.**
  - 프로덕션 데이터 폴더: macOS `~/Library/Application Support/ProgInOne Go`(다른 OS도 각 OS 표준 위치 아래 `ProgInOne Go`)
  - 서버 포트: `4311`(JavaScript 앱은 `4310`)
- **뼈대에는 Go 코드 실행이 없습니다.** 과정·레슨·선택형 문제(`mcq_single`, `mcq_multi`, `true_false`)·학습 엔진 흐름까지만 만듭니다. Go 콘텐츠의 형식, 코드 실행 샌드박스, 채점 체크, 에디터 언어는 다음 단계의 Go 전용 설계에서 정하고 승인을 받은 뒤 만듭니다.
- **저장소 운영은 javascript·core와 같습니다.**
  - 공개 저장소 `ProgInOne/go`. 기본 브랜치는 `develop`(스쿼시 병합만, 선형 기록), 릴리스는 `develop` → `main`(merge commit만). `main`으로 가는 PR은 `develop`에서만 엽니다.
  - Actions는 GitHub 소유 액션과 `pnpm/action-setup`만 허용하고, 워크플로 토큰은 읽기 전용입니다. 외부 기여자의 PR 워크플로는 승인 후 실행합니다.
  - 비밀 검사, 푸시 보호, Dependabot 보안 업데이트, 비공개 취약점 신고를 켭니다.
  - CI는 GitHub 호스트 러너에서만 실행합니다. 공개 저장소에 self-hosted runner를 붙이면 누구의 PR이든 소유자의 컴퓨터에서 실행되기 때문입니다.
- **필수 CI 검사는 처음에 `lint · typecheck · test · build` 하나입니다.** 브라우저 E2E는 서버·웹 뼈대가 생겨야 의미가 있으므로, 그때 `e2e · visual · a11y` 검사를 추가하고 두 번째 필수 검사로 등록합니다.
- **뼈대는 PR 다섯 개로 나눕니다.** ① 도구·CI·문서(이 결정) ② content-cli와 Go 예시 과정 1개(레슨과 선택형 문제만) ③ 서버 뼈대 ④ 웹 뼈대 ⑤ E2E와 두 번째 필수 검사. 서버는 `content.db`를 읽으므로 콘텐츠 파이프라인을 먼저 만듭니다.

## G-002. Go 코드 실행과 채점 — `확정`
- 2026-11-25, 사용자 결정(3단계 Go 전용 설계, 추천안 승인).
- **Go 도구 체인은 학습자 컴퓨터에 설치된 `go`를 씁니다.** 최소 버전은 1.22이고, 콘텐츠는 CI의 고정 버전(`.go-version`)으로 검증합니다. Go가 없으면 실행 기능만 끄고 설치를 안내합니다. 공식 배포판을 앱이 받아 주는 기능은 필요할 때 더합니다. Go Playground 원격 실행은 외부 프로그램용 공식 API가 아니고 학습자 코드를 외부로 보내므로 쓰지 않습니다.
- **로컬 서버가 `GOOS=wasip1 GOARCH=wasm`으로 컴파일하고, 서버의 Worker 스레드에서 직접 구현한 최소 WASI로 실행합니다.**
  - 컴파일은 부모 환경을 물려받지 않는 깨끗한 환경(`GOTOOLCHAIN=local`, `GOPROXY=off`, `GOENV=off`, `CGO_ENABLED=0`)과 학습자 파일만 있는 임시 모듈에서, 시간 제한을 두고 합니다. 표준 라이브러리만 씁니다.
  - 실행은 표준 입출력, 가상 시계, 난수, 종료만 열고 파일·네트워크·환경 변수를 주지 않습니다. 실행 시간, Wasm 메모리, 출력 크기에 한도를 둡니다.
  - `time.Sleep`은 가상 시계를 앞으로 보내기만 해 채점과 검증이 빠르고 결정론적입니다.
  - `node:wasi`는 실험 단계이고 보안 격리를 보장하지 않아 쓰지 않습니다. 브라우저 샌드박스 실행, 일반 실행 파일, Docker, 인터프리터는 [설계 문서](/docs/design/go-code-execution.md#검토한-대안)의 이유로 고르지 않았습니다.
- **채점은 서버가 실행하고 서버가 판정합니다.** 정답 키는 서버를 떠나지 않습니다. 처음 체크는 `stdout`, `compile`, `call`, `exit`이고, `call`은 YAML 사례 표에서 하네스를 생성합니다. 소스 구조 검사는 나중에 정합니다.
- **문제 유형은 `predict_output`·`implement_function` → `fix_bug`·`fill_blank` → `parsons`·`find_bug_line` 순서로 만듭니다.** `implement_function`의 `entry`는 JS D-028처럼 선택입니다. 템플릿은 그 뒤입니다.
- **에디터는 core `CodeEditor`(CodeMirror 6)에 `@codemirror/lang-go`를 붙이고, "gofmt로 정리" 버튼과 컴파일 오류 줄 표시를 둡니다.**
- **레슨의 `RunnableExample`·`TryIt`을 Go용으로 되살리고, `content:check --run`이 실제 Go로 실행해 기대 출력을 계산합니다.** CI는 `actions/setup-go`로 Go를 설치합니다.
- 진행: ① 이 결정과 설계 문서 ② `packages/go-runner` ③ 서버 실행 API ④ 웹 에디터와 실행 화면 ⑤ `content:check --run`과 CI ⑥ 문제 유형.
- 상세: [Go 코드 실행과 채점 설계](/docs/design/go-code-execution.md).

## G-003. Go 코드 문제의 채점 세부 — `확정`
- 2026-11-25, 사용자 결정(G-002의 ⑥ 문제 유형, 추천안 승인).
- **채점 흐름**: 코드를 실행해야 하는 유형은 core 문제 유형 틀의 "실행 계획 → 실행 → 채점"을 그대로 쓰고, 실행을 서버의 Go 실행기가 합니다. core는 바꾸지 않습니다. 출력 예측은 빌드 때 실행한 결과가 정답이라 채점에 실행이 필요 없습니다.
- **`predict_output`**: 답 형식은 `output`(출력 전체를 적음, 줄 끝 공백과 끝 빈 줄 무시)과 `choice`(보기 고르기)입니다. 보기는 출력 텍스트이거나 "컴파일 오류"·"panic" 결과(`outcome`)이고, 정답 보기는 실행 결과로 정합니다. 값 예측(`value`)은 Go 값 표시 형식을 정한 뒤로 미룹니다.
- **기대값 저장**: JavaScript와 같이 `content:check:run`이 실행해서 `content/.generated/predict-expected.json`에 입력 해시와 함께 기록하고, `check`·`build`가 채웁니다. 저자는 정답을 쓰지 않습니다. 프로그램은 서로 다른 난수 시드로 두 번 실행해 결과가 같아야 합니다(맵 순회 순서 등). CI는 `--frozen`으로 기록이 최신인지 확인해, Go 버전이 바뀌어 출력이 달라지면 잡아냅니다.
- **`implement_function`의 `call` 체크**: 사례마다 인수와 기대값을 Go 식 문자열로 적습니다(`args: ['3', '4']`, `want: ['7']`, 반환값이 여럿이면 여러 개). 하네스는 `got := F(...)` 뒤에 `want := got; want = <식>`으로 기대값을 반환 타입에 맞추고 `reflect.DeepEqual`로 비교합니다. 실패하면 `%#v`로 받은 값과 기대값을 보여 주고, `hidden` 사례는 입력을 숨깁니다. 실수 허용 오차는 필요할 때 더합니다.
- **문제 화면**: 함수 작성 문제(`entry` 있음)는 "제출(채점)"만, 프로그램 작성 문제는 "실행"도 둡니다. 에디터와 gofmt, 체크별 결과 목록(JS D-097: 언어 저장소)을 두고, 설정 > 화면의 "작업대 테마"를 다시 보여 줍니다.
- **콘텐츠 검증**: `content:check:run`이 코드 문제의 모범 답안은 모든 체크를 통과하고, 시작 코드는 적어도 하나를 통과하지 못하는지 확인합니다.
- 순서: ⑥-1 `predict_output` ⑥-2 `implement_function` 그다음 실제 `go-basics`에 실행 예제와 코드 문제를 더하고 AI 교차 검토.
