import {
  ASSESSMENT_MAX_ITEMS,
  containsRawHtml,
  type ConceptSource,
  type ExerciseSource,
} from '@proginone/content-schema';
import { join } from 'node:path';
import { checkAliases, type AliasRow } from './aliases.ts';
import { parseDiagrams } from './diagram.ts';
import { Diagnostics } from './diagnostics.ts';
import { loadContent, type ContentSource, type LessonNodeSource } from './load.ts';
import {
  EXPECTATIONS_FILE,
  predictInputHash,
  readExpectations,
  type ExpectationStore,
} from './expectations.ts';
import { compileLessonMdx, type CompiledLesson } from './mdx.ts';
import { namingWarning } from './naming.ts';

/** Validates a type-specific exercise spec. Supplied by exercise-kit's registry. */
export type SpecValidator = (
  type: string,
  spec: unknown,
) =>
  | {
      ok: true;
      warnings?: string[];
      /** Misconception IDs the spec refers to (checked against the catalog). */
      misconceptions?: string[];
    }
  | { ok: false; errors: string[] };

export interface CheckOptions {
  validateSpec?: SpecValidator;
  /**
   * Execution-derived predict_output answer keys. Default: read
   * `<root>/.generated/predict-expected.json` (see expectations.ts).
   */
  expectations?: ExpectationStore;
  /** `check --run` computes the keys itself: do not fill or report them here. */
  skipExpectations?: boolean;
}

export interface CheckResult {
  source: ContentSource;
  diagnostics: Diagnostics;
  /** Compiled lesson bodies keyed by lesson id (reused by `build`). */
  lessons: Map<string, CompiledLesson>;
  /** `content_id_aliases` rows from `aliases.yaml` (aliases.ts). */
  aliases: AliasRow[];
}

/**
 * Types a `usage: check` item may use: the short types the lesson body answers in place, graded
 * without running code (JS D-091). This repository has no Go execution yet (G-001), so these are
 * the common choice types.
 */
export const CHECK_EXERCISE_TYPES: ReadonlySet<string> = new Set([
  'mcq_single',
  'mcq_multi',
  'true_false',
]);

/** Recommended items per assessment sitting (JS D-070). */
export const ASSESSMENT_ITEM_RANGE = { min: 10, max: 20 } as const;

/**
 * Items one sitting of an assessment asks: `itemCount` items of the approved pool (the pool may
 * hold more so that retakes see other items), or without it the whole pool up to the engine's
 * cap. The 10~20 advice is about this number, not the pool size (JS D-070).
 */
export function assessmentAsked(pool: number, itemCount: number | undefined): number {
  return Math.min(pool, itemCount ?? ASSESSMENT_MAX_ITEMS);
}

/** Message for content that needs Go execution, which the skeleton does not have (G-001). */
const NEEDS_RUN = 'Go 코드 실행은 아직 없습니다(G-001). 실행 방식은 Go 전용 설계에서 정합니다';

const prereqId = (p: ConceptSource['prerequisites'][number]) => (typeof p === 'string' ? p : p.id);

