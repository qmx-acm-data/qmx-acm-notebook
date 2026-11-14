import type { BrowserWindowConstructorOptions, WebPreferences } from 'electron';

export interface PublicPageSnapshot {
  title: string;
  text: string;
  links: { text: string; url: string }[];
  publicData?: { dailyCounts?: unknown; uid?: unknown };
}

export interface PublicPageNavigationEvent {
  preventDefault(): void;
}

export interface PublicPageSession {
  setPermissionRequestHandler(handler: (
    contents: unknown,
    permission: string,
    callback: (allowed: boolean) => void
  ) => void): void;
}

export interface PublicPageWebContents {
  setWindowOpenHandler(handler: () => { action: 'deny' }): void;
  on(event: 'will-navigate' | 'will-redirect', listener: (event: PublicPageNavigationEvent, next: string) => void): unknown;
  session: PublicPageSession;
  executeJavaScript(code: string): Promise<unknown>;
}

export interface PublicPageWindow {
  webContents: PublicPageWebContents;
  loadURL(url: string): Promise<unknown>;
  isDestroyed(): boolean;
  destroy(): void;
}

export type PublicPageWindowOptions = Required<Pick<BrowserWindowConstructorOptions, 'show'>> & {
  webPreferences: Required<Pick<WebPreferences,
    'partition' | 'nodeIntegration' | 'contextIsolation' | 'sandbox' | 'webSecurity'>>;
};

export interface PublicPageDependencies {
  BrowserWindow: new (options: PublicPageWindowOptions) => PublicPageWindow;
}

// Public pages run in an isolated, non-persistent session with no preload or Node access.
export function createPublicPageReader({ BrowserWindow }: PublicPageDependencies): (url: string) => Promise<PublicPageSnapshot> {
  let sequence = 0;
  return async function readPage(url: string): Promise<PublicPageSnapshot> {
    const target = new URL(url);
    if(target.protocol !== 'https:' || !['www.luogu.com.cn','ac.nowcoder.com'].includes(target.hostname)) throw new Error('不支持的公开资料地址');
    const window = new BrowserWindow({ show:false, webPreferences:{partition:`public-platform-${process.pid}-${++sequence}`,nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true} });
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    const restrict = (event: PublicPageNavigationEvent, next: string): void => { try { const u=new URL(next); if(u.protocol!=='https:' || u.hostname!==target.hostname) event.preventDefault(); }catch{event.preventDefault();} };
    window.webContents.on('will-navigate',restrict); window.webContents.on('will-redirect',restrict);
    window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const work = async(): Promise<PublicPageSnapshot> => {
      await window.loadURL(target.href);
      let previous='', stable=0;
      for(let i=0;i<35;i++) {
        const snapshot=await window.webContents.executeJavaScript(`(()=>{let publicData;try{const raw=document.getElementById('lentille-context')?.textContent;if(raw&&raw.length<4000000){const c=JSON.parse(raw);if(c.template==='user.show'&&c.status===200){const d=c.data;publicData={dailyCounts:d?.dailyCounts,uid:d?.user?.uid};}}}catch{}return {title:document.title,text:document.body?.innerText||'',links:Array.from(document.querySelectorAll('a[href]')).map(a=>({text:a.innerText,url:a.href})).slice(0,2000),publicData};})()`) as PublicPageSnapshot;
        const ready=target.hostname==='www.luogu.com.cn' ? /通过\s*\n\s*\d/.test(snapshot.text) : /题已通过|次Rating赛/.test(snapshot.text);
        if(ready && snapshot.text===previous && !/加载中/.test(snapshot.text)) stable++; else stable=0;
        if(stable>=2) return snapshot;
        previous=snapshot.text;
        await new Promise(resolve=>setTimeout(resolve,400));
      }
      throw new Error('公开页面未加载完整，可能遇到访问验证或网络限制，请稍后重试');
    };
    try { return await Promise.race([work(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('平台公开页面查询超时，请稍后重试')),25000);})]); }
    finally { clearTimeout(timer); if(!window.isDestroyed()) window.destroy(); }
  };
}
