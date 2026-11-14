// Generated from src/main/links/external.cts; run pnpm modules:build.
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createExternalLinks = createExternalLinks;
const path = __importStar(require("node:path"));
function createExternalLinks({ shell, fs, spawn, env = process.env, platform = process.platform, setTimeout = globalThis.setTimeout, clearTimeout = globalThis.clearTimeout }) {
    function assertExternal(url) {
        const invalid = () => new Error('仅允许打开不含账号密码的 HTTP 或 HTTPS 网页链接');
        if (typeof url !== 'string' || url.length > 8192 || /[\u0000-\u0020\u007f\\]/.test(url) || !/^https?:\/\//i.test(url))
            throw invalid();
        let u;
        try {
            u = new URL(url);
        }
        catch {
            throw invalid();
        }
        if (!['https:', 'http:'].includes(u.protocol) || !u.hostname || u.username || u.password)
            throw invalid();
        return u;
    }
    async function external(url) {
        const u = assertExternal(url);
        await shell.openExternal(u.href);
    }
    // Prefer Chrome for the device-flow page; fall back to the default handler if it is missing or
    // fails during startup. Existing Chrome instances may accept the URL and exit successfully.
    const AUTH_BROWSER_STARTUP_GRACE_MS = 1000;
    function chromePath() {
        const candidates = platform === 'win32'
            ? [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].map(base => base && path.join(base, 'Google\\Chrome\\Application\\chrome.exe'))
            : platform === 'darwin'
                ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
                : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
        return candidates.find(candidate => candidate && fs.existsSync(candidate)) || null;
    }
    async function openAuthUrl(url) {
        const u = assertExternal(url);
        if (u.protocol !== 'https:' || u.hostname !== 'github.com' || u.port)
            throw new Error('仅允许打开 GitHub 授权链接');
        const chrome = chromePath();
        if (chrome) {
            const launched = await new Promise(resolve => {
                let child, timer, settled = false, spawned = false;
                const finish = (success) => {
                    if (settled)
                        return;
                    settled = true;
                    clearTimeout(timer);
                    child?.removeListener('spawn', onSpawn);
                    child?.removeListener('exit', onExit);
                    resolve(success);
                };
                const onSpawn = () => { spawned = true; child.unref(); };
                const onExit = (code, signal) => finish(code === 0 && !signal);
                try {
                    child = spawn(chrome, [u.href], { detached: true, stdio: 'ignore' });
                }
                catch {
                    finish(false);
                    return;
                }
                // Keep the one-shot error handler after the grace period to consume late process errors.
                child.once('error', () => finish(false));
                child.once('spawn', onSpawn);
                child.once('exit', onExit);
                timer = setTimeout(() => finish(spawned), AUTH_BROWSER_STARTUP_GRACE_MS);
            });
            if (launched)
                return true;
        }
        await shell.openExternal(u.href);
        return false;
    }
    return { assertExternal, external, openAuthUrl, chromePath };
}
