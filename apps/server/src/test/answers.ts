import { EX, REMEDIAL } from './content-fixture.ts';

// Learner answers for the fixture exercises (content-fixture.ts). Every fixture exercise is a
// choice type: mcq_single `b`, mcq_multi `a`+`b` and true_false `false` are correct.

type Pair = [string, { right: unknown; wrong: unknown }];
const single = (id: string): Pair => [id, { right: { optionId: 'b' }, wrong: { optionId: 'a' } }];
const multi = (id: string): Pair => [
  id,
  { right: { optionIds: ['b', 'a'] }, wrong: { optionIds: ['a', 'c'] } },
];
const verdict = (id: string): Pair => [id, { right: { value: false }, wrong: { value: true } }];

const ANSWERS: Pair[] = [
  single(EX.mcq),
  multi(EX.mcqMulti),
  verdict(EX.trueFalse),
  single(EX.mcqOrder),
  single(EX.mcqOutput),
  multi(EX.multiParts),
  verdict(EX.tfImport),
  single(EX.mcqValues),
  multi(EX.multiErrors),
  single(EX.mcqMain),
  verdict(EX.tfQuotes),
  ...Object.values(REMEDIAL).map(single),
];

/** Correct answers by exercise id. */
export const CORRECT: Record<string, unknown> = Object.fromEntries(
  ANSWERS.map(([id, a]) => [id, a.right]),
);

/** Wrong answers by exercise id. */
export const WRONG: Record<string, unknown> = Object.fromEntries(
  ANSWERS.map(([id, a]) => [id, a.wrong]),
);
