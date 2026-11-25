import { go } from '@codemirror/lang-go';
import { FormatError, type EditorLanguageSupport } from '@proginone/exercise-ui';
import { formatGo } from './api.ts';

/**
 * Go for the shared code editor (JS D-096 injection point, G-002): CodeMirror's Go mode, tab
 * indentation shown 4 columns wide like gofmt, and the learner's own gofmt on the server.
 */
export const GO_LANGUAGE: EditorLanguageSupport = {
  id: 'go',
  matchesPath: (path) => path.endsWith('.go'),
  extension: () => go(),
  indentUnit: '\t',
  tabSize: 4,
  format: async (code) => {
    const result = await formatGo(code);
    if (result.ok) return result.source;
    throw new FormatError(result.diagnostics[0]?.line);
  },
};
