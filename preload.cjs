const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('courtesy',Object.freeze({
  readSession:()=>ipcRenderer.invoke('courtesy:read'),
  saveSession:(data)=>ipcRenderer.invoke('courtesy:save',data)
}));

