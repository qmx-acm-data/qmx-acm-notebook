'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { _electron: electron } = require('playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const profile = path.join(root, 'sandbox-profile', `clist-live-${Date.now()}`);
  const raw = fs.readFileSync(path.join(root, 'API KEYs.txt'), 'utf8').trim();
  const match = raw.match(/^\s*([^:=：\r\n]+)\s*[:=：]\s*([^\r\n]+)\s*$/);
  if (!match) { console.log('credential-format: unsupported'); return; }
  const credentials = { username: match[1].trim(), apiKey: match[2].trim() };
  fs.mkdirSync(profile, { recursive: true });
  const env = { ...process.env, QMX_USER_DATA_DIR: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  let app;
  try {
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--disable-gpu'], env, timeout: 30000 });
    const page = await app.firstWindow();
    const info = await app.evaluate(({ app, BrowserWindow }) => ({ userData: app.getPath('userData'), prefs: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences() }));
    if (path.resolve(info.userData) !== path.resolve(profile) || !info.prefs.contextIsolation || info.prefs.nodeIntegration) throw new Error('isolation');
    console.log('electron-isolation: pass');
    const saved = await page.evaluate(async c => { await window.notebook.saveClistCredentials(c); return (await window.notebook.getClistStatus()).configured; }, credentials);
    console.log(`credential-ipc-save-status: ${saved ? 'pass' : 'fail'}`);
    await app.close(); app = null;
    app = await electron.launch({ executablePath: require('electron'), args: [root, '--disable-gpu'], env, timeout: 30000 });
    const page2 = await app.firstWindow();
    console.log(`credential-reload-status: ${(await page2.evaluate(async () => (await window.notebook.getClistStatus()).configured)) ? 'pass' : 'fail'}`);
    for (const source of ['LG', 'NC']) {
      const result = await page2.evaluate(async source => {
        try {
          const r = await window.notebook.dailyDraw({ source });
          return { ok: true, source: r.problem?.source, origin: r.problem?.origin, clistId: /^(LG|NC):\d+$/.test(r.problem?.id || ''), errors: Array.isArray(r.errors) ? r.errors.map(e => /CLIST/i.test(e) ? 'clist' : 'other') : [] };
        } catch (e) { const s = String(e?.message || ''); return { ok: false, clist: /CLIST/.test(s), network: /HTTP|fetch|网络|获取/.test(s), empty: /没有符合条件/.test(s) }; }
      }, source);
      console.log(`draw-${source}: ${JSON.stringify(result)}`);
    }
  } catch (error) { console.log(`test-error: ${error?.message === 'isolation' ? 'isolation' : app ? 'ipc-or-runtime' : 'electron-launch'}`); process.exitCode = 1; }
  finally { if (app) await app.close().catch(() => {}); }
})().catch(() => { console.log('test-error: setup'); process.exitCode = 1; });
