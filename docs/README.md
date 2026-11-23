# ProgInOne Go 문서 지도

ProgInOne Go 저장소의 모든 문서 목록과 읽는 순서입니다.
문서를 추가하거나 삭제하면 이 목록도 함께 갱신합니다.

제품 요구사항(PRD)과 학습 엔진, 콘텐츠 시스템, AI 시스템 등 공통 설계는 [JavaScript 저장소의 문서](https://github.com/ProgInOne/javascript/blob/develop/docs/README.md)가 원천입니다. 이 저장소에는 Go에만 해당하는 결정과 설계를 적습니다.

## 처음 읽는 순서

1.  [결정 기록](/docs/decisions.md): Go 저장소의 결정과 출발점이 된 공통 결정
1.  [기여 가이드](/CONTRIBUTING.md): 브랜치, 커밋, 리뷰, 완료 정의

## 공통 문서

| 문서 | 설명 |
|---|---|
| [용어집](/docs/glossary.md) | Go 저장소에만 있는 용어 |
| [결정 기록](/docs/decisions.md) | 합의된 결정과 근거 (추가 전용, `G-nnn`) |
| [문서 작성 규칙](/docs/documentation-style.md) | Google 문서화 가이드 기반 작성 규칙 |
| [기여 가이드](/CONTRIBUTING.md) | 브랜치, 커밋, 리뷰, 완료 정의 |
| [변경 이력](/CHANGELOG.md) | 릴리스별 변경 사항 |

## 예정 문서

해당 작업을 시작할 때 작성합니다. 아직 내용이 없으므로 파일을 만들지 않습니다.

| 문서 | 작성 시점 |
|---|---|
| 콘텐츠 작성 가이드 | content-cli와 예시 과정을 추가할 때 |
| 시작하기, 테스트 가이드 | 서버·웹 뼈대를 추가할 때 |
| Go 콘텐츠·문제 유형, 코드 실행 샌드박스, 에디터 설계 | Go 전용 설계 단계 |
| 패키지별 `README.md` | 각 패키지 생성 시 |