/** Schema + cross-reference checks (`content-cli check`). */
export function checkContent(root: string, options: CheckOptions = {}): CheckResult {
  const diag = new Diagnostics(root);
  const source = loadContent(root, diag);
  const lessons = new Map<string, CompiledLesson>();
  const expectations = options.expectations ?? readExpectations(root, diag);
  const predictIds = new Set<string>();
  const diagrams: { file: string; line: number | null; code: string }[] = [];

  // ── Uniqueness ──
  const seen = new Map<string, string>();
  const unique = (id: string, file: string) => {
    const prev = seen.get(id);
    if (prev) diag.error(file, `ID가 중복됩니다: ${id} (${prev})`);
    else seen.set(id, file);
  };

  const concepts = new Map(source.concepts.map((c) => [c.data.id, c]));
  const misconceptions = new Map(source.misconceptions.map((m) => [m.data.id, m]));
  source.concepts.forEach((c) => {
    unique(c.data.id, c.file);
  });
  source.misconceptions.forEach((m) => {
    unique(m.data.id, m.file);
  });

  const allLessons: LessonNodeSource[] = source.courses.flatMap((c) =>
    c.modules.flatMap((m) => m.lessons),
  );
  const exerciseIds = new Set(allLessons.flatMap((l) => l.exercises.map((e) => e.data.id)));

  // ── Concepts ──
  for (const { file, data } of source.concepts) {
    for (const p of data.prerequisites) {
      if (!concepts.has(prereqId(p)))
        diag.error(file, `${data.id}: 없는 선수 개념입니다: ${prereqId(p)}`);
      if (prereqId(p) === data.id)
        diag.error(file, `${data.id}: 자기 자신을 선수 개념으로 둘 수 없습니다`);
    }
    for (const m of data.misconceptions) {
      const mc = misconceptions.get(m);
      if (!mc) diag.error(file, `${data.id}: 없는 오개념입니다: ${m}`);
      else if (mc.data.concept !== data.id)
        diag.error(file, `${data.id}: 오개념 ${m}은 ${mc.data.concept}에 속합니다`);
    }
  }
  for (const cycle of findCycles(source.concepts.map((c) => c.data))) {
    diag.error(
      concepts.get(cycle[0] ?? '')?.file ?? root,
      `선수 관계에 순환이 있습니다: ${cycle.join(' → ')}`,
    );
  }

  // ── Misconceptions ──
  for (const { file, data } of source.misconceptions) {
    if (!concepts.has(data.concept))
      diag.error(file, `${data.id}: 없는 개념입니다: ${data.concept}`);
    for (const ex of data.remediation?.exercises ?? []) {
      if (!exerciseIds.has(ex)) diag.error(file, `${data.id}: 없는 문제입니다: ${ex}`);
    }
    const anchor = data.remediation?.lessonSection;
    if (anchor && !allLessons.some((l) => l.meta.data.id === anchor.split('#')[0])) {
      diag.error(file, `${data.id}: 없는 단원입니다: ${anchor}`);
    }
  }

  // ── Lessons and exercises ──
  const introducedAt = new Map<string, number>();
  allLessons.forEach((lesson, index) => {
    const { file, data } = lesson.meta;
    unique(data.id, file);
    const lessonConcepts = [
      ...data.concepts.primary,
      ...data.concepts.practiced,
      ...data.concepts.reviewed,
    ];
    for (const c of lessonConcepts) if (!concepts.has(c)) diag.error(file, `없는 개념입니다: ${c}`);
    for (const c of data.concepts.primary) {
      if (introducedAt.has(c))
        diag.error(file, `개념 ${c}을(를) 이미 앞 단원에서 소개했습니다(primary는 한 단원만)`);
      else introducedAt.set(c, index);
    }

    const metaText = [data.title, data.summary, ...data.objectives].join('\n');
    const metaNaming = namingWarning('lesson.yaml', metaText);
    if (metaNaming) diag.warn(file, metaNaming);

    if (lesson.mdx !== null) {
      const mdxNaming = namingWarning('본문', lesson.mdx);
      if (mdxNaming) diag.warn(lesson.mdxFile, mdxNaming);
      const compiled = compileLessonMdx(lesson.mdx, { lessonKind: data.kind });
      lessons.set(data.id, compiled);
      for (const e of compiled.errors) diag.error(lesson.mdxFile, e);
      for (const d of compiled.refs.diagrams) diagrams.push({ file: lesson.mdxFile, ...d });
      for (const ref of compiled.refs.exercises) {
        if (!lesson.exercises.some((x) => x.data.id === ref))
          diag.error(lesson.mdxFile, `이 단원에 없는 문제입니다: ${ref}`);
      }
      for (const ref of compiled.refs.concepts)
        if (!concepts.has(ref)) diag.error(lesson.mdxFile, `없는 개념입니다: ${ref}`);
      for (const ref of compiled.refs.misconceptions) {
        if (!misconceptions.has(ref)) diag.error(lesson.mdxFile, `없는 오개념입니다: ${ref}`);
      }
      // Every misconception of a primary concept should be covered in pitfalls.
      for (const c of data.concepts.primary) {
        for (const m of concepts.get(c)?.data.misconceptions ?? []) {
          if (!compiled.refs.misconceptions.includes(m))
            diag.warn(lesson.mdxFile, `흔한 실수에 오개념 ${m}이(가) 없습니다`);
        }
      }
    }

    let approved = 0;
    for (const { file: exFile, data: ex } of lesson.exercises) {
      unique(ex.id, exFile);
      if (!ex.id.startsWith(`${data.id}.`))
        diag.error(exFile, `문제 ID는 단원 ID(${data.id})로 시작해야 합니다`);
      for (const c of ex.concepts)
        if (!concepts.has(c.id)) diag.error(exFile, `없는 개념입니다: ${c.id}`);
      for (const m of ex.misconceptions)
        if (!misconceptions.has(m)) diag.error(exFile, `없는 오개념입니다: ${m}`);
      const fields = { prompt: ex.prompt, explanation: ex.explanation, hints: ex.hints.join('\n') };
      for (const [field, text] of Object.entries(fields)) {
        if (containsRawHtml(text)) diag.error(exFile, `${field}에 원시 HTML이 있습니다`);
        const naming = namingWarning(field, text);
        if (naming) diag.warn(exFile, naming);
      }
      const predict = ex.type === 'predict_output';
      if (predict) {
        predictIds.add(ex.id);
        if (!options.skipExpectations) applyExpectation(ex, exFile, expectations, diag);
      }
      if (options.validateSpec) {
        const r = options.validateSpec(ex.type, ex.spec);
        if (!r.ok) for (const e of r.errors) diag.error(exFile, `spec: ${e}`);
        else {
          for (const m of r.misconceptions ?? []) {
            if (!misconceptions.has(m)) diag.error(exFile, `spec: 없는 오개념입니다: ${m}`);
          }
          for (const w of r.warnings ?? []) {
            // A missing predict key is reported by applyExpectation with the command that fixes it.
            if (predict && w.includes('content:check:run')) continue;
            diag.warn(exFile, `spec: ${w}`);
          }
        }
      }
      if (ex.review.status === 'approved') approved++;
    }
    checkAssessmentUnit(lesson, diag);
    checkProjectUnit(lesson, diag);
    checkWorkedExamples(lesson, diag);
    checkLessonBlocks(lesson, lesson.mdx === null ? null : (lessons.get(data.id) ?? null), diag);
    const drafts = lesson.exercises.length - approved;
    if (drafts > 0) diag.warn(file, `검토되지 않은 문제 ${drafts}개는 빌드에서 제외됩니다`);
    // Worked examples are served only by the relearning path, never in the unit's sets (JS D-072).
    const target = data.practice?.targetCount;
    const counted = lesson.exercises.filter(
      (x) =>
        x.data.review.status === 'approved' &&
        x.data.usage !== 'worked_example' &&
        x.data.usage !== 'check' &&
        x.data.usage !== 'try',
    ).length;
    if (target !== undefined && counted !== target)
      diag.warn(file, `승인된 문제 ${counted}개 / 목표 ${target}개`);
  });

  // ── Modules: the declared unit assessment ──
  for (const course of source.courses) {
    for (const mod of course.modules) {
      const { file, data } = mod.meta;
      const projects = mod.lessons.filter((l) => l.meta.data.kind === 'project');
      if (projects.length > 1)
        diag.error(
          file,
          `프로젝트 단원은 모듈에 하나만 둘 수 있습니다: ${projects.map((l) => l.meta.data.id).join(', ')}`,
        );
      const units = mod.lessons.filter((l) => l.meta.data.kind === 'assessment');
      if (units.length > 1)
        diag.error(
          file,
          `단원 평가 단원은 모듈에 하나만 둘 수 있습니다: ${units.map((l) => l.meta.data.id).join(', ')}`,
        );
      if (data.assessment !== undefined) {
        const target = mod.lessons.find((l) => l.meta.data.id === `${data.id}.${data.assessment}`);
        if (!target)
          diag.error(file, `assessment: 이 모듈의 lessons에 없는 단원입니다: ${data.assessment}`);
        else if (target.meta.data.kind !== 'assessment')
          diag.error(file, `assessment: ${data.assessment}은(는) kind: assessment 단원이 아닙니다`);
      } else if (units.length === 1) {
        const slug = units[0]?.meta.data.id.split('.').at(-1) ?? '';
        diag.warn(
          file,
          `단원 평가 단원을 assessment: ${slug}로 선언하세요(지금은 자동으로 연결합니다)`,
        );
      }
    }
  }

  // Concepts must belong to a lesson; prerequisites should be introduced earlier.
  for (const { file, data } of source.concepts) {
    const at = introducedAt.get(data.id);
    if (at === undefined) {
      diag.error(file, `${data.id}: 어느 단원에서도 소개(primary)하지 않습니다`);
      continue;
    }
    for (const p of data.prerequisites) {
      const pAt = introducedAt.get(prereqId(p));
      if (pAt !== undefined && pAt > at)
        diag.warn(file, `${data.id}: 선수 개념 ${prereqId(p)}이(가) 뒤 단원에서 소개됩니다`);
    }
  }

  // Parametric templates (`templates/`) are not built here yet: their Go form is step-3 design.
  for (const course of source.courses) {
    for (const lesson of course.modules.flatMap((m) => m.lessons)) {
      for (const t of lesson.templates) {
        diag.error(
          t.file,
          '문제 템플릿은 아직 지원하지 않습니다(G-001). Go 전용 설계에서 정합니다',
        );
      }
    }
  }
  const aliases = checkAliases(source, diag);

  // Mermaid syntax of every <Diagram>, in one child process (diagram.ts).
  parseDiagrams(diagrams.map((d) => d.code)).forEach(({ error }, i) => {
    const d = diagrams[i];
    if (error !== null && d)
      diag.error(
        d.file,
        `${d.line === null ? '' : `${d.line}행: `}<Diagram> Mermaid 구문 오류: ${error}`,
      );
  });

  for (const id of Object.keys(expectations.entries)) {
    if (!predictIds.has(id) && !options.skipExpectations)
      diag.warn(
        join(root, EXPECTATIONS_FILE),
        `없는 predict_output 문제의 기대값입니다: ${id} (pnpm content:check:run이 정리합니다)`,
      );
  }

  return { source, diagnostics: diag, lessons, aliases };
}

