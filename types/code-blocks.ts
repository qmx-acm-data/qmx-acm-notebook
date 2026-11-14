import type { FormatCodeResult } from '../src/shared/contracts/notebook';

/** Browser previews may supply a synchronous formatter or no result. */
export type CodeBlockFormatResult = string | FormatCodeResult | null | undefined;
export type CodeBlockFormatter = (source: string, language: string) =>
  CodeBlockFormatResult | PromiseLike<CodeBlockFormatResult>;

/** App callbacks captured by each independently created helper instance. */
export interface CodeBlocksOptions {
  toast(message: string): void;
  errorMessage(error: unknown): string;
}

export interface CodeBlocksController {
  highlightCodeBlock(code: HTMLElement): void;
  decorateCodeBlocks(container: ParentNode): void;
  codeBlockClick(event: Event): void;
}

export interface CodeBlocksApi {
  create(options: CodeBlocksOptions): CodeBlocksController;
}

/** Only the Prism operation used by the code-block helpers is required. */
export interface CodeBlocksPrism {
  highlightElement(code: HTMLElement): void;
}

export interface CodeBlockActionButton extends HTMLButtonElement {
  _codeResetTimer?: number;
}

declare global {
  interface Window {
    Prism?: CodeBlocksPrism;
    formatCode?: CodeBlockFormatter;
  }
}
