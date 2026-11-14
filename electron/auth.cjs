// Generated from src/main/auth/auth.cts; run pnpm modules:build.
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
exports.createAuth = createAuth;
exports.configureUserData = configureUserData;
const node_buffer_1 = require("node:buffer");
const nodePath = __importStar(require("node:path"));
// Dependency injection keeps tests away from Electron's real keychain and userData.
function createAuth({ safeStorage, readAuth, saveAuth, now = () => new Date().toISOString() }) {
    let token = '', account = null, revision = 0;
    let status = { status: 'anonymous', code: null, transport: 'electron-net' };
    const report = (value, code = null) => {
        status = { status: value, code, transport: 'electron-net', checkedAt: now() };
    };
    const validAccount = (value) => {
        const candidate = value;
        return Boolean(value && Number.isSafeInteger(candidate.id) && candidate.id > 0 && typeof candidate.login === 'string' && Boolean(candidate.login.trim()));
    };
    const validToken = (value) => typeof value === 'string' && Boolean(value.trim()) && !/[\r\n]/.test(value);
    function encode(data) {
        if (!safeStorage.isEncryptionAvailable())
            throw new Error('系统凭据加密不可用，无法安全保存登录');
        return { encrypted: safeStorage.encryptString(JSON.stringify(data)).toString('base64') };
    }
    function restore() {
        let saved;
        try {
            saved = readAuth();
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                report('anonymous');
                return false;
            }
            report('recovery-required', 'credential-read-failed');
            return false;
        }
        if (saved && typeof saved === 'object' && !Array.isArray(saved) && Object.keys(saved).length === 0) {
            report('anonymous');
            return false;
        }
        const stored = saved;
        if (!saved || typeof stored.encrypted !== 'string' || !stored.encrypted || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(stored.encrypted)) {
            report('recovery-required', 'credential-format-invalid');
            return false;
        }
        try {
            if (!safeStorage.isEncryptionAvailable()) {
                report('recovery-required', 'keychain-unavailable');
                return false;
            }
            const parsed = JSON.parse(safeStorage.decryptString(node_buffer_1.Buffer.from(stored.encrypted, 'base64')));
            const data = parsed;
            if (!validAccount(data.account) || (data.invalidated !== true && !validToken(data.token))) {
                report('recovery-required', 'credential-format-invalid');
                return false;
            }
            token = data.invalidated === true ? '' : data.token;
            account = data.account;
            revision++;
            report(data.invalidated === true ? 'expired' : 'restored', data.invalidated === true ? 'http-401' : null);
            return Boolean(token);
        }
        catch {
            report('recovery-required', 'credential-decrypt-failed');
            return false;
        }
    }
    function capture() { return { revision, token }; }
    function current(ticket) { return ticket.revision === revision && ticket.token === token; }
    function commit(nextToken, nextAccount, ticket = capture()) {
        if (!current(ticket))
            throw new Error('账号已改变，请重试');
        if (!validToken(nextToken) || !validAccount(nextAccount))
            throw new Error('登录资料格式不正确');
        try {
            saveAuth(encode({ token: nextToken, account: nextAccount }));
        }
        catch {
            report('recovery-required', 'credential-save-failed');
            throw new Error('无法安全保存 GitHub 登录，原凭据未主动清除；请检查系统加密和数据目录权限后重试');
        }
        token = nextToken;
        account = nextAccount;
        revision++;
        report('verified');
    }
    function failure(error, ticket) {
        if (!current(ticket) || !ticket.token)
            return false;
        // Deliberately access the supplied value directly: null/undefined still throw.
        const failure = error;
        if (failure.status === 401) {
            // Preserve identity/ownership locally, but never send a confirmed expired token again.
            token = '';
            revision++;
            report('expired', 'http-401');
            try {
                saveAuth(encode({ token: '', account, invalidated: true }));
            }
            catch {
                report('expired', 'credential-invalidation-save-failed');
            }
        }
        else if (failure.status === 403 || failure.status === 429)
            report('unverified', `http-${failure.status}`);
        else
            report('unverified', failure.status ? 'http-other' : 'network-unavailable');
        return true;
    }
    function logout() {
        // Persist first: failure must not claim credentials were durably removed.
        saveAuth({});
        token = '';
        account = null;
        revision++;
        report('anonymous');
    }
    return { restore, capture, current, commit, failure, logout,
        get token() { return token; }, get account() { return account; }, get status() { return { ...status }; } };
}
function configureUserData(app, { env = process.env, argv = process.argv, path = nodePath } = {}) {
    const argument = argv.find(value => value.startsWith('--qmx-user-data-dir='));
    const explicit = argument ? argument.slice('--qmx-user-data-dir='.length) : env.QMX_USER_DATA_DIR;
    const chromium = app.commandLine?.getSwitchValue('user-data-dir');
    const directory = explicit !== undefined ? explicit : (chromium || undefined);
    if (directory !== undefined) {
        if (!directory || !path.isAbsolute(directory))
            throw new Error('隔离数据目录必须是明确的绝对路径');
        app.setPath('userData', path.resolve(directory));
    }
    // Do not rename the application or move the established installed profile.
}