/**
 * Fills `spec.expected` of a predict_output exercise from the expectation store when the code
 * has not changed since the last `check --run`. Approved exercises must have a fresh key (they
 * ship and are graded against it); drafts only warn.
 */
function applyExpectation(
  ex: ExerciseSource,
  file: string,
  store: ExpectationStore,
  diag: Diagnostics,
): void {
  if (ex.spec['expected'] !== undefined && ex.spec['expected'] !== null) {
    diag.error(
      file,
      'spec.expected는 직접 쓰지 않습니다. pnpm content:check:run이 실행해서 계산합니다',
    );
    return;
  }
  const entry = store.entries[ex.id];
  if (entry?.inputHash === predictInputHash(ex.spec)) {
    ex.spec['expected'] = entry.expected;
    return;
  }
  const message = entry
    ? '코드가 바뀌어 실행 기대값이 낡았습니다. pnpm content:check:run으로 다시 계산하세요'
    : '실행 기대값이 아직 없습니다. pnpm content:check:run으로 계산하세요';
  if (ex.review.status === 'approved') diag.error(file, message);
  else diag.warn(file, message);
}

/**
 * The lesson's own "이해도 확인" items (`usage: check`, `<InlineExercise>`, JS D-091). Each such
 * item belongs to exactly one block of its own lesson, so practice sets (which never serve them)
 * and the body do not repeat. "직접 써 보기" (`usage: try`, `<TryIt>`) needs Go execution, which
 * the skeleton does not have (G-001).
 */
