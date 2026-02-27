# 管理平台快速启动指南

## 首次使用

### 1. 确保已安装 Node.js

检查 Node.js 版本：
```bash
node -v
npm -v
```

如果未安装，请访问 https://nodejs.org 下载安装（推荐 LTS 版本）。

### 2. 安装依赖

```bash
cd admin
npm install
```

### 3. 启动管理平台

```bash
npm start
```

### 4. 访问管理界面

打开浏览器访问：http://localhost:3001

## 功能演示

### 页面管理

1. 点击"页面管理"标签
2. 填写页面信息：
   - 页面路径：`test.md`
   - 标题：`测试页面`
   - Permalink：`/test.html`
   - 内容：编写 Markdown
3. 点击"保存页面"

### 文档管理

1. 点击"文档管理"标签
2. 填写文档信息：
   - 分类：`frontend`
   - 文件名：`test-doc.md`
   - 标题：`测试文档`
   - 日期：选择日期
   - 内容：编写 Markdown
3. 点击"保存文档"

### 数据管理

1. 点击"数据管理"标签
2. 编辑友链或碎碎念的 JSON 数据
3. 点击"保存"按钮

### Git 提交

1. 点击"Git 操作"标签
2. 查看当前修改状态
3. 填写提交信息
4. 点击"提交并推送到 GitHub"

## 常用命令

```bash
# 启动管理平台
npm start

# 开发模式（自动重启）
npm run dev

# 停止服务器
Ctrl + C
```

## 技巧

- 使用 Ctrl+S 保存页面内容
- Markdown 内容支持完整的 Markdown 语法
- 编辑现有内容时，点击列表中的"编辑"按钮
- 删除操作会有确认提示

## 故障排查

### 端口被占用

修改 `server.js` 中的端口号：
```javascript
const PORT = 3002; // 改为其他端口
```

### 依赖安装失败

使用淘宝镜像：
```bash
npm install --registry=https://registry.npmmirror.com
```

### Git 推送失败

确保已配置 Git 凭证：
```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

## 下一步

- 阅读完整文档：[admin/README.md](README.md)
- 了解 API 接口
- 自定义管理平台功能
