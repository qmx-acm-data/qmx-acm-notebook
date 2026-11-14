'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const YAML = require('yaml');

const root = path.resolve(__dirname, '..');
const readWorkflow = name => YAML.parse(fs.readFileSync(path.join(root, '.github', 'workflows', name), 'utf8'));

test('release workflow runs manually from main and isolates signing from tag source', () => {
  const workflow = readWorkflow('release.yml');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.jobs.trust.env.GH_TOKEN, '${{ github.token }}');
  assert.match(workflow.jobs.trust.steps.find(step => step.name?.includes('validated stable tag')).run, /gh auth setup-git/);
  assert.doesNotMatch(workflow.jobs['windows-build'].steps.map(step => JSON.stringify(step)).join('\n'), /secrets\.QMX_UPDATE_SIGNING_KEY_PEM/);

  const signer = workflow.jobs['sign-feed'];
  assert.deepEqual(signer.needs, ['trust', 'windows-build']);
  assert.equal(signer.steps[0].uses, 'actions/checkout@v4');
  assert.equal(signer.steps[0].with.ref, '${{ github.sha }}');
  assert.equal(signer.steps.find(step => step.name?.startsWith('Sign using trusted')).env.QMX_UPDATE_SIGNING_KEY_PEM, '${{ secrets.QMX_UPDATE_SIGNING_KEY_PEM }}');
  const signing = signer.steps.find(step => step.name?.startsWith('Sign using trusted')).run;
  assert.match(signing, /node tools\/update-manifest\.cjs --root-dir signing-root/);
  assert.match(signing, /node tools\/delta-feed\.cjs build --root-dir signing-root --base resources\/app\.asar --base-manifest feed\/manifest\.json/);
  assert.deepEqual(signer.steps.find(step => step.uses === 'actions/upload-artifact@v4').with.path.trim().split('\n'), ['signing-root/feed/manifest.json', 'signing-root/feed/delta.json', 'signing-root/resources/app.asar', 'signing-root/resources/deltas/**']);
});

test('release trust compares the complete build graph to the exact workflow checkout before running tag code', () => {
  const workflow = readWorkflow('release.yml');
  const trust = workflow.jobs.trust;
  const checkout = trust.steps[0];
  assert.equal(checkout.with.ref, '${{ github.sha }}');
  assert.equal(checkout.with['persist-credentials'], false);
  const guard = trust.steps.find(step => step.id === 'guard').run;
  assert.match(guard, /git diff --no-ext-diff --no-textconv --quiet "\$GITHUB_SHA" "\$TAG_COMMIT" -- "\$INPUT"/);
  assert.doesNotMatch(guard, /git (?:checkout|switch)|pnpm (?:install|check|test|package)/);
  assert.ok(guard.indexOf('TRUSTED_INPUTS=(') < guard.indexOf('VERSION=$(git show'));
  for (const name of ['windows-build', 'windows-package', 'unix']) {
    const job = workflow.jobs[name];
    assert.ok(Array.isArray(job.needs) ? job.needs.includes('trust') : job.needs === 'trust');
    assert.equal(job.steps[0].with.ref, '${{ needs.trust.outputs.release_sha }}');
  }
  for (const name of ['signing-check', 'sign-feed', 'draft']) {
    assert.equal(workflow.jobs[name].steps[0].with.ref, '${{ github.sha }}');
  }
});