function checkLessonBlocks(
  lesson: LessonNodeSource,
  compiled: CompiledLesson | null,
  diag: Diagnostics,
): void {
  const byId = new Map(lesson.exercises.map((x) => [x.data.id, x] as const));
  const inline = compiled?.refs.exercises ?? [];
  const mdxFile = lesson.mdxFile;

  const seen = new Set<string>();
  for (const ref of inline) {
    if (seen.has(ref)) diag.error(mdxFile, `InlineExercise가 같은 문제를 두 번 씁니다: ${ref}`);
    seen.add(ref);
    const ex = byId.get(ref)?.data;
    if (ex && ex.usage !== 'check')
      diag.error(mdxFile, `이해도 확인(InlineExercise)은 usage: check 문제만 씁니다: ${ref}`);
  }

  for (const { file: exFile, data: ex } of lesson.exercises) {
    if (ex.usage === 'check') {
      if (!CHECK_EXERCISE_TYPES.has(ex.type))
        diag.error(
          exFile,
          `usage: check 문제는 실행 없이 채점하는 ${[...CHECK_EXERCISE_TYPES].join(', ')} 유형만 씁니다: ${ex.type}`,
        );
      if (!inline.includes(ex.id))
        diag.error(exFile, '본문의 InlineExercise가 쓰지 않는 usage: check 문제입니다');
    }
    if (ex.usage === 'try') diag.error(exFile, `usage: try 문제는 쓸 수 없습니다. ${NEEDS_RUN}`);
  }
}

