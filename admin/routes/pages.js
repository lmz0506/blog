const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');

const PAGES_DIR = path.join(__dirname, '../../pages');

// 获取所有页面列表
router.get('/', async (req, res) => {
  try {
    const pages = await getPagesList(PAGES_DIR);
    res.json({ success: true, data: pages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个页面内容
router.get('/:path(*)', async (req, res) => {
  try {
    const filePath = path.join(PAGES_DIR, req.params.path);
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, content: markdown } = matter(content);

    res.json({
      success: true,
      data: {
        frontMatter: data,
        content: markdown,
        path: req.params.path
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建新页面
router.post('/', async (req, res) => {
  try {
    const { path: pagePath, frontMatter, content } = req.body;

    if (!pagePath) {
      return res.status(400).json({ success: false, error: '缺少页面路径' });
    }

    const filePath = path.join(PAGES_DIR, pagePath);
    const dir = path.dirname(filePath);

    // 确保目录存在
    await fs.mkdir(dir, { recursive: true });

    // 生成 markdown 内容
    const fileContent = matter.stringify(content || '', frontMatter || {});

    await fs.writeFile(filePath, fileContent, 'utf-8');

    res.json({ success: true, message: '页面创建成功', path: pagePath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新页面
router.put('/:path(*)', async (req, res) => {
  try {
    const { frontMatter, content } = req.body;
    const filePath = path.join(PAGES_DIR, req.params.path);

    // 生成 markdown 内容
    const fileContent = matter.stringify(content || '', frontMatter || {});

    await fs.writeFile(filePath, fileContent, 'utf-8');

    res.json({ success: true, message: '页面更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除页面
router.delete('/:path(*)', async (req, res) => {
  try {
    const filePath = path.join(PAGES_DIR, req.params.path);
    await fs.unlink(filePath);
    res.json({ success: true, message: '页面删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 辅助函数：递归获取页面列表
async function getPagesList(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const pages = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subPages = await getPagesList(fullPath, baseDir);
      pages.push(...subPages);
    } else if (entry.name.endsWith('.md')) {
      const relativePath = path.relative(baseDir, fullPath);
      const content = await fs.readFile(fullPath, 'utf-8');
      const { data } = matter(content);

      pages.push({
        path: relativePath,
        title: data.title || entry.name,
        permalink: data.permalink || '',
        layout: data.layout || ''
      });
    }
  }

  return pages;
}

module.exports = router;
