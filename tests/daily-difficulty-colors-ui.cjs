'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {appPath}=require('./app-path.cjs');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
const page=await browser.newPage();await page.setContent('<!doctype html><html><body></body></html>');
for(const css of ['styles.css','appearance.css','daily-problem.css'])await page.addStyleTag({path:appPath('ui/'+css)});
await page.addScriptTag({path:appPath('ui/daily-problem.js')});
await page.evaluate(()=>{window.colorFixture={};document.body.append(window.DailyProblem.create({contextKey:'color-fixture',draw:async()=>window.colorFixture,openExternal:()=>{},chooseTags:()=>{}}));});
const cfCases=[[800,'gray'],[1199,'gray'],[1200,'green'],[1399,'green'],[1400,'cyan'],[1600,'blue'],[1900,'purple'],[2100,'orange'],[2400,'red'],[3000,'red']];
const lgCases=[['入门','red'],['普及-','orange'],['普及','yellow'],['普及+/提高-','green'],['提高','cyan'],['提高+/省选−','blue'],['省选/NOI-','purple'],['NOI/NOI+/CTS','black']];
let count=0;const palettes=['porcelain','blue','violet','rose','amber','teal'];
for(const theme of ['light','dark'])for(const palette of palettes){await page.evaluate(({theme,palette})=>{document.body.dataset.theme=theme;document.body.dataset.palette=palette;},{theme,palette});
for(const [i,[rating,tone]] of cfCases.entries()){
 const [level,lgTone]=lgCases[i%lgCases.length];
 for(const native of [false,true]){
 await page.evaluate(({rating,level,native})=>{window.colorFixture={problem:{id:'color',title:'Color fixture',source:native?'CF':'AT',rating:native?rating:null,estimatedCfRating:native?null:rating,luoguDifficulty:native?level:'',estimatedLuoguDifficulty:native?null:level,tags:[],url:'https://example.com/problem'}};},{rating,level,native});
 await page.locator('.daily-draw').click();await page.waitForFunction(()=>document.querySelector('.daily-problem-result').getAttribute('aria-busy')==='false');
 for(const [selector,expected] of [['.daily-cf',tone],['.daily-luogu',lgTone]]){const result=await page.locator(selector).evaluate((node,expected)=>{const style=getComputedStyle(node),sample=document.createElement('span');sample.style.color='var(--tone-'+expected+')';node.append(sample);const color=getComputedStyle(sample).color;sample.remove();return {tone:node.classList.contains('tone-'+expected),color:style.color,expected:color};},expected);assert.equal(result.tone,true,`${theme}/${palette}/${selector}/${rating}/${level}`);assert.equal(result.color,result.expected,JSON.stringify(result));}
 assert.match(await page.locator('.daily-cf').innerText(),native?/原生/:/参考/);count++;
 }
}
await page.evaluate(()=>{window.colorFixture={problem:{id:'unknown',title:'Unknown',source:'NC',rating:null,estimatedCfRating:null,luoguDifficulty:'暂无评定',tags:[],url:'https://example.com'}};});await page.locator('.daily-draw').click();await page.waitForFunction(()=>document.querySelector('.daily-problem-title')?.textContent==='Unknown');assert.equal(await page.locator('.daily-cf.difficulty-badge,.daily-luogu.difficulty-badge').count(),0);assert.equal(await page.locator('.daily-cf.daily-unrated,.daily-luogu.daily-unrated').count(),2);
}
console.log(`DAILY DIFFICULTY COLORS PASS: ${count} native/reference rating/level cases across 2 modes x 6 palettes, exact shared colors, unknown remains neutral`);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
