# 🍜 FoodRank — 启动指南

## 第一步：获取 Google Places API Key（免费）

### 1. 开通 Google Cloud 账号
打开这个链接：https://console.cloud.google.com/
- 用你的 Google 账号登录
- 如果没有账号，免费注册一个

### 2. 创建一个新项目
- 点击顶部的 "Select a project" → "New Project"
- Project name 填：`FoodRank`
- 点 "Create"

### 3. 开启 Places API (New)
- 左边菜单 → "APIs & Services" → "Library"
- 搜索：`Places API (New)`
- 点进去，点 "Enable" 开启

### 4. 创建 API Key
- 左边菜单 → "APIs & Services" → "Credentials"
- 点 "Create Credentials" → "API Key"
- 复制那个 Key（格式像：`AIzaSy...`）

### 5. （推荐）限制 API Key 安全性
- 点刚创建的 Key → "Edit API Key"
- 在 "API restrictions" 选 "Restrict key"
- 选 "Places API (New)"
- 保存

### 💰 费用说明
- Google 每月给 **$200 免费额度**
- 搜索 1000 次大约 $17，等于每月可以免费用约 **11,000 次搜索**
- 个人测试完全够用，不会收费

---

## 第二步：配置 Google Places API Key

1. 打开 `FoodApp/backend/` 文件夹
2. 复制 `.env.example`，改名为 `.env`
3. 把 `your_google_places_api_key_here` 换成你的 Key：

```
GOOGLE_PLACES_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXX
```

---

## 第二点五步：设置小红书搜索（可选但推荐）

我们用 **SerpAPI** 来搜索小红书内容。SerpAPI 通过百度（百度收录了大量小红书帖子）来找到相关帖子。

### 1. 注册 SerpAPI

打开：https://serpapi.com/

- 点 **"Register"** 免费注册
- 验证邮箱后登录

### 2. 拿到 API Key

登录后，在 **Dashboard** 页面顶部可以看到你的 **API Key**（格式像 `a1b2c3...`）

### 3. 填入 .env

```
SERPAPI_KEY=a1b2c3d4e5f6g7h8i9j0...
```

### 💰 费用说明
- 免费注册后每月有 **100 次免费搜索**（开发测试够用）
- 付费计划：$50/月 5,000 次，$130/月 15,000 次
- 搜索一个餐厅的小红书帖子 = 1 次搜索

---

## 第三步：安装 Node.js（如果还没有）

下载地址：https://nodejs.org/
- 选 LTS 版本下载安装
- 安装完后打开 Terminal（命令提示符），输入：
  ```
  node --version
  ```
  应该看到 `v20.x.x` 之类的版本号

---

## 第四步：启动服务器

打开 Terminal，进入项目文件夹：

```bash
cd 你的路径/FoodApp/backend

# 安装依赖（只需要做一次）
npm install

# 启动服务器
npm start
```

看到这个说明成功：
```
🍜 FoodRank Server 启动成功！
📡 本地地址: http://localhost:3000
🔑 Google Places Key: ✅ 已设置
📕 小红书 CSE ID:      ✅ 已设置
```

---

## 第五步：打开 App

在浏览器打开：http://localhost:3000

就能看到真实的 Google Reviews 数据了！🎉

---

## 常见问题

**Q: 看到 "API Key 未设置" 的错误？**
→ 检查 `backend/.env` 文件是否存在，Key 是否正确填写

**Q: 看到 "无法连接到服务器"？**
→ 确认 `npm start` 在运行，没有报错

**Q: 搜索结果很少或没有？**
→ 正常，附近真的没那么多，可以把 radius 改大（在 server.js 里）

**Q: 评论只有5条？**
→ Google Places API 限制，最多返回5条。要更多需要 Google Maps Platform 的企业套餐

---

## 文件结构

```
FoodApp/
├── backend/
│   ├── server.js          ← 后端主文件（Express + Google Places API）
│   ├── package.json
│   ├── .env               ← 你的 API Key（自己创建，不要上传 GitHub！）
│   └── .env.example       ← 示例配置
└── public/
    └── index.html         ← 前端界面（自动被服务器托管）
```
