import { Annotation } from '@langchain/langgraph'

/** Each field uses a reducer; we use "replace" for most (last-writer wins). */
export const AnalysisAnnotation = Annotation.Root({
  /** Input */
  errorEventId: Annotation<string>({ reducer: (_, x) => x }),
  projectId: Annotation<string>({ reducer: (_, x) => x }),
  appId: Annotation<string>({ reducer: (_, x) => x }),
  version: Annotation<string>({ reducer: (_, x) => x }),
  /** Absolute or relative path to the project source root on the backend machine.
   *  When set, resolvedStack frames are used to read source files directly. */
  sourceRoot: Annotation<string | null>({ reducer: (_, x) => x, default: () => null }),

  /** Raw error payload from the ErrorEvent */
  rawError: Annotation<Record<string, unknown>>({ reducer: (_, x) => x }),

  /** Stack frames resolved via Source Map */
  resolvedStack: Annotation<
    Array<{ source: string | null; line: number | null; column: number | null; name: string | null; resolved: boolean }>
  >({
    reducer: (_, x) => x,
    default: () => [],
  }),

  /** Code snippets retrieved from the vector store */
  relatedCode: Annotation<string[]>({ reducer: (_, x) => x, default: () => [] }),

  /** LLM root-cause diagnosis */
  diagnosis: Annotation<string>({ reducer: (_, x) => x, default: () => '' }),

  /** LLM suggested fix / patch */
  suggestedFix: Annotation<string>({ reducer: (_, x) => x, default: () => '' }),

  /** Review note — quality check on the suggestion */
  reviewNote: Annotation<string>({ reducer: (_, x) => x, default: () => '' }),

  /** Any non-fatal error messages accumulated during the flow */
  warnings: Annotation<string[]>({
    reducer: (prev, x) => [...prev, ...x],
    default: () => [],
  }),
})

export type AnalysisState = typeof AnalysisAnnotation.State
