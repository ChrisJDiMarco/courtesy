import {_electron as electron,expect} from '@playwright/test';
import {initialState,validateState} from '../src/game.js';
import {chooseAction} from '../src/bot.js';
import {writeFile} from 'node:fs/promises';
const app=await electron.launch({args:['.'],cwd:process.cwd()});
const page=await app.firstWindow();page.setDefaultTimeout(12000);
const read=()=>page.evaluate(()=>window.courtesy.readSession());
try{
 await page.waitForSelector('#app[data-ready="true"]');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(data=>window.courtesy.saveSession(data),{version:1,state:initialState(),history:[],mode:'ai',difficulty:'thoughtful',firstPlayer:0,sound:false});
 await page.reload();await page.waitForSelector('#app[data-ready="true"]');
 let state=(await read()).state;const moves=[];
 for(let turn=0;turn<200&&state.winner===null;turn++){
  await expect.poll(async()=>{const s=(await read()).state;return s.winner!==null||s.turn===0;},{timeout:15000}).toBe(true);
  state=(await read()).state;if(state.winner!==null)break;await page.waitForTimeout(150);
  const action=chooseAction(state,{difficulty:'casual',timeMs:8});console.log('PLAY',state.ply,action,await page.locator('#turn-eyebrow').textContent());
  if(action.type!=='pass')await page.locator('[data-pot="'+action.pot+'"]').click();
  await expect(page.locator('#commit-button')).toBeEnabled();
  await page.locator('#commit-button').click();
  await expect.poll(async()=>{const s=(await read()).state;return s.winner!==null||(s.ply>state.ply&&s.turn===0);},{timeout:15000}).toBe(true);
  state=(await read()).state;expect(validateState(state)).toBe(true);moves.push({ply:state.ply,scores:state.scores,hands:state.hands});
 }
 expect(state.winner).not.toBeNull();
 await expect(page.locator('#winner-dialog')).toBeVisible();
 await page.screenshot({path:'verification/full-game-result.png'});
 const finished=state;
 await page.reload();await page.waitForSelector('#app[data-ready="true"]');expect((await read()).state).toEqual(finished);
 const result={winner:state.winner,scores:state.scores,plies:state.ply,validEveryTurn:true,restoredFinishedMatch:true,moves};
 await writeFile('verification/full-game.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,moves:undefined}));
 await page.evaluate(data=>window.courtesy.saveSession(data),{version:1,state:initialState(),history:[],mode:'ai',difficulty:'thoughtful',firstPlayer:0,sound:false});
}catch(error){await page.screenshot({path:'verification/full-game-error.png'});console.log('ERRORSTATE',await read(),await page.locator('.turn-console').innerText());throw error;}finally{await app.close();}
