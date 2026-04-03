# 📱 FoodRank — 打包成 Android App 指南

## 概览

```
本地开发 (localhost)          云端 Backend              Android App
  index.html  ──────────►  Railway Node.js  ◄──────  Capacitor APK
  (浏览器测试)               (Google/SerpAPI)          (手机安装)
```

---

## 第一步：把 Backend 部署到 Railway（免费）

### 1. 安装 Git，创建 GitHub 仓库
- 下载 Git：https://git-scm.com/
- 去 https://github.com 注册/登录，创建新 repo，名字叫 `FoodRank`，选 **Private**

### 2. 上传代码到 GitHub

打开 Terminal，进入 FoodApp 文件夹：

```bash
cd 你的路径/FoodApp

git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/FoodRank.git
git push -u origin main
```

> ⚠️ `.gitignore` 已经排除了 `.env` 文件，API Key **不会**被上传

### 3. 在 Railway 部署

1. 去 https://railway.app 注册（用 GitHub 账号登录）
2. 点 **"New Project"** → **"Deploy from GitHub repo"**
3. 选你的 `FoodRank` repo
4. Railway 会自动检测 Node.js，但要**指定 backend 目录**：
   - 点进项目 → **Settings** → **Build**
   - **Root Directory** 填：`backend`
5. 点 **Variables** → 添加你的环境变量：
   ```
   GOOGLE_PLACES_API_KEY = 你的key
   SERPAPI_KEY = 你的key
   PORT = 3000
   ```
6. 点 **Deploy** — 大概 1-2 分钟部署完成

### 4. 拿到 Railway URL

部署完成后，点 **Settings** → **Networking** → **Generate Domain**

你会得到一个 URL，格式像：`https://foodrank-production-xxxx.railway.app`

### 5. 更新前端的 API 地址

打开 `FoodApp/public/index.html`，找到这一行：

```javascript
const RAILWAY_URL = 'https://your-app-name.railway.app'; // ← 部署后填入 Railway URL
```

把 `your-app-name.railway.app` 换成你实际的 Railway URL，例如：

```javascript
const RAILWAY_URL = 'https://foodrank-production-xxxx.railway.app';
```

保存文件。

---

## 第二步：安装 Android Studio

下载安装：https://developer.android.com/studio

安装时勾选：
- ✅ Android SDK
- ✅ Android Virtual Device（模拟器，可选）

安装完成后，打开 Android Studio → **More Actions** → **SDK Manager**
确认 Android SDK Platform **34** (Android 14) 已安装。

---

## 第三步：安装 Capacitor 并生成 Android 项目

打开 Terminal，进入 FoodApp 根目录（不是 backend）：

```bash
cd 你的路径/FoodApp

# 安装 Capacitor
npm install

# 初始化 Capacitor（如果第一次运行）
npx cap init FoodRank com.foodrank.app --web-dir public

# 添加 Android 平台
npx cap add android

# 把前端文件同步到 Android 项目
npx cap copy android
```

---

## 第四步：在 Android Studio 里打包

```bash
# 用 Android Studio 打开 Android 项目
npx cap open android
```

Android Studio 会自动打开。然后：

1. 等待 Gradle sync 完成（第一次可能需要 5-10 分钟）
2. 菜单：**Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
3. 等待几分钟，完成后点右下角 **"locate"** 找到 APK 文件

APK 文件路径大概是：
```
FoodApp/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 第五步：安装到手机

### 方法 A：USB 安装（最简单）

1. 手机开启 **开发者模式**：设置 → 关于手机 → 连续点击「版本号」7次
2. 开启 **USB 调试**：设置 → 开发者选项 → USB 调试
3. 用 USB 连接手机到电脑
4. Android Studio 顶部会出现你的手机名字，点 ▶️ Run 直接安装

### 方法 B：发送 APK 给朋友

把 `app-debug.apk` 用微信/WhatsApp/Google Drive 发给朋友。

朋友手机需要开启**允许安装未知来源应用**：
- 设置 → 安全 → 允许安装未知应用

---

## 以后每次修改前端

```bash
cd FoodApp

# 修改 public/index.html 后运行：
npx cap copy android

# 重新在 Android Studio 里 Build APK
```

---

## 💰 费用

| 服务 | 费用 |
|------|------|
| Railway | 免费（每月 $5 额度，足够小项目） |
| GitHub | 免费 |
| Android 开发 | 免费 |
| 发布到 Google Play | $25 一次性（可选，不发布也能用） |

---

## 常见问题

**Q: App 打开显示空白？**
→ 检查 `RAILWAY_URL` 是否正确填写，用浏览器访问 `https://你的url.railway.app/api/health` 看是否返回 JSON

**Q: GPS 不工作？**
→ Android 已自动申请位置权限，手机弹出权限询问时点「允许」

**Q: Railway 免费额度用完了？**
→ Railway 每月给 $5 免费额度，小流量项目完全够用；如果超出可以用 Render.com 的免费方案（每月 750 小时）
