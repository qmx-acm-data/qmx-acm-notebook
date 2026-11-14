import { parseDocument, parseAlgorithmNote, issueRecord, validatePath } from '../../src/main/records/parser.cjs';
import { createAuth } from '../../src/main/auth/auth.cjs';
import { createPlannerService } from '../../src/main/planner/service.cjs';
import type { PlannerSnapshot } from '../../src/shared/models/planner.js';

function assertions(): void {
  const document = parseDocument('problems/old.md', 'body');
  const title: string = document.title;
  const overridden = parseDocument('problems/old.md', 'body', { title: 42, kind: false, legacy: { retained: true } });
  const alternateTitle: number = overridden.title;
  const alternateKind: boolean = overridden.kind;
  // @ts-expect-error Extra fields overwrite parser scalars; they are not validated.
  const promisedTitle: string = overridden.title;
  const note = parseAlgorithmNote('algorithms/old.md', 'body', { title: null, kind: false });
  const noteKind: 'algorithm-note' = note.kind;
  const noteTitle: null = note.title;
  const issue = issueRecord({ number: 'legacy', title: false, body: '', labels: [{ name: 42 }] });
  // @ts-expect-error Issue numbers are copied without validation.
  const issueNumber: number = issue.number;
  const validPath: string = validatePath('problems/old.md');
  const auth = createAuth({
    safeStorage: { isEncryptionAvailable: () => true, encryptString: value => Buffer.from(value), decryptString: value => value.toString() },
    readAuth: () => ({ opaque: true }), saveAuth: () => {}
  });
  const login: string | undefined = auth.account?.login;
  const opaque: unknown = auth.account?.opaque;
  const planner = createPlannerService({ read: () => ({ opaque: true }), save: () => {} });
  const snapshot: PlannerSnapshot = planner.state();
  const url: string = snapshot.problems[0].url;
  const dueAt: string = snapshot.tasks[0].dueAt;
  // @ts-expect-error Tasks do not promise a problem URL.
  const taskUrl: string = snapshot.tasks[0].url;
  void [title, alternateTitle, alternateKind, promisedTitle, noteKind, noteTitle, issueNumber, validPath, login, opaque, url, dueAt, taskUrl];
}
void assertions;
