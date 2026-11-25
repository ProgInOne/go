import { CodeEditor, type CodeEditorProps } from '@proginone/exercise-ui';
import { GO_LANGUAGE } from './language.ts';

/**
 * The shared code editor set up for Go. Loaded lazily (`React.lazy`) so CodeMirror stays out of
 * the first page load; lesson code is shown as plain text until the learner edits it.
 */
export default function GoEditor(props: Omit<CodeEditorProps, 'language'>) {
  return <CodeEditor {...props} language={GO_LANGUAGE} />;
}
