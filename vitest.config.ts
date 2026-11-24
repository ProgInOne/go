import { defineConfig } from 'vitest/config';

const WEB_TESTS = 'apps/web/src/**/*.test.{ts,tsx}';

export default defineConfig({
  test: {
    // Puts every test's temporary folders under one root and removes it after the run.
    globalSetup: ['tools/vitest-global-setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['{apps,packages,tools}/*/{src,scripts}/**/*.test.{ts,tsx}', 'tools/*.test.ts'],
          exclude: ['**/node_modules/**', WEB_TESTS],
        },
      },
      {
        // React components need a DOM; everything else stays on plain Node.
        extends: true,
        test: {
          name: 'web',
          environment: 'jsdom',
          include: [WEB_TESTS],
          setupFiles: ['apps/web/src/test/jsdom-setup.ts', 'apps/web/src/test/setup.ts'],
        },
      },
    ],
  },
});
