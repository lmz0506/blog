const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');

const ROOT_DIR = path.resolve(__dirname, '../../');
const CONFIG_FILE = path.join(ROOT_DIR, '_config.yml');
const FAVICON_PATH = path.join(ROOT_DIR, 'assets/images/favicon.ico');
const AVATAR_PATH = path.join(ROOT_DIR, 'assets/images/avatar.jpg');

// 获取配置信息
router.get('/info', async (req, res) => {
  try {
    const configContent = await fs.readFile(CONFIG_FILE, 'utf8');
    const config = yaml.load(configContent);

    // 检查文件是否存在
    const faviconExists = await fs.access(FAVICON_PATH).then(() => true).catch(() => false);
    const avatarExists = await fs.access(AVATAR_PATH).then(() => true).catch(() => false);

    res.json({
      success: true,
      data: {
        title: config.title || '',
        description: config.description || '',
        url: config.url || '',
        baseurl: config.baseurl || '',
        github_url: config.github_url || '',
        favicon: faviconExists ? '/assets/images/favicon.ico' : null,
        avatar: avatarExists ? '/assets/images/avatar.jpg' : null,
        footer_text: config.footer_text || '',
        footer_powered_by: config.footer_powered_by !== false,
        footer_powered_by_text: config.footer_powered_by_text || 'Powered by',
        footer_powered_by_name: config.footer_powered_by_name || 'Jekyll',
        footer_powered_by_link: config.footer_powered_by_link || 'https://jekyllrb.com/',
        baidu_analytics: config.baidu_analytics || '',
        busuanzi_counter: config.busuanzi_counter !== false
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '读取配置失败: ' + error.message
    });
  }
});

// 更新配置信息
router.put('/info', async (req, res) => {
  try {
    const {
      title,
      description,
      url,
      baseurl,
      github_url,
      footer_text,
      footer_powered_by,
      footer_powered_by_text,
      footer_powered_by_name,
      footer_powered_by_link,
      baidu_analytics,
      busuanzi_counter
    } = req.body;

    // 读取现有配置内容（保留注释）
    let configContent = await fs.readFile(CONFIG_FILE, 'utf8');

    // 使用正则表达式替换，保留注释和格式
    if (title !== undefined) {
      configContent = configContent.replace(
        /^title:.*$/m,
        `title: ${title}`
      );
    }

    if (description !== undefined) {
      configContent = configContent.replace(
        /^description:.*$/m,
        `description: ${description}`
      );
    }

    if (url !== undefined) {
      configContent = configContent.replace(
        /^url:.*$/m,
        `url: ${url}`
      );
    }

    if (baseurl !== undefined) {
      configContent = configContent.replace(
        /^baseurl:.*$/m,
        `baseurl: "${baseurl}"`
      );
    }

    if (github_url !== undefined) {
      if (configContent.match(/^github_url:.*$/m)) {
        configContent = configContent.replace(
          /^github_url:.*$/m,
          `github_url: ${github_url}`
        );
      } else {
        configContent += `\ngithub_url: ${github_url}`;
      }
    }

    // Footer配置
    if (footer_text !== undefined) {
      if (configContent.match(/^footer_text:.*$/m)) {
        configContent = configContent.replace(
          /^footer_text:.*$/m,
          footer_text ? `footer_text: "${footer_text}"` : 'footer_text: ""'
        );
      } else {
        configContent += `\n# Footer配置\nfooter_text: "${footer_text}"`;
      }
    }

    if (footer_powered_by !== undefined) {
      if (configContent.match(/^footer_powered_by:.*$/m)) {
        configContent = configContent.replace(
          /^footer_powered_by:.*$/m,
          `footer_powered_by: ${footer_powered_by}`
        );
      } else {
        configContent += `\nfooter_powered_by: ${footer_powered_by}`;
      }
    }

    if (footer_powered_by_text !== undefined) {
      if (configContent.match(/^footer_powered_by_text:.*$/m)) {
        configContent = configContent.replace(
          /^footer_powered_by_text:.*$/m,
          `footer_powered_by_text: "${footer_powered_by_text}"`
        );
      } else {
        configContent += `\nfooter_powered_by_text: "${footer_powered_by_text}"`;
      }
    }

    if (footer_powered_by_name !== undefined) {
      if (configContent.match(/^footer_powered_by_name:.*$/m)) {
        configContent = configContent.replace(
          /^footer_powered_by_name:.*$/m,
          `footer_powered_by_name: "${footer_powered_by_name}"`
        );
      } else {
        configContent += `\nfooter_powered_by_name: "${footer_powered_by_name}"`;
      }
    }

    if (footer_powered_by_link !== undefined) {
      if (configContent.match(/^footer_powered_by_link:.*$/m)) {
        configContent = configContent.replace(
          /^footer_powered_by_link:.*$/m,
          `footer_powered_by_link: "${footer_powered_by_link}"`
        );
      } else {
        configContent += `\nfooter_powered_by_link: "${footer_powered_by_link}"`;
      }
    }

    // 统计配置
    if (baidu_analytics !== undefined) {
      if (configContent.match(/^baidu_analytics:.*$/m)) {
        configContent = configContent.replace(
          /^baidu_analytics:.*$/m,
          baidu_analytics ? `baidu_analytics: "${baidu_analytics}"` : '# baidu_analytics: ""'
        );
      } else {
        if (baidu_analytics) {
          configContent += `\n\n# 百度统计配置\nbaidu_analytics: "${baidu_analytics}"`;
        }
      }
    }

    if (busuanzi_counter !== undefined) {
      if (configContent.match(/^busuanzi_counter:.*$/m)) {
        configContent = configContent.replace(
          /^busuanzi_counter:.*$/m,
          `busuanzi_counter: ${busuanzi_counter}`
        );
      } else {
        configContent += `\n\n# 不蒜子访问量统计\nbusuanzi_counter: ${busuanzi_counter}`;
      }
    }

    // 写回文件
    await fs.writeFile(CONFIG_FILE, configContent, 'utf8');

    res.json({
      success: true,
      message: '配置更新成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '更新配置失败: ' + error.message
    });
  }
});

// 上传图标/头像
router.post('/upload', async (req, res) => {
  try {
    const { type, data, filename } = req.body; // type: 'favicon' | 'avatar'

    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 确保目录存在
    const imagesDir = path.join(ROOT_DIR, 'assets/images');
    await fs.mkdir(imagesDir, { recursive: true });

    // 解析base64数据
    const matches = data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        success: false,
        error: '无效的图片数据'
      });
    }

    const imageBuffer = Buffer.from(matches[2], 'base64');

    // 确定文件路径
    let targetPath;
    if (type === 'favicon') {
      targetPath = FAVICON_PATH;
    } else if (type === 'avatar') {
      targetPath = AVATAR_PATH;
    } else {
      return res.status(400).json({
        success: false,
        error: '无效的上传类型'
      });
    }

    // 写入文件
    await fs.writeFile(targetPath, imageBuffer);

    res.json({
      success: true,
      message: '上传成功',
      path: type === 'favicon' ? '/assets/images/favicon.ico' : '/assets/images/avatar.jpg'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '上传失败: ' + error.message
    });
  }
});

module.exports = router;
