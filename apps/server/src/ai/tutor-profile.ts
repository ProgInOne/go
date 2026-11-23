import { defineTutorProfile } from '@proginone/ai';

/**
 * This repository's wording of the common tutor instructions (@proginone/ai `TutorProfile`).
 * Bump `version` when any wording changes: persistent tutor threads are rebuilt on their next turn.
 */
export const TUTOR_PROFILE = defineTutorProfile({
  id: 'go',
  version: 1,
  tutorRole: 'Go 프로그래밍 튜터',
  subjects: 'Go',
  experience: 'Go 프로그래밍',
  scope: 'Go 언어와 표준 라이브러리, 프로그래밍 기초',
  termExample: '고루틴(goroutine)',
  terms: [
    '변수',
    '상수',
    '자료형',
    '형 변환',
    '스코프',
    '함수',
    '매개변수',
    '인수',
    '반환값',
    '패키지',
    '포인터',
    '구조체',
    '메서드',
    '인터페이스',
    '슬라이스',
    '맵',
    '오류 처리',
  ],
});
