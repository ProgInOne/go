import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '../../api/client.ts';

// `/go` API (G-002): the learner's Go, free runs and gofmt. Responses are validated like any
// other server output.

export const goToolchainSchema = z.object({
  status: z.enum(['ok', 'missing', 'too-old', 'broken']),
  version: z.string().nullable(),
  goBin: z.string().nullable(),
  minVersion: z.string(),
  contentVersion: z.string().nullable(),
  matchesContentVersion: z.boolean().nullable(),
  searched: z.array(z.string()),
});
export type GoToolchain = z.infer<typeof goToolchainSchema>;

const diagnosticSchema = z.object({
  file: z.string(),
  line: z.number(),
  column: z.number(),
  message: z.string(),
});
export type GoDiagnostic = z.infer<typeof diagnosticSchema>;

export const goRunSchema = z.discriminatedUnion('phase', [
  z.object({
    phase: z.literal('compile'),
    compile: z.discriminatedUnion('reason', [
      z.object({
        reason: z.literal('compile-error'),
        output: z.string(),
        diagnostics: z.array(diagnosticSchema),
        durationMs: z.number(),
      }),
      z.object({ reason: z.enum(['timeout', 'output-limit']), durationMs: z.number() }),
    ]),
  }),
  z.object({
    phase: z.literal('run'),
    compileMs: z.number(),
    run: z.object({
      reason: z.enum(['exit', 'panic', 'fatal', 'memory', 'timeout', 'output-limit', 'crash']),
      stdout: z.string(),
      stderr: z.string(),
      exitCode: z.number().nullable(),
      durationMs: z.number(),
      virtualMs: z.number(),
    }),
  }),
]);
export type GoRunResponse = z.infer<typeof goRunSchema>;

const formatSchema = z.union([
  z.object({ ok: z.literal(true), source: z.string() }),
  z.object({
    ok: z.literal(false),
    reason: z.literal('syntax-error'),
    output: z.string(),
    diagnostics: z.array(diagnosticSchema),
  }),
]);
export type GoFormatResponse = z.infer<typeof formatSchema>;

export const goToolchainQuery = queryOptions({
  queryKey: ['go', 'toolchain'],
  queryFn: ({ signal }) => api('/go/toolchain', { schema: goToolchainSchema, signal }),
  staleTime: 60_000,
});

export function useGoToolchain() {
  return useQuery(goToolchainQuery);
}

/** Looks for Go again (after the learner installs it) without restarting the app. */
export function useRefreshGoToolchain() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api('/go/toolchain/refresh', { method: 'POST', schema: goToolchainSchema }),
    onSuccess: (status) => {
      client.setQueryData(goToolchainQuery.queryKey, status);
    },
  });
}

export function runGo(source: string, stdin = '', signal?: AbortSignal): Promise<GoRunResponse> {
  return api('/go/run', {
    method: 'POST',
    body: { source, stdin },
    schema: goRunSchema,
    ...(signal ? { signal } : {}),
  });
}

export function formatGo(source: string): Promise<GoFormatResponse> {
  return api('/go/format', { method: 'POST', body: { source }, schema: formatSchema });
}
