const express = require('express');
const router = express.Router();
const simpleGit = require('simple-git');
const path = require('path');

const REPO_DIR = path.join(__dirname, '../..');
const git = simpleGit(REPO_DIR);

// 获取 Git 状态
router.get('/status', async (req, res) => {
  try {
    const status = await git.status();
    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 提交更改
router.post('/commit', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: '请提供提交信息' });
    }

    // 添加所有更改
    await git.add('./*');

    // 提交
    const result = await git.commit(message);

    res.json({
      success: true,
      message: '提交成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 推送到远程仓库
router.post('/push', async (req, res) => {
  try {
    const { branch = 'main' } = req.body;

    const result = await git.push('origin', branch);

    res.json({
      success: true,
      message: '推送成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 一键提交并推送
router.post('/commit-and-push', async (req, res) => {
  try {
    const { message, branch = 'main' } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, error: '请提供提交信息' });
    }

    // 添加所有更改
    await git.add('./*');

    // 提交
    await git.commit(message);

    // 推送
    await git.push('origin', branch);

    res.json({
      success: true,
      message: '提交并推送成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取最近的提交记录
router.get('/log', async (req, res) => {
  try {
    const { maxCount = 10 } = req.query;
    const log = await git.log({ maxCount: parseInt(maxCount) });
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 拉取远程更新
router.post('/pull', async (req, res) => {
  try {
    const { branch = 'main' } = req.body;
    const result = await git.pull('origin', branch);
    res.json({
      success: true,
      message: '拉取成功',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取所有分支
router.get('/branches', async (req, res) => {
  try {
    const branches = await git.branchLocal();
    res.json({ success: true, data: branches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建分支
router.post('/branch/create', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: '请提供分支名称' });
    }
    await git.checkoutLocalBranch(name);
    res.json({ success: true, message: `分支 ${name} 创建成功` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 切换分支
router.post('/branch/checkout', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: '请提供分支名称' });
    }
    await git.checkout(name);
    res.json({ success: true, message: `已切换到分支 ${name}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除分支
router.delete('/branch/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await git.deleteLocalBranch(name);
    res.json({ success: true, message: `分支 ${name} 已删除` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 合并分支
router.post('/merge', async (req, res) => {
  try {
    const { branch } = req.body;
    if (!branch) {
      return res.status(400).json({ success: false, error: '请提供要合并的分支名称' });
    }
    const result = await git.merge([branch]);
    res.json({
      success: true,
      message: `分支 ${branch} 合并成功`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查看文件差异
router.get('/diff', async (req, res) => {
  try {
    const { file } = req.query;
    const diff = file ? await git.diff([file]) : await git.diff();
    res.json({ success: true, data: diff });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 撤销工作区改动
router.post('/checkout-file', async (req, res) => {
  try {
    const { file } = req.body;
    if (!file) {
      return res.status(400).json({ success: false, error: '请提供文件路径' });
    }
    await git.checkout([file]);
    res.json({ success: true, message: `文件 ${file} 已撤销改动` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 重置到指定提交
router.post('/reset', async (req, res) => {
  try {
    const { commit, mode = 'soft' } = req.body;
    if (!commit) {
      return res.status(400).json({ success: false, error: '请提供提交哈希值' });
    }

    const validModes = ['soft', 'mixed', 'hard'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ success: false, error: '无效的重置模式' });
    }

    await git.reset([`--${mode}`, commit]);
    res.json({
      success: true,
      message: `已重置到 ${commit} (${mode} 模式)`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 暂存当前改动
router.post('/stash/save', async (req, res) => {
  try {
    const { message } = req.body;
    const result = message
      ? await git.stash(['save', message])
      : await git.stash();
    res.json({
      success: true,
      message: '已暂存当前改动',
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查看暂存列表
router.get('/stash/list', async (req, res) => {
  try {
    const result = await git.stashList();
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 应用暂存
router.post('/stash/apply', async (req, res) => {
  try {
    const { index = 0 } = req.body;
    await git.stash(['apply', `stash@{${index}}`]);
    res.json({ success: true, message: '已应用暂存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 弹出暂存
router.post('/stash/pop', async (req, res) => {
  try {
    const { index = 0 } = req.body;
    await git.stash(['pop', `stash@{${index}}`]);
    res.json({ success: true, message: '已弹出暂存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除暂存
router.delete('/stash/:index', async (req, res) => {
  try {
    const { index } = req.params;
    await git.stash(['drop', `stash@{${index}}`]);
    res.json({ success: true, message: '已删除暂存' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取远程仓库列表
router.get('/remotes', async (req, res) => {
  try {
    const remotes = await git.getRemotes(true);
    res.json({ success: true, data: remotes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 添加远程仓库
router.post('/remote/add', async (req, res) => {
  try {
    const { name, url } = req.body;
    if (!name || !url) {
      return res.status(400).json({ success: false, error: '请提供远程仓库名称和URL' });
    }
    await git.addRemote(name, url);
    res.json({ success: true, message: `远程仓库 ${name} 已添加` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除远程仓库
router.delete('/remote/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await git.removeRemote(name);
    res.json({ success: true, message: `远程仓库 ${name} 已删除` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取标签列表
router.get('/tags', async (req, res) => {
  try {
    const tags = await git.tags();
    res.json({ success: true, data: tags });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建标签
router.post('/tag/create', async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: '请提供标签名称' });
    }

    if (message) {
      await git.addAnnotatedTag(name, message);
    } else {
      await git.addTag(name);
    }

    res.json({ success: true, message: `标签 ${name} 已创建` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除标签
router.delete('/tag/:name', async (req, res) => {
  try {
    const { name } = req.params;
    await git.tag(['-d', name]);
    res.json({ success: true, message: `标签 ${name} 已删除` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 推送标签
router.post('/tag/push', async (req, res) => {
  try {
    const { name } = req.body;
    if (name) {
      await git.pushTags('origin', name);
      res.json({ success: true, message: `标签 ${name} 已推送` });
    } else {
      await git.pushTags('origin');
      res.json({ success: true, message: '所有标签已推送' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
