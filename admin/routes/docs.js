const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');

const DOCS_DIR = path.join(__dirname, '../../_docs');

// 获取所有文档列表
router.get('/', async (req, res) => {
  try {
    const docs = await getDocsList(DOCS_DIR);
    res.json({ success: true, data: docs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个文档内容
router.get('/:category/:filename', async (req, res) => {
  try {
    const filePath = path.join(DOCS_DIR, req.params.category, req.params.filename);
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, content: markdown } = matter(content);

    res.json({
      success: true,
      data: {
        frontMatter: data,
        content: markdown,
        category: req.params.category,
        filename: req.params.filename
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建新文档
router.post('/', async (req, res) => {
  try {
    const { category, filename, frontMatter, content } = req.body;

    if (!category || !filename) {
      return res.status(400).json({ success: false, error: '缺少分类或文件名' });
    }

    const categoryDir = path.join(DOCS_DIR, category);
    await fs.mkdir(categoryDir, { recursive: true });

    const filePath = path.join(categoryDir, filename);

    // 确保文件名以 .md 结尾
    const finalPath = filename.endsWith('.md') ? filePath : `${filePath}.md`;

    // 生成 markdown 内容
    const fileContent = matter.stringify(content || '', frontMatter || {});

    await fs.writeFile(finalPath, fileContent, 'utf-8');

    res.json({ success: true, message: '文档创建成功', path: `${category}/${path.basename(finalPath)}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新文档
router.put('/:category/:filename', async (req, res) => {
  try {
    const { frontMatter, content } = req.body;
    const filePath = path.join(DOCS_DIR, req.params.category, req.params.filename);

    // 生成 markdown 内容
    const fileContent = matter.stringify(content || '', frontMatter || {});

    await fs.writeFile(filePath, fileContent, 'utf-8');

    res.json({ success: true, message: '文档更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除文档
router.delete('/:category/:filename', async (req, res) => {
  try {
    const filePath = path.join(DOCS_DIR, req.params.category, req.params.filename);
    await fs.unlink(filePath);
    res.json({ success: true, message: '文档删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取分类列表
router.get('/categories', async (req, res) => {
  try {
    const entries = await fs.readdir(DOCS_DIR, { withFileTypes: true });
    const categories = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);

    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 辅助函数：递归获取文档列表
async function getDocsList(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const docs = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subDocs = await getDocsList(fullPath, baseDir);
      docs.push(...subDocs);
    } else if (entry.name.endsWith('.md')) {
      const content = await fs.readFile(fullPath, 'utf-8');
      const { data } = matter(content);
      const category = path.relative(baseDir, path.dirname(fullPath));

      docs.push({
        category: category || '未分类',
        filename: entry.name,
        title: data.title || entry.name,
        date: data.date || '',
        tags: data.tags || []
      });
    }
  }

  return docs;
}

module.exports = router;
