import { Hono } from 'hono';
import { z } from 'zod';
import { GoUnavailableError, type GoService } from '../../services/go/go-service.ts';
import type { AppEnv } from '../env.ts';
import { AppError } from '../errors.ts';
import { jsonBody, limitBody } from './input.ts';

/** Source and standard input caps for one free run (G-002). */
const MAX_SOURCE_CHARS = 64 * 1024;
const MAX_STDIN_CHARS = 64 * 1024;

const runBodySchema = z.strictObject({
  source: z.string().min(1).max(MAX_SOURCE_CHARS),
  stdin: z.string().max(MAX_STDIN_CHARS).default(''),
});
const formatBodySchema = z.strictObject({ source: z.string().max(MAX_SOURCE_CHARS) });

function unavailable(e: GoUnavailableError): AppError {
  const message =
    e.status.status === 'too-old'
      ? `Go ${e.status.minVersion.slice(2)} 이상이 필요해요. 지금 찾은 Go는 ${e.status.version ?? '알 수 없음'}이에요.`
      : 'Go를 찾지 못했어요. Go를 설치한 뒤 다시 확인해 주세요.';
  return new AppError('EXERCISE_NOT_RUNNABLE', 409, message, {
    details: { reason: 'go-unavailable', toolchain: e.status },
  });
}

async function withGo<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (e) {
    if (e instanceof GoUnavailableError) throw unavailable(e);
    throw e;
  }
}

/**
 * `/go`: the learner's Go toolchain, free runs and `gofmt` (G-002). Graded runs go through the
 * attempt routes, which keep answer keys on the server.
 */
export function goRoutes(service: GoService) {
  return new Hono<AppEnv>()
    .get('/toolchain', (c) => c.json(service.status()))
    .post('/toolchain/refresh', async (c) => c.json(await service.refresh()))
    .post('/run', limitBody(512 * 1024), async (c) => {
      const body = runBodySchema.parse(await jsonBody(c));
      const result = await withGo(() => service.runProgram(body.source, body.stdin));
      if (result.phase === 'compile') {
        const compile = result.compile;
        if (compile.reason === 'internal') {
          throw new AppError('INTERNAL', 500, '코드를 컴파일하지 못했어요.', {
            cause: new Error(compile.message),
          });
        }
        return c.json({
          phase: 'compile' as const,
          compile:
            compile.reason === 'compile-error'
              ? {
                  reason: compile.reason,
                  output: compile.output,
                  diagnostics: compile.diagnostics,
                  durationMs: compile.durationMs,
                }
              : { reason: compile.reason, durationMs: compile.durationMs },
        });
      }
      // The service logged it; it is for us, not for learners.
      const { internalMessage: _internal, ...run } = result.run;
      return c.json({ phase: 'run' as const, compileMs: result.compileMs, run });
    })
    .post('/format', limitBody(512 * 1024), async (c) => {
      const body = formatBodySchema.parse(await jsonBody(c));
      const result = await withGo(() => service.format(body.source));
      if (result.ok || result.reason === 'syntax-error') return c.json(result);
      if (result.reason === 'too-large') {
        throw new AppError('VALIDATION_FAILED', 413, '코드가 너무 길어서 정리하지 못했어요.');
      }
      throw new AppError('INTERNAL', 500, 'gofmt를 실행하지 못했어요.', {
        retryable: result.reason === 'timeout',
        cause: new Error(result.message),
      });
    });
}