test('the workflow comparison rejects source, generator, config and dependency drift with unchanged tracked JS', t => {
  const workflow = readWorkflow('release.yml');
  const guard = workflow.jobs.trust.steps.find(step => step.id === 'guard').run;
  // Execute the actual array and comparison loop, never network/signing commands.
  const comparison = guard.slice(guard.indexOf('TRUSTED_INPUTS=('), guard.indexOf('VERSION=$(git show'));
  assert.ok(comparison.startsWith('TRUSTED_INPUTS=('));
  assert.match(comparison, /exit 1/);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qmx-release-trust-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const git = args => {
    const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const write = (name, text) => {
    const file = path.join(directory, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  git(['init', '--quiet']);
  git(['config', 'core.autocrlf', 'false']);
  git(['config', 'user.name', 'Release trust test']);
  git(['config', 'user.email', 'release-trust@example.invalid']);
  const guarded = [
    '.github/workflows/release.yml', '.github/workflows/ci.yml', '.github/workflows/activate-update.yml',
    'src/main/update/updater.cts', 'src/main/app/main.cts', 'src/renderer/reading/reading-detail.ts',
    'src/preload/preload.ts', 'src/shared/models/delta.ts', 'src/tools/package.cts', 'src/server/server.cts',
    'tools/build-app.cjs', 'tools/build-modules.cjs', 'tools/build-reading-detail.cjs',
    'tools/build-preload.cjs', 'tools/build-ipc-boundary.cjs',
    'tools/package.cjs', 'tools/installer.cjs', 'tools/update-manifest.cjs', 'tools/release-feed.cjs', 'tools/delta-feed.cjs',
    'electron/updater.cjs', 'electron/update-key.cjs', 'electron/delta-codec.cjs', 'electron/delta-manifest.cjs',
    'electron/delta-chain.cjs', 'electron/main.cjs', 'electron/preload.cjs', 'ui/reading-detail.js', 'ui/index.html', 'server.js',
    'tsconfig.json', 'tsconfig.node.json', 'tsconfig.modules.json', 'tsconfig.preload.json', 'tsconfig.boundary.json',
    'types/notebook-window.ts', 'tests/types/notebook.ts', 'tests/types-node/updater.cts', 'tests/app-path.cjs',
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc', '.pnpmfile.cjs', '.pnpmfile.mjs',
    'pnpmfile.cjs', 'patches/compiler.patch', '.gitattributes',
    'data/algorithm-directory.json', 'data/algorithm-learning-path.json'
  ];
  for (const file of guarded) write(file, 'reviewed\n');
  git(['add', '.']);
  // Tree objects suffice: this test creates no commits, branches or tags.
  const trusted = git(['write-tree']);
  const script = path.join(directory, 'compare-trusted.sh');
  fs.writeFileSync(script, 'set -euo pipefail\n' + comparison);
  const compare = tag => {
    const result = spawnSync('bash', ['compare-trusted.sh'], {
      cwd: directory, encoding: 'utf8', env: { ...process.env, GITHUB_SHA: trusted, TAG_COMMIT: tag }
    });
    assert.ifError(result.error);
    return result;
  };
  assert.equal(compare(trusted).status, 0, 'identical graph must pass');
  for (const file of guarded) {
    write(file, 'changed independently; generated counterparts stay reviewed\n');
    git(['add', '--', file]);
    const changed = git(['write-tree']);
    const result = compare(changed);
    assert.equal(result.status, 1, `${file}: ${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Release tag must contain the reviewed release inputs:/);
    write(file, 'reviewed\n');
    git(['add', '--', file]);
  }
  // Directory and glob pathspecs must catch additions and deletions in either tree.
  for (const file of ['.github/workflows/new-workflow.yml', 'src/main/update/new-helper.cts', 'tools/new-generator.cjs', 'tsconfig.future.json', 'types/new-global.d.ts']) {
    write(file, 'new unreviewed input\n');
    git(['add', '--', file]);
    assert.equal(compare(git(['write-tree'])).status, 1, `new ${file}`);
    git(['update-index', '--force-remove', '--', file]);
  }
  git(['update-index', '--force-remove', '--', 'src/main/update/updater.cts']);
  assert.equal(compare(git(['write-tree'])).status, 1, 'deleted TS source');
  git(['add', '--', 'src/main/update/updater.cts']);
  for (const file of ['README.md', 'docs/USAGE.md', 'docs/releases/example.md', 'feed/manifest.json', 'resources/app.asar']) {
    write(file, 'outside the executable source graph\n');
    git(['add', '--', file]);
  }
  assert.equal(compare(git(['write-tree'])).status, 0, 'user documentation and signed channel data may differ');
  // The trusted side must come from Git, even if the working checkout differs.
  write('tools/build-modules.cjs', 'uncommitted checkout content\n');
  assert.equal(compare(trusted).status, 0, 'comparison uses immutable trees rather than working files');
});

test('signed feed is injected into every installer and attached for post-release verification', () => {
  const workflow = readWorkflow('release.yml');
  const windowsPackage = workflow.jobs['windows-package'];
  assert.ok(windowsPackage.needs.includes('sign-feed'));
  assert.match(windowsPackage.steps.find(step => step.name?.includes('Verify and install')).run, /delta-feed\.cjs install incoming-signed/);
  assert.match(windowsPackage.steps.find(step => step.name?.includes('Verify and install')).run, /verify incoming-signed/);
  const unix = workflow.jobs.unix.steps.find(step => step.name?.includes('Build platform app'));
  assert.match(unix.run, /delta-feed\.cjs install incoming/);
  assert.match(unix.run, /pnpm dist/);

  const draft = workflow.jobs.draft.steps.find(step => step.name?.includes('Prepare flat release'));
  assert.match(draft.run, /signed-update-feed\/feed\/manifest\.json/);
  assert.match(draft.run, /signed-update-feed\/resources\/app\.asar/);
});

test('published update-channel activation needs GitHub token and never receives signing secret', () => {
  const workflow = readWorkflow('activate-update.yml');
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
  assert.equal(workflow.jobs.prepare.if, "github.ref == 'refs/heads/main'");
  assert.equal(workflow.jobs.prepare.env.GH_TOKEN, '${{ github.token }}');
  assert.ok(workflow.jobs.prepare.permissions['pull-requests'] === 'write');
  const steps = workflow.jobs.prepare.steps;
  assert.match(steps.find(step => step.name?.includes('Require a published')).run, /gh auth setup-git/);
  assert.match(steps.find(step => step.name?.includes('Verify signature')).run, /--runtime-version manifest/);
  assert.doesNotMatch(JSON.stringify(workflow), /secrets\.QMX_UPDATE_SIGNING_KEY_PEM/);
  assert.equal(workflow.jobs.prepare.permissions.actions, 'write');
  assert.ok(Object.hasOwn(readWorkflow('ci.yml').on, 'workflow_dispatch'));
  const checks = steps.find(step => step.name === 'Run required source checks for the channel branch');
  assert.match(checks.run, /gh workflow run ci\.yml --ref/);
  assert.match(checks.run, /gh run watch .*--exit-status/);
});
