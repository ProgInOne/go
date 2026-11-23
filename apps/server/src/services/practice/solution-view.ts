import type { McqMultiSpec, McqSingleSpec, TrueFalseSpec } from '@proginone/exercise-kit';
import { type SolutionView } from '@proginone/shared';

/**
 * What "정답 보기" reveals for a validated spec (JS D-010: only after the third hint). exercise-kit
 * has no display helper for this, so the server picks the reference answer per type. Hidden
 * checks and misconception maps are never part of the view.
 */
export function solutionView(typeId: string, spec: unknown): SolutionView {
  switch (typeId) {
    case 'mcq_single': {
      const s = spec as McqSingleSpec;
      const option = s.options.find((o) => o.id === s.correct);
      return { kind: 'choice', choiceId: s.correct, text: option?.text ?? '' };
    }
    case 'mcq_multi': {
      const s = spec as McqMultiSpec;
      return {
        kind: 'choices',
        choices: s.options
          .filter((o) => s.correct.includes(o.id))
          .map((o) => ({ id: o.id, text: o.text })),
      };
    }
    case 'true_false': {
      const s = spec as TrueFalseSpec;
      const verdict = s.answer ? '참이에요.' : '거짓이에요.';
      const reason = s.requireReason ? s.reasons?.find((r) => r.correct)?.text : undefined;
      return { kind: 'text', text: reason ? `${verdict} 이유: ${reason}` : verdict };
    }
    default:
      return { kind: 'none' };
  }
}

/**
 * The learner's stored answer in the `SolutionView` shape, for the mistake notes ("내 답"). Option
 * and block texts come from the validated spec (they were shown to the learner); nothing from the
 * answer key is added. Answers that no longer parse (an older type version) show as `none`.
 */
export function answerView(typeId: string, spec: unknown, answer: unknown): SolutionView {
  const a = answer as Record<string, unknown>;
  switch (typeId) {
    case 'mcq_single': {
      const s = spec as McqSingleSpec;
      const id = typeof a['optionId'] === 'string' ? a['optionId'] : '';
      return { kind: 'choice', choiceId: id, text: s.options.find((o) => o.id === id)?.text ?? '' };
    }
    case 'mcq_multi': {
      const s = spec as McqMultiSpec;
      const ids = Array.isArray(a['optionIds'])
        ? (a['optionIds'] as unknown[]).filter((x) => typeof x === 'string')
        : [];
      return {
        kind: 'choices',
        choices: s.options
          .filter((o) => ids.includes(o.id))
          .map((o) => ({ id: o.id, text: o.text })),
      };
    }
    case 'true_false': {
      const s = spec as TrueFalseSpec;
      if (typeof a['value'] !== 'boolean') return { kind: 'none' };
      const verdict = a['value'] ? '참이라고 답했어요.' : '거짓이라고 답했어요.';
      const reason = s.reasons?.find((r) => r.id === a['reasonId'])?.text;
      return { kind: 'text', text: reason ? `${verdict} 이유: ${reason}` : verdict };
    }
    default:
      return { kind: 'none' };
  }
}
