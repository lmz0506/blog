const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const ROOT_DIR = path.resolve(__dirname, '../../');
const PROFILE_FILE = path.join(ROOT_DIR, '_data/profile.yml');
const PROJECTS_FILE = path.join(ROOT_DIR, '_data/projects.yml');

// 获取个人信息
router.get('/profile', async (req, res) => {
  try {
    const content = await fs.readFile(PROFILE_FILE, 'utf8');
    const data = yaml.load(content);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新个人信息
router.put('/profile', async (req, res) => {
  try {
    const content = yaml.dump(req.body, { indent: 2, lineWidth: -1 });
    await fs.writeFile(PROFILE_FILE, content, 'utf8');
    res.json({ success: true, message: '个人信息更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目列表
router.get('/projects', async (req, res) => {
  try {
    const content = await fs.readFile(PROJECTS_FILE, 'utf8');
    const data = yaml.load(content) || [];
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新项目列表
router.put('/projects', async (req, res) => {
  try {
    const content = yaml.dump(req.body, { indent: 2, lineWidth: -1 });
    await fs.writeFile(PROJECTS_FILE, content, 'utf8');
    res.json({ success: true, message: '项目列表更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
