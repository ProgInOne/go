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
