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
async function setup(browser,admin=false,rows=fixtureRows){
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
   saveTrick:async input=>{window.trickCalls.push({method:'save',input});if(window.failTrickSave)throw Error('fixture SHA conflict');const existing=payload.tricks.find(x=>x.path===input.path);const saved={...input,recommendation:input.recommendation===undefined?existing?.recommendation:input.recommendation??undefined,kind:'trick',id:'trick:'+input.clientId,authorId:existing?.authorId??2,author:existing?.author??{id:2,login:'alice',name:'陈一鸣'},path:input.path||'tricks/'+input.clientId+'.md',sha:'saved-sha',updatedAt:'2026-11-21T11:00:00Z',serverUrl:''};payload.tricks=[saved,...payload.tricks.filter(x=>x.path!==saved.path)];return saved;},
   deleteTrick:async input=>{window.trickCalls.push({method:'delete',input});payload.tricks=payload.tricks.filter(x=>x.path!==input.path);return {deleted:true,path:input.path};},openExternal:async()=>{}};
 },{rows,admin,sourceKey});
 await page.goto(pathToFileURL(appPath('ui/index.html')).href);await page.locator('.rail-nav-item[data-view="tricks"]').click();await page.mouse.move(1300,850);await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().width<=73);
 return {page,errors};
}
async function checkRanking(browser) {
  const prefix = 'algorithm-一维前缀和', basic = 'xcpc-基础线段树-1', lazy = 'xcpc-带标记的线段树-1';
  const withTier = (i, tier, prerequisiteIds, reason) => ({ ...fixtureRows[i], recommendation: { tier, prerequisiteIds, reason } });
  const ranked = [withTier(0,'A',[],'无需算法前置。'),withTier(1,'S',[basic,lazy],'进阶区间最值。'),withTier(2,'S',[prefix],'统一左边界。'),withTier(3,'B',[basic],'按需查看。'),fixtureRows[4],withTier(5,'B',['retired-algorithm'],'旧前置。'),
    ...['E','D','C'].map((tier,i)=>({...withTier(0,tier,['retired-algorithm'],'专项验收。'), path:`tricks/00000000-0000-4000-8000-00000000000${i+6}.md`}))];
  const {page,errors}=await setup(browser,true,ranked);
  try {
    assert.equal(await page.locator('.trick-row').first().getAttribute('data-path'),ranked[0].path);
    const outsideTags=path=>page.locator(`.trick-row[data-path="${path}"] .trick-row-tags .tag`);
    const assertColumns=async ()=>{
      const header=page.locator('.trick-column-prerequisites');
      assert.equal(await header.innerText(),'前置算法');
      assert.equal(await header.isVisible(),true);
      const tagColumn=await header.boundingBox();
      assert.ok(await page.locator('.trick-row').evaluateAll((rows,column)=>rows.every(row=>{
        const title=row.querySelector('.trick-row-title-cell').getBoundingClientRect();
        const tags=row.querySelector('.trick-row-prerequisites').getBoundingClientRect();
        return title.right<=tags.left&&Math.abs(tags.left-column.x)<1&&tags.right<=innerWidth&&row.scrollWidth<=row.clientWidth;
      }),tagColumn),'the prerequisite header aligns with a separate column to the right of each title');
    };
    await assertColumns();
    assert.deepEqual(await outsideTags(ranked[1].path).allTextContents(),['线段树']);
    assert.deepEqual(await outsideTags(ranked[2].path).allTextContents(),['前缀和']);
    for(const i of [0,4,5]) assert.equal(await outsideTags(ranked[i].path).count(),0);
    const search=page.getByRole('searchbox',{name:'搜索 Trick'});
    await search.fill('线段树');
    assert.deepEqual(await page.locator('.trick-row').evaluateAll(nodes=>nodes.map(node=>node.dataset.path)),[ranked[1].path,ranked[3].path]);
    await search.fill('');
    await page.locator('.tricks-view-ranking').click();
    await assertColumns();
    assert.ok(await page.locator('.trick-row').evaluateAll(rows=>rows.every(row=>row.getBoundingClientRect().height<=76)),'tagged ranking rows remain compact');
    assert.deepEqual(await outsideTags(ranked[1].path).allTextContents(),['线段树']);
    assert.deepEqual(await outsideTags(ranked[2].path).allTextContents(),['前缀和']);
    assert.deepEqual(await page.locator('.trick-rank-group').evaluateAll(nodes=>nodes.map(node=>node.dataset.tier)),['S','A','B','C','D','E','unrated']);
    assert.equal(await page.locator('.trick-rank-group[data-tier=S] h3').innerText(),'S 级 · 优先掌握');
    assert.equal(await page.locator('.trick-rank-group[data-tier=E] h3').innerText(),'E 级 · 备查参考');
    assert.match(await page.locator('.trick-rank-group[data-tier=S] .trick-tier-badge').first().getAttribute('title'),/满足前置后/);
    const guide=page.locator('.trick-tier-guide');
    await guide.locator('summary').click();
    assert.equal(await guide.locator('dt:visible').count(),7);
    assert.match(await guide.innerText(),/不是算法难度/);
    await guide.locator('summary').click();
    assert.deepEqual(await page.locator('.trick-rank-group[data-tier="S"] .trick-row').evaluateAll(nodes=>nodes.map(node=>node.dataset.path)),[ranked[1].path,ranked[2].path]);
    const picker=page.locator('.tricks-learned-algorithms');
    const select=async (container,label,id)=>{await container.locator('input[type=search]').fill(label);await container.locator(`input[data-algorithm-id="${id}"]`).check();};
    await picker.locator('input[type=search]').fill('线段树');
    for (const id of [basic,lazy]) {
      const choice=picker.locator('.trick-algorithm-choice').filter({has:page.locator(`input[data-algorithm-id="${id}"]`)});
      assert.deepEqual(await choice.locator('.trick-algorithm-tags .tag').allTextContents(),['线段树']);
    }
    const ready=page.locator('.tricks-ready-filter');
    await ready.check();assert.equal(await page.locator('.trick-row').count(),1);
    await select(picker,'一维前缀和',prefix);assert.equal(await page.locator('.trick-row').count(),2);
    await select(picker,'基础线段树',basic);assert.equal(await page.locator('.trick-row').count(),3,'advanced S needs both prerequisites');
    await select(picker,'懒标记线段树',lazy);assert.equal(await page.locator('.trick-row').count(),4);
    await picker.locator(`button[data-algorithm-id="${lazy}"]`).click();assert.equal(await page.locator('.trick-row').count(),3);
    await page.locator(`.trick-row[data-path="${ranked[2].path}"]`).click();assert.match(await page.locator('.trick-recommendation').innerText(),/一维前缀和.*统一左边界/s);
    assert.deepEqual(await page.locator('.trick-dependency .trick-algorithm-tags .tag').allTextContents(),['前缀和']);
    await page.keyboard.press('Escape');assert.equal(await ready.isChecked(),true);assert.equal(await page.locator('.trick-row').count(),3);
    await page.locator('.tricks-filter-reset').click();assert.equal(await page.locator('.trick-row').count(),ranked.length);
    await page.locator(`.trick-row[data-path="${ranked[1].path}"]`).click();
    const graph=page.getByRole('region',{name:'前置算法依赖图'});
    const checks=graph.getByRole('checkbox');
    const progress=graph.getByRole('progressbar',{name:'已满足的前置算法'});
    assert.equal(await checks.count(),2);
    assert.deepEqual(await graph.locator('.trick-algorithm-tags .tag').allTextContents(),['线段树','线段树']);
    assert.equal(await progress.getAttribute('max'),'2');
    assert.equal(await progress.getAttribute('value'),'0');
    await checks.first().check();
    assert.equal(await graph.locator('.trick-dependency-source[data-state=learned]').count(),1);
    assert.equal(await graph.locator('.trick-dependency-target').getAttribute('data-ready'),'false');
    await checks.last().check();
    assert.equal(await progress.getAttribute('value'),'2');
    assert.equal(await graph.locator('.trick-dependency-target').getAttribute('data-ready'),'true');
    await page.setViewportSize({width:390,height:844});
    assert.ok(await graph.evaluate(node=>{
      const frame=node.getBoundingClientRect(), target=node.querySelector('.trick-dependency-target').getBoundingClientRect();
      return frame.left>=0&&frame.right<=innerWidth&&node.scrollWidth<=node.clientWidth&&Array.from(node.querySelectorAll('.trick-dependency-node')).every(el=>el.getBoundingClientRect().right<target.left&&el.scrollWidth<=el.clientWidth);
    }),'graph fits on narrow viewports without overlapping labels or columns');
    await page.setViewportSize({width:1440,height:940});
    await page.keyboard.press('Escape');await ready.check();
    assert.equal(await page.locator(`.trick-row[data-path="${ranked[1].path}"]`).count(),1,'detail selections apply to ranking');
    await page.locator(`.trick-row[data-path="${ranked[1].path}"]`).click();await checks.last().uncheck();
    assert.equal(await progress.getAttribute('value'),'1');
    await page.keyboard.press('Escape');assert.equal(await page.locator(`.trick-row[data-path="${ranked[1].path}"]`).count(),0,'removing a prerequisite hides the trick in filtered ranking');
    await page.locator('.tricks-filter-reset').click();
    await page.locator(`.trick-row[data-path="${ranked[5].path}"]`).click();assert.match(await page.locator('.trick-prerequisite-unrecognized').innerText(),/retired-algorithm/);
    assert.equal(await checks.count(),0);assert.equal(await progress.getAttribute('value'),'0');
    assert.equal(await graph.locator('.trick-algorithm-tags .tag').count(),0);
    await page.keyboard.press('Escape');
    await page.locator(`.trick-row[data-path="${ranked[0].path}"]`).click();
    assert.equal(await graph.count(),0);assert.match(await page.locator('.trick-prerequisites').innerText(),/无/);
    await page.keyboard.press('Escape');
    await page.locator(`.trick-row[data-path="${ranked[4].path}"]`).click();await page.locator('.trick-edit').click();
    const editor=page.locator('.trick-editor');
    const tier=editor.locator('[name=recommendationTier]');
    assert.deepEqual(await tier.locator('option').evaluateAll(nodes=>nodes.map(node=>node.value)),['','S','A','B','C','D','E']);
    await tier.selectOption('E');
    assert.match(await editor.locator('.trick-tier-hint').innerText(),/无需专门练习/);
    await page.getByRole('button',{name:'保存修改',exact:true}).click();assert.match(await editor.locator('.form-error').innerText(),/推荐理由/);
    await editor.locator('[name=recommendationReason]').fill('适合已学前缀和的人使用。');
    await select(editor.locator('.trick-prerequisite-picker'),'一维前缀和',prefix);
    await page.getByRole('button',{name:'保存草稿并关闭',exact:true}).click();await page.locator('.trick-edit').click();
    assert.equal(await editor.locator('[name=recommendationTier]').inputValue(),'E');assert.equal(await editor.locator(`button[data-algorithm-id="${prefix}"]`).count(),1);
    await page.getByRole('button',{name:'保存修改',exact:true}).click();await editor.waitFor({state:'detached'});
    assert.deepEqual(await page.evaluate(()=>window.trickCalls.at(-1).input.recommendation),{tier:'E',prerequisiteIds:[prefix],reason:'适合已学前缀和的人使用。'});
    await page.locator('.trick-edit').click();await editor.locator('.trick-recommendation-clear').click();await page.getByRole('button',{name:'保存修改',exact:true}).click();await editor.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.trickCalls.at(-1).input.recommendation),null);
    await page.locator('.trick-edit').click();
    assert.equal(await editor.locator('[name=recommendationTier]').inputValue(),'');
    await editor.locator('.trick-recommendation-clear').click();
    await page.getByRole('button',{name:'保存草稿并关闭',exact:true}).click();
    await page.locator('.trick-edit').click();
    assert.match(await editor.locator('.trick-tier-hint').innerText(),/将清除/);
    await page.getByRole('button',{name:'保存修改',exact:true}).click();await editor.waitFor({state:'detached'});
    assert.equal(await page.evaluate(()=>window.trickCalls.at(-1).input.recommendation),null,'maintainer can explicitly clear a legacy malformed rating hidden as unrated');
    await page.keyboard.press('Escape');await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await assertColumns();
    await page.locator('.tricks-view-latest').click();
    await assertColumns();
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
  const author=await setup(browser,false,ranked);
  try {
    await author.page.locator('.trick-row').first().click();await author.page.locator('.trick-edit').click();
    assert.equal(await author.page.locator('.trick-recommendation-editor').count(),0);
    await author.page.locator('.trick-editor [name=introduction]').fill('只更新作者自己的简介');
    await author.page.getByRole('button',{name:'保存修改',exact:true}).click();await author.page.locator('.trick-editor').waitFor({state:'detached'});
    assert.equal(await author.page.evaluate(()=>Object.hasOwn(window.trickCalls.at(-1).input,'recommendation')),false);
    assert.match(await author.page.locator('.trick-recommendation').innerText(),/无需算法前置/);
  } finally {await author.page.close();}
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
 await checkRanking(browser);
 console.log('PASS tricks: recommendation ranking and review, compact directory, lazy Markdown, search/back, author/admin permissions, persistent drafts/reload/clientId, SHA conflict explicit resolution, delete confirmation, account/source isolation, 390px');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
