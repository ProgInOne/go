import { conceptSchema, courseSchema } from '@proginone/content-schema';
import { z } from 'zod';

/**
 * This repository's language kit on top of the common content schemas (JS D-092). The common
 * schemas leave language-specific values open; here they are narrowed or added. Always extend the
 * common schema; never redefine it.
 */

/** Course languages this repository serves. */
export const COURSE_LANGUAGES = ['go'] as const;
export type CourseLanguage = (typeof COURSE_LANGUAGES)[number];

/** courses/<course>/course.yaml */
export const goCourseSchema = courseSchema.extend({ language: z.enum(COURSE_LANGUAGES) });
export type GoCourseSource = z.infer<typeof goCourseSchema>;

/** Hosts a concept's reference document may live on: the Go site and the package docs. */
const DOC_URL = /^https:\/\/(go\.dev|pkg\.go\.dev)\/[\w./#%-]*$/;

/** One entry of content/concepts/<file>.yaml, with the official reference document. */
export const goConceptSchema = conceptSchema.extend({
  /** Full URL on go.dev or pkg.go.dev, e.g. `https://go.dev/ref/spec#Short_variable_declarations`. */
  doc: z.string().regex(DOC_URL, 'go.dev 또는 pkg.go.dev의 https 주소여야 합니다').optional(),
});
export type GoConceptSource = z.infer<typeof goConceptSchema>;
export const goConceptsFileSchema = z.array(goConceptSchema);

/** The reference document URL stored in content.db `concepts.doc_url`. */
export const docUrlOf = (concept: GoConceptSource): string | null => concept.doc ?? null;
