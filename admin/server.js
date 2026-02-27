const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // 增加限制以支持图片上传
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 挂载博客根目录的 assets 文件夹
app.use('/assets', express.static(path.join(__dirname, '..', 'assets')));

// 路由
app.use('/api/pages', require('./routes/pages'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/data', require('./routes/data'));
app.use('/api/git', require('./routes/git'));
app.use('/api/config', require('./routes/config'));
app.use('/api/home', require('./routes/home'));

// 首页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`\n🚀 管理平台已启动！`);
  console.log(`📝 访问地址: http://localhost:${PORT}`);
  console.log(`\n功能列表:`);
  console.log(`  - 首页管理: 管理个人信息、技能、项目等`);
  console.log(`  - 页面管理: 新增/编辑/删除页面`);
  console.log(`  - 文档管理: 新增/编辑/删除知识库文档`);
  console.log(`  - 数据管理: 管理友链和碎碎念`);
  console.log(`  - Git 操作: 提交和推送到 GitHub\n`);
});
