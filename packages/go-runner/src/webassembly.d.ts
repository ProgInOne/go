/**
 * The part of the WebAssembly JS API this package uses. TypeScript declares it only in the DOM
 * library and `@types/node` does not, so files that use it import this file's types (which also
 * brings them along when another package imports those files).
 */
export {};

declare global {
  // Mirrors lib.dom.d.ts, where these are classes with static members.
  /* eslint-disable @typescript-eslint/no-extraneous-class */
  namespace WebAssembly {
    type ImportExportKind = 'function' | 'table' | 'memory' | 'global' | 'tag';

    interface ModuleImportDescriptor {
      module: string;
      name: string;
      kind: ImportExportKind;
    }

    class Module {
      constructor(bytes: Uint8Array);
      static imports(module: Module): ModuleImportDescriptor[];
    }

    class Instance {
      constructor(module: Module, importObject?: Record<string, Record<string, unknown>>);
      readonly exports: Record<string, unknown>;
    }

    class Memory {
      constructor(descriptor: { initial: number; maximum?: number });
      readonly buffer: ArrayBuffer;
      grow(delta: number): number;
    }
  }
  /* eslint-enable @typescript-eslint/no-extraneous-class */
}
