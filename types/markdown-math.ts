/** Structural contracts for the standalone Markdown/KaTeX helper; types only. */
import type { MarkdownTableToken, MarkdownTokenizer } from './markdown';

export interface MarkdownMathFormula {
  raw: string;
  text: string;
  display: boolean;
}

export interface MarkdownMathToken extends MarkdownMathFormula {
  type: 'notebookMathBlock' | 'notebookMathInline';
}

export interface MarkdownMathExtension {
  name: MarkdownMathToken['type'];
  level: 'block' | 'inline';
  start(source: string): number | undefined;
  tokenizer(source: string): MarkdownMathToken | undefined;
  renderer(token: MarkdownMathToken): string;
}

export interface MarkdownMathMarkedOptions {
  gfm: true;
  breaks: false;
  renderer: { checkbox(token: { checked: boolean }): string };
  tokenizer: {
    table(this: MarkdownTokenizer, source: string): MarkdownTableToken | false;
  };
  extensions: MarkdownMathExtension[];
}

export interface MarkdownMathParser {
  parse(source: string): string;
}

export interface MarkdownMathMarked {
  Marked: new (options: MarkdownMathMarkedOptions) => MarkdownMathParser;
}

export type MarkdownMathMacros = Record<string, unknown>;

export interface MarkdownMathRenderOptions {
  displayMode: boolean;
  throwOnError: true;
  trust: false;
  strict: 'ignore';
  maxExpand: 1000;
  maxSize: 20;
  macros: MarkdownMathMacros;
  globalGroup: true;
  output: 'htmlAndMathml';
}

export interface MarkdownMathKatex {
  render(text: string, node: HTMLElement, options: MarkdownMathRenderOptions): void;
}

export type MarkdownMathContainer = ParentNode & { ownerDocument: Document };

export interface MarkdownMathApi {
  parse(source: string, marked: MarkdownMathMarked): string;
  render(container: MarkdownMathContainer, katex?: MarkdownMathKatex | null): void;
}
