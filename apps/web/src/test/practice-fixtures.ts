import type {
  AttemptResponse,
  ExerciseView,
  LessonDetail,
  PracticeItemView,
  PracticeSetView,
} from '@proginone/shared';

// Fake API data for the practice flow tests (shapes follow @proginone/shared practice.ts).

export const LESSON_ID = 'go-basics.start.first-program';
export const SET_ID = '01JD3Z8Q6V2K9M4T7R1X5W0BNC';
export const MCQ = `${LESSON_ID}.mcq-log`;
export const TF = `${LESSON_ID}.tf-println-needs-import`;

export const lesson: LessonDetail = {
  id: LESSON_ID,
  title: '첫 프로그램',
  summary: 's',
  kind: 'lesson',
  importance: 'core',
  course: { id: 'go-basics', title: 'Go 기초', language: 'go' },
  module: { id: 'go-basics.start', title: '시작하기' },
  objectives: ['출력할 수 있다'],
  estimatedMinutes: 27,
  readMinutes: 12,
  sections: [{ id: 'intro', kind: 'intro', title: null }],
  body: [
    {
      type: 'component',
      name: 'Section',
      props: { kind: 'intro', id: 'intro' },
      children: [{ type: 'paragraph', children: [{ type: 'text', value: '본문' }] }],
    },
  ],
  concepts: [],
  previous: null,
  next: { id: 'go-basics.start.reading-errors', title: '오류 읽기' },
  contentHash: 'h',
};

const concept = { id: 'go.basics.println', title: 'fmt.Println으로 출력하기' };

export function item(
  position: number,
  exerciseId: string,
  type: string,
  over: Partial<PracticeItemView> = {},
): PracticeItemView {
  return {
    id: `01JD3Z8Q6V2K9M4T7R1X5W0AT${position}`,
    position,
    exerciseId,
    type,
    difficulty: 2,
    status: 'pending',
    reason: 'lesson_practice',
    targetConcept: concept,
    attempts: 0,
    lastOutcome: null,
    ...over,
  };
}

export function practiceSet(over: Partial<PracticeSetView> = {}): PracticeSetView {
  const items = over.items ?? [item(0, MCQ, 'mcq_single'), item(1, TF, 'true_false')];
  return {
    id: SET_ID,
    kind: 'lesson',
    status: 'active',
    lessonId: LESSON_ID,
    items,
    progress: { total: items.length, answered: 0, skipped: 0, pending: items.length },
    nextItemId: items[0]?.id ?? null,
    passRule: { minCorrect: 0.7, minConceptCredit: 0.6, minDistinctTypes: 2, minLevel3Correct: 0 },
    result: null,
    createdAt: 1,
    completedAt: null,
    ...over,
  };
}

const base = {
  category: 'recognition' as const,
  difficulty: 2,
  lessonId: LESSON_ID,
  code: null,
  codeLanguage: null,
  estimatedSeconds: 40,
  hintCount: 3,
  openedHints: [],
  solutionViewed: false,
  writing: false,
};

export const mcqView: ExerciseView = {
  ...base,
  id: MCQ,
  type: 'mcq_single',
  prompt: '`fmt.Println("완료")`는 무엇을 하나요?',
  publicSpec: {
    codeOptions: false,
    options: [
      { id: 'a', text: '화면에 글자를 출력한다' },
      { id: 'b', text: '값을 저장한다' },
    ],
  },
  requiresRun: false,
};

export const tfView: ExerciseView = {
  ...base,
  id: TF,
  type: 'true_false',
  prompt: '다음 설명이 맞는지 판단하세요.',
  publicSpec: { statement: '`import "fmt"`가 없어도 `fmt.Println`을 쓸 수 있다.' },
  requiresRun: false,
};

export const HINTS = ['첫 번째 힌트', '두 번째 힌트', '세 번째 힌트'];

export function attemptResponse(
  set: PracticeSetView,
  itemId: string,
  outcome: 'correct' | 'incorrect',
  over: { attempts?: number; completed?: boolean } = {},
): AttemptResponse {
  const items = set.items.map((i) => (i.id === itemId ? { ...i, status: 'answered' as const } : i));
  const answered = items.filter((i) => i.status === 'answered').length;
  // The server keeps a set open after a wrong answer to its last pending item (another try).
  const completed = over.completed ?? (answered === items.length && outcome === 'correct');
  return {
    attempt: {
      id: '01JD3Z8Q6V2K9M4T7R1X5W0ATT',
      outcome,
      score: outcome === 'correct' ? 1 : 0,
      correct: outcome === 'correct',
      engineApplied: true,
      attemptNo: over.attempts ?? 1,
      attemptInItem: over.attempts ?? 1,
    },
    grade: {
      feedback: [],
      misconceptions:
        outcome === 'correct'
          ? []
          : [{ id: 'go.mc.println-returns', title: '출력을 반환으로 착각함' }],
      explanation: '정답은 **화면에 출력한다**예요.',
    },
    masteryChanges: [
      {
        conceptId: concept.id,
        title: concept.title,
        scoreBefore: 0,
        scoreAfter: 20,
        stageBefore: 'not_started',
        stageAfter: 'introduced',
      },
    ],
    misconceptionChanges: [],
    remediation: null,
    adaptations: [],
    item: { id: itemId, status: 'answered', attempts: over.attempts ?? 1 },
    set: {
      id: set.id,
      status: completed ? 'completed' : 'active',
      progress: {
        total: items.length,
        answered,
        skipped: 0,
        pending: items.length - answered,
      },
      nextItemId: completed ? null : (items.find((i) => i.status === 'pending')?.id ?? null),
      result: completed
        ? {
            total: items.length,
            answered,
            skipped: 0,
            correct: answered,
            pass: {
              passed: true,
              checks: {
                allAnswered: true,
                minCorrect: { met: true, required: 0.7, actual: 1 },
                minConceptCredit: { met: true, required: 0.6, actual: 1, below: [], concepts: [] },
                minDistinctTypes: { met: true, required: 2, actual: 2 },
                minLevel3Correct: { met: true, required: 0, actual: 0 },
              },
            },
          }
        : null,
    },
  };
}
