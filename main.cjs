const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
let server, window, origin;
let saveQueue = Promise.resolve();
const root = path.join(__dirname, 'renderer');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'";
async function startServer() {
  server = http.createServer(async (req,res)=>{
    try {
      if (req.headers.host !== new URL(origin).host) {res.writeHead(403).end();return;}
      if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405).end();return;}
      const pathname=decodeURIComponent(new URL(req.url,origin).pathname);
      const target=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if (!target.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
      const data=await fs.readFile(target);
      res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream','Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
      res.end(req.method==='HEAD'?undefined:data);
    } catch {res.writeHead(404).end('Not found');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  origin='http://127.0.0.1:'+server.address().port;
}
function trusted(event) {return window && event.sender===window.webContents && event.senderFrame?.url.startsWith(origin+'/');}
function createWindow() {
  window=new BrowserWindow({width:1440,height:960,minWidth:1050,minHeight:740,title:'Courtesy',backgroundColor:'#19141e',titleBarStyle:'hiddenInset',trafficLightPosition:{x:20,y:23},show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  window.webContents.session.setPermissionCheckHandler(()=>false);
  window.once('ready-to-show',()=>window.show());
  window.webContents.on('render-process-gone',()=>dialog.showErrorBox('Courtesy needs to restart','The game window stopped responding. Your last saved turn will be restored when you reopen Courtesy.'));
  window.on('closed',()=>{window=null;});
  window.loadURL(origin);
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
  app.whenReady().then(async()=>{
    app.setName('Courtesy');
    await startServer();
    const sessionFile=path.join(app.getPath('userData'),'match.json');
    ipcMain.handle('courtesy:read',async(event)=>{
      if(!trusted(event))throw new Error('Invalid sender');
      try{return JSON.parse(await fs.readFile(sessionFile,'utf8'));}
      catch(error){if(error.code==='ENOENT')return null;return {readError:true};}
    });
    ipcMain.handle('courtesy:save',async(event,data)=>{
      if(!trusted(event))throw new Error('Invalid sender');
      const serialized=JSON.stringify(data);
      if(!serialized||serialized.length>512000)throw new Error('Invalid session');
      saveQueue=saveQueue.catch(()=>{}).then(async()=>{
        await fs.mkdir(path.dirname(sessionFile),{recursive:true});
        await fs.writeFile(sessionFile+'.tmp',serialized,{mode:0o600});
        await fs.rename(sessionFile+'.tmp',sessionFile);
      });
      await saveQueue;
      return true;
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'Courtesy',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]},
      {label:'Edit',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},
      {label:'View',submenu:[{role:'togglefullscreen'}]},{role:'windowMenu'}
    ]));
    createWindow();
    app.on('activate',()=>{if(!window)createWindow();});
  }).catch(error=>{dialog.showErrorBox('Unable to open Courtesy',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  let flushing=false;
  app.on('before-quit',(event)=>{
    if(flushing)return;
    event.preventDefault();flushing=true;
    const finish=()=>{server?.close();app.quit();};
    saveQueue.then(finish,finish);
  });
}