/**
 * Worked examples (`usage: worked_example`, FR-LRN-05, JS D-072): the relearning path suggests a
 * concept's stages 0 (full solution) → 1 (blanks) → 2 (solve). They live in the `kind: lesson`
 * unit that introduces their primary concept, and each concept's approved set holds every stage
 * exactly once (the engine takes the first exercise of a stage, so a duplicate is never served).
 */
function checkWorkedExamples(lesson: LessonNodeSource, diag: Diagnostics): void {
  const { file, data } = lesson.meta;
  const stages = new Map<string, number[]>();
  for (const { file: exFile, data: ex } of lesson.exercises) {
    if (ex.usage !== 'worked_example') continue;
    if (data.kind !== 'lesson') {
      diag.error(exFile, 'usage: worked_example 문제는 일반 단원(kind: lesson)에만 둡니다');
      continue;
    }
    const primary = ex.concepts.find((c) => c.weight === 1)?.id;
    if (primary === undefined) continue; // reported by the schema
    if (!data.concepts.primary.includes(primary))
      diag.warn(exFile, `풀이 예제는 주 개념 ${primary}을(를) 소개하는 단원에 둡니다`);
    if (ex.review.status !== 'approved' || ex.workedExampleStage === null) continue;
    stages.set(primary, [...(stages.get(primary) ?? []), ex.workedExampleStage]);
  }
  for (const [concept, list] of stages) {
    const missing = [0, 1, 2].filter((s) => !list.includes(s));
    const repeated = [...new Set(list.filter((s, i) => list.indexOf(s) !== i))];
    if (missing.length > 0)
      diag.warn(file, `${concept}의 풀이 예제에 단계 ${missing.join('·')}이(가) 없습니다`);
    if (repeated.length > 0)
      diag.warn(
        file,
        `${concept}의 풀이 예제 단계 ${repeated.join('·')}이(가) 두 개 이상입니다(앞의 것만 쓰입니다)`,
      );
  }
}

/**
 * Rules of a `kind: assessment` unit (learning-engine.md#단원-평가-세트): it introduces nothing,
 * assesses the concepts in `concepts.reviewed` with its own `usage: assessment` items (at least
 * one per concept), and is configured by `assessment` rather than `practice.passRule`. Units of
 * other kinds may not hold assessment items or settings.
 */
