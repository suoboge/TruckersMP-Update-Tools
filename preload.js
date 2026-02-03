const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // 文件列表
    getFileList: () => ipcRenderer.invoke('get-file-list'),
    
    // 文件下载（带MD5校验）
    downloadFile: (url, filePath, targetDir, fileMD5) => 
        ipcRenderer.invoke('download-file', { url, filePath, targetDir, fileMD5 }),
    
    // 权限检查
    checkPermission: (dirPath) => ipcRenderer.invoke('check-permission', dirPath),
    
    // 目录选择
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    
    // 读取TruckersMP配置
    readTruckersmpConfig: () => ipcRenderer.invoke('read-truckersmp-config'),
    
    // 进度监听
    onDownloadProgress: (callback) => {
        ipcRenderer.on('download-progress', (event, data) => callback(data));
    },
    
    // 移除监听器
    removeAllListeners: (channel) => {
        ipcRenderer.removeAllListeners(channel);
    }
});

// 窗口控制
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, data) => ipcRenderer.send(channel, data)
    }
});