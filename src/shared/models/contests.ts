/** Official platforms exposed by the synchronous contest-listing parsers. */
export type ContestSourceId = 'codeforces' | 'atcoder' | 'luogu' | 'nowcoder';

export interface Contest {
  id: string;
  title: string;
  url: string;
  /** ISO datetime strings produced by Date.toISOString(), including the UTC suffix. */
  startTime: string;
  endTime: string;
}

/** Metadata is frozen at runtime; each parse returns a fresh, mutable contest array. */
export interface ContestSource<
  Id extends ContestSourceId = ContestSourceId,
  Name extends string = string,
  Url extends string = string,
  Endpoint extends string = string,
> {
  readonly id: Id;
  readonly name: Name;
  readonly url: Url;
  readonly endpoint: Endpoint;
  /** External response values are checked before any platform-specific parsing. */
  readonly parse: (text: unknown) => Contest[];
}
