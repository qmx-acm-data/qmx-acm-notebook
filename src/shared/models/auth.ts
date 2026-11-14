/** Identity fields checked by auth; provider/cache extras are retained unchanged. */
export interface AuthAccount extends Record<string, unknown> {
  id: number;
  login: string;
}

export type AuthStatusValue =
  | 'anonymous'
  | 'recovery-required'
  | 'expired'
  | 'restored'
  | 'verified'
  | 'unverified';

export type AuthStatusCode =
  | 'credential-read-failed'
  | 'credential-format-invalid'
  | 'keychain-unavailable'
  | 'credential-decrypt-failed'
  | 'credential-save-failed'
  | 'credential-invalidation-save-failed'
  | 'http-401'
  | 'http-403'
  | 'http-429'
  | 'http-other'
  | 'network-unavailable';

export interface AuthStatus {
  status: AuthStatusValue;
  code: AuthStatusCode | null;
  transport: 'electron-net';
  /** Absent until the first status report. */
  checkedAt?: string;
}

/** Both generation and token must match before an asynchronous result is used. */
export interface AuthTicket {
  revision: number;
  token: string;
}
