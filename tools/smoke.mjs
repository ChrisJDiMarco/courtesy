import {_electron as electron,expect} from '@playwright/test';
import {initialState,applyAction,legalActions} from '../src/game.js';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('verification',{recursive:true});
const app=await electron.launch({args:['.'],cwd:process.cwd()});
const page=await app.firstWindow();page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const receipt=[];
async function read(){return page.evaluate(()=>window.courtesy.readSession());}
async function ready(){await page.waitForSelector('#app[data-ready="true"]',{timeout:30000});}
async function seed(state,mode='local',history=[]){await page.evaluate(data=>window.courtesy.saveSession(data),{version:1,state,history,mode,difficulty:'casual',firstPlayer:0,sound:false});await page.reload();await ready();}
async function action(index){await page.locator('[data-pot="'+index+'"]').click();await expect(page.locator('#commit-button')).toBeEnabled();await page.locator('#commit-button').click();await page.waitForTimeout(880);}
try{
 await ready();
 await seed(initialState());
 await page.getByRole('button',{name:'How to play',exact:true}).click();
 await expect(page.locator('#rules-dialog')).toBeVisible();
 await page.getByRole('button',{name:'Back to the table',exact:true}).click();
 await page.keyboard.press('1');await page.keyboard.press('Enter');await page.waitForTimeout(900);
 expect((await read()).state.hands).toEqual([11,12]);
 receipt.push('Rules dialog and 1 + Enter keyboard start');
 await action(0);expect((await read()).state.pots[0]).toEqual({count:3,owner:1});
 await action(1);await action(1);await action(2);await action(2);
 expect((await read()).state.hands).toEqual([9,6]);
 await action(0);await action(1);
 expect((await read()).state.hands).toEqual([8,6]);expect((await read()).state.scores).toEqual([0,3]);
 await action(2);await action(1);await action(0);await action(2);
 const trap=(await read()).state;
 expect(trap.pots[2]).toEqual({count:15,owner:1});expect(trap.scores).toEqual([7,3]);
 receipt.push('Full legal opening and two-sevens financing trap in rendered controls');
 await page.screenshot({path:'verification/trap.png'});
 await page.getByRole('button',{name:'Undo',exact:false}).click();
 expect((await read()).state.pots[2]).toEqual({count:7,owner:0});
 receipt.push('Local undo restores pre-move ownership and counters');
 await page.locator('#view-button').click();await page.waitForTimeout(800);
 await page.screenshot({path:'verification/overhead.png'});
 await page.locator('#reset-view').click();
 receipt.push('Overhead and reset controls');
 await page.reload();await ready();expect((await read()).state.pots[2]).toEqual({count:7,owner:0});
 receipt.push('Match survives renderer reload');
 await seed(initialState(),'ai');await action(0);
 await expect(page.locator('#turn-eyebrow')).toContainText('YOUR MOVE',{timeout:10000});
 expect((await read()).state.ply).toBe(2);
 await page.getByRole('button',{name:'Undo',exact:false}).click();
 expect((await read()).state).toEqual(initialState());
 receipt.push('Computer reply and undo of complete human/computer turn');
 await action(0);await page.getByRole('button',{name:'How to play',exact:true}).click();
 const frozen=(await read()).state.ply;await page.waitForTimeout(1500);expect((await read()).state.ply).toBe(frozen);
 await page.getByRole('button',{name:'Back to the table',exact:true}).click();
 await expect(page.locator('#turn-eyebrow')).toContainText('YOUR MOVE',{timeout:10000});
 receipt.push('Rules pause computer and closing resumes it');
 const nearWin=applyAction(initialState(),{type:'start',pot:0});nearWin.turn=0;nearWin.scores[0]=24;
 await seed(nearWin);await action(0);
 await expect(page.locator('#winner-dialog')).toBeVisible();expect((await read()).state.winner).toBe(0);
 await page.screenshot({path:'verification/winner.png'});
 await page.locator('#rematch-button').click();expect((await read()).state).toEqual(initialState(1));
 receipt.push('Immediate victory and rematch switches first player');
 await seed(initialState());
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1100,760));await page.waitForTimeout(800);
 for(const button of await page.locator('[data-pot]').all())await expect(button).toBeInViewport();
 await page.screenshot({path:'verification/compact.png'});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1440,960));
 await seed(initialState(),'ai');await page.waitForTimeout(900);
 await page.screenshot({path:'verification/initial.png'});
 expect(errors).toEqual([]);
 receipt.push('Compact window: all pot controls visible; no renderer exceptions');
 console.log(JSON.stringify({passed:receipt,errors},null,2));
 await writeFile('verification/smoke.json',JSON.stringify({passed:receipt,errors},null,2));
}finally{await app.close();}
