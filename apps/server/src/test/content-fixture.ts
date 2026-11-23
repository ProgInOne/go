import { join } from 'node:path';
import { CONTENT_DB_SCHEMA_VERSION, CONTENT_DDL } from '@proginone/content-schema/db';
import { leakFingerprints, redactSpec } from '@proginone/exercise-kit';
import Database from 'better-sqlite3';
import { tmpDir } from './helpers.ts';

const body = [
  {
    type: 'component',
    name: 'Section',
    props: { kind: 'objectives', id: 'objectives' },
    children: [],
  },
  {
    type: 'paragraph',
    children: [
      { type: 'text', value: '문장은 ' },
      {
        type: 'component',
        name: 'ConceptLink',
        props: { to: 'go.basics.comment' },
        children: [{ type: 'text', value: '주석' }],
      },
    ],
  },
];

/** A tiny content.db (2 lessons, an assessment, 2 concepts, choice exercises) written with the real DDL. */
export function writeContentDb(meta: Record<string, string> = {}): string {
  const path = join(tmpDir('proginone-contentdb-'), 'content.db');
  const db = new Database(path);
  db.exec(CONTENT_DDL);
  const ins = (table: string, row: Record<string, unknown>) => {
    const cols = Object.keys(row);
    db.prepare(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => `@${c}`).join(',')})`,
    ).run(row);
  };
  for (const [key, value] of Object.entries({
    schema_version: String(CONTENT_DB_SCHEMA_VERSION),
    pack_version: '2026.11.14.1',
    ...meta,
  })) {
    ins('content_meta', { key, value });
  }
  ins('tracks', { id: 'go', title: 'Go', summary: 'Go 기초', order_index: 0 });
  ins('courses', {
    id: 'go-basics',
    track_id: 'go',
    title: 'Go 기초',
    summary: 'JS',
    language: 'go',
    level: 'basic',
    order_index: 0,
    estimated_minutes: 50,
    objectives_json: '["쓴다"]',
  });
  ins('courses', {
    id: 'secret',
    track_id: 'go',
    title: '숨김',
    summary: 's',
    language: 'go',
    level: 'intro',
    order_index: 1,
    estimated_minutes: 0,
    status: 'hidden',
    objectives_json: '[]',
  });
  ins('modules', {
    id: 'go-basics.start',
    course_id: 'go-basics',
    title: '시작하기',
    summary: 's',
    order_index: 0,
  });
  const lesson = (id: string, order: number) => ({
    id,
    module_id: 'go-basics.start',
    title: `단원 ${order}`,
    summary: '요약',
    order_index: order,
    estimated_minutes: 25,
    read_minutes: 10,
    objectives_json: '["목표"]',
    body_compiled: JSON.stringify(body),
    body_text: '문장은 주석',
    sections_json: JSON.stringify({
      v: 1,
      sections: [{ id: 'objectives', kind: 'objectives', title: null }],
    }),
    content_hash: 'h',
  });
  ins('lessons', lesson('go-basics.start.first-program', 0));
  ins('lessons', lesson('go-basics.start.reading-errors', 1));
  // The module's unit assessment (kind: assessment; learning-engine.md#단원-평가-세트).
  ins('lessons', {
    ...lesson(ASSESSMENT, 2),
    title: '시작하기 단원 평가',
    kind: 'assessment',
  });
  db.prepare('UPDATE modules SET assessment_id = ? WHERE id = ?').run(
    ASSESSMENT,
    'go-basics.start',
  );
  const concept = (id: string, lessonId: string) => ({
    id,
    course_id: 'go-basics',
    title: id,
    summary: 's',
    importance: 'core',
    introduced_in_lesson_id: lessonId,
  });
  ins('concepts', concept('go.basics.statement', 'go-basics.start.first-program'));
  ins('concepts', concept('go.basics.comment', 'go-basics.start.reading-errors'));
  ins('lesson_concepts', {
    lesson_id: 'go-basics.start.first-program',
    concept_id: 'go.basics.statement',
    role: 'introduces',
  });
  // Relearning looks at required prerequisites (learning-engine.md#재학습-규칙).
  ins('concept_prerequisites', {
    concept_id: 'go.basics.statement',
    prerequisite_id: 'go.basics.comment',
    strength: 'required',
  });
  ins('misconceptions', {
    id: 'go.mc.println-returns',
    concept_id: 'go.basics.statement',
    title: 'fmt.Println을 반환으로 생각함',
    description: '출력하면 값이 돌아온다고 생각합니다.',
    correction: 'fmt.Println은 값을 화면에 보여 줄 뿐 돌려주지 않습니다.',
    remedial_exercise_ids_json: '[]',
  });
  for (const role of ['go.basics.statement', 'go.basics.comment']) {
    ins('lesson_concepts', { lesson_id: ASSESSMENT, concept_id: role, role: 'reviews' });
  }
  ins('assessments', {
    id: ASSESSMENT,
    scope_type: 'module',
    scope_id: 'go-basics.start',
    title: '시작하기 단원 평가',
    exercise_ids_json: JSON.stringify(ASSESSMENT_EXERCISES.map((e) => e.id)),
    selection_rule_json: JSON.stringify({
      v: 1,
      itemCount: null,
      conceptIds: ['go.basics.statement', 'go.basics.comment'],
    }),
    pass_ratio: 0.8,
  });
  for (const ex of [
    ...FIXTURE_EXERCISES,
    ...LESSON_BLOCK_EXERCISES,
    ...REMEDIAL_EXERCISES,
    ...ASSESSMENT_EXERCISES,
  ]) {
    ins('exercises', {
      id: ex.id,
      type: ex.type,
      difficulty: ex.difficulty,
      lesson_id: ex.lessonId ?? 'go-basics.start.first-program',
      usage: ex.usage ?? 'practice',
      prompt: `${ex.type} 문제`,
      code: ex.code ?? null,
      spec_json: JSON.stringify(ex.spec),
      public_spec_json: JSON.stringify(redactSpec(ex.type, ex.spec)),
      leak_fingerprints_json: JSON.stringify(leakFingerprints(ex.type, ex.spec)),
      hints_json: JSON.stringify({ v: 1, levels: ['힌트 1', '힌트 2', '힌트 3'] }),
      explanation: `${ex.id} 해설`,
      estimated_seconds: 60,
      // Wrong options/patterns pointing to misconceptions (content-cli derives this from specs).
      misconception_ids_json: JSON.stringify(
        JSON.stringify(ex.spec).includes('go.mc.println-returns') ? ['go.mc.println-returns'] : [],
      ),
      review_status: 'trusted',
      content_hash: `hash-${ex.id}`,
      dedupe_signature: `sig-${ex.id}`,
    });
    for (const c of ex.concepts ?? [{ id: 'go.basics.statement', weight: 1 }]) {
      ins('exercise_concepts', {
        exercise_id: ex.id,
        concept_id: c.id,
        weight: c.weight,
        is_primary: c.weight === 1 ? 1 : 0,
      });
    }
  }
  db.close();
  return path;
}

// ── Exercises: one or more per implemented type, with real exercise-kit specs ──
// Answer keys carry markers (`*-MARK`, `QUIET!`) so tests can assert they never reach a response.

const P = 'go-basics.start.first-program';

export const EX = {
  mcq: `${P}.mcq-x`,
  mcqMulti: `${P}.mcq-multi-x`,
  trueFalse: `${P}.tf-x`,
  mcqOrder: `${P}.mcq-order`,
  mcqOutput: `${P}.mcq-output`,
  multiParts: `${P}.multi-parts`,
  tfImport: `${P}.tf-import`,
  mcqValues: `${P}.mcq-values`,
  multiErrors: `${P}.multi-errors`,
  mcqMain: `${P}.mcq-main`,
  tfQuotes: `${P}.tf-quotes`,
} as const;

/** Markers that only exist in answer keys of the fixture specs. */
export const ANSWER_MARKERS = ['RATIONALE-MARK'];
/** Spec keys that hold answer keys (exercise-kit testing fixtures use the same list). */
export const ANSWER_KEY_FIELDS = [
  'correct',
  'rationale',
  'misconception',
  'misconceptionIfWrong',
  'missedMisconception',
  'answer',
];

interface FixtureExercise {
  id: string;
  type: string;
  difficulty: number;
  usage?: 'practice' | 'remedial' | 'assessment' | 'check';
  spec: unknown;
  code?: string;
  lessonId?: string;
  concepts?: { id: string; weight: number }[];
}

/** An mcq_single spec whose correct option is `b`; `a` points to the misconception. */
const mcqSpec = (a: string, b: string, c: string) => ({
  options: [
    { id: 'a', text: a, misconception: 'go.mc.println-returns', rationale: 'RATIONALE-MARK' },
    { id: 'b', text: b },
    { id: 'c', text: c },
  ],
  correct: 'b',
});

/** An mcq_multi spec whose correct options are `a` and `b`; `c` points to the misconception. */
const multiSpec = (a: string, b: string, c: string) => ({
  options: [
    { id: 'a', text: a },
    { id: 'b', text: b },
    { id: 'c', text: c, misconception: 'go.mc.println-returns', rationale: 'RATIONALE-MARK' },
  ],
  correct: ['a', 'b'],
});

/** A true_false spec whose answer is `false`. */
const falseSpec = (statement: string) => ({
  statement,
  answer: false,
  misconceptionIfWrong: 'go.mc.println-returns',
});

// The skeleton serves only the common choice types (G-001). The eleven practice items keep the
// difficulty mix (1 → 3) the set-building tests rely on.
export const FIXTURE_EXERCISES: FixtureExercise[] = [
  {
    id: EX.mcq,
    type: 'mcq_single',
    difficulty: 1,
    spec: mcqSpec('`2`를 돌려준다', '`2`를 출력한다', '아무 일도 없다'),
  },
  {
    id: EX.mcqMulti,
    type: 'mcq_multi',
    difficulty: 1,
    spec: multiSpec(
      '`fmt.Println`은 값을 출력한다',
      '문장은 위에서 아래로 실행된다',
      '`fmt.Println`은 값을 돌려준다',
    ),
  },
  {
    id: EX.trueFalse,
    type: 'true_false',
    difficulty: 1,
    spec: falseSpec('`fmt.Println(2)`는 2를 돌려준다.'),
  },
  {
    id: EX.mcqOrder,
    type: 'mcq_single',
    difficulty: 1,
    spec: mcqSpec('아래 문장부터', '위 문장부터', '무작위로'),
  },
  {
    id: EX.mcqOutput,
    type: 'mcq_single',
    difficulty: 2,
    code: 'fmt.Println(1 + 1)',
    spec: mcqSpec('`11`', '`2`', '`1 + 1`'),
  },
  {
    id: EX.multiParts,
    type: 'mcq_multi',
    difficulty: 2,
    spec: multiSpec('`package main`', '`func main()`', '`fmt.Println`이 값을 돌려주는 부분'),
  },
  {
    id: EX.tfImport,
    type: 'true_false',
    difficulty: 2,
    spec: falseSpec('`import "fmt"` 없이도 `fmt.Println`을 쓸 수 있다.'),
  },
  {
    id: EX.mcqValues,
    type: 'mcq_single',
    difficulty: 2,
    spec: mcqSpec('`합계:7`', '`합계: 7`', '`"합계:" 7`'),
  },
  {
    id: EX.multiErrors,
    type: 'mcq_multi',
    difficulty: 3,
    concepts: [
      { id: 'go.basics.statement', weight: 1 },
      { id: 'go.basics.comment', weight: 0.5 },
    ],
    spec: multiSpec('쓰지 않은 변수', '같은 범위의 `x := 1` 두 번', '`fmt.Println` 호출'),
  },
  {
    id: EX.mcqMain,
    type: 'mcq_single',
    difficulty: 3,
    spec: mcqSpec('파일 맨 위 함수', '`main` 함수', '`import` 문'),
  },
  {
    id: EX.tfQuotes,
    type: 'true_false',
    difficulty: 2,
    spec: falseSpec('`fmt.Println("hi")`는 따옴표까지 출력한다.'),
  },
];

/**
 * The first lesson's own body items (JS D-091): "이해도 확인" checks (`usage: check`, answered by
 * `inline-attempts`). Kept out of FIXTURE_EXERCISES: practice sets never serve them. "직접 써 보기"
 * (`usage: try`) needs Go execution (G-001).
 */
export const BLOCK = {
  checkMcq: `${P}.check-mcq`,
  checkTf: `${P}.check-tf`,
} as const;

const fixtureById = (id: string): FixtureExercise => {
  const ex = FIXTURE_EXERCISES.find((e) => e.id === id);
  if (!ex) throw new Error(`no fixture exercise ${id}`);
  return ex;
};

export const LESSON_BLOCK_EXERCISES: FixtureExercise[] = [
  { ...fixtureById(EX.mcq), id: BLOCK.checkMcq, usage: 'check' },
  { ...fixtureById(EX.trueFalse), id: BLOCK.checkTf, usage: 'check' },
];

// ── Remedial exercises: outside lesson and review sets, used by adaptive items and weakness sets ──

const choice = {
  options: [
    { id: 'a', text: '`2`를 돌려준다', misconception: 'go.mc.println-returns' },
    { id: 'b', text: '`2`를 출력한다' },
    { id: 'c', text: '아무 일도 없다' },
  ],
  correct: 'b',
};

/** `usage: remedial` choice exercises (answer `b` is correct, `a` points to the misconception). */
export const REMEDIAL = {
  statementL1: `${P}.remedial-statement-l1`,
  statementL2: `${P}.remedial-statement-l2`,
  statementL3: `${P}.remedial-statement-l3`,
  statementL4: `${P}.remedial-statement-l4`,
  commentL1a: `${P}.remedial-comment-l1a`,
  commentL1b: `${P}.remedial-comment-l1b`,
  commentL2: `${P}.remedial-comment-l2`,
} as const;

const remedial = (id: string, difficulty: number, concept: string): FixtureExercise => ({
  id,
  type: 'mcq_single',
  difficulty,
  usage: 'remedial',
  spec: choice,
  concepts: [{ id: concept, weight: 1 }],
});

export const REMEDIAL_EXERCISES: FixtureExercise[] = [
  remedial(REMEDIAL.statementL1, 1, 'go.basics.statement'),
  remedial(REMEDIAL.statementL2, 2, 'go.basics.statement'),
  remedial(REMEDIAL.statementL3, 3, 'go.basics.statement'),
  remedial(REMEDIAL.statementL4, 4, 'go.basics.statement'),
  remedial(REMEDIAL.commentL1a, 1, 'go.basics.comment'),
  remedial(REMEDIAL.commentL1b, 1, 'go.basics.comment'),
  remedial(REMEDIAL.commentL2, 2, 'go.basics.comment'),
];

// ── Unit assessment: usage `assessment`, only served by assessment sets ──

export const ASSESSMENT = 'go-basics.start.start-review';

/** Assessment items (answer `b` is correct). Easy → hard: statement L2, comment L2, … */
export const ASSESS = {
  statementL2: `${ASSESSMENT}.mcq-statement-l2`,
  statementL3: `${ASSESSMENT}.mcq-statement-l3`,
  statementL4: `${ASSESSMENT}.mcq-statement-l4`,
  commentL2: `${ASSESSMENT}.mcq-comment-l2`,
  commentL3: `${ASSESSMENT}.tf-comment-l3`,
} as const;

const assessmentItem = (
  id: string,
  difficulty: number,
  concept: string,
  type = 'mcq_single',
): FixtureExercise => ({
  id,
  type,
  difficulty,
  usage: 'assessment',
  lessonId: ASSESSMENT,
  spec:
    type === 'true_false'
      ? {
          statement: '주석은 실행된다.',
          answer: false,
          misconceptionIfWrong: 'go.mc.println-returns',
        }
      : { ...choice, options: choice.options.map((o) => ({ ...o, rationale: 'RATIONALE-MARK' })) },
  concepts: [{ id: concept, weight: 1 }],
});

export const ASSESSMENT_EXERCISES: FixtureExercise[] = [
  assessmentItem(ASSESS.statementL2, 2, 'go.basics.statement'),
  assessmentItem(ASSESS.statementL3, 3, 'go.basics.statement'),
  assessmentItem(ASSESS.statementL4, 4, 'go.basics.statement'),
  assessmentItem(ASSESS.commentL2, 2, 'go.basics.comment'),
  assessmentItem(ASSESS.commentL3, 3, 'go.basics.comment', 'true_false'),
];
