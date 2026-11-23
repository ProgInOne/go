import { describe, expect, it } from 'vitest';
import { docUrlOf, goConceptSchema, goCourseSchema } from './schema.ts';

// This repository's language kit over the common content schemas (JS D-092).
describe('Go language kit schemas', () => {
  const course = {
    id: 'go-basics',
    title: 'Go 기초',
    summary: 's',
    language: 'go',
    level: 'intro',
    objectives: ['o'],
    modules: ['start'],
  };
  const concept = { id: 'go.vars.short', title: ':=', importance: 'core', summary: 's' };

  it('serves only go courses', () => {
    expect(goCourseSchema.safeParse(course).success).toBe(true);
    expect(goCourseSchema.safeParse({ ...course, language: 'javascript' }).success).toBe(false);
  });

  it('keeps a go.dev or pkg.go.dev reference URL', () => {
    const spec = 'https://go.dev/ref/spec#Short_variable_declarations';
    expect(docUrlOf(goConceptSchema.parse({ ...concept, doc: spec }))).toBe(spec);
    expect(docUrlOf(goConceptSchema.parse({ ...concept, doc: 'https://pkg.go.dev/fmt' }))).toBe(
      'https://pkg.go.dev/fmt',
    );
    expect(docUrlOf(goConceptSchema.parse(concept))).toBeNull();
    for (const doc of ['https://example.com/x', 'http://go.dev/ref/spec', 'go.dev/ref/spec']) {
      expect(goConceptSchema.safeParse({ ...concept, doc }).success).toBe(false);
    }
  });
});
