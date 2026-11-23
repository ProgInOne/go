import { defineConfig } from 'vitest/config';

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
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
});
