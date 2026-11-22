'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {_electron:electron}=require('playwright');
const {appPath}=require('./app-path.cjs');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'qmx-trick-desktop-'));
const repo='fixture/tricks',sourceKey='https://api.github.com|'+repo,clientId='44444444-4444-4444-8444-444444444444';
const trick={id:'trick:tricks/'+clientId+'.md',kind:'trick',clientId,path:'tricks/'+clientId+'.md',sha:'fixture-sha',title:'桌面缓存验收',introduction:'列表只展示简介，正文点击才显示。',body:'# 独立正文\n\n**缓存可离线阅读**。',authorId:2,author:{id:2,login:'fixture'},updatedAt:'2026-11-21T10:00:00Z',repo,sourceKey,serverUrl:''};
const cache={repo,records:[],issues:[],tricks:[trick],algorithmNotes:[]};
fs.writeFileSync(path.join(profile,'settings.json'),JSON.stringify({repo,autoSync:false}));
fs.writeFileSync(path.join(profile,'cache.json'),JSON.stringify({...cache,repos:{[sourceKey]:cache}}));
const env={...process.env,QMX_USER_DATA_DIR:profile};delete env.ELECTRON_RUN_AS_NODE;
(async()=>{let app;try{
 async function launch(){app=await electron.launch({executablePath:require('electron'),args:[appPath('.'), '--disable-gpu'],env,timeout:45000});const page=await app.firstWindow();page.setDefaultTimeout(12000);await page.locator('.rail-nav-item[data-view="tricks"]').click();await page.locator('.trick-row').waitFor();return page;}
 let page=await launch();assert.equal(await page.locator('.trick-content').count(),0);assert.equal(await page.locator('.trick-create').count(),0);await page.locator('.trick-row').click();assert.equal(await page.locator('.trick-content strong').innerText(),'缓存可离线阅读');
 const bootstrap=await page.evaluate(()=>window.notebook.bootstrap());assert.deepEqual(bootstrap.tricks,[trick]);
 await page.evaluate(async()=>{const v=await window.notebook.bootstrap();v.local.trickAcceptanceOpaque={keep:true};await window.notebook.updateLocal(v.local);});
 const prefs=await app.evaluate(({BrowserWindow})=>{const p=BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();return {sandbox:p.sandbox,contextIsolation:p.contextIsolation,nodeIntegration:p.nodeIntegration};});assert.deepEqual(prefs,{sandbox:true,contextIsolation:true,nodeIntegration:false});
 await app.close();app=null;page=await launch();assert.equal(await page.locator('.trick-content').count(),0);const restored=await page.evaluate(()=>window.notebook.bootstrap());assert.deepEqual(restored.tricks,[trick]);assert.equal(restored.local.trickAcceptanceOpaque.keep,true);console.log(JSON.stringify({pass:true,profile,realElectron:true,isolatedPreload:true,defaultSandbox:true,cacheRestart:true,opaqueLocalPreserved:true}));
 }finally{if(app)await app.close();}})().catch(e=>{console.error(e);process.exitCode=1});
