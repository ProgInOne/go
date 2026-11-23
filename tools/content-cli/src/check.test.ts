import { describe, expect, it } from 'vitest';
import { checkContent } from './check.ts';
import {
  CHECK,
  CHECK_YAML,
  EXERCISE,
  EXERCISE_YAML,
  LESSON_MDX,
  LESSON_YAML,
  lessonMdx,
  MODULE_YAML,
  PROJECT_YAML,
  REVIEW_EXERCISE_YAML,
  REVIEW_YAML,
  withAssessment,
  withProject,
  writeContent,
  FIXTURE_BLOCKS,
} from './test/fixture.ts';

type Files = Record<string, unknown>;
const messages = (patch: (f: Files) => void) =>
  checkContent(writeContent(patch))
    .diagnostics.items.map((d) => `${d.level} ${d.file} ${d.message}`)
    .join('\n');
const obj = (files: Files, key: string) => files[key] as Record<string, unknown>;
const first = (files: Files, key: string) => {
  const item = (files[key] as Record<string, unknown>[])[0];
  if (!item) throw new Error(`empty ${key}`);
  return item;
};

describe('checkContent', () => {
  it('passes a valid content tree', () => {
    const { diagnostics, lessons } = checkContent(writeContent());
    expect(diagnostics.items).toEqual([]);
    expect(lessons.get('go-basics.start.first-program')?.sections).toHaveLength(12);
  });

  it.each<[string, (f: Files) => void, string]>([
    [
      'unknown prerequisite',
      (f) => {
        first(f, 'concepts/go.yaml')['prerequisites'] = ['js.nope.x'];
      },
      '없는 선수 개념',
    ],
    [
      'prerequisite cycle',
      (f) => {
        first(f, 'concepts/go.yaml')['prerequisites'] = ['go.basics.println'];
      },
      '순환',
    ],
    [
      'lesson id mismatch',
      (f) => {
        obj(f, LESSON_YAML)['id'] = 'go-basics.start.other';
      },
      'id는 "go-basics.start.first-program"',
    ],
    [
      'lesson not listed',
      (f) => {
        obj(f, 'courses/go-basics/modules/01-start/module.yaml')['lessons'] = ['missing'];
      },
      '목록에 없는 단원',
    ],
    [
      'exercise prefix',
      (f) => {
        obj(f, EXERCISE_YAML)['id'] = 'go-basics.start.other.mcq-x';
      },
      '단원 ID',
    ],
    [
      'raw html in prompt',
      (f) => {
        obj(f, EXERCISE_YAML)['prompt'] = '<b>굵게</b>';
      },
      '원시 HTML',
    ],
    [
      'unknown concept in exercise',
      (f) => {
        obj(f, EXERCISE_YAML)['concepts'] = [{ id: 'js.x.y', weight: 1 }];
      },
      '없는 개념입니다: js.x.y',
    ],
    [
      'inline exercise from elsewhere',
      (f) => {
        f[LESSON_MDX] = lessonMdx({ check: '<InlineExercise ref="a.b.c.d" />' });
      },
      '이 단원에 없는 문제',
    ],
    [
      'inline check on a practice item (JS D-091)',
      (f) => {
        f[LESSON_MDX] = lessonMdx({
          ...FIXTURE_BLOCKS,
          check: `<InlineExercise ref="${CHECK}" />\n\n<InlineExercise ref="${EXERCISE}" />`,
        });
      },
      'usage: check 문제만 씁니다',
    ],
    [
      'check item the body never uses',
      (f) => {
        f[LESSON_MDX] = lessonMdx({ ...FIXTURE_BLOCKS, check: '확인.' });
      },
      'InlineExercise가 쓰지 않는 usage: check 문제',
    ],
    [
      'check item that needs a run',
      (f) => {
        obj(f, CHECK_YAML)['type'] = 'predict_output';
      },
      '실행 없이 채점하는 mcq_single, mcq_multi, true_false 유형만',
    ],
    [
      'a try task (needs Go execution)',
      (f) => {
        obj(f, CHECK_YAML)['usage'] = 'try';
      },
      'usage: try 문제는 쓸 수 없습니다. Go 코드 실행은 아직 없습니다(G-001)',
    ],
    [
      'a TryIt component',
      (f) => {
        f[LESSON_MDX] = lessonMdx({
          ...FIXTURE_BLOCKS,
          walkthrough: `<TryIt ref="${EXERCISE}" />`,
        });
      },
      '허용되지 않은 컴포넌트입니다: <TryIt',
    ],
    [
      'the same check twice',
      (f) => {
        f[LESSON_MDX] = lessonMdx({
          ...FIXTURE_BLOCKS,
          check: `${FIXTURE_BLOCKS.check}\n\n${FIXTURE_BLOCKS.check}`,
        });
      },
      '같은 문제를 두 번',
    ],
    [
      'missing pitfall coverage',
      (f) => {
        f[LESSON_MDX] = lessonMdx();
      },
      'warning',
    ],
    [
      'concept never introduced',
      (f) => {
        obj(f, LESSON_YAML)['concepts'] = { primary: ['go.basics.println'] };
      },
      '소개(primary)하지 않습니다',
    ],
    [
      'misconception concept mismatch',
      (f) => {
        first(f, 'misconceptions/go.yaml')['concept'] = 'go.basics.package-main';
      },
      '에 속합니다',
    ],
    [
      'target count',
      (f) => {
        obj(f, LESSON_YAML)['practice'] = { targetCount: 5 };
      },
      '목표 5개',
    ],
    [
      'yaml syntax',
      (f) => {
        f['pack.yaml'] = 'id: [oops';
      },
      'YAML을 해석할 수 없습니다',
    ],
  ])('reports %s', (_, patch, expected) => {
    expect(messages(patch)).toContain(expected);
  });

  describe('worked examples (JS D-072)', () => {
    const DIR = 'courses/go-basics/modules/01-start/lessons/01-first-program/exercises';
    const addStages = (f: Files, stages: number[], concept = 'go.basics.println') => {
      for (const [i, stage] of stages.entries()) {
        f[`${DIR}/we-${String(i)}.yaml`] = {
          ...obj(f, EXERCISE_YAML),
          id: `go-basics.start.first-program.we-log-${String(i)}`,
          concepts: [{ id: concept, weight: 1 }],
          usage: 'worked_example',
          workedExampleStage: stage,
        };
      }
    };

    it('accepts a full set and keeps it out of the target count', () => {
      const out = messages((f) => {
        addStages(f, [0, 1, 2]);
      });
      expect(out).toBe('');
    });

    it('reports missing and repeated stages', () => {
      const out = messages((f) => {
        addStages(f, [0, 0]);
      });
      expect(out).toContain('단계 1·2이(가) 없습니다');
      expect(out).toContain('단계 0이(가) 두 개 이상입니다');
    });

    it('reports a worked example outside its concept unit', () => {
      const out = messages((f) => {
        obj(f, LESSON_YAML)['concepts'] = { primary: ['go.basics.package-main'] };
        addStages(f, [0, 1, 2]);
      });
      expect(out).toContain('풀이 예제는 주 개념 go.basics.println을(를) 소개하는 단원에 둡니다');
    });
  });

  it('runs the type-specific spec validator', () => {
    const { diagnostics } = checkContent(writeContent(), {
      validateSpec: (type) =>
        type === 'mcq_single' ? { ok: false, errors: ['options: 2개 이상'] } : { ok: true },
    });
    expect(diagnostics.items.map((d) => d.message)).toContain('spec: options: 2개 이상');
  });

  it('reports misconception IDs in a spec that are not in the catalog', () => {
    const { diagnostics } = checkContent(writeContent(), {
      validateSpec: () => ({ ok: true, misconceptions: ['go.mc.println-returns', 'js.mc.nope'] }),
    });
    const errors = diagnostics.items.filter((d) => d.level === 'error').map((d) => d.message);
    // Reported once per exercise (the validator returns it for both).
    expect(new Set(errors)).toEqual(new Set(['spec: 없는 오개념입니다: js.mc.nope']));
  });
});

