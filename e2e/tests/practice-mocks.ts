import type { Page } from '@playwright/test';

/**
 * Fixed practice API responses for the visual and accessibility checks of the practice screen.
 * The engine orders items differently per set, so screenshots of the real flow would not be
 * stable; the screens themselves are still the production build talking to these responses.
 */

export const PRACTICE_URL =
  '/learn/go-basics.start.first-program?mode=practice&set=01JD3Z8Q6V2K9M4T7R1X5W0BNC';

export const MCQ = 'go-basics.start.first-program.mcq-println-role';
export const MULTI = 'go-basics.start.first-program.multi-println-facts';
const item = (position: number, exerciseId: string, type: string, difficulty: number) => ({
  id: `01JD3Z8Q6V2K9M4T7R1X5W0AT${position}`,
  position,
  exerciseId,
  type,
  difficulty,
  status: 'pending',
  reason: 'lesson_practice',
  targetConcept: { id: 'go.basics.println', title: 'fmt.Println으로 출력하기' },
  attempts: 0,
  lastOutcome: null,
});

const items = [item(0, MCQ, 'mcq_single', 1), item(1, MULTI, 'mcq_multi', 2)];
const set = {
  id: '01JD3Z8Q6V2K9M4T7R1X5W0BNC',
  kind: 'lesson',
  status: 'active',
  lessonId: 'go-basics.start.first-program',
  items,
  progress: { total: 2, answered: 0, skipped: 0, pending: 2 },
  nextItemId: items[0]?.id,
  passRule: { minCorrect: 0.7, minConceptCredit: 0.6, minDistinctTypes: 2, minLevel3Correct: 1 },
  result: null,
  createdAt: 1,
  completedAt: null,
};

const common = {
  lessonId: 'go-basics.start.first-program',
  code: null,
  codeLanguage: null,
  hintCount: 3,
  openedHints: [{ level: 1, text: '`Println`은 "한 줄 출력(print line)"이라는 뜻이에요.' }],
  solutionViewed: false,
  writing: false,
};

export const views: Record<string, Record<string, unknown>> = {
  [MCQ]: {
    ...common,
    id: MCQ,
    type: 'mcq_single',
    category: 'recognition',
    difficulty: 1,
    prompt: '`fmt.Println("완료")`를 실행하면 어떤 일이 일어나나요?',
    publicSpec: {
      codeOptions: false,
      options: [
        { id: 'a', text: '화면에 `완료`라는 글자가 보인다' },
        { id: 'b', text: '`완료`라는 값이 저장되어 다음 줄에서 다시 쓸 수 있다' },
        { id: 'c', text: '프로그램이 끝난다' },
      ],
    },
    estimatedSeconds: 40,
    requiresRun: false,
  },
  [MULTI]: {
    ...common,
    openedHints: [],
    id: MULTI,
    type: 'mcq_multi',
    category: 'recognition',
    difficulty: 2,
    prompt: '`fmt.Println`에 대한 설명으로 맞는 것을 모두 고르세요.',
    publicSpec: {
      codeOptions: false,
      minSelect: 1,
      options: [
        { id: 'a', text: '괄호 안의 값을 화면에 보여 준다' },
        { id: 'b', text: '한 번 호출하면 출력에 한 줄이 생긴다' },
        { id: 'c', text: '출력한 값을 저장해 두었다가 다음 줄에서 돌려준다' },
      ],
    },
    estimatedSeconds: 50,
    requiresRun: false,
  },
};

const wrongAttempt = {
  attempt: {
    id: '01JD3Z8Q6V2K9M4T7R1X5W0ATT',
    outcome: 'incorrect',
    score: 0,
    correct: false,
    engineApplied: true,
    attemptNo: 1,
    attemptInItem: 1,
  },
  grade: {
    feedback: [],
    misconceptions: [{ id: 'go.mc.println-is-return', title: '출력을 반환으로 착각함' }],
    explanation: '정답은 **화면에 `완료`라는 글자가 보인다**예요.',
  },
  masteryChanges: [
    {
      conceptId: 'go.basics.println',
      title: 'fmt.Println으로 출력하기',
      scoreBefore: 0,
      scoreAfter: 4,
      stageBefore: 'not_started',
      stageAfter: 'introduced',
    },
  ],
  misconceptionChanges: [],
  remediation: null,
  adaptations: [],
  item: { id: items[0]?.id, status: 'answered', attempts: 1 },
  set: {
    id: set.id,
    status: 'active',
    progress: { total: 2, answered: 1, skipped: 0, pending: 1 },
    nextItemId: items[1]?.id,
    result: null,
  },
};

export async function mockPractice(page: Page) {
  await page.route('**/api/v1/practice-sets**', (route) => route.fulfill({ json: set }));
  await page.route('**/api/v1/exercises/**', (route) => {
    const url = new URL(route.request().url());
    const id = decodeURIComponent(url.pathname.split('/')[4] ?? '');
    return route.fulfill({ json: views[id] ?? {} });
  });
  await page.route('**/api/v1/attempts', (route) =>
    route.fulfill({ status: 201, json: wrongAttempt }),
  );
}

