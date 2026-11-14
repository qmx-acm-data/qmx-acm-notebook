import type {
  BoundaryHandlers,
  BoundaryRegister,
  InvokeArgs,
  InvokeName,
  InvokeResult,
  NotebookBridge,
  ProgressEvents
} from '../../src/shared/contracts/notebook';

type Invoke = <K extends InvokeName>(name: K, ...args: InvokeArgs<K>) => Promise<InvokeResult<K>>;
type Subscribe = <K extends keyof ProgressEvents>(name: K, callback: (data: ProgressEvents[K]) => void) => () => void;

/** Compile-only assertions. This function is deliberately never called. */
function contractAssertions(invoke: Invoke, register: BoundaryRegister, subscribe: Subscribe, bridge: NotebookBridge): void {
  const opened: Promise<void> = invoke('openExternal', 'https://example.org/');
  const chromeLaunched: Promise<boolean> = invoke('openAuthUrl', 'https://github.com/login/device');
  const formatted: Promise<{ code: string; error?: string }> = bridge.formatCode('int main(){}', 'cpp');
  const loaded: Promise<import('../../src/shared/models/bootstrap').BootstrapPayload> = bridge.bootstrap();
  const saved = bridge.updateLocal({ records: [{ id: 'local:old', kind: 'local', extra: { old: true } }], draft: null });
  void [loaded, saved];
  // @ts-expect-error Local writes require records.
  bridge.updateLocal({ favorites: [] });
  // @ts-expect-error updateLocal rejects non-string incoming IDs at runtime.
  bridge.updateLocal({ records: [{ id: 42 }] });
  // @ts-expect-error Bootstrap has no caller-selected repository argument.
  bridge.bootstrap('other/repo');
  const canceled: Promise<void> = bridge.cancelLogin();
  const exported: Promise<boolean> = bridge.exportLocal();
  void [opened, chromeLaunched, formatted, canceled, exported];

  // @ts-expect-error Channel names are exact; arbitrary IPC is not exposed.
  invoke('open-external', 'https://example.org/');
  // @ts-expect-error Browser URLs must be strings.
  invoke('openExternal', 42);
  // @ts-expect-error Formatting needs the language argument.
  invoke('formatCode', 'int main(){}');
  // @ts-expect-error Cancel does not accept a login identifier.
  invoke('cancelLogin', 'old-login');
  // @ts-expect-error Export does not accept a renderer-chosen destination.
  bridge.exportLocal('/tmp/backup.json');
  // @ts-expect-error Default browser fallback is represented by a boolean, not an object.
  const wrongAuthResult: Promise<{ success: boolean }> = invoke('openAuthUrl', 'https://github.com/login/device');
  // @ts-expect-error openExternal has no boolean success result.
  const wrongOpenResult: Promise<boolean> = bridge.openExternal('https://example.org/');
  // @ts-expect-error Export returns a boolean rather than an Electron dialog object.
  const wrongExportResult: Promise<{ canceled: boolean }> = bridge.exportLocal();
  void [wrongAuthResult, wrongOpenResult, wrongExportResult];

  const operations: BoundaryHandlers = {
    openExternal: async (_url) => {},
    openAuthUrl: (_url) => false,
    formatCode: (source, _language) => ({ code: source }),
    cancelLogin: () => {},
    exportLocal: async () => true,
    bootstrap: async () => { throw new Error('compile-only fixture'); },
    updateLocal: data => ({ records: data.records, favorites: [], mastery: {}, draft: {} })
  };
  register('openExternal', operations.openExternal);
  register('formatCode', operations.formatCode);
  register('cancelLogin', operations.cancelLogin);
  // @ts-expect-error Bootstrap must return the actual state envelope, not an empty object.
  register('bootstrap', () => ({}));
  // @ts-expect-error Main auth operations must return a boolean or thenable boolean.
  register('openAuthUrl', (_url: string) => 'chrome');
  // @ts-expect-error Main formatter results need code, including on error.
  register('formatCode', (_source: string, _language: string) => ({ error: 'failed' }));
  // @ts-expect-error Main export must not return a dialog object.
  register('exportLocal', () => ({ canceled: true }));

  const stopAuth: () => void = bridge.onAuthProgress(progress => {
    const userCode: unknown = progress.userCode;
    const url: unknown = progress.url;
    const expiresIn: unknown = progress.expiresIn;
    void [userCode, url, expiresIn];
    // @ts-expect-error Raw OAuth JSON has not guaranteed a string.
    const code: string = progress.userCode;
    // @ts-expect-error Only the actual emitted auth field names are modeled.
    progress.verificationUri;
    void code;
  });
  const stopUpdate: () => void = subscribe('update-progress', progress => {
    const downloaded: number = progress.downloaded;
    const version: string | null = progress.latestVersion;
    void [downloaded, version];
    // @ts-expect-error Update progress does not expose the verified archive path.
    progress.path;
    // @ts-expect-error Installing is renderer state, not an updater progress phase.
    const phase: typeof progress.phase = 'installing';
    void phase;
  });
  // @ts-expect-error Progress event channels are exact.
  subscribe('authProgress', () => {});
  // @ts-expect-error Auth listeners receive auth payloads, not updater state.
  bridge.onAuthProgress((progress: ProgressEvents['update-progress']) => { void progress; });
  stopAuth();
  stopUpdate();
}
void contractAssertions;
