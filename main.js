const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');

// 窗口控制
ipcMain.on('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('close-window', () => {
    if (mainWindow) mainWindow.close();
});

let mainWindow;

function createWindow() {
        // 启动时权限检查
        try {
            const testFile = path.join('C:\\ProgramData\\TruckersMP', 'tmp_test_permission.txt');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
        } catch (error) {
            if (error.code === 'EPERM') {
                dialog.showErrorBox('权限不足', '请右键点击程序，选择"以管理员身份运行"');
                app.quit();
                return;
            }
        }
        
        // 启动时自动读取TruckersMP配置
        try {
            const appDataPath = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
            const configPath = path.join(appDataPath, 'TruckersMP', 'launcher-options.json');
            
            if (fs.existsSync(configPath)) {
                const configData = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configData);
                
                if (config.installPath) {
                    console.log('启动时检测到TruckersMP安装路径:', config.installPath);
                    // 可以在这里做一些初始化工作
                }
            }
        } catch (error) {
            console.log('启动时读取TruckersMP配置失败（非致命错误）:', error.message);
        }

    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: 'TMP更新工具',
        icon: path.join(__dirname, 'assets/icon.ico'),
        // 隐藏默认标题栏，使用自定义标题栏
        frame: false,
        // 启用透明背景以支持圆角效果
        transparent: true,
        // 强制要求管理员权限
        win32: {
            requestedExecutionLevel: 'requireAdministrator'
        }
    });

    mainWindow.loadFile('index.html');
}

// 计算文件的MD5哈希值
function calculateFileMD5(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('md5');
        const stream = fs.createReadStream(filePath);
        
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (error) => reject(error));
    });
}

// 检查文件是否需要更新（MD5校验）
async function checkFileNeedUpdate(filePath, expectedMD5) {
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`文件不存在，需要下载: ${filePath}`);
            return true;
        }
        
        const actualMD5 = await calculateFileMD5(filePath);
        const needsUpdate = actualMD5 !== expectedMD5;
        
        if (needsUpdate) {
            console.log(`文件MD5不匹配，需要更新: ${filePath}`);
            console.log(`  期望MD5: ${expectedMD5}`);
            console.log(`  实际MD5: ${actualMD5}`);
        } else {
            console.log(`文件MD5匹配，跳过更新: ${filePath}`);
        }
        
        return needsUpdate;
    } catch (error) {
        console.error(`检查文件MD5失败: ${filePath}`, error);
        return true; // 如果检查失败，默认需要更新
    }
}

// 获取文件列表
ipcMain.handle('get-file-list', async () => {
    try {
        console.log('正在获取文件列表...');
        const response = await axios.get('https://da.vtcm.link/other/tmpFileList', {
            timeout: 10000,
            headers: {
                'User-Agent': 'TMP-Update-Tool/1.0.0'
            }
        });
        
        if (response.data && response.data.code === 200) {
            console.log(`成功获取 ${response.data.data.length} 个文件`);
            
            // 确保每个文件对象都有MD5字段
            const filesWithMD5 = response.data.data.map(file => {
                if (!file.md5) {
                    console.warn(`文件缺少MD5字段: ${file.filePath}`);
                    file.md5 = ''; // 添加空MD5字段
                }
                return file;
            });
            
            return filesWithMD5;
        }
        throw new Error('API返回的数据格式不正确');
    } catch (error) {
        console.error('获取文件列表失败:', error.message);
        throw new Error(`获取文件列表失败: ${error.message}`);
    }
});

// 文件下载（带MD5校验）
ipcMain.handle('download-file', async (event, { url, filePath, targetDir, fileMD5 }) => {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('开始下载:', url, '->', targetDir);
            
            // 清理路径
            let cleanPath = filePath.replace(/^[\/\\]/, '').replace(/^tmp_file[\/\\]/, '');
            cleanPath = cleanPath.replace(/\//g, '\\');
            const fullPath = path.join(targetDir, cleanPath);
            
            // 检查文件是否需要更新（MD5校验）
            if (fileMD5) {
                const needsUpdate = await checkFileNeedUpdate(fullPath, fileMD5);
                if (!needsUpdate) {
                    console.log(`文件已是最新，跳过下载: ${filePath}`);
                    resolve({ skipped: true, reason: 'MD5匹配' });
                    return;
                }
            }
            
            // 创建目录
            const dir = path.dirname(fullPath);
            await fs.promises.mkdir(dir, { recursive: true });
            
            // 下载文件
            const response = await axios({
                url,
                responseType: 'stream',
                timeout: 30000
            });
            
            const writer = fs.createWriteStream(fullPath);
            let downloadedBytes = 0;
            const totalBytes = parseInt(response.headers['content-length'] || '0', 10);

            // 进度更新
            response.data.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                    const progress = Math.round((downloadedBytes / totalBytes) * 100);
                    event.sender.send('download-progress', {
                        filePath,
                        progress,
                        downloadedBytes,
                        totalBytes
                    });
                }
            });

            response.data.pipe(writer);
            
            writer.on('finish', async () => {
                console.log('下载完成:', fullPath);
                
                // 下载完成后验证MD5（如果有提供MD5）
                if (fileMD5) {
                    try {
                        const actualMD5 = await calculateFileMD5(fullPath);
                        if (actualMD5 !== fileMD5) {
                            console.error(`MD5校验失败: ${filePath}`);
                            console.error(`  期望: ${fileMD5}`);
                            console.error(`  实际: ${actualMD5}`);
                            reject(new Error(`MD5校验失败: ${filePath}`));
                            return;
                        }
                        console.log(`MD5校验成功: ${filePath}`);
                    } catch (error) {
                        console.error(`MD5校验失败: ${filePath}`, error);
                        reject(new Error(`MD5校验失败: ${filePath}`));
                        return;
                    }
                }
                
                resolve({ success: true });
            });
            
            writer.on('error', (error) => {
                console.error('下载写入错误:', error);
                reject(new Error(`文件写入失败: ${error.message}`));
            });
            
        } catch (error) {
            console.error('下载失败:', error.message);
            reject(new Error(`下载失败: ${error.message}`));
        }
    });
});

// 检查目录权限
ipcMain.handle('check-permission', async (event, dirPath) => {
    try {
        const testFile = path.join(dirPath, '.tmp_test');
        await fs.promises.writeFile(testFile, 'test');
        await fs.promises.unlink(testFile);
        return { hasPermission: true };
    } catch (error) {
        return { hasPermission: false, error: error.message };
    }
});

// 选择目录
ipcMain.handle('select-directory', async () => {
    try {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
            title: '选择TMP目录'
        });
        return result.canceled ? null : result.filePaths[0];
    } catch (error) {
        console.error('选择目录失败:', error);
        throw error;
    }
});

// 读取TruckersMP配置文件
ipcMain.handle('read-truckersmp-config', async () => {
    try {
        // 构建正确的配置文件路径
        const appDataPath = process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming');
        const configPath = path.join(appDataPath, 'TruckersMP', 'launcher-options.json');
        
        console.log('正在读取TruckersMP配置文件:', configPath);
        
        if (!fs.existsSync(configPath)) {
            throw new Error('TruckersMP配置文件不存在');
        }
        
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        
        if (!config.installPath) {
            throw new Error('配置文件中未找到installPath字段');
        }
        
        console.log('成功读取TruckersMP配置，installPath:', config.installPath);
        
        return {
            installPath: config.installPath,
            configPath: configPath
        };
    } catch (error) {
        console.error('读取TruckersMP配置失败:', error.message);
        throw error;
    }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});