function checkAssessmentUnit(lesson: LessonNodeSource, diag: Diagnostics): void {
  const { file, data } = lesson.meta;
  if (data.kind !== 'assessment') {
    if (data.assessment !== undefined)
      diag.error(file, 'assessment 설정은 kind: assessment 단원에만 쓸 수 있습니다');
    for (const { file: exFile, data: ex } of lesson.exercises) {
      if (ex.usage === 'assessment')
        diag.error(exFile, 'usage: assessment 문제는 단원 평가(kind: assessment) 단원에만 둡니다');
    }
    return;
  }
  if (data.concepts.primary.length > 0)
    diag.error(
      file,
      '단원 평가는 새 개념을 소개하지 않습니다. 평가할 개념은 concepts.reviewed에 두세요',
    );
  const assessed = new Set(data.concepts.reviewed);
  if (assessed.size === 0)
    diag.error(file, '단원 평가에는 평가할 개념(concepts.reviewed)이 있어야 합니다');
  if (data.practice?.passRule)
    diag.error(
      file,
      '단원 평가는 practice.passRule 대신 assessment.passRatio로 통과 기준을 정합니다',
    );

  // Counted over every item (drafts included): unreviewed drafts are reported separately.
  const covered = new Map<string, number>();
  for (const { file: exFile, data: ex } of lesson.exercises) {
    if (ex.usage !== 'assessment')
      diag.error(exFile, `단원 평가 단원의 문제는 usage: assessment여야 합니다(지금: ${ex.usage})`);
    const primary = ex.concepts.find((c) => c.weight === 1)?.id;
    if (primary !== undefined && !assessed.has(primary))
      diag.error(exFile, `주 개념 ${primary}이(가) 이 단원 평가의 concepts.reviewed에 없습니다`);
    if (primary !== undefined) covered.set(primary, (covered.get(primary) ?? 0) + 1);
  }
  for (const c of assessed) {
    if (!covered.has(c)) diag.warn(file, `평가 문항이 없는 개념입니다: ${c}`);
  }
  // Only approved items are served (drafts are left out of the build).
  const items = lesson.exercises.filter((e) => e.data.review.status === 'approved').length;
  const itemCount = data.assessment?.itemCount;
  // The advice is about one sitting, not the pool size (JS D-070): `itemCount` items are asked (the
  // pool may hold more so that retakes see other items); without it, the pool up to the cap.
  const asked = assessmentAsked(items, itemCount);
  const { min, max } = ASSESSMENT_ITEM_RANGE;
  if (asked < min || asked > max)
    diag.warn(file, `단원 평가 한 번에 내는 문항은 ${min}~${max}개를 권장합니다(지금 ${asked}개)`);
  if (itemCount !== undefined) {
    if (itemCount > items)
      diag.warn(file, `assessment.itemCount ${itemCount}가 승인된 문항 ${items}개보다 많습니다`);
    if (itemCount < assessed.size)
      diag.warn(
        file,
        `assessment.itemCount ${itemCount}로는 평가할 개념 ${assessed.size}개를 모두 다룰 수 없습니다`,
      );
  }
}

/**
 * Project units (`kind: project`) are built around a code-running project exercise, so they wait
 * for Go execution (G-001). Units of other kinds may not hold project exercises either.
 */
function checkProjectUnit(lesson: LessonNodeSource, diag: Diagnostics): void {
  const { file, data } = lesson.meta;
  if (data.kind === 'project')
    diag.error(file, `프로젝트 단원은 아직 쓸 수 없습니다. ${NEEDS_RUN}`);
  for (const { file: exFile, data: ex } of lesson.exercises) {
    if (ex.usage === 'project')
      diag.error(exFile, `usage: project 문제는 쓸 수 없습니다. ${NEEDS_RUN}`);
  }
}

/** Returns each prerequisite cycle once (as a closed path). */
export function findCycles(concepts: readonly ConceptSource[]): string[][] {
  const graph = new Map(concepts.map((c) => [c.id, c.prerequisites.map(prereqId)]));
  const state = new Map<string, 'visiting' | 'done'>();
  const cycles: string[][] = [];
  const stack: string[] = [];
  const visit = (id: string) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'visiting') {
      cycles.push([...stack.slice(stack.indexOf(id)), id]);
      return;
    }
    state.set(id, 'visiting');
    stack.push(id);
    for (const next of graph.get(id) ?? []) visit(next);
    stack.pop();
    state.set(id, 'done');
  };
  for (const id of graph.keys()) visit(id);
  return cycles;
}
