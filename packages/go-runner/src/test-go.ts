import { findGoToolchain, type GoToolchain } from './toolchain.ts';

/**
 * The Go these tests compile with. CI installs it (`actions/setup-go`, `.go-version`); locally,
 * tests that need Go are skipped when none is found.
 */
export async function testToolchain(): Promise<GoToolchain | null> {
  const lookup = await findGoToolchain();
  if (lookup.status === 'ok') return lookup.toolchain;
  if (process.env['CI'])
    throw new Error(`CI needs Go for go-runner tests: ${JSON.stringify(lookup)}`);
  return null;
}
