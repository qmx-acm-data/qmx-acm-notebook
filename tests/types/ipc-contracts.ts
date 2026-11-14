import type {
  BoundaryHandlers,
  BoundaryRegister,
  InvokeArgs,
  InvokeName,
  InvokeResult,
  LegacyMethodName,
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
  const planned = bridge.plannerAction('addTask', { title: '复习', dueAt: '' });
  const layout = bridge.plannerAction('setLayout', { layout: 'compact' });
  // @ts-expect-error Action name and payload must match.
  bridge.plannerAction('setLayout', { title: 'wrong' });
  // @ts-expect-error Problem creation requires an official URL.
  bridge.plannerAction('addProblem', { title: 'wrong' });
  void [planned, layout];
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

  type SavedDocument = import('../../src/shared/models/ipc-services').SavedDocument;
  const newDocument = { clientId: '00000000-0000-0000-0000-000000000001', title: { legacy: true } };
  const existingDocument = { path: 'problems/example.md', sha: 'current-sha' };
  const bound: Promise<import('../../src/shared/models/ipc-services').PlatformSnapshot> = invoke('bindPlatform', 'CF', 'https://codeforces.com/profile/example');
  const refreshed = bridge.refreshPlatform('AT');
  const unbound = bridge.unbindPlatform('LG');
  const contests: Promise<import('../../src/shared/models/ipc-services').ContestSnapshot> = invoke('getContests');
  bridge.getContests(true);
  const synced: Promise<InvokeResult<'bootstrap'>> = bridge.sync();
  const submitted: Promise<SavedDocument> = invoke('submit', newDocument);
  const proposed: Promise<SavedDocument> = bridge.propose(newDocument);
  const document: Promise<SavedDocument> = bridge.saveDocument(existingDocument);
  const note: Promise<SavedDocument> = bridge.saveAlgorithmNote({ body: '# Note', noteScope: 'personal' });
  const topic = bridge.saveAlgorithmTopic({ parentId: 'root', label: 'DP', fullLabel: 'Dynamic programming', color: 'basic' });
  bridge.saveAlgorithmTopic({ parentId: 'root', label: 'Topics', fullLabel: 'Topics', kind: 'directory' });
  const deletedDocument = bridge.deleteDocument(existingDocument);
  const deletedIssue = bridge.deleteIssue({ number: 1, repo: 'owner/repo' });
  const commented: Promise<unknown> = bridge.comment({ number: '1', repo: 'owner/repo', body: 'Thanks' });
  const comments: Promise<import('../../src/shared/models/ipc-services').CommentSnapshot[]> = bridge.getComments(1);
  const settings: Promise<InvokeResult<'bootstrap'>> = bridge.saveSettings({ repositories: [{ repo: 'owner/repo' }], autoSync: true, codeFontSize: 14 });
  const login = bridge.login();
  const logout: Promise<InvokeResult<'bootstrap'>> = bridge.logout();
  const account: Promise<InvokeResult<'bootstrap'>> = bridge.refreshAccount();
  const startup: Promise<ProgressEvents['update-progress'] | null> = bridge.checkStartupUpdates();
  const checked: Promise<ProgressEvents['update-progress']> = bridge.checkForUpdates();
  const downloaded: Promise<ProgressEvents['update-progress']> = bridge.downloadUpdate();
  const installed: Promise<{ installing: boolean }> = bridge.installUpdate();
  const catalog = bridge.getTagCatalog();
  const requested = bridge.requestTag({ category: 'algorithm', name: 'DP' });
  const review = bridge.getTagReview();
  const reviewed = bridge.reviewTag({ number: 1, decision: 'approve', expected: { category: 'algorithm', name: 'DP', updatedAt: { raw: true } } });
  const legacyName: LegacyMethodName = 'reviewTag';
  void [bound, refreshed, unbound, contests, synced, submitted, proposed, document, note, topic, deletedDocument, deletedIssue, commented, comments, settings, login, logout, account, startup, checked, downloaded, installed, catalog, requested, review, reviewed, legacyName];
  // @ts-expect-error Service channels do not become boundary registrations before runtime migration.
  register('sync', () => { throw new Error('compile-only fixture'); });
  // @ts-expect-error Platform codes are exact, rather than arbitrary strings.
  invoke('bindPlatform', 'codeforces', 'https://codeforces.com/profile/example');
  // @ts-expect-error Binding requires the profile URL.
  bridge.bindPlatform('CF');
  // @ts-expect-error Refresh accepts exactly one platform.
  bridge.refreshPlatform('CF', true);
  // @ts-expect-error Unbind requires the platform.
  bridge.unbindPlatform();
  // @ts-expect-error Contest force flags must be booleans.
  invoke('getContests', 'force');
  // @ts-expect-error Sync has no renderer-selected repository.
  bridge.sync('owner/repo');
  // @ts-expect-error Submit requires an authored document, not a bare client ID.
  bridge.submit('client-id');
  // @ts-expect-error Propose shares saveDocument's creation/edit prerequisites.
  bridge.propose({ title: 'missing client ID' });
  // @ts-expect-error Existing document writes require the current SHA.
  bridge.saveDocument({ path: 'problems/example.md' });
  // @ts-expect-error Algorithm note writes require a Markdown body.
  bridge.saveAlgorithmNote({ title: 'missing body' });
  // @ts-expect-error Algorithm note body is checked as a string in main.
  bridge.saveAlgorithmNote({ body: 42 });
  // @ts-expect-error Existing algorithm notes need a SHA field even though its scalar stays raw.
  bridge.saveAlgorithmNote({ body: '# Note', path: 'algorithms/notes/example.md' });
  // @ts-expect-error Directory nodes cannot carry algorithm difficulty colors.
  bridge.saveAlgorithmTopic({ parentId: 'root', label: 'DP', fullLabel: 'DP', kind: 'directory', color: 'basic' });
  // @ts-expect-error Algorithm nodes require one of the accepted difficulty colors.
  bridge.saveAlgorithmTopic({ parentId: 'root', label: 'DP', fullLabel: 'DP', color: 'impossible' });
  // @ts-expect-error Document deletion needs a current SHA.
  bridge.deleteDocument({ path: 'problems/example.md' });
  // @ts-expect-error Issue deletion checks a numeric identifier without string coercion.
  bridge.deleteIssue({ repo: 'owner/repo', number: '1' });
  // @ts-expect-error Comments must supply their text and source repository.
  bridge.comment({ number: 1, repo: 'owner/repo' });
  // @ts-expect-error API response uncertainty does not loosen comment arguments.
  invoke('comment', { number: 1, repo: 'owner/repo', body: 42 });
  // @ts-expect-error Comment lookup accepts a numeric identifier, not an object.
  bridge.getComments({ number: 1 });
  // @ts-expect-error Settings updates use known field names.
  bridge.saveSettings({ colour: 'dark' });
  // @ts-expect-error Contest preferences are an array of strings.
  bridge.saveSettings({ contestOptOuts: [1] });
  // @ts-expect-error Device login does not accept renderer credentials.
  bridge.login('token');
  // @ts-expect-error Logout has no account argument.
  bridge.logout(1);
  // @ts-expect-error Account refresh has no account argument.
  bridge.refreshAccount(1);
  // @ts-expect-error Startup discovery takes no force flag.
  bridge.checkStartupUpdates(true);
  // @ts-expect-error Update checks take no release URL.
  bridge.checkForUpdates('https://example.org/');
  // @ts-expect-error Download uses the discovered release rather than a caller path.
  bridge.downloadUpdate('update.zip');
  // @ts-expect-error Installation uses the verified archive rather than a caller path.
  bridge.installUpdate('update.zip');
  // @ts-expect-error Catalog lookup has no category selector.
  bridge.getTagCatalog('algorithm');
  // @ts-expect-error Tag requests require a name.
  bridge.requestTag({ category: 'algorithm' });
  // @ts-expect-error Tag review lookup takes no account argument.
  bridge.getTagReview(1);
  // @ts-expect-error Review action names must match the implemented decisions.
  bridge.reviewTag({ number: 1, decision: 'delete', expected: { category: 'algorithm', name: 'DP' } });
  // @ts-expect-error Review writes require the latest request snapshot.
  bridge.reviewTag({ number: 1, decision: 'reject' });
  // @ts-expect-error Raw comment POST output cannot promise an API object.
  const wrongComment: Promise<{ id: number }> = commented;
  // @ts-expect-error Startup checks can resolve null when busy or unavailable.
  const wrongStartup: Promise<ProgressEvents['update-progress']> = startup;
  // @ts-expect-error Parsed saves can return an algorithm note depending on the path.
  const wrongDocument: Promise<import('../../src/shared/models/records').DocumentRecord> = document;
  void [wrongComment, wrongStartup, wrongDocument];

  void comments.then(values => {
    const body: unknown = values[0]?.body;
    // @ts-expect-error Projecting a provider field does not validate it as Markdown text.
    const text: string = values[0]!.body;
    void [body, text];
  });
  void catalog.then(value => {
    const name: string | undefined = value.categories[0]?.tags[0]?.name;
    const categoryId: unknown = value.categories[0]?.id;
    void [name, categoryId];
  });
  void requested.then(value => {
    if (!value) return;
    const name: string = value.name;
    // @ts-expect-error Provider issue IDs are returned without scalar validation.
    const number: number = value.number;
    void [name, number];
  });
  void login.then(value => {
    const id: number = value.id;
    const picture: string | null = value.avatarData;
    // @ts-expect-error Provider display names remain unvalidated API values.
    const name: string = value.name;
    void [id, picture, name];
  });
  void topic.then(value => {
    const author: string = value.createdBy.login;
    // @ts-expect-error Idempotent topic replay may retain a regex-coerced persisted ID.
    const id: string = value.id;
    void [author, id];
  });

  const operations: BoundaryHandlers = {
    openExternal: async (_url) => {},
    openAuthUrl: (_url) => false,
    formatCode: (source, _language) => ({ code: source }),
    cancelLogin: () => {},
    exportLocal: async () => true,
    bootstrap: async () => { throw new Error('compile-only fixture'); },
    updateLocal: data => ({ records: data.records, favorites: [], mastery: {}, draft: {} }),
    plannerAction: (..._args) => ({ problems: [], tasks: [], layout: 'compact' })
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
