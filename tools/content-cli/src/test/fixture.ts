import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { stringify } from 'yaml';
import { SECTION_KINDS } from '../mdx.ts';

export const LESSON = 'go-basics.start.first-program';
export const EXERCISE = `${LESSON}.mcq-what-is-println`;
/** The lesson's own "이해도 확인" item (`usage: check`, JS D-091). */
export const CHECK = `${LESSON}.check-log-prints`;
/** The fixture lesson's own body block (JS D-091): a check item. */
export const FIXTURE_BLOCKS = {
  check: `<InlineExercise ref="${CHECK}" />`,
};

export function lessonMdx(extra: Partial<Record<string, string>> = {}): string {
  return SECTION_KINDS.map((k) => `<Section kind="${k}">\n${extra[k] ?? `${k}.`}\n</Section>`).join(
    '\n\n',
  );
}

/** A minimal valid content tree; `patch` edits the file map before writing. */
export function writeContent(
  patch: (files: Record<string, unknown>) => void = () => undefined,
): string {
  const files: Record<string, unknown> = {
    'pack.yaml': {
      id: 'test-pack',
      version: '2026.11.14.1',
      schemaVersion: 1,
      title: '테스트',
      tracks: [{ id: 'go', title: 'Go', summary: 'Go 기초', courses: ['go-basics'] }],
    },
    'concepts/go.yaml': [
      { id: 'go.basics.package-main', title: '문장', importance: 'minor', summary: '실행 단위' },
      {
        id: 'go.basics.println',
        title: 'fmt.Println',
        importance: 'core',
        summary: '콘솔에 출력',
        prerequisites: ['go.basics.package-main'],
        misconceptions: ['go.mc.println-returns'],
      },
    ],
    'misconceptions/go.yaml': [
      {
        id: 'go.mc.println-returns',
        concept: 'go.basics.println',
        title: '출력을 반환으로 착각',
        statement: '출력하면 반환된다고 생각한다.',
        reality: '출력만 한다.',
        remediation: { exercises: [EXERCISE] },
      },
    ],
    'courses/go-basics/course.yaml': {
      id: 'go-basics',
      title: 'Go 기초',
      summary: 'Go 기초',
      language: 'go',
      level: 'basic',
      objectives: ['프로그램을 쓴다'],
      modules: ['start'],
    },
    'courses/go-basics/modules/01-start/module.yaml': {
      id: 'go-basics.start',
      title: '시작하기',
      summary: '첫 프로그램',
      lessons: ['first-program'],
    },
    'courses/go-basics/modules/01-start/lessons/01-first-program/lesson.yaml': {
      id: LESSON,
      title: '첫 프로그램',
      summary: '콘솔에 출력합니다',
      importance: 'core',
      estimatedMinutes: { read: 10, practice: 15 },
      concepts: { primary: ['go.basics.package-main', 'go.basics.println'] },
      objectives: ['fmt.Println으로 출력할 수 있다'],
      practice: { targetCount: 1 },
    },
    'courses/go-basics/modules/01-start/lessons/01-first-program/lesson.mdx': lessonMdx({
      pitfalls:
        '<Pitfall misconception="go.mc.println-returns">\n<Wrong>a</Wrong>\n<Actual>b</Actual>\n<Right>c</Right>\n</Pitfall>',
      ...FIXTURE_BLOCKS,
    }),
    'courses/go-basics/modules/01-start/lessons/01-first-program/exercises/001-mcq.yaml': {
      id: EXERCISE,
      type: 'mcq_single',
      difficulty: 1,
      concepts: [{ id: 'go.basics.println', weight: 1 }],
      estimatedSeconds: 40,
      prompt: '`fmt.Println`는 무엇을 하나요?',
      spec: { options: [] },
      hints: ['a', 'b', 'c'],
      explanation: '출력합니다.',
      review: { status: 'approved', draftedBy: 'ai:claude', reviewedBy: 'ai:reviewer' },
    },
    'courses/go-basics/modules/01-start/lessons/01-first-program/exercises/check-01-log.yaml': {
      id: CHECK,
      type: 'true_false',
      usage: 'check',
      difficulty: 1,
      concepts: [{ id: 'go.basics.println', weight: 1 }],
      estimatedSeconds: 30,
      prompt: '`fmt.Println`는 값을 콘솔에 출력해요.',
      spec: { statement: '`fmt.Println`는 값을 콘솔에 출력해요.', answer: true },
      hints: ['a', 'b', 'c'],
      explanation: '맞아요.',
      review: { status: 'approved', draftedBy: 'ai:claude', reviewedBy: 'ai:reviewer' },
    },
  };
  patch(files);
  const root = mkdtempSync(join(tmpdir(), 'proginone-content-'));
  for (const [path, value] of Object.entries(files)) {
    if (value === undefined) continue;
    const full = join(root, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, typeof value === 'string' ? value : stringify(value));
  }
  return root;
}

