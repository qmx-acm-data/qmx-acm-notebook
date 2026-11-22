'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { appPath } = require('./app-path.cjs');
const sourceKey = 'https://api.github.com|team/notebook';
const fixtureRows = [
  ['二分答案：先写不变量，再决定边界','陈一鸣','把问题化成单调判断，再分清最后一个满足和第一个不满足。',2],
  ['把「恰好 k 个」拆成两个「至多」','林小满','使用 F(k) − F(k−1)，把恰好出现的问题交给滑动窗口。',3],
  ['差分数组多开一格，让区间更新少一个分支','周子航','在 l 加 x、r+1 减 x，保留哨兵位置处理末尾。',4],
  ['优先队列删不掉？先标记，再跳过','许知远','状态保存在堆外，每次取出时判断它是否依然有效。',5],
  ['整除分块：右端点直接算','唐可','相同的商连成一段，用 n / (n / l) 直接计算右端点。',6],
  ['先离散化，再比较相邻位置','苏晚','离散化保留顺序，不保留距离；别把排名相邻当成数值相邻。',7]
].map(([title,name,introduction,authorId],i)=>({kind:'trick',id:`trick:${i}`,clientId:`00000000-0000-4000-8000-00000000000${i}`,path:`tricks/00000000-0000-4000-8000-00000000000${i}.md`,sha:`sha-${i}`,title,introduction,authorId,author:{id:authorId,login:`user${authorId}`,name},updatedAt:`2026-11-${20-i}T10:00:00Z`,repo:'team/notebook',serverUrl:'',sourceKey,body:'# 关键观察\n\n正文独有TOKEN，不应在列表里显示。\n\n**不变量**先于边界。\n\n```cpp\nwhile (l < r) {\n    int mid = l + (r - l + 1) / 2;\n    if (check(mid)) l = mid;\n    else r = mid - 1;\n}\n```\n\n<img src=x onerror="window.trickXss=1"><script>window.trickXss=2</script>\n[bad](javascript:window.trickXss=3)'}));
async function setup(browser,admin=false){
 const page=await browser.newPage({viewport:{width:1440,height:940}}); page.setDefaultTimeout(10000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({rows,admin,sourceKey})=>{
  window.trickXss=0; window.trickCalls=[];window.failTrickSave=false;
  const foreign={...rows[0],id:'foreign',path:'tricks/foreign.md',sourceKey:'https://api.github.com|other/repo',title:'OTHER SOURCE SECRET'};
  const payload=window.trickFixture={records:[],issues:[],tricks:[...rows,foreign],algorithmNotes:[
   {kind:'algorithm-note',id:'pub',repo:'team/notebook',sourceKey,noteScope:'public',authorId:9},
   {kind:'algorithm-note',id:'own',repo:'team/notebook',sourceKey,noteScope:'personal',authorId:2},
   {kind:'algorithm-note',id:'private-other',repo:'team/notebook',sourceKey,noteScope:'personal',authorId:8},
   {kind:'algorithm-note',id:'foreign',repo:'other/repo',sourceKey:'https://api.github.com|other/repo',noteScope:'public',authorId:2}
  ],settings:{repo:'team/notebook',autoSync:false},permissions:{repo:'team/notebook',push:true,admin},account:{id:2,login:'alice',name:'陈一鸣'},local:{records:[],favorites:[],mastery:{},draft:{}}};
  window.notebook={bootstrap:async()=>payload,sync:async()=>payload,updateLocal:async v=>v,
   saveTrick:async input=>{window.trickCalls.push({method:'save',input});if(window.failTrickSave)throw Error('fixture SHA conflict');const saved={...input,kind:'trick',id:'trick:'+input.clientId,authorId:2,author:{id:2,login:'alice',name:'陈一鸣'},path:input.path||'tricks/'+input.clientId+'.md',sha:'saved-sha',updatedAt:'2026-11-21T11:00:00Z',serverUrl:''};payload.tricks=[saved,...payload.tricks.filter(x=>x.path!==saved.path)];return saved;},
   deleteTrick:async input=>{window.trickCalls.push({method:'delete',input});payload.tricks=payload.tricks.filter(x=>x.path!==input.path);return {deleted:true,path:input.path};},openExternal:async()=>{}};
 },{rows:fixtureRows,admin,sourceKey});
 await page.goto(pathToFileURL(appPath('ui/index.html')).href);await page.locator('.rail-nav-item[data-view="tricks"]').click();await page.mouse.move(1300,850);await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width<=73);
 return {page,errors};
}
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const {page,errors}=await setup(browser);
 assert.equal(await page.locator('.trick-row').count(),6);
 assert.equal(await page.locator('#count-tricks').textContent(),'6');assert.equal(await page.locator('#count-algorithms').textContent(),'2','public plus own personal notes in current source');
 assert.deepEqual(await page.locator('.nav-item[data-view="tricks"] .nav-count, .rail-nav-item[data-view="tricks"] .nav-count').allTextContents(),['6','6']);
 assert.equal(await page.locator('.trick-content').count(),0);
 assert.doesNotMatch(await page.locator('.tricks-workspace').innerText(),/正文独有TOKEN|OTHER SOURCE SECRET/);
 assert.ok(await page.locator('.trick-row').first().evaluate(n=>n.getBoundingClientRect().height)<=76,'compact directory rows');
 await page.locator('.tricks-search input').fill('林小满');assert.equal(await page.locator('.trick-row').count(),1);
 await page.locator('.trick-row').click();assert.match(await page.locator('.trick-content').innerText(),/正文独有TOKEN/);assert.equal(await page.locator('.trick-edit').count(),0,'cannot edit another author');
 assert.equal(await page.locator('.trick-content script,.trick-content [onerror]').count(),0);assert.equal(await page.evaluate(()=>window.trickXss),0);
 await page.keyboard.press('Escape');assert.equal(await page.locator('.trick-content').count(),0);assert.equal(await page.locator('.tricks-search input').inputValue(),'林小满');
 await page.locator('.tricks-search input').fill('');await page.locator('.trick-row').first().click();await page.locator('.trick-edit').click();
 assert.equal(await page.locator('.trick-editor [name="title"]').inputValue(),fixtureRows[0].title);
 await page.locator('.trick-editor [name="body"]').fill('# Updated\n\n**安全 Markdown**');
 await page.getByRole('button',{name:'预览',exact:true}).click();assert.match(await page.locator('.trick-editor-preview strong').innerText(),/安全/);
 await page.getByRole('button',{name:'继续编辑',exact:true}).click();
 await page.evaluate(()=>window.failTrickSave=true);await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.locator('.trick-editor .form-error').waitFor();
 assert.match(await page.locator('.trick-editor [name="body"]').inputValue(),/Updated/);
 await page.getByRole('button',{name:'保存草稿并关闭',exact:true}).click();
 await page.evaluate(()=>{window.failTrickSave=false;window.trickFixture.tricks[0].sha='remote-new-sha';window.trickFixture.tricks[0].body='# Remote update';});
 await page.locator('#sync-button').click();await page.waitForFunction(()=>!document.querySelector('#sync-button').disabled);await page.locator('.trick-edit').click();
 assert.match(await page.locator('.trick-editor [name="body"]').inputValue(),/Updated/);assert.match(await page.locator('.trick-draft-notice').innerText(),/远端版本已更新/);
 await page.getByRole('button',{name:'保存修改',exact:true}).click();assert.match(await page.locator('.trick-editor .form-error').innerText(),/核对/);
 await page.getByRole('checkbox',{name:'已核对最新远端，使用草稿保存'}).check();
 await page.getByRole('button',{name:'保存修改',exact:true}).click();await page.locator('.trick-editor').waitFor({state:'detached'});
 assert.equal(await page.locator('.trick-content strong').innerText(),'安全 Markdown');
 await page.keyboard.press('Escape');await page.locator('.trick-create').click();await page.locator('.trick-editor [name="title"]').fill('新技巧');await page.locator('.trick-editor [name="introduction"]').fill('新简介');await page.locator('.trick-editor [name="body"]').fill('新的正文');await page.getByRole('button',{name:'发布 Trick',exact:true}).click();await page.locator('.trick-editor').waitFor({state:'detached'});
 assert.equal(await page.locator('#count-tricks').textContent(),'7','creation updates badge immediately');
 const calls=await page.evaluate(()=>window.trickCalls);assert.equal(calls[0].input.sha,'sha-0');assert.equal(calls[1].input.sha,'remote-new-sha');assert.equal(calls[0].input.clientId,calls[1].input.clientId);assert.equal(calls[2].input.sourceKey,sourceKey);
 await page.locator('.trick-delete').click();assert.equal(await page.locator('.trick-delete-dialog').isVisible(),true);await page.getByRole('button',{name:'确认删除',exact:true}).click();await page.locator('.trick-delete-dialog').waitFor({state:'detached'});assert.equal(await page.locator('.trick-row').count(),6);assert.equal(await page.locator('#count-tricks').textContent(),'6','deletion updates badge immediately');
 await page.locator('.tricks-search input').fill('无匹配');assert.equal(await page.locator('.tricks-empty').isVisible(),true);await page.locator('.tricks-search input').fill('');
 await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('.trick-row').first().click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.keyboard.press('Escape');
 await page.setViewportSize({width:1440,height:940});
 await page.evaluate(()=>{window.trickFixture.account={id:99,login:'visitor'};window.trickFixture.permissions={repo:'team/notebook',push:false,admin:false};});await page.locator('#sync-button').click();await page.waitForFunction(()=>!document.querySelector('.trick-create'));assert.equal(await page.locator('.trick-create').count(),0);assert.equal(await page.locator('#count-algorithms').textContent(),'1','account switch hides personal count');await page.locator('.trick-row').first().click();assert.equal(await page.locator('.trick-edit').count(),0);await page.keyboard.press('Escape');
 await page.evaluate(()=>{window.trickFixture.settings={repo:'other/repo',autoSync:false};window.trickFixture.permissions.repo='other/repo';});await page.locator('#sync-button').click();await page.waitForFunction(()=>document.querySelectorAll('.trick-row').length===1);assert.match(await page.locator('.trick-row').innerText(),/OTHER SOURCE SECRET/);assert.equal(await page.locator('#count-tricks').textContent(),'1');assert.equal(await page.locator('#count-algorithms').textContent(),'1');assert.equal(await page.locator('.trick-content').count(),0);
 assert.deepEqual(errors,[]);await page.close();
 const admin=await setup(browser,true);await admin.page.locator('.trick-row').nth(1).click();assert.equal(await admin.page.locator('.trick-edit').isVisible(),true);await admin.page.keyboard.press('Escape');
 const shots='D:/qmx-trick-layouts';fs.mkdirSync(shots,{recursive:true});await admin.page.evaluate(()=>document.activeElement instanceof HTMLElement && document.activeElement.blur());await admin.page.mouse.move(1400,900);await admin.page.screenshot({path:path.join(shots,'d-compact.png'),fullPage:true});await admin.page.locator('.trick-row').first().click();await admin.page.screenshot({path:path.join(shots,'d-compact-open.png'),fullPage:true});await admin.page.keyboard.press('Escape');await admin.page.setViewportSize({width:390,height:844});await admin.page.screenshot({path:path.join(shots,'d-compact-mobile.png'),fullPage:true});await admin.page.close();
 const drafts=await setup(browser);
 await drafts.page.locator('.trick-create').click();await drafts.page.locator('.trick-editor [name="title"]').fill('恢复的新草稿');await drafts.page.locator('.trick-editor [name="introduction"]').fill('本机保存简介');await drafts.page.locator('.trick-editor [name="body"]').fill('重启恢复正文');
 const savedDraft=await drafts.page.evaluate(()=>Object.entries(localStorage).find(([k])=>k.includes('qmx.trick-draft.v1:')));
 assert.ok(savedDraft);const id=JSON.parse(savedDraft[1]).clientId;await drafts.page.keyboard.press('Escape');await drafts.page.reload();await drafts.page.locator('.rail-nav-item[data-view="tricks"]').click();await drafts.page.locator('.trick-create').click();assert.equal(await drafts.page.locator('.trick-editor [name="body"]').inputValue(),'重启恢复正文');await drafts.page.getByRole('button',{name:'发布 Trick',exact:true}).click();await drafts.page.locator('.trick-editor').waitFor({state:'detached'});assert.equal((await drafts.page.evaluate(()=>window.trickCalls))[0].input.clientId,id);assert.equal(await drafts.page.evaluate(()=>Object.keys(localStorage).filter(k=>k.includes('qmx.trick-draft.v1:')).length),0);await drafts.page.close();
 const isolated=await setup(browser);await isolated.page.locator('.trick-create').click();await isolated.page.locator('.trick-editor [name="title"]').fill('A账号草稿');await isolated.page.keyboard.press('Escape');
 await isolated.page.evaluate(()=>{window.trickFixture.account={id:8,login:'other'};});await isolated.page.locator('#sync-button').click();await isolated.page.waitForFunction(()=>!document.querySelector('#sync-button').disabled);await isolated.page.locator('.trick-create').click();assert.equal(await isolated.page.locator('.trick-editor [name="title"]').inputValue(),'');await isolated.page.getByRole('button',{name:'丢弃草稿',exact:true}).click();
 await isolated.page.evaluate(()=>{window.trickFixture.account={id:2,login:'alice'};});await isolated.page.locator('#sync-button').click();await isolated.page.waitForFunction(()=>!document.querySelector('#sync-button').disabled);await isolated.page.locator('.trick-create').click();assert.equal(await isolated.page.locator('.trick-editor [name="title"]').inputValue(),'A账号草稿');
 await isolated.page.locator('.trick-editor [name="body"]').fill('x'.repeat(1000001));await isolated.page.getByRole('button',{name:'保存草稿并关闭',exact:true}).click();assert.equal(await isolated.page.locator('.trick-editor').isVisible(),true);assert.match(await isolated.page.locator('.trick-editor .form-error').innerText(),/超过草稿保存上限/);await isolated.page.locator('.trick-editor [name="body"]').fill('可恢复的正文');await isolated.page.locator('.trick-editor [name="introduction"]').fill('完整简介');
 await isolated.page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('fixture quota');};});await isolated.page.getByRole('button',{name:'发布 Trick',exact:true}).click();assert.equal(await isolated.page.evaluate(()=>window.trickCalls.length),0,'storage failure blocks unknown-outcome create');await isolated.page.keyboard.press('Escape');assert.equal(await isolated.page.locator('.trick-editor').isVisible(),true);assert.match(await isolated.page.locator('.trick-editor .form-error').innerText(),/存储不可用/);await isolated.page.getByRole('button',{name:'丢弃草稿',exact:true}).click();await isolated.page.close();
 console.log('PASS tricks: compact directory, lazy Markdown, search/back, author/admin permissions, persistent drafts/reload/clientId, SHA conflict explicit resolution, delete confirmation, account/source isolation, 390px');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