const THREAD_ID = '01JD3Z8Q6V2K9M4T7R1X5W0TH1';
const thread = {
  id: THREAD_ID,
  scopeType: 'exercise',
  scopeId: MULTI,
  title: '출력과 저장은 어떻게 달라요?',
  status: 'open',
  messageCount: 2,
  createdAt: 1,
  lastMessageAt: 1,
};
const message = (id: string, role: string, content: string) => ({
  id,
  threadId: THREAD_ID,
  role,
  content,
  status: 'complete',
  taskName: role === 'tutor' ? 'tutor.reply' : null,
  taskVersion: role === 'tutor' ? 1 : null,
  meta: null,
  createdAt: 1,
});

/** A fixed tutor conversation for the drawer's visual and accessibility checks. */
export async function mockTutor(page: Page) {
  await page.route('**/api/v1/tutor/threads', (route) => route.fulfill({ json: thread }));
  await page.route(`**/api/v1/tutor/threads/${THREAD_ID}/messages`, (route) =>
    route.fulfill({
      json: {
        thread,
        messages: [
          message(
            '01JD3Z8Q6V2K9M4T7R1X5W0ML1',
            'learner',
            'fmt.Println으로 출력한 값을 다음 줄에서 다시 쓸 수 있나요?',
          ),
          message(
            '01JD3Z8Q6V2K9M4T7R1X5W0MT1',
            'tutor',
            [
              '좋은 질문이에요. `fmt.Println`은 값을 **화면에 보여 주기만** 해요.',
              '',
              '- 출력: 사람이 볼 수 있게 화면에 보여 줌',
              '- 저장: 이름을 붙여 다시 쓸 수 있게 담아 둠',
              '',
              '```go',
              'total := 1 + 1',
              'fmt.Println(total) // 2',
              '```',
              '',
              '둘째 줄에서 어느 부분이 값을 담아 두는지 확인해 볼래요?',
            ].join('\n'),
          ),
        ],
      },
    }),
  );
}

// 재학습 유도: the wrong answer is the second in a row on the concept, so the engine suggests a
// short prerequisite check and appends its item to the set (JS D-033).
const remedialItem = {
  ...item(2, MCQ, 'mcq_single', 1),
  reason: 'remedial_prereq',
  targetConcept: { id: 'go.basics.statement', title: '문장과 실행 순서' },
};
const remediationAttempt = {
  ...wrongAttempt,
  misconceptionChanges: [
    {
      misconceptionId: 'go.mc.println-is-return',
      title: '출력을 반환으로 착각함',
      conceptId: 'go.basics.println',
      statusBefore: 'suspected',
      statusAfter: 'confirmed',
      transitions: ['confirmed'],
      resolution: { done: 0, required: 2 },
    },
  ],
  remediation: {
    id: 'r1',
    concept: { id: 'go.basics.println', title: 'fmt.Println으로 출력하기' },
    trigger: 'set_consecutive_failures',
    kind: 'prerequisite_check',
    prerequisite: {
      conceptId: 'go.basics.statement',
      title: '문장과 실행 순서',
      stage: 'introduced',
      effective: 32,
    },
    check: { items: 2, minDifficulty: 1, maxDifficulty: 2, passCorrect: 2 },
    workedExampleStages: [],
    targetDifficulty: null,
    autoHintLevel: 0,
    tutorBadge: false,
    lesson: { id: 'go-basics.start.first-program', title: '첫 프로그램' },
    prerequisitesChecked: [
      {
        conceptId: 'go.basics.statement',
        title: '문장과 실행 순서',
        stage: 'introduced',
        effective: 32,
        depth: 1,
        weak: true,
      },
    ],
    itemIds: [remedialItem.id],
  },
  adaptations: [
    {
      kind: 'append',
      itemId: remedialItem.id,
      position: 2,
      exerciseId: MCQ,
      reason: 'remedial_prereq',
      targetConcept: remedialItem.targetConcept,
    },
  ],
  set: { ...wrongAttempt.set, progress: { total: 3, answered: 1, skipped: 0, pending: 2 } },
};

/** `mockPractice` whose wrong answer brings a relearning suggestion (call after it). */
export async function mockRemediation(page: Page) {
  let answered = false;
  await page.route('**/api/v1/practice-sets**', (route) =>
    route.fulfill({
      json: answered
        ? {
            ...set,
            items: [
              { ...items[0], status: 'answered', attempts: 1, lastOutcome: 'incorrect' },
              items[1],
              remedialItem,
            ],
            progress: { total: 3, answered: 1, skipped: 0, pending: 2 },
          }
        : set,
    }),
  );
  await page.route('**/api/v1/attempts', (route) => {
    answered = true;
    return route.fulfill({ status: 201, json: remediationAttempt });
  });
}
