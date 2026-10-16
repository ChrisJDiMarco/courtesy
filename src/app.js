import './style.css';
import {initialState,legalActions,applyAction,validateState} from './game.js';
import {createScene} from './scene.js';

const $ = id => document.getElementById(id);
const potButtons = [...document.querySelectorAll('[data-pot]')];
const numerals = ['I','II','III'];
let state=initialState(), history=[], mode='ai', difficulty='thoughtful', firstPlayer=0;
let selected=null, scene=null, thinking=false, busy=false, view='perspective', sound=false;
let worker=null, requestId=0, botTimer=null, busyTimer=null, toastTimer=null, winnerTimer=null;
let audio=null, saveFailed=false, botFailed=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const playerName=p=>p===0?(mode==='ai'?'You':'Ivory'):'Violet';
const possessive=p=>p===0&&mode==='ai'?'Your':playerName(p)+'’s';
const modalOpen=()=>Boolean(document.querySelector('dialog[open]'));
const humanTurn=()=>state.winner===null && (mode==='local'||state.turn===0);
const canUndo=()=>mode==='local'?history.length>0:history.some(entry=>entry.before.turn===0);

function toast(message) {
  clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;
  toastTimer=setTimeout(()=>{$('toast').hidden=true;},4200);
}
async function save() {
  const session={version:1,state,history:history.slice(-200),mode,difficulty,firstPlayer,sound};
  try {
    if(window.courtesy) await window.courtesy.saveSession(session);
    else localStorage.setItem('courtesy-session',JSON.stringify(session));
    $('save-status').textContent=window.courtesy?'SAVED ON THIS MAC':'SAVED IN THIS BROWSER';
    saveFailed=false;
  } catch {
    $('save-status').textContent='NOT SAVED';
    if(!saveFailed)toast('Your match could not be saved. Keep this window open to continue.');
    saveFailed=true;
  }
}
function validSession(session) {
  if(!session||session.version!==1||!validateState(session.state)||!['ai','local'].includes(session.mode)||!['casual','thoughtful'].includes(session.difficulty)||![0,1].includes(session.firstPlayer)||!Array.isArray(session.history)||session.history.length>200)return false;
  return session.history.every(entry=>{
    if(!entry||!validateState(entry.before)||typeof entry.label!=='string')return false;
    try{applyAction(entry.before,entry.action);return true;}catch{return false;}
  });
}
function cancelAI() {
  requestId++;clearTimeout(botTimer);botTimer=null;thinking=false;
}
function buildWorker() {
  worker?.terminate();
  worker=new Worker(new URL('./bot-worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.id!==requestId||mode!=='ai'||state.turn!==1||state.winner!==null)return;
    thinking=false;
    if(modalOpen()){render();return;}
    if(data.error||!data.action){
      botFailed=true;
      toast('Violet could not finish that thought. Try again.');
      render();showRetry();return;
    }
    try{botFailed=false;commit(data.action,true);}catch(error){botFailed=true;console.error(error);toast('Violet’s move was not legal. Try again.');render();showRetry();}
  };
  worker.onerror=event=>{
    console.error('Computer opponent failed',event.message);botFailed=true;cancelAI();render();showRetry();
    toast('The computer opponent stopped. Retry its turn or start a local game.');
  };
}
function showRetry() {
  if(mode!=='ai'||state.turn!==1||state.winner!==null)return;
  const button=document.createElement('button');button.className='primary-button';button.textContent='Retry Violet’s turn';
  button.onclick=()=>{botFailed=false;buildWorker();scheduleAI();};$('action-area').replaceChildren(button);
}
function scheduleAI() {
  if(mode!=='ai'||state.turn!==1||state.winner!==null||modalOpen()||thinking||botFailed)return;
  thinking=true;render();
  const id=++requestId;
  botTimer=setTimeout(()=>{
    if(id!==requestId||modalOpen()){thinking=false;render();return;}
    worker.postMessage({id,state,difficulty});
  },reduced.matches?100:650);
}
function chime(type) {
  if(!sound)return;
  try {
    audio??=new AudioContext();
    if(audio.state==='suspended')audio.resume();
    const notes=type==='collect'?[523.25,659.25,783.99]:type==='take'?[392,523.25]:[659.25];
    notes.forEach((frequency,i)=>{
      const oscillator=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*.055;
      oscillator.type='sine';oscillator.frequency.value=frequency;
      gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.035,t+.009);gain.gain.exponentialRampToValueAtTime(.0001,t+.28);
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(t);oscillator.stop(t+.3);
    });
  } catch(error){console.warn('Sound unavailable',error);}
}
function actionLabel(before,action) {
  const name=playerName(before.turn),verb=name==='You'?'':'s';
  if(action.type==='pass')return name+' pass'+(name==='You'?'':'es')+' — no legal action.';
  const count=before.pots[action.pot].count,pot='pot '+numerals[action.pot];
  if(action.type==='start')return name+' start'+verb+' '+pot+' with 1 counter.';
  if(action.type==='take')return name+' take'+verb+' '+pot+' for '+(count+1)+' counters. Its value is now '+(count*2+1)+'.';
  return name+' collect'+verb+' '+count+' point'+(count===1?'':'s')+'. '+playerName(1-before.turn)+' receive'+(1-before.turn===0&&mode==='ai'?'':'s')+' '+count+' counter'+(count===1?'':'s')+'.';
}
function commit(action,fromBot=false) {
  if(state.winner!==null||(!fromBot&&(!humanTurn()||busy||modalOpen())))return;
  const next=applyAction(state,action);
  const entry={before:state,action,label:actionLabel(state,action)};
  history.push(entry);if(history.length>200)history.shift();
  state=next;selected=null;scene?.setSelected(null);scene?.update(state);
  chime(action.type);busy=true;clearTimeout(busyTimer);
  busyTimer=setTimeout(()=>{busy=false;render();scheduleAI();},reduced.matches?80:800);
  render();save();
  if(state.winner!==null){
    clearTimeout(winnerTimer);
    winnerTimer=setTimeout(showWinner,reduced.matches?80:1200);
  }
}
function selectPot(index) {
  selected=index;scene?.setSelected(index);render();
}
function addAction(text,action,hint='',disabled=false) {
  const wrap=$('action-area');wrap.replaceChildren();
  const button=document.createElement('button');button.className='primary-button';button.id='commit-button';
  button.textContent=text;button.disabled=disabled||busy||thinking||!humanTurn();
  button.onclick=()=>commit(action);wrap.append(button);
  if(hint){const note=document.createElement('div');note.className='action-hint';note.textContent=hint;wrap.append(note);}
}
function render() {
  for(let p=0;p<2;p++){
    $('name-'+p).textContent=playerName(p);
    $('player-'+p).classList.toggle('active',state.turn===p&&state.winner===null);
    $('player-'+p).classList.toggle('thinking',thinking&&p===1);
    $('score-'+p).textContent=state.scores[p];$('hand-'+p).textContent=state.hands[p];
    $('progress-'+p).style.width=Math.min(100,state.scores[p]*4)+'%';
  }
  $('mode-caption').textContent=mode==='ai'?'YOU & VIOLET · '+difficulty.toUpperCase():'IVORY & VIOLET · LOCAL TWO-PLAYER';
  $('last-move').textContent=history.at(-1)?.label??'You keep the points. Your opponent gets the counters.';
  $('undo-button').disabled=!canUndo();
  $('sound-button').setAttribute('aria-pressed',String(sound));
  $('sound-button').querySelector('span').textContent='Sound '+(sound?'on':'off');
  potButtons.forEach((button,i)=>{
    const pot=state.pots[i];
    button.classList.toggle('selected',selected===i);
    button.classList.toggle('owner-0',pot.owner===0);button.classList.toggle('owner-1',pot.owner===1);
    button.querySelector('.pot-amount').textContent=pot.count||'Empty';
    button.querySelector('.pot-owner').textContent=pot.owner===null?'Start with 1':possessive(pot.owner)+' claim';
    button.setAttribute('aria-label','Pot '+numerals[i]+': '+(pot.count?pot.count+' counters, '+possessive(pot.owner)+' claim':'empty'));
    button.setAttribute('aria-pressed',String(selected===i));
  });
  const title=$('turn-title'),description=$('turn-description'),area=$('action-area');
  $('turn-eyebrow').textContent=(state.winner!==null?'MATCH COMPLETE':(state.turn===0&&mode==='ai'?'YOUR MOVE':playerName(state.turn).toUpperCase()+'’S MOVE'))+' · TURN '+(state.ply+1);
  area.replaceChildren();
  if(state.winner!==null){
    title.textContent=playerName(state.winner)+(state.winner===0&&mode==='ai'?' win.':' wins.');
    description.textContent='A new round begins with the other player.';
    const again=document.createElement('button');again.className='primary-button';again.textContent='Play again ↗';again.onclick=rematch;area.append(again);return;
  }
  if(!humanTurn()){
    if(botFailed){title.textContent='Violet lost her train of thought.';description.textContent='Your position is safe. Retry the computer’s turn.';showRetry();return;}
    title.textContent=thinking?'Violet is considering…':'Violet’s move.';
    description.textContent='A gift now can become a threat later.';
    const note=document.createElement('span');note.className='select-prompt';note.textContent=thinking?'Reading the table':'The other side of the table';area.append(note);return;
  }
  const actions=legalActions(state);
  if(actions[0]?.type==='pass'){
    title.textContent='Nothing to spend. Nothing to collect.';
    description.textContent='No legal action is available. Pass the turn.';
    addAction('Pass turn →',{type:'pass'});return;
  }
  if(selected===null){
    title.textContent=state.ply===0?'A little generosity.':(mode==='ai'?'Your move.':playerName(state.turn)+'’s move.');
    description.textContent=state.ply===0?'Choose a dish. A counter is all it takes to begin.':'Choose a pot to inspect your next move.';
    const prompt=document.createElement('span');prompt.className='select-prompt';prompt.textContent='Select a pot on the table ↗';area.append(prompt);return;
  }
  const pot=state.pots[selected],action=actions.find(a=>a.pot===selected);
  if(!pot.count){
    title.textContent='Begin something.';
    description.textContent='Place 1 counter in pot '+numerals[selected]+'. It becomes your claim.';
    addAction('Start pot '+numerals[selected]+' · 1 counter',{type:'start',pot:selected},'Your reserve: '+state.hands[state.turn]+' → '+(state.hands[state.turn]-1),!action);
  }else if(pot.owner===state.turn){
    const other=1-state.turn,newHand=state.hands[other]+pot.count;
    const exposed=state.pots.filter((p,i)=>i!==selected&&p.owner===state.turn&&state.hands[other]<p.count+1&&newHand>=p.count+1);
    title.textContent='The points are yours.';
    description.textContent='Score '+pot.count+'. Give '+(mode==='ai'&&other===0?'yourself':playerName(other))+' all '+pot.count+' counter'+(pot.count===1?'':'s')+'.';
    addAction('Collect '+pot.count+' point'+(pot.count===1?'':'s'),{type:'collect',pot:selected},exposed.length?'This funds a takeover of your other claim.':possessive(other)+' reserve: '+state.hands[other]+' → '+newHand);
  }else{
    const cost=pot.count+1;
    title.textContent=action?'Make it yours.':'A claim beyond your reach.';
    description.textContent=action?'Add '+cost+' counters to take pot '+numerals[selected]+'. Its value becomes '+(pot.count*2+1)+'.':'Taking this pot costs '+cost+' counters. You have '+state.hands[state.turn]+'.';
    addAction('Take pot '+numerals[selected]+' · '+cost+' counters',{type:'take',pot:selected},action?'The pot can still change hands.':'Choose another pot.',!action);
  }
}
function undo() {
  if(!canUndo())return;
  cancelAI();botFailed=false;clearTimeout(busyTimer);clearTimeout(winnerTimer);busy=false;
  $('winner-dialog').close();
  let entry=history.pop();state=entry.before;
  if(mode==='ai')while(state.turn===1&&history.length){entry=history.pop();state=entry.before;}
  selected=null;scene?.setSelected(null);scene?.update(state);render();save();scheduleAI();
}
function newGame(nextMode=mode,nextDifficulty=difficulty,start=1-firstPlayer) {
  cancelAI();botFailed=false;clearTimeout(busyTimer);clearTimeout(winnerTimer);busy=false;
  mode=nextMode;difficulty=nextDifficulty;firstPlayer=start;
  state=initialState(start);history=[];selected=null;
  document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close());
  scene?.setSelected(null);scene?.update(state);render();save();scheduleAI();
}
function rematch(){newGame();}
function showWinner() {
  if(state.winner===null)return;
  const name=playerName(state.winner);
  $('winner-title').textContent=name+(name==='You'?' win.':' wins.');
  $('winner-score').textContent=state.scores[0]+' — '+state.scores[1];
  $('winner-description').textContent=state.winner===0?'The points are yours. What will you try next?':'One collection can change everything. Take another seat.';
  if(!modalOpen())$('winner-dialog').showModal();
}
function openDialog(id) {cancelAI();render();$(id).showModal();}
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{scheduleAI();}));
potButtons.forEach(button=>button.onclick=()=>selectPot(Number(button.dataset.pot)));
$('undo-button').onclick=undo;
$('rules-button').onclick=()=>openDialog('rules-dialog');
$('new-button').onclick=()=>{
  $('game-mode').value=mode;$('difficulty').value=difficulty;$('first-player').value=String(1-firstPlayer);
  $('difficulty-field').hidden=mode!=='ai';openDialog('new-dialog');
};
$('game-mode').onchange=()=>{$('difficulty-field').hidden=$('game-mode').value!=='ai';};
$('new-form').onsubmit=event=>{event.preventDefault();newGame($('game-mode').value,$('difficulty').value,Number($('first-player').value));};
$('rematch-button').onclick=rematch;
$('view-button').onclick=()=>{view=view==='perspective'?'top':'perspective';scene?.setView(view);$('view-button').querySelector('span').textContent=view==='top'?'Perspective':'Overhead';};
$('reset-view').onclick=()=>{view='perspective';scene?.resetView();$('view-button').querySelector('span').textContent='Overhead';};
$('sound-button').onclick=()=>{sound=!sound;chime('start');render();save();};
document.addEventListener('keydown',event=>{
  if(modalOpen()||event.altKey||event.ctrlKey||event.metaKey||['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName))return;
  if(['1','2','3'].includes(event.key)){event.preventDefault();selectPot(Number(event.key)-1);$('commit-button')?.focus();}
  if(event.key==='Enter'&&(event.target.tagName!=='BUTTON'||event.target.matches('[data-pot]'))){event.preventDefault();$('commit-button')?.click();}
  if(event.key.toLowerCase()==='r')$('reset-view').click();
});
reduced.addEventListener('change',()=>scene?.setReducedMotion(reduced.matches));
async function init() {
  try {
    const session=window.courtesy?await window.courtesy.readSession():JSON.parse(localStorage.getItem('courtesy-session')||'null');
    if(session&&validSession(session)){({state,history,mode,difficulty,firstPlayer}=session);sound=Boolean(session.sound);}
    else if(session)toast('The saved match could not be restored. A fresh table is ready.');
  }catch(error){console.warn('Restore failed',error);toast('The saved match could not be read. A fresh table is ready.');}
  try {
    scene=createScene({canvas:$('table'),onPotSelect:selectPot,onProject:positions=>{
      positions.forEach((position,i)=>{
        potButtons[i].style.left=position.x+'px';potButtons[i].style.top=position.y+'px';potButtons[i].style.visibility=position.visible?'visible':'hidden';
      });
    },onReady:()=>{$('app').dataset.ready='true';}});
    scene.setReducedMotion(reduced.matches);scene.update(state,{animate:false});
  }catch(error){
    console.error('Table renderer failed',error);$('render-error').hidden=false;
    potButtons.forEach((button,i)=>{button.style.left=(30+i*20)+'%';button.style.top='53%';});
  }
  buildWorker();render();save();scheduleAI();
  if(state.winner!==null)showWinner();
}
window.addEventListener('beforeunload',()=>{worker?.terminate();scene?.dispose();audio?.close();});
init();