// Mermaid's parser loads lazily and takes seconds on a busy CI runner; give the suite room.
describe('checkContent: diagrams', { timeout: 30_000 }, () => {
  const withDiagram = (source: string) => (f: Files) => {
    f[LESSON_MDX] = lessonMdx({
      ...FIXTURE_BLOCKS,
      principle: `원리 본문\n\n<Diagram alt="흐름">\n\n\`\`\`mermaid\n${source}\n\`\`\`\n\n</Diagram>`,
    });
  };

  it('accepts a Mermaid diagram that parses', () => {
    const out = messages(withDiagram('flowchart TD\n  A[시작] --> B{조건}\n  B -->|예| C[끝]'));
    expect(out).not.toMatch(/^error/m);
    expect(out).not.toContain('Diagram');
  });

  it('reports a Mermaid syntax error with the line', () => {
    expect(messages(withDiagram('flowchart TD\n  A -->'))).toMatch(
      /error .*lesson\.mdx \d+행: <Diagram> Mermaid 구문 오류: Parse error/,
    );
  });

  it('reports an unknown diagram type', () => {
    expect(messages(withDiagram('graphh TD\n  A --> B'))).toContain('<Diagram> Mermaid 구문 오류');
  });

  it('rejects configuration directives and interactions', () => {
    const out = messages(
      withDiagram(
        '%%{init: {"securityLevel": "loose"}}%%\nflowchart TD\n  A --> B\n  click A "https://example.com"',
      ),
    );
    expect(out).toContain('지시문은 쓸 수 없습니다');
    expect(out).toContain('click·link 상호작용은 쓸 수 없습니다');
  });
});