export const LESSON_YAML =
  'courses/go-basics/modules/01-start/lessons/01-first-program/lesson.yaml';
export const LESSON_MDX = 'courses/go-basics/modules/01-start/lessons/01-first-program/lesson.mdx';
export const EXERCISE_YAML =
  'courses/go-basics/modules/01-start/lessons/01-first-program/exercises/001-mcq.yaml';
export const CHECK_YAML =
  'courses/go-basics/modules/01-start/lessons/01-first-program/exercises/check-01-log.yaml';

export const REVIEW = 'go-basics.start.start-review';
export const REVIEW_YAML = 'courses/go-basics/modules/01-start/lessons/02-start-review/lesson.yaml';
export const REVIEW_EXERCISE_YAML =
  'courses/go-basics/modules/01-start/lessons/02-start-review/exercises/001-mcq.yaml';
export const MODULE_YAML = 'courses/go-basics/modules/01-start/module.yaml';

/** Adds a declared unit assessment (`kind: assessment`) with one item to the fixture module. */
export function withAssessment(files: Record<string, unknown>): void {
  const mod = files[MODULE_YAML] as Record<string, unknown>;
  mod['lessons'] = ['first-program', 'start-review'];
  mod['assessment'] = 'start-review';
  files[REVIEW_YAML] = {
    id: REVIEW,
    title: '시작하기 단원 평가',
    summary: '모듈 1을 확인합니다',
    kind: 'assessment',
    estimatedMinutes: { read: 1, practice: 10 },
    concepts: { reviewed: ['go.basics.println'] },
    objectives: ['출력을 설명할 수 있다'],
    assessment: { passRatio: 0.7 },
  };
  files['courses/go-basics/modules/01-start/lessons/02-start-review/lesson.mdx'] = [
    'objectives',
    'practice',
    'summary',
    'next',
  ]
    .map((k) => `<Section kind="${k}">\n${k}.\n</Section>`)
    .join('\n\n');
  files[REVIEW_EXERCISE_YAML] = {
    id: `${REVIEW}.mcq-log`,
    type: 'mcq_single',
    difficulty: 3,
    concepts: [{ id: 'go.basics.println', weight: 1 }],
    estimatedSeconds: 40,
    usage: 'assessment',
    prompt: '`fmt.Println("a")`는 무엇을 하나요?',
    spec: { options: [] },
    hints: ['a', 'b', 'c'],
    explanation: '출력합니다.',
    review: { status: 'approved', draftedBy: 'ai:claude', reviewedBy: 'ai:reviewer' },
  };
}

export const PROJECT_YAML =
  'courses/go-basics/modules/01-start/lessons/02-mini-project/lesson.yaml';

/** Adds a `kind: project` unit to the fixture module (not supported yet: needs Go execution). */
export function withProject(files: Record<string, unknown>): void {
  const mod = files[MODULE_YAML] as Record<string, unknown>;
  mod['lessons'] = ['first-program', 'mini-project'];
  files[PROJECT_YAML] = {
    id: 'go-basics.start.mini-project',
    title: '미니 프로젝트',
    summary: '배운 내용으로 프로그램을 만듭니다',
    kind: 'project',
    estimatedMinutes: { read: 3, practice: 40 },
    concepts: { practiced: ['go.basics.println'] },
    objectives: ['출력을 조합할 수 있다'],
  };
  files['courses/go-basics/modules/01-start/lessons/02-mini-project/lesson.mdx'] = [
    'objectives',
    'practice',
    'summary',
    'next',
  ]
    .map((k) => `<Section kind="${k}">\n${k}.\n</Section>`)
    .join('\n\n');
}
