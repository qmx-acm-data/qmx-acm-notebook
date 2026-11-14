/** Structural contracts for the standalone Markdown helpers; types only. */
export interface MarkdownMathToken {
  raw: string;
}

export type MarkdownFormula = (source: string) => MarkdownMathToken | undefined;

export interface MarkdownTokenizer {
  rules: {
    block: { table: RegExp };
    other: {
      tableDelimiter: RegExp;
      tableAlignChars: RegExp;
      tableAlignRight: RegExp;
      tableAlignCenter: RegExp;
      tableAlignLeft: RegExp;
      tableRowBlankLine: RegExp;
    };
  };
  lexer: { inline(source: string): unknown[] };
}

export type MarkdownTableAlignment = 'right' | 'center' | 'left' | null;

export interface MarkdownTableCell {
  text: string;
  tokens: unknown[];
  header: boolean;
  align: MarkdownTableAlignment;
}

export interface MarkdownTableToken {
  type: 'table';
  raw: string;
  header: MarkdownTableCell[];
  align: MarkdownTableAlignment[];
  rows: MarkdownTableCell[][];
}

export interface MarkdownTableApi {
  tokenize(source: string, tokenizer: MarkdownTokenizer, formula: MarkdownFormula): MarkdownTableToken | undefined;
}

export interface MarkdownColorNode {
  nodeName: string;
  getAttribute(name: string): string | null;
}

export interface MarkdownColorDocument {
  createElement(tagName: 'span'): { style: { color: string } };
}

export type MarkdownSanitizeElementHook = (node: Node) => void;

export interface MarkdownSanitizeOptions {
  FORBID_TAGS: string[];
  FORBID_ATTR: string[];
  RETURN_DOM_FRAGMENT: true;
}

export interface MarkdownPurifier {
  addHook(name: 'uponSanitizeElement', hook: MarkdownSanitizeElementHook): void;
  removeHook(name: 'uponSanitizeElement', hook: MarkdownSanitizeElementHook): unknown;
  sanitize(html: string, options: MarkdownSanitizeOptions): DocumentFragment;
}

export interface MarkdownColorApi {
  sanitize(html: string, purifier: MarkdownPurifier, document: MarkdownColorDocument): DocumentFragment;
}

export interface MarkdownGlobal {
  NotebookMarkdownTable?: Readonly<MarkdownTableApi>;
  NotebookMarkdownColor?: Readonly<MarkdownColorApi>;
}