describe('checkContent: unit assessments', () => {
  const errorsOf = (patch: (f: Files) => void) =>
    checkContent(
      writeContent((f) => {
        withAssessment(f);
        patch(f);
      }),
    ).diagnostics.items.filter((d) => d.level === 'error');

  it('accepts a declared assessment unit (only the item-count advice)', () => {
    const { diagnostics } = checkContent(writeContent(withAssessment));
    expect(diagnostics.items.map((d) => `${d.level} ${d.message}`)).toEqual([
      'warning 단원 평가 한 번에 내는 문항은 10~20개를 권장합니다(지금 1개)',
    ]);
  });

  /** `n` assessment items in the unit (copies of the fixture item). */
  const withPool = (f: Files, n: number) => {
    const item = obj(f, REVIEW_EXERCISE_YAML);
    for (let i = 1; i < n; i++) {
      f[REVIEW_EXERCISE_YAML.replace(/\.yaml$/, `-${String(i)}.yaml`)] = {
        ...item,
        id: `${String(item['id'])}-${String(i)}`,
      };
    }
  };
  const countAdvice = (patch: (f: Files) => void) =>
    checkContent(
      writeContent((f) => {
        withAssessment(f);
        patch(f);
      }),
    )
      .diagnostics.items.map((d) => d.message)
      .filter((m) => m.startsWith('단원 평가 한 번에 내는 문항'));

  it.each<[string, number, number | undefined, string[]]>([
    ['a pool in range without itemCount', 12, undefined, []],
    [
      'a pool larger than one sitting, itemCount in range',
      25,
      15,
      [], // retakes draw other items from the pool
    ],
    [
      'a large pool with a small itemCount',
      12,
      5,
      ['단원 평가 한 번에 내는 문항은 10~20개를 권장합니다(지금 5개)'],
    ],
    [
      'a small pool without itemCount',
      4,
      undefined,
      ['단원 평가 한 번에 내는 문항은 10~20개를 권장합니다(지금 4개)'],
    ],
    ['a pool over 20 without itemCount (the engine asks 20)', 24, undefined, []],
  ])('advises on the items asked per sitting: %s', (_, pool, itemCount, expected) => {
    expect(
      countAdvice((f) => {
        withPool(f, pool);
        if (itemCount !== undefined) obj(f, REVIEW_YAML)['assessment'] = { itemCount };
      }),
    ).toEqual(expected);
  });

  it.each<[string, (f: Files) => void, string]>([
    [
      'introduced concepts',
      (f) => {
        obj(f, REVIEW_YAML)['concepts'] = {
          primary: ['go.basics.package-main'],
          reviewed: ['go.basics.println'],
        };
        obj(f, LESSON_YAML)['concepts'] = { primary: ['go.basics.println'] };
      },
      '새 개념을 소개하지 않습니다',
    ],
    [
      'no assessed concepts',
      (f) => {
        obj(f, REVIEW_YAML)['concepts'] = {};
        obj(f, REVIEW_EXERCISE_YAML)['concepts'] = [{ id: 'go.basics.println', weight: 0.5 }];
      },
      '평가할 개념(concepts.reviewed)',
    ],
    [
      'a pass rule',
      (f) => {
        obj(f, REVIEW_YAML)['practice'] = { targetCount: 1, passRule: { minCorrect: 0.5 } };
      },
      'assessment.passRatio',
    ],
    [
      'a practice item in the unit',
      (f) => {
        obj(f, REVIEW_EXERCISE_YAML)['usage'] = 'practice';
      },
      'usage: assessment여야 합니다',
    ],
    [
      'an item outside the assessed concepts',
      (f) => {
        obj(f, REVIEW_EXERCISE_YAML)['concepts'] = [{ id: 'go.basics.package-main', weight: 1 }];
      },
      'concepts.reviewed에 없습니다',
    ],
    [
      'an assessment item in a regular lesson',
      (f) => {
        obj(f, EXERCISE_YAML)['usage'] = 'assessment';
      },
      '단원 평가(kind: assessment) 단원에만',
    ],
    [
      'assessment settings on a regular lesson',
      (f) => {
        obj(f, LESSON_YAML)['assessment'] = { itemCount: 5 };
      },
      'kind: assessment 단원에만',
    ],
    [
      'a module assessment that is not an assessment unit',
      (f) => {
        obj(f, MODULE_YAML)['assessment'] = 'first-program';
      },
      'kind: assessment 단원이 아닙니다',
    ],
    [
      'a module assessment outside the module',
      (f) => {
        obj(f, MODULE_YAML)['assessment'] = 'missing-review';
      },
      'lessons에 없는 단원',
    ],
  ])('reports %s', (_, patch, expected) => {
    expect(
      errorsOf(patch)
        .map((d) => d.message)
        .join('\n'),
    ).toContain(expected);
  });

  it('warns about an undeclared unit, uncovered concepts and an impossible item count', () => {
    const warnings = checkContent(
      writeContent((f) => {
        withAssessment(f);
        delete obj(f, MODULE_YAML)['assessment'];
        obj(f, REVIEW_YAML)['concepts'] = {
          reviewed: ['go.basics.println', 'go.basics.package-main'],
        };
        obj(f, REVIEW_YAML)['assessment'] = { itemCount: 1 };
      }),
    )
      .diagnostics.items.filter((d) => d.level === 'warning')
      .map((d) => d.message);
    expect(warnings).toEqual(
      expect.arrayContaining([
        '평가 문항이 없는 개념입니다: go.basics.package-main',
        'assessment.itemCount 1로는 평가할 개념 2개를 모두 다룰 수 없습니다',
        '단원 평가 단원을 assessment: start-review로 선언하세요(지금은 자동으로 연결합니다)',
      ]),
    );
  });
});

describe('checkContent: project units', () => {
  it('rejects a project unit and project items until Go execution exists (G-001)', () => {
    const errors = checkContent(
      writeContent((f) => {
        withProject(f);
        obj(f, EXERCISE_YAML)['usage'] = 'project';
      }),
    )
      .diagnostics.items.filter((d) => d.level === 'error')
      .map((d) => `${d.file} ${d.message}`);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`${PROJECT_YAML} 프로젝트 단원은 아직 쓸 수 없습니다`),
        expect.stringContaining(`${EXERCISE_YAML} usage: project 문제는 쓸 수 없습니다`),
      ]),
    );
  });
});
