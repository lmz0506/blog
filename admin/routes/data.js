const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const DATA_DIR = path.join(__dirname, '../../_data');

// 获取友链列表
router.get('/links', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'links.yml');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.load(content);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新友链列表
router.put('/links', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'links.yml');
    const yamlContent = yaml.dump(req.body);
    await fs.writeFile(filePath, yamlContent, 'utf-8');
    res.json({ success: true, message: '友链更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取碎碎念列表
router.get('/thoughts', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'thoughts.yml');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.load(content);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新碎碎念列表
router.put('/thoughts', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'thoughts.yml');
    const yamlContent = yaml.dump(req.body);
    await fs.writeFile(filePath, yamlContent, 'utf-8');
    res.json({ success: true, message: '碎碎念更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取 GitHub 项目列表
router.get('/github-projects', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'github_projects.yml');
    const content = await fs.readFile(filePath, 'utf-8');
    const data = yaml.load(content) || [];

    // 读取时也过滤掉前端自动获取的字段
    const cleanedData = data.map(project => {
      const { stars, language, languages, ...rest } = project;
      return rest;
    });

    res.json({ success: true, data: cleanedData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新 GitHub 项目列表
router.put('/github-projects', async (req, res) => {
  try {
    const filePath = path.join(DATA_DIR, 'github_projects.yml');

    // 保存时过滤掉前端自动获取的字段
    const cleanedData = req.body.map(project => {
      const { stars, language, languages, ...rest } = project;
      return rest;
    });

    const yamlContent = yaml.dump(cleanedData);
    await fs.writeFile(filePath, yamlContent, 'utf-8');
    res.json({ success: true, message: 'GitHub 项目更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
