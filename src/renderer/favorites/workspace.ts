import type { AppRecord } from '../../../types/app.js';
import type { FavoriteEntry, FavoriteType } from './model.js';
const labels: Record<FavoriteType, string> = { solution: '题解', trick: 'Trick', algorithm: '算法笔记' };
interface Options {
  host: HTMLElement;
  getEntries(): FavoriteEntry[];
  getContext(): string;
  isFavorite(record: AppRecord): boolean;
  toggle(record: AppRecord): Promise<void>;
  renderMarkdown(host: HTMLElement, body: unknown): void;
  renderSolution(record: AppRecord, host: HTMLElement): void;
  authorName(value: unknown): string;
  date(value: unknown): string;
  errorMessage(error: unknown): string;
  toast(message: string): void;
}
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] { const n = document.createElement(tag); n.className = cls; if(text !== undefined)n.textContent=text;return n; }
function button(label:string,cls:string,run:()=>void){const n=el('button',cls,label);n.type='button';n.addEventListener('click',run);return n;}
export function createFavoritesWorkspace(options: Options) {
  const host=options.host;let context='',query='',type:FavoriteType|'all'='all',selected:string|null=null,scroll=0;
  function reset(){query='';type='all';selected=null;context='';}
  function back(){const previous=selected;selected=null;render();Array.from(host.querySelectorAll<HTMLButtonElement>('.favorite-open')).find(n=>n.dataset.key===previous)?.focus({preventScroll:true});window.scrollTo({top:scroll});}
  function open(entry:FavoriteEntry){scroll=window.scrollY;selected=entry.key;render();host.querySelector<HTMLButtonElement>('.favorite-back')?.focus({preventScroll:true});host.scrollIntoView({block:'start'});}
  function render(){
    const current=options.getContext();if(context!==current){context=current;selected=null;query='';type='all';}
    host.replaceChildren();const entries=options.getEntries();
    const entry=selected?entries.find(e=>e.key===selected):undefined;
    if(entry){
      const article=el('article','favorite-reader'),top=el('div','favorite-reader-top');top.append(button('← 返回个人收藏','button secondary favorite-back',back));article.append(top);host.append(article);
      if(entry.type==='solution'){const mount=el('section','favorite-solution-reader');article.append(mount);options.renderSolution(entry.record,mount);return;}
      const star=button('★ 已收藏','button secondary favorite-toggle',()=>{void options.toggle(entry.record).then(()=>{star.textContent=options.isFavorite(entry.record)?'★ 已收藏':'☆ 收藏';star.setAttribute('aria-pressed',String(options.isFavorite(entry.record)));}).catch(e=>options.toast(options.errorMessage(e)));});star.setAttribute('aria-pressed','true');top.append(star);
      article.append(el('span','favorite-kind',labels[entry.type]),el('h2','favorite-reader-title',entry.record.title||'未命名内容'),el('p','favorite-reader-meta',`${options.authorName(entry.record.author)} · ${options.date(entry.record.updatedAt)}`));
      if(typeof entry.record.introduction==='string')article.append(el('p','favorite-reader-intro',entry.record.introduction));
      const body=el('div','markdown-body favorite-body');options.renderMarkdown(body,entry.record.body);article.append(body);return;
    }
    // An item can be removed while open; return to the list rather than retaining stale content.
    selected=null;
    const tools=el('div','favorites-tools'),search=el('input','favorites-search');search.type='search';search.placeholder='搜索标题、作者、标签或简介';search.setAttribute('aria-label','搜索个人收藏');search.value=query;
    const tabs=el('div','favorites-types');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','收藏类型');
    const counts=new Map<string,number>([['all',entries.length]]);for(const e of entries)counts.set(e.type,(counts.get(e.type)||0)+1);
    for(const [key,label] of [['all','全部'],...Object.entries(labels)]){const control=button(`${label} ${counts.get(key)||0}`,'favorite-type',()=>{type=key as FavoriteType|'all';render();});control.dataset.type=key;control.setAttribute('aria-pressed',String(type===key));tabs.append(control);}
    tools.append(search,tabs);host.append(tools);
    const list=el('div','favorites-list');host.append(list);
    function rows(){list.replaceChildren();const needle=query.toLocaleLowerCase().trim();const visible=entries.filter(e=>(type==='all'||e.type===type)&&`${e.record.title||''} ${options.authorName(e.record.author)} ${(e.record.tags||[]).join(' ')} ${String(e.record.introduction||'')}`.toLocaleLowerCase().includes(needle));
      const count=el('div','favorites-result-count',`${visible.length} 条收藏`);list.append(count);
      if(!visible.length){const empty=el('div','favorites-empty');empty.append(el('h3','',entries.length?'没有匹配的收藏':'收藏值得再读的内容'),el('p','',entries.length?'换一个关键词或内容类型试试。':'在题解、Trick 或算法笔记阅读页点击「收藏」，便可在这里统一查看。'));list.append(empty);return;}
      const heading=el('div','favorites-columns');['类型','标题','作者','更新'].forEach(t=>heading.append(el('span','',t)));heading.setAttribute('aria-hidden','true');list.append(heading);
      const ul=el('ul','favorites-directory');for(const e of visible){const li=el('li','favorite-row'),read=button('','favorite-open',()=>open(e));read.dataset.key=e.key;read.append(el('span','favorite-kind',labels[e.type]),el('span','favorite-title',e.record.title||'未命名内容'),el('span','favorite-author',options.authorName(e.record.author)),el('time','favorite-updated',options.date(e.record.updatedAt)));const remove=button('★','favorite-remove',()=>{void options.toggle(e.record).then(render).catch(error=>options.toast(options.errorMessage(error)));});remove.title='取消收藏';remove.setAttribute('aria-label',`取消收藏 ${e.record.title||'未命名内容'}`);li.append(read,remove);ul.append(li);}list.append(ul);
    }
    search.addEventListener('input',()=>{query=search.value;rows();});rows();
  }
  return {render,reset,back,isReading:()=>selected!==null,focusSearch:()=>host.querySelector<HTMLInputElement>('.favorites-search')?.focus()};
}
