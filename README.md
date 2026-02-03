# TMP更新工具

🚛 智能检测和更新TruckersMP插件文件

## 功能特点

- 📋 从TMP API获取最新文件列表
- 🔒 目录权限检查
- 🆕 单独更新新版目录
- 🔄 单独更新旧版目录（需要管理员权限）
- ?? 实时下载进度显示
- 🎨 现代化美观的UI界面
- 🪟 支持窗口最小化和关闭

## 使用说明

### 启动程序

```bash
# 安装依赖
npm install

# 启动程序
npm start
```

### 操作流程

1. **获取文件列表** - 从TMP API获取最新文件信息
2. **检查权限** - 验证目录写入权限
3. **更新文件** - 分别更新新版和旧版文件

### 目录说明

- **新版目录**: `C:\Users\Administrator\AppData\Roaming\TruckersMP\installation`
- **旧版目录**: `C:\ProgramData\TruckersMP` (需要管理员权限)

## 技术栈

- Electron - 跨平台桌面应用框架
- React - 用户界面库
- Material-UI - UI组件库
- Axios - HTTP客户端

## 版本信息

- 当前版本: 1.0.0
- 作者: 鹿途鲁班
- QQ: 2822296635
- 特别鸣谢: 长碳

## 许可证

MIT License