# ProgInOne Go 기여 가이드

ProgInOne Go 저장소에서 작업할 때의 브랜치, 커밋, 리뷰, 완료 기준을 정의합니다.
사람과 AI 에이전트 모두 이 가이드를 따릅니다.

## 작업 흐름

1.  작업은 [결정 기록](/docs/decisions.md)에서 합의한 단계와 작업 항목에서 시작합니다.
1.  `develop`에서 작업 브랜치를 만듭니다.
1.  설계에 영향을 주는 변경이면 먼저 관련 설계 문서를 수정하거나, 새 결정을 [결정 기록](/docs/decisions.md)에 추가합니다.
1.  코드, 테스트, 문서를 같은 PR에서 함께 변경합니다.
1.  CI가 통과하고 리뷰 체크리스트를 만족하면 `develop`에 병합합니다(squash merge).
1.  릴리스할 때 `develop`을 `main`으로 병합합니다(merge commit).

### develop과 main

두 브랜치로 운영합니다([JS D-090](https://github.com/ProgInOne/javascript/blob/develop/docs/decisions.md), [G-001](/docs/decisions.md#g-001-go-앱의-형태와-저장소-운영--확정)).

| 브랜치 | 역할 | 들어오는 PR | 병합 방식 |
|---|---|---|---|
| `develop` | 기본 브랜치. 다음 릴리스에 들어갈 변경을 모음 | 작업 브랜치 | 스쿼시만, 선형 기록 |
| `main` | 릴리스된 상태. 릴리스 태그는 여기에 붙음 | `develop`만 | merge commit만 |

- `main`으로 가는 PR은 `develop`에서만 엽니다. CI가 다른 브랜치에서 온 PR을 실패시킵니다.
- 핫픽스도 `develop`에 병합한 뒤 다시 릴리스합니다. `main`에 직접 고치면 `main` → `develop` 역병합이 필요해지기 때문입니다.
- `develop` → `main`을 스쿼시하지 않습니다. 두 브랜치의 기록이 갈라져 다음 릴리스에서 충돌합니다.

### 협업 원칙 (사람 ↔ AI 에이전트)

- 중요한 제품·아키텍처 결정은 사용자와 합의한 뒤 결정 기록에 반영합니다.
- 사소한 사항은 합리적인 기본값으로 진행하고, PR 설명에 선택 근거를 남깁니다.
- 사용자가 명시적으로 승인하기 전에는 새 단계의 구현을 시작하지 않습니다.
- 설계 선택이 있으면 코드를 쓰기 전에 선택지와 추천안을 보여 주고 승인을 받습니다.

## 브랜치 규칙

| 접두사 | 용도 | 예시 |
|---|---|---|
| `feat/` | 기능 | `feat/practice-set-builder` |
| `fix/` | 버그 수정 | `fix/lesson-route-404` |
| `content/` | 콘텐츠 추가·수정 | `content/go-basics-exercises` |
| `docs/` | 문서만 변경 | `docs/ai-system-review` |
| `chore/` | 빌드, 의존성, 설정 | `chore/update-deps` |
| `refactor/` | 동작 변경 없는 구조 개선 | `refactor/attempt-service` |

## 커밋 메시지

[Conventional Commits][conventional-commits] 형식을 따릅니다.

```text
<type>(<scope>): <요약, 한국어 또는 영어, 명령형, 72자 이내>

<본문: 무엇을, 왜. 어떻게는 코드가 설명합니다>

<꼬리말: Refs, BREAKING CHANGE 등>
```

- `type`: `feat`, `fix`, `content`, `docs`, `test`, `refactor`, `perf`, `chore`, `ci`, `build`
- `scope`: 패키지나 영역 이름. 예: `web`, `server`, `content`, `content-cli`, `ci`
- 호환성을 깨는 변경은 꼬리말에 `BREAKING CHANGE:`를 씁니다.

[conventional-commits]: https://www.conventionalcommits.org/ko/v1.0.0/

## PR 규칙

PR 설명에는 다음을 포함합니다.

- 무엇을, 왜 바꿨는지
- 관련 결정 또는 작업 항목 (예: `G-001`)
- 테스트 방법과 결과
- UI 변경이면 변경 전후 스크린샷 (라이트/다크)
- 설계 문서·결정 기록 변경 여부

PR 하나는 리뷰 가능한 크기(변경 400줄 안팎, 콘텐츠 제외)를 목표로 합니다.

## 리뷰 체크리스트

- [ ] 요구사항과 설계 문서에 맞게 동작하는가
- [ ] 새 동작에 테스트가 있는가. 버그 수정에는 재현 테스트가 있는가
- [ ] 신뢰할 수 없는 입력(학습자 코드, AI 출력, HTTP 요청)을 경계에서 검증하는가
- [ ] 오류 상황이 정해진 오류 코드와 UI로 처리되는가
- [ ] DB 스키마 변경에 마이그레이션이 있고, 마이그레이션 테스트가 있는가
- [ ] UI 변경이 디자인 토큰을 쓰고, 빈/로딩/오류 상태와 키보드 조작, 다크 모드를 갖췄는가
- [ ] 관련 문서(README, 설계 문서, 가이드, 용어집)를 함께 갱신했는가
- [ ] `CHANGELOG.md`의 `Unreleased` 섹션에 사용자에게 보이는 변경을 기록했는가

## 완료 정의 (Definition of Done)

작업 항목은 다음을 모두 만족해야 완료입니다.

1.  코드가 `develop`에 병합되었고 필수 CI 검사가 모두 통과한다.
1.  요구사항의 완료 기준을 만족한다.
1.  UI 작업이면 실제 브라우저에서 라이트/다크, 1280/1440 뷰포트로 확인했고, 시각 회귀 기준 이미지를 갱신했다.
1.  문서가 현재 동작과 일치한다.

"렌더링이 된다"는 완료 기준이 아닙니다. 실제 학습 흐름에서 쓰기 편한지 확인합니다.

## 코드 규칙

- TypeScript `strict`. `any` 금지(불가피하면 `unknown` + 검증). 비null 단언(`!`) 최소화.
- 외부 입력은 zod로 검증합니다. AI가 만든 콘텐츠와 학습자 코드는 모두 신뢰할 수 없는 입력입니다.
- 비즈니스 로직은 순수 함수로 작성하고 I/O는 경계(서비스 계층, 훅)에 둡니다.
- 주석은 "왜"를 씁니다. 공개 함수에는 계약(인자, 반환, 오류)을 TSDoc으로 씁니다.
- 포맷은 Prettier, 린트는 ESLint 설정을 따르며 수동으로 바꾸지 않습니다.

## 문서 규칙

[문서 작성 규칙](/docs/documentation-style.md)을 따릅니다.
