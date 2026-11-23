/**
 * Dependency rules. Rules about published @proginone/* packages (node_modules, excluded here)
 * live in eslint.config.js.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: '순환 의존은 금지합니다.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'web-not-to-server',
      severity: 'error',
      comment: '웹은 서버 코드를 직접 가져오지 않습니다(타입은 @proginone/shared로 공유).',
      from: { path: '^apps/web/' },
      to: { path: '^apps/server/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'packages-not-to-apps',
      severity: 'error',
      comment: '패키지는 앱에 의존하지 않습니다.',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'pure-packages-no-io',
      severity: 'error',
      comment: 'exercise-kit는 I/O 없는 순수 함수입니다(채점은 서버 경계 밖의 부수 효과가 없음).',
      from: { path: '^packages/exercise-kit/' },
      to: {
        dependencyTypes: ['core'],
        path: '^(fs|node:fs|net|node:net|http|node:http|child_process|node:child_process)',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage|node_modules)/' },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs'],
    },
  },
};
