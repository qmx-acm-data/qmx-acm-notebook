// Generated from src/main/app/session.cts; run pnpm modules:build.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSession = createSession;
/** Live callbacks retain main's tickets, generation and identity across every await. */
function createSession({ networkFetch, getAuth, getToken, setToken, getAccount, setAccount, setPermissions, getLoginGeneration, nextLoginGeneration, isWriteBusy, isSyncBusy, sourceScope, ensureSource, githubClient, annotate, settings, state, sendAuthProgress, openAuthUrl, URL, Buffer, AbortSignal, Date, setTimeout }) {
    function persistAuth(data, ticket) {
        getAuth().commit(data.token, data.account, ticket);
    }
    async function avatarData(url) {
        try {
            const u = new URL(url);
            if (u.protocol !== 'https:' || u.hostname !== 'avatars.githubusercontent.com')
                return null;
            u.searchParams.set('s', '80');
            const response = await networkFetch(u, { signal: AbortSignal.timeout(7000), redirect: 'error' });
            const type = response.headers.get('content-type')?.split(';')[0];
            if (!response.ok || !['image/png', 'image/jpeg', 'image/webp'].includes(type))
                return null;
            const reader = response.body.getReader();
            const chunks = [];
            let length = 0;
            while (true) {
                const part = await reader.read();
                if (part.done)
                    break;
                length += part.value.length;
                if (length > 256000) {
                    await reader.cancel();
                    return null;
                }
                chunks.push(Buffer.from(part.value));
            }
            return `data:${type};base64,${Buffer.concat(chunks).toString('base64')}`;
        }
        catch {
            return null;
        }
    }
    async function refreshIdentity() {
        const gen = getLoginGeneration(), scope = sourceScope(), ticket = getAuth().capture();
        const gh = githubClient(getToken(), scope.repo, '');
        const result = scope.serverUrl ? await gh.identity() : await gh.profile();
        const picture = await avatarData(result.account.avatarUrl);
        ensureSource(scope.sourceKey, gen);
        const next = { ...result.account, avatarData: picture };
        persistAuth({ token: ticket.token, account: next }, ticket);
        setAccount(next);
        setPermissions(scope.serverUrl ? { ...scope, push: false, admin: false } : annotate(result.permissions, scope));
        return state();
    }
    async function oauth(endpoint, data) {
        const response = await networkFetch(`https://github.com/login/${endpoint}`, {
            method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify(data), signal: AbortSignal.timeout(20000)
        });
        if (!response.ok)
            throw new Error(`GitHub 授权服务错误 ${response.status}`);
        return response.json();
    }
    const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    async function login() {
        if (isWriteBusy() || isSyncBusy())
            throw new Error('请等待当前操作完成后再登录');
        const id = settings().clientId.trim();
        if (!id)
            throw new Error('请先在设置中填写队伍 GitHub OAuth 应用的 Client ID，并启用 Device Flow。未配置时仍可使用本地题解和公开题库。');
        const gen = nextLoginGeneration(), ticket = getAuth().capture();
        const code = await oauth('device/code', { client_id: id, scope: 'public_repo' });
        if (gen !== getLoginGeneration())
            throw new Error('已取消登录');
        if (code.error)
            throw new Error((code.error_description || code.error));
        sendAuthProgress({ userCode: code.user_code, url: code.verification_uri, expiresIn: code.expires_in });
        // The code/link are already visible, so a failed automatic browser launch must not stop polling.
        await openAuthUrl(code.verification_uri).catch(() => { });
        let interval = Math.max(5, (code.interval || 5)) * 1000;
        const deadline = Date.now() + code.expires_in * 1000;
        while (Date.now() < deadline) {
            await pause(interval);
            if (gen !== getLoginGeneration())
                throw new Error('已取消登录');
            const result = await oauth('oauth/access_token', { client_id: id, device_code: code.device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' });
            if (gen !== getLoginGeneration())
                throw new Error('已取消登录');
            if (result.error === 'authorization_pending')
                continue;
            if (result.error === 'slow_down') {
                interval += 5000;
                continue;
            }
            if (result.error)
                throw new Error((result.error_description || result.error));
            if (!result.access_token)
                throw new Error('GitHub 未返回凭据');
            const scope = sourceScope();
            const gh = githubClient(result.access_token, scope.repo, '');
            const profile = scope.serverUrl ? await gh.identity() : await gh.profile();
            const picture = await avatarData(profile.account.avatarUrl);
            ensureSource(scope.sourceKey, gen);
            const next = { ...profile.account, avatarData: picture };
            persistAuth({ token: result.access_token, account: next }, ticket);
            setToken(result.access_token);
            setAccount(next);
            setPermissions(scope.serverUrl ? { ...scope, push: false, admin: false } : annotate(profile.permissions, scope));
            return getAccount();
        }
        throw new Error('授权码已过期，请重新登录');
    }
    return { login, refreshIdentity };
}
