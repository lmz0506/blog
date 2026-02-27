const API_BASE = 'http://localhost:3001/api';

// Tab 切换
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;

    // 切换 tab active 状态
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // 切换内容显示
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');

    // 加载对应数据
    if (tabName === 'home') loadHomeData();
    if (tabName === 'pages') loadPages();
    if (tabName === 'docs') loadDocs();
    if (tabName === 'data') loadDataManagement();
    if (tabName === 'github') loadGithubProjects();
    if (tabName === 'config') loadConfig();
    if (tabName === 'git') loadGitStatus();
  });
});

// ============= 首页管理 =============

let profileData = {};
let projectsData = [];
let editingProjectIndex = -1;

async function loadHomeData() {
  await loadProfile();
  await loadProjects();
}

// 加载个人信息
async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/home/profile`);
    const { data } = await res.json();
    profileData = data;

    // 填充表单
    document.getElementById('profileName').value = data.name || '';
    document.getElementById('profileBio').value = data.bio || '';
    document.getElementById('profileIntro').value = data.intro || '';
    document.getElementById('profileGithub').value = data.social?.github || '';
    document.getElementById('profileEmail').value = data.social?.email || '';

    // 渲染技能栈
    renderSkillsList(data.skills || []);

    // 渲染当前在做
    renderCurrentlyList(data.currently || []);
  } catch (error) {
    showAlert('error', '加载个人信息失败: ' + error.message);
  }
}

// 渲染技能栈列表
function renderSkillsList(skills) {
  const html = skills.map((skill, index) => `
    <div class="list-item">
      <div>
        <div class="list-item-title">${skill.name}</div>
        <div class="list-item-meta">${skill.items.join(', ')}</div>
      </div>
      <div class="list-item-actions">
        <button class="btn btn-sm btn-primary" onclick="editSkill(${index})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteSkill(${index})">删除</button>
      </div>
    </div>
  `).join('');

  document.getElementById('skillsList').innerHTML = html || '<p style="color:#999;">暂无技能栈</p>';
}

// 添加技能分类
function addSkill() {
  showSkillModal(null, (skillData) => {
    profileData.skills = profileData.skills || [];
    profileData.skills.push(skillData);
    saveProfile();
  });
}

// 编辑技能
function editSkill(index) {
  const skill = profileData.skills[index];
  showSkillModal(skill, (skillData) => {
    profileData.skills[index] = skillData;
    saveProfile();
  });
}

// 删除技能
function deleteSkill(index) {
  if (!confirm('确定要删除这个技能分类吗？')) return;
  profileData.skills.splice(index, 1);
  saveProfile();
}

// 渲染当前在做列表
function renderCurrentlyList(currently) {
  const html = currently.map((item, index) => `
    <div class="list-item">
      <div>
        <div class="list-item-title">${item}</div>
      </div>
      <div class="list-item-actions">
        <button class="btn btn-sm btn-primary" onclick="editCurrently(${index})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCurrently(${index})">删除</button>
      </div>
    </div>
  `).join('');

  document.getElementById('currentlyList').innerHTML = html || '<p style="color:#999;">暂无内容</p>';
}

// 添加当前在做
function addCurrently() {
  showCurrentlyModal(null, (item) => {
    profileData.currently = profileData.currently || [];
    profileData.currently.push(item);
    saveProfile();
  });
}

// 编辑当前在做
function editCurrently(index) {
  const item = profileData.currently[index];
  showCurrentlyModal(item, (newItem) => {
    profileData.currently[index] = newItem;
    saveProfile();
  });
}

// 删除当前在做
function deleteCurrently(index) {
  if (!confirm('确定要删除这一项吗？')) return;
  profileData.currently.splice(index, 1);
  saveProfile();
}

// 保存个人信息
document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  profileData.name = document.getElementById('profileName').value;
  profileData.bio = document.getElementById('profileBio').value;
  profileData.intro = document.getElementById('profileIntro').value;
  profileData.social = profileData.social || {};
  profileData.social.github = document.getElementById('profileGithub').value;
  profileData.social.email = document.getElementById('profileEmail').value;

  await saveProfile();
});

async function saveProfile() {
  try {
    const res = await fetch(`${API_BASE}/home/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData)
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', '个人信息保存成功');
      renderSkillsList(profileData.skills || []);
      renderCurrentlyList(profileData.currently || []);
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '保存失败: ' + error.message);
  }
}

// 加载项目列表
async function loadProjects() {
  try {
    const res = await fetch(`${API_BASE}/home/projects`);
    const { data } = await res.json();
    projectsData = data || [];
    renderProjectsList();
  } catch (error) {
    showAlert('error', '加载项目列表失败: ' + error.message);
  }
}

// 渲染项目列表
function renderProjectsList() {
  const html = projectsData.map((project, index) => {
    const linksHtml = project.links && project.links.length > 0
      ? `<div class="list-item-meta">扩展链接: ${project.links.map(l => `<a href="${l.url}" target="_blank">${l.name}</a>`).join(', ')}</div>`
      : '';

    return `
      <div class="list-item">
        <div>
          <div class="list-item-title">
            ${project.name}
            ${project.star ? '<span class="star-badge">⭐</span>' : ''}
          </div>
          <div class="list-item-meta">${project.description}</div>
          <div class="list-item-meta">${project.url}</div>
          ${linksHtml}
          <div class="list-item-meta">${(project.tags || []).join(', ')}</div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-sm btn-primary" onclick="editProject(${index})">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProject(${index})">删除</button>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('projectsList').innerHTML = html || '<p style="color:#999;">暂无项目</p>';
}

// 编辑项目
function editProject(index) {
  const project = projectsData[index];
  document.getElementById('projectName').value = project.name || '';
  document.getElementById('projectDesc').value = project.description || '';
  document.getElementById('projectUrl').value = project.url || '';
  document.getElementById('projectTags').value = (project.tags || []).join(', ');
  document.getElementById('projectStar').checked = project.star || false;

  // 设置临时链接并渲染
  tempProjectLinks = project.links ? JSON.parse(JSON.stringify(project.links)) : [];
  renderProjectLinks(tempProjectLinks);

  editingProjectIndex = index;

  const submitBtn = document.querySelector('#projectForm button[type="submit"]');
  submitBtn.textContent = '更新项目';
  submitBtn.className = 'btn btn-success';

  document.getElementById('projectForm').scrollIntoView({ behavior: 'smooth' });
}

// 渲染项目扩展链接
function renderProjectLinks(links = []) {
  const container = document.getElementById('projectLinksContainer');
  container.innerHTML = links.map((link, index) => `
    <div class="project-link-item" style="display: flex; gap: 8px; margin-bottom: 8px; align-items: center;">
      <input type="text" placeholder="链接名称" value="${link.name || ''}"
             onchange="updateProjectLinkName(${index}, this.value)"
             style="flex: 1; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
      <input type="url" placeholder="链接地址" value="${link.url || ''}"
             onchange="updateProjectLinkUrl(${index}, this.value)"
             style="flex: 2; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px;">
      <button type="button" class="btn btn-sm btn-danger" onclick="removeProjectLink(${index})">删除</button>
    </div>
  `).join('');
}

// 全局变量存储临时的扩展链接
let tempProjectLinks = [];

// 添加项目扩展链接
function addProjectLink() {
  tempProjectLinks.push({ name: '', url: '' });
  renderProjectLinks(tempProjectLinks);
}

// 更新链接名称
function updateProjectLinkName(index, value) {
  tempProjectLinks[index].name = value;
}

// 更新链接地址
function updateProjectLinkUrl(index, value) {
  tempProjectLinks[index].url = value;
}

// 删除扩展链接
function removeProjectLink(index) {
  tempProjectLinks.splice(index, 1);
  renderProjectLinks(tempProjectLinks);
}

// 删除项目
function deleteProject(index) {
  if (!confirm('确定要删除这个项目吗？')) return;
  projectsData.splice(index, 1);
  saveProjects();
}

// 重置项目表单
function resetProjectForm() {
  document.getElementById('projectForm').reset();
  editingProjectIndex = -1;
  tempProjectLinks = [];
  renderProjectLinks([]);

  const submitBtn = document.querySelector('#projectForm button[type="submit"]');
  submitBtn.textContent = '添加项目';
  submitBtn.className = 'btn btn-primary';
}

// 提交项目表单
document.getElementById('projectForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const project = {
    name: document.getElementById('projectName').value,
    description: document.getElementById('projectDesc').value,
    url: document.getElementById('projectUrl').value,
    tags: document.getElementById('projectTags').value.split(',').map(t => t.trim()).filter(Boolean),
    star: document.getElementById('projectStar').checked
  };

  // 过滤掉空的扩展链接
  const validLinks = tempProjectLinks.filter(link => link.name && link.url);
  if (validLinks.length > 0) {
    project.links = validLinks;
  }

  if (editingProjectIndex >= 0) {
    projectsData[editingProjectIndex] = project;
  } else {
    projectsData.push(project);
  }

  await saveProjects();
  resetProjectForm();
});

async function saveProjects() {
  try {
    const res = await fetch(`${API_BASE}/home/projects`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectsData)
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', '项目列表保存成功');
      renderProjectsList();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '保存失败: ' + error.message);
  }
}

// ============= 页面管理 =============

// 加载页面列表
async function loadPages() {
  try {
    const res = await fetch(`${API_BASE}/pages`);
    const { data } = await res.json();

    const html = data.map(page => `
      <div class="list-item">
        <div>
          <div class="list-item-title">${page.title}</div>
          <div class="list-item-meta">${page.path} → ${page.permalink}</div>
        </div>
<!--        <div class="list-item-actions">-->
<!--          <button class="btn btn-sm btn-primary" onclick="editPage('${page.path}')">编辑</button>-->
<!--          <button class="btn btn-sm btn-danger" onclick="deletePage('${page.path}')">删除</button>-->
<!--        </div>-->
      </div>
    `).join('');

    document.getElementById('pagesList').innerHTML = html || '<p>暂无页面</p>';
  } catch (error) {
    showAlert('error', '加载页面列表失败: ' + error.message);
  }
}

// 编辑页面
async function editPage(path) {
  try {
    const res = await fetch(`${API_BASE}/pages/${path}`);
    const { data } = await res.json();

    document.getElementById('pagePath').value = data.path;
    document.getElementById('pageTitle').value = data.frontMatter.title || '';
    document.getElementById('pagePermalink').value = data.frontMatter.permalink || '';
    document.getElementById('pageLayout').value = data.frontMatter.layout || 'page';
    document.getElementById('pageContent').value = data.content || '';

    // 滚动到表单
    document.getElementById('pageForm').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    showAlert('error', '加载页面失败: ' + error.message);
  }
}

// 删除页面
async function deletePage(path) {
  if (!confirm('确定要删除这个页面吗？')) return;

  try {
    const res = await fetch(`${API_BASE}/pages/${path}`, { method: 'DELETE' });
    const result = await res.json();

    if (result.success) {
      showAlert('success', '页面删除成功');
      loadPages();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '删除失败: ' + error.message);
  }
}

// 重置页面表单
function resetPageForm() {
  document.getElementById('pageForm').reset();
}

// 提交页面表单
document.getElementById('pageForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const path = document.getElementById('pagePath').value;
  const frontMatter = {
    layout: document.getElementById('pageLayout').value,
    title: document.getElementById('pageTitle').value,
    permalink: document.getElementById('pagePermalink').value
  };
  const content = document.getElementById('pageContent').value;

  try {
    // 检查是否已存在（更新 vs 创建）
    const checkRes = await fetch(`${API_BASE}/pages/${path}`);
    const isUpdate = checkRes.ok;

    const res = await fetch(
      `${API_BASE}/pages${isUpdate ? '/' + path : ''}`,
      {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, frontMatter, content })
      }
    );

    const result = await res.json();

    if (result.success) {
      showAlert('success', isUpdate ? '页面更新成功' : '页面创建成功');
      resetPageForm();
      loadPages();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '操作失败: ' + error.message);
  }
});

// ============= 文档管理 =============

// 加载文档列表
async function loadDocs() {
  try {
    const res = await fetch(`${API_BASE}/docs`);
    const { data } = await res.json();

    // 按分类分组
    const byCategory = data.reduce((acc, doc) => {
      if (!acc[doc.category]) acc[doc.category] = [];
      acc[doc.category].push(doc);
      return acc;
    }, {});

    const html = Object.entries(byCategory).map(([category, docs]) => `
      <h3 style="margin-top: 20px; color: #667eea;">${category}</h3>
      ${docs.map(doc => `
        <div class="list-item">
          <div>
            <div class="list-item-title">${doc.title}</div>
            <div class="list-item-meta">${doc.filename} | ${doc.date} | ${(doc.tags || []).join(', ')}</div>
          </div>
          <div class="list-item-actions">
            <button class="btn btn-sm btn-primary" onclick="editDoc('${doc.category}', '${doc.filename}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="deleteDoc('${doc.category}', '${doc.filename}')">删除</button>
          </div>
        </div>
      `).join('')}
    `).join('');

    document.getElementById('docsList').innerHTML = html || '<p>暂无文档</p>';

    // 加载分类列表
    const categoriesRes = await fetch(`${API_BASE}/docs/categories`);
    const { data: categories } = await categoriesRes.json();
    document.getElementById('categoryList').innerHTML = categories.map(c => `<option value="${c}">`).join('');
  } catch (error) {
    showAlert('error', '加载文档列表失败: ' + error.message);
  }
}

// 编辑文档
async function editDoc(category, filename) {
  try {
    const res = await fetch(`${API_BASE}/docs/${category}/${filename}`);
    const { data } = await res.json();

    document.getElementById('docCategory').value = data.category;
    document.getElementById('docFilename').value = data.filename;
    document.getElementById('docTitle').value = data.frontMatter.title || '';
    document.getElementById('docDate').value = data.frontMatter.date || new Date().toISOString().split('T')[0];
    document.getElementById('docTags').value = (data.frontMatter.tags || []).join(', ');
    document.getElementById('docContent').value = data.content || '';

    document.getElementById('docForm').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    showAlert('error', '加载文档失败: ' + error.message);
  }
}

// 删除文档
async function deleteDoc(category, filename) {
  if (!confirm('确定要删除这个文档吗？')) return;

  try {
    const res = await fetch(`${API_BASE}/docs/${category}/${filename}`, { method: 'DELETE' });
    const result = await res.json();

    if (result.success) {
      showAlert('success', '文档删除成功');
      loadDocs();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '删除失败: ' + error.message);
  }
}

// 重置文档表单
function resetDocForm() {
  document.getElementById('docForm').reset();
  document.getElementById('docDate').value = new Date().toISOString().split('T')[0];
}

// 导入语雀文档
function importYuqueDoc() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed = parseYuqueMarkdown(content);

      // 检查是否正在编辑现有文档
      const isEditing = document.getElementById('docFilename').value.trim() !== '' &&
                        document.getElementById('docCategory').value.trim() !== '';

      if (isEditing) {
        // 编辑模式：只更新内容,保留其他字段
        document.getElementById('docContent').value = parsed.content;
        showAlert('success', '文档内容已更新！其他信息保持不变,请检查后保存。');
      } else {
        // 新建模式：填充所有字段
        const filename = file.name;
        document.getElementById('docFilename').value = filename;
        document.getElementById('docTitle').value = parsed.title || filename.replace('.md', '');
        document.getElementById('docContent').value = parsed.content;
        showAlert('success', '语雀文档导入成功！请补充分类、日期等信息后保存。');
      }

      document.getElementById('docForm').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      showAlert('error', '导入失败: ' + error.message);
    }
  };
  input.click();
}

// 预览Markdown
function previewMarkdown() {
  const content = document.getElementById('docContent').value;
  const title = document.getElementById('docTitle').value || '未命名文档';

  if (!content.trim()) {
    showAlert('error', '请先输入Markdown内容');
    return;
  }

  // 创建预览模态框
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal" style="width: 95%; max-width: 1400px; height: 90vh; display: flex; flex-direction: column;">
      <div class="modal-header">
        <h3>📖 Markdown 预览 - ${escapeHtml(title)}</h3>
      </div>
      <div class="modal-body" style="flex: 1; display: flex; gap: 20px; padding: 20px; overflow: hidden;">
        <!-- 左侧：可编辑源码 -->
        <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0; color: #667eea; font-size: 14px;">源码 (可编辑)</h4>
            <button id="refreshPreview" class="btn btn-sm" style="padding: 6px 12px; margin: 0; font-size: 12px; background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white;">🔄 刷新预览</button>
          </div>
          <textarea id="previewSource" style="flex: 1; font-family: 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6; resize: none; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; overflow-y: auto;">${escapeHtml(content)}</textarea>
        </div>

        <!-- 中间：目录导航 -->
        <div id="previewTocContainer" style="width: 200px; flex-shrink: 0; display: flex; flex-direction: column; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 0 15px;">
          <h4 style="margin: 0 0 10px 0; color: #667eea; font-size: 14px;">目录</h4>
          <nav id="previewToc" style="flex: 1; overflow-y: auto;">
            <!-- 动态生成目录 -->
          </nav>
        </div>

        <!-- 右侧：预览效果 -->
        <div style="flex: 1; display: flex; flex-direction: column; min-width: 0;">
          <h4 style="margin: 0 0 10px 0; color: #667eea; font-size: 14px;">预览效果</h4>
          <div id="previewRendered" style="flex: 1; overflow-y: auto; overflow-x: hidden; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; background: #fff; line-height: 1.8; word-wrap: break-word; overflow-wrap: break-word;">
            <!-- 渲染后的内容 -->
          </div>
        </div>
      </div>
      <div style="padding: 12px 20px; background: #f8f9fc; border-radius: 8px; margin: 0 20px 20px 20px; font-size: 13px; color: #64748b;">
        <strong>提示：</strong>左侧源码可实时编辑，点击"刷新预览"查看效果。关闭时会自动保存编辑内容。实际渲染以Jekyll为准。
      </div>
      <div class="modal-footer">
        <button class="btn btn-primary" id="savePreviewChanges">✅ 保存并关闭</button>
        <button class="btn btn-secondary" onclick="closeModal(this)">取消</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 初始渲染
  renderMarkdownPreview();

  // 刷新预览按钮事件
  document.getElementById('refreshPreview').addEventListener('click', renderMarkdownPreview);

  // 保存并关闭按钮事件
  document.getElementById('savePreviewChanges').addEventListener('click', function() {
    const editedContent = document.getElementById('previewSource').value;
    // 回填到原始文档内容输入框
    document.getElementById('docContent').value = editedContent;
    closeModal(modal);
    showAlert('success', '内容已更新，请点击"保存文档"按钮保存修改');
  });

  // 点击遮罩关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

// 渲染Markdown预览
function renderMarkdownPreview() {
  const source = document.getElementById('previewSource').value;
  const rendered = document.getElementById('previewRendered');
  const tocContainer = document.getElementById('previewToc');

  try {
    // 配置marked选项
    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false
      });

      const html = marked.parse(source);
      rendered.innerHTML = html;

      // 生成目录
      generatePreviewToc(rendered, tocContainer);

      // 为所有元素添加边界保护
      rendered.querySelectorAll('*').forEach(el => {
        el.style.maxWidth = '100%';
        el.style.overflowWrap = 'break-word';
        el.style.wordWrap = 'break-word';
      });

      // 特别处理代码块和表格
      rendered.querySelectorAll('pre, table').forEach(el => {
        el.style.overflowX = 'auto';
        el.style.maxWidth = '100%';
      });

      // 处理图片
      rendered.querySelectorAll('img').forEach(img => {
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
      });
    } else {
      rendered.innerHTML = '<p style="color: red;">Markdown渲染库加载失败</p>';
    }
  } catch (error) {
    rendered.innerHTML = `<p style="color: red;">渲染失败: ${escapeHtml(error.message)}</p>`;
  }
}

// 生成预览目录
function generatePreviewToc(container, tocNav) {
  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');

  if (headings.length === 0) {
    tocNav.innerHTML = '<p style="color: #94a3b8; font-size: 12px;">无标题</p>';
    return;
  }

  let tocHTML = '<ul style="list-style: none; margin: 0; padding: 0;">';
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.substring(1));
    const text = heading.textContent;
    const id = heading.id || `preview-heading-${index}`;

    if (!heading.id) {
      heading.id = id;
    }

    const indent = (level - 1) * 12;
    tocHTML += `
      <li style="margin-bottom: 6px;">
        <a href="#${id}"
           class="preview-toc-link"
           style="display: block; padding: 6px 8px; padding-left: ${indent + 8}px; color: #475569; text-decoration: none; font-size: ${14 - (level - 1)}px; border-radius: 6px; transition: all 0.3s ease; border-left: 2px solid transparent;"
           onclick="event.preventDefault(); document.getElementById('${id}').scrollIntoView({behavior: 'smooth', block: 'start'});">
          ${escapeHtml(text)}
        </a>
      </li>
    `;
  });
  tocHTML += '</ul>';

  tocNav.innerHTML = tocHTML;

  // 添加悬停效果
  tocNav.querySelectorAll('.preview-toc-link').forEach(link => {
    link.addEventListener('mouseenter', function() {
      this.style.background = 'rgba(102, 126, 234, 0.1)';
      this.style.color = '#667eea';
      this.style.borderLeftColor = '#667eea';
    });
    link.addEventListener('mouseleave', function() {
      this.style.background = '';
      this.style.color = '#475569';
      this.style.borderLeftColor = 'transparent';
    });
  });
}

// HTML转义工具函数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 解析语雀导出的 Markdown 文档 - 处理标题降级、引用块和表格
function parseYuqueMarkdown(content) {
  let title = '';
  let processedContent = content;

  // 1. 提取标题（从第一个 h1 标签或第一个 # 标题）用于填充表单
  const h1Match = content.match(/<h1[^>]*>(.*?)<\/h1>/);
  if (h1Match) {
    const h1Content = h1Match[1];
    // 移除 font 标签获取纯文本
    title = h1Content.replace(/<font[^>]*>(.*?)<\/font>/g, '$1').trim();
  } else {
    // 如果没有HTML h1,尝试提取第一个Markdown标题
    const mdH1Match = content.match(/^#\s+(.+)$/m);
    if (mdH1Match) {
      title = mdH1Match[1].trim();
    }
  }

  // 2. 【修复引用块】确保引用块每行都有 > 符号
  // 语雀导出的引用块可能只在第一行有 >,后续行缺少 >
  processedContent = processedContent.replace(/^(>.*?)(\n(?!>|\n|$))/gm, function(match, quoteLine, nextLine) {
    // 如果引用块后面跟着非引用块行且不是空行,给后续行添加 >
    return quoteLine + nextLine;
  });

  // 处理多行引用块：确保连续的非空行都有 > 符号
  const lines = processedContent.split('\n');
  let inBlockquote = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测引用块开始
    if (line.trim().startsWith('>')) {
      inBlockquote = true;
    }
    // 如果在引用块中，且当前行不是空行，且没有 > 符号
    else if (inBlockquote && line.trim() !== '' && !line.startsWith('>')) {
      // 检查是否是表格或其他特殊格式
      if (!line.trim().startsWith('|') && !line.trim().startsWith('#')) {
        lines[i] = '> ' + line;
      } else {
        // 遇到表格或标题，结束引用块
        inBlockquote = false;
      }
    }
    // 遇到空行，结束引用块
    else if (line.trim() === '') {
      inBlockquote = false;
    }
  }
  processedContent = lines.join('\n');

  // 3. 【修复表格】确保表格格式正确
  // 语雀导出的表格可能格式不规范，需要确保表格行都有正确的格式
  const tableLines = processedContent.split('\n');
  let inTable = false;
  let tableStart = -1;

  for (let i = 0; i < tableLines.length; i++) {
    const line = tableLines[i].trim();

    // 检测表格开始（包含 | 的行）
    if (line.includes('|') && !inTable) {
      inTable = true;
      tableStart = i;
    }
    // 如果在表格中
    else if (inTable) {
      // 如果当前行不包含 | 或者是空行，表格结束
      if (!line.includes('|') || line === '') {
        // 验证表格是否有分隔行（第二行应该是 |---|---|）
        if (tableStart >= 0 && i - tableStart >= 2) {
          const headerLine = tableLines[tableStart].trim();
          const separatorLine = tableLines[tableStart + 1].trim();

          // 如果第二行不是分隔符，尝试修复
          if (!separatorLine.match(/^[\|\s:-]+$/)) {
            // 统计表头的列数
            const headerCols = headerLine.split('|').filter(cell => cell.trim() !== '').length;
            // 生成分隔行
            const separator = '| ' + Array(headerCols).fill('---').join(' | ') + ' |';
            tableLines.splice(tableStart + 1, 0, separator);
            i++; // 调整索引
          }
        }

        inTable = false;
        tableStart = -1;
      }
    }
  }
  processedContent = tableLines.join('\n');

  // 4. 【智能标题降级】检测第一个标题级别，决定是否降级
  // 查找第一个标题（Markdown格式 # 开头）
  const firstMdHeading = processedContent.match(/^(#{1,6})\s/m);

  // 只有当第一个标题是 # (h1) 时才降级
  const shouldDemoteHeadings = firstMdHeading && firstMdHeading[1] === '#';

  // 5. 处理 Markdown 格式的标题降级（保持内容完全不变）
  if (shouldDemoteHeadings) {
    // 使用临时标记避免重复替换,保持标题内容完全不变
    processedContent = processedContent.replace(/^# (.*)$/gm, '{{H1}}$1');
    processedContent = processedContent.replace(/^## (.*)$/gm, '{{H2}}$1');
    processedContent = processedContent.replace(/^### (.*)$/gm, '{{H3}}$1');
    processedContent = processedContent.replace(/^#### (.*)$/gm, '{{H4}}$1');
    processedContent = processedContent.replace(/^##### (.*)$/gm, '{{H5}}$1');
    processedContent = processedContent.replace(/^###### (.*)$/gm, '{{H6}}$1');

    // 替换为降级后的标题（内容保持原样）
    processedContent = processedContent.replace(/^\{\{H1\}\}(.*)$/gm, '## $1');
    processedContent = processedContent.replace(/^\{\{H2\}\}(.*)$/gm, '### $1');
    processedContent = processedContent.replace(/^\{\{H3\}\}(.*)$/gm, '#### $1');
    processedContent = processedContent.replace(/^\{\{H4\}\}(.*)$/gm, '##### $1');
    processedContent = processedContent.replace(/^\{\{H5\}\}(.*)$/gm, '###### $1');
    processedContent = processedContent.replace(/^\{\{H6\}\}(.*)$/gm, '###### $1');
  }
  // 如果不需要降级，保持原标题级别和内容完全不变

  return {
    title,
    content: processedContent
  };
}

// 提交文档表单
document.getElementById('docForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const category = document.getElementById('docCategory').value;
  const filename = document.getElementById('docFilename').value;
  const frontMatter = {
    layout: 'doc',
    title: document.getElementById('docTitle').value,
    category: category,
    date: document.getElementById('docDate').value,
    tags: document.getElementById('docTags').value.split(',').map(t => t.trim()).filter(Boolean)
  };
  const content = document.getElementById('docContent').value;

  try {
    // 检查是否已存在
    const checkRes = await fetch(`${API_BASE}/docs/${category}/${filename}`);
    const isUpdate = checkRes.ok;

    const res = await fetch(
      `${API_BASE}/docs${isUpdate ? '/' + category + '/' + filename : ''}`,
      {
        method: isUpdate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, filename, frontMatter, content })
      }
    );

    const result = await res.json();

    if (result.success) {
      showAlert('success', isUpdate ? '文档更新成功' : '文档创建成功');
      resetDocForm();
      loadDocs();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '操作失败: ' + error.message);
  }
});

// ============= 数据管理 =============

let linksData = [];
let thoughtsData = [];
let editingLinkIndex = -1;
let editingThoughtIndex = -1;

async function loadDataManagement() {
  await loadLinks();
  await loadThoughts();
}

// 友链管理
async function loadLinks() {
  try {
    const res = await fetch(`${API_BASE}/data/links`);
    const { data } = await res.json();
    linksData = data || [];
    renderLinksList();
  } catch (error) {
    showAlert('error', '加载友链失败: ' + error.message);
  }
}

function renderLinksList() {
  const html = linksData.map((link, index) => `
    <div class="list-item">
      <div>
        <div class="list-item-title">${link.name}</div>
        <div class="list-item-meta">${link.url}</div>
        <div class="list-item-meta">${link.description}</div>
      </div>
      <div class="list-item-actions">
        <button class="btn btn-sm btn-primary" onclick="editLink(${index})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteLink(${index})">删除</button>
      </div>
    </div>
  `).join('');

  document.getElementById('linksList').innerHTML = html || '<p style="color:#999;">暂无友链</p>';
}

function editLink(index) {
  const link = linksData[index];
  document.getElementById('linkName').value = link.name || '';
  document.getElementById('linkUrl').value = link.url || '';
  document.getElementById('linkDesc').value = link.description || '';
  document.getElementById('linkAvatar').value = link.avatar || '';

  editingLinkIndex = index;

  // 修改按钮文本
  const submitBtn = document.querySelector('#linkForm button[type="submit"]');
  submitBtn.textContent = '更新友链';
  submitBtn.className = 'btn btn-success';

  document.getElementById('linkForm').scrollIntoView({ behavior: 'smooth' });
}

function deleteLink(index) {
  if (!confirm('确定要删除这个友链吗？')) return;

  linksData.splice(index, 1);
  saveLinksData();
}

function resetLinkForm() {
  document.getElementById('linkForm').reset();
  editingLinkIndex = -1;

  const submitBtn = document.querySelector('#linkForm button[type="submit"]');
  submitBtn.textContent = '添加友链';
  submitBtn.className = 'btn btn-primary';
}

document.getElementById('linkForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const link = {
    name: document.getElementById('linkName').value,
    url: document.getElementById('linkUrl').value,
    description: document.getElementById('linkDesc').value,
    avatar: document.getElementById('linkAvatar').value || 'https://via.placeholder.com/60'
  };

  if (editingLinkIndex >= 0) {
    // 更新
    linksData[editingLinkIndex] = link;
  } else {
    // 添加
    linksData.push(link);
  }

  await saveLinksData();
  resetLinkForm();
});

async function saveLinksData() {
  try {
    const res = await fetch(`${API_BASE}/data/links`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(linksData)
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', '友链保存成功');
      renderLinksList();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '保存失败: ' + error.message);
  }
}

// 碎碎念管理
async function loadThoughts() {
  try {
    const res = await fetch(`${API_BASE}/data/thoughts`);
    const { data } = await res.json();
    thoughtsData = data || [];
    renderThoughtsList();
  } catch (error) {
    showAlert('error', '加载碎碎念失败: ' + error.message);
  }
}

function renderThoughtsList() {
  // 按日期时间倒序排序（最新的在前）
  const sortedThoughts = thoughtsData.sort((a, b) => {
    const dateA = new Date(a.datetime || a.date);
    const dateB = new Date(b.datetime || b.date);
    return dateB - dateA;
  });

  const html = sortedThoughts.map((thought, index) => `
    <div class="list-item">
      <div>
        <div class="list-item-title">${thought.content}</div>
        <div class="list-item-meta">
          ${thought.datetime || thought.date}
          ${thought.tags ? ' | ' + thought.tags.join(', ') : ''}
        </div>
      </div>
      <div class="list-item-actions">
        <button class="btn btn-sm btn-primary" onclick="editThought(${index})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteThought(${index})">删除</button>
      </div>
    </div>
  `).join('');

  document.getElementById('thoughtsList').innerHTML = html || '<p style="color:#999;">暂无碎碎念</p>';
}

function editThought(index) {
  const thought = thoughtsData[index];
  const datetime = thought.datetime || thought.date;

  // 转换为 datetime-local 格式 (YYYY-MM-DDTHH:mm)
  let datetimeValue;
  if (datetime.includes(' ')) {
    // 格式: "2025-12-15 14:30"
    datetimeValue = datetime.replace(' ', 'T');
  } else {
    // 格式: "2025-12-15"
    datetimeValue = datetime + 'T00:00';
  }

  document.getElementById('thoughtDatetime').value = datetimeValue;
  document.getElementById('thoughtContent').value = thought.content || '';
  document.getElementById('thoughtTags').value = (thought.tags || []).join(', ');

  editingThoughtIndex = index;

  // 修改按钮文本
  const submitBtn = document.querySelector('#thoughtForm button[type="submit"]');
  submitBtn.textContent = '更新碎碎念';
  submitBtn.className = 'btn btn-success';

  document.getElementById('thoughtForm').scrollIntoView({ behavior: 'smooth' });
}

function deleteThought(index) {
  if (!confirm('确定要删除这条碎碎念吗？')) return;

  thoughtsData.splice(index, 1);
  saveThoughtsData();
}

function resetThoughtForm() {
  document.getElementById('thoughtForm').reset();

  // 设置为当前日期时间
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('thoughtDatetime').value = `${year}-${month}-${day}T${hours}:${minutes}`;

  editingThoughtIndex = -1;

  const submitBtn = document.querySelector('#thoughtForm button[type="submit"]');
  submitBtn.textContent = '添加碎碎念';
  submitBtn.className = 'btn btn-primary';
}

document.getElementById('thoughtForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // 将 datetime-local 格式 (YYYY-MM-DDTHH:mm) 转换为 YAML 格式 (YYYY-MM-DD HH:mm)
  const datetimeLocal = document.getElementById('thoughtDatetime').value;
  const datetime = datetimeLocal.replace('T', ' ');

  const thought = {
    datetime: datetime,
    content: document.getElementById('thoughtContent').value,
    tags: document.getElementById('thoughtTags').value
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
  };

  if (editingThoughtIndex >= 0) {
    // 更新
    thoughtsData[editingThoughtIndex] = thought;
  } else {
    // 添加到开头（最新的在前面）
    thoughtsData.unshift(thought);
  }

  await saveThoughtsData();
  resetThoughtForm();
});

async function saveThoughtsData() {
  try {
    const res = await fetch(`${API_BASE}/data/thoughts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(thoughtsData)
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', '碎碎念保存成功');
      renderThoughtsList();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '保存失败: ' + error.message);
  }
}

// ============= GitHub 精选管理 =============

let githubProjectsData = [];
let editingGithubProjectIndex = -1;

async function loadGithubProjects() {
  try {
    const res = await fetch(`${API_BASE}/data/github-projects`);
    const { data } = await res.json();
    githubProjectsData = data || [];
    renderGithubProjectsList();
  } catch (error) {
    showAlert('error', '加载 GitHub 项目失败: ' + error.message);
  }
}

function renderGithubProjectsList() {
  // 按添加时间倒序排序 - 创建副本避免修改原数组
  const sortedProjects = [...githubProjectsData].sort((a, b) => {
    const dateA = new Date(a.addtime);
    const dateB = new Date(b.addtime);
    return dateB - dateA;
  });

  const html = sortedProjects.map((project) => {
    // 找到该项目在原数组中的真实索引
    const realIndex = githubProjectsData.findIndex(p =>
      p.url === project.url && p.addtime === project.addtime
    );

    return `
    <div class="list-item">
      <div>
        <div class="list-item-title">${project.name}</div>
        <div class="list-item-meta">${project.description}</div>
        <div class="list-item-meta">${project.url}</div>
        <div class="list-item-meta">添加时间: ${project.addtime || ''}</div>
        <div class="list-item-meta">标签: ${(project.tags || []).join(', ')}</div>
      </div>
      <div class="list-item-actions">
        <button class="btn btn-sm btn-primary" onclick="editGithubProject(${realIndex})">编辑</button>
        <button class="btn btn-sm btn-danger" onclick="deleteGithubProject(${realIndex})">删除</button>
      </div>
    </div>
  `}).join('');

  document.getElementById('githubProjectsList').innerHTML = html || '<p style="color:#999;">暂无 GitHub 精选项目</p>';
}

function editGithubProject(index) {
  const project = githubProjectsData[index];
  document.getElementById('githubProjectName').value = project.name || '';
  document.getElementById('githubProjectDesc').value = project.description || '';
  document.getElementById('githubProjectUrl').value = project.url || '';
  document.getElementById('githubProjectTags').value = (project.tags || []).join(', ');

  // 转换时间格式为 datetime-local
  if (project.addtime) {
    const datetime = project.addtime.includes(' ')
      ? project.addtime.replace(' ', 'T')
      : project.addtime + 'T00:00';
    document.getElementById('githubProjectAddtime').value = datetime;
  }

  editingGithubProjectIndex = index;

  const submitBtn = document.querySelector('#githubProjectForm button[type="submit"]');
  submitBtn.textContent = '更新项目';
  submitBtn.className = 'btn btn-success';

  document.getElementById('githubProjectForm').scrollIntoView({ behavior: 'smooth' });
}

function deleteGithubProject(index) {
  if (!confirm('确定要删除这个 GitHub 项目吗？')) return;

  githubProjectsData.splice(index, 1);
  saveGithubProjectsData();
}

function resetGithubProjectForm() {
  document.getElementById('githubProjectForm').reset();

  // 设置为当前日期时间
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('githubProjectAddtime').value = `${year}-${month}-${day}T${hours}:${minutes}`;

  editingGithubProjectIndex = -1;

  const submitBtn = document.querySelector('#githubProjectForm button[type="submit"]');
  submitBtn.textContent = '添加项目';
  submitBtn.className = 'btn btn-primary';
}

// 从 GitHub API 获取项目信息
async function fetchGithubRepoInfo() {
  const url = document.getElementById('githubProjectUrl').value.trim();

  if (!url) {
    showAlert('error', '请先填写 GitHub 链接');
    return;
  }

  // 解析 GitHub URL
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) {
    showAlert('error', 'GitHub 链接格式不正确，应为: https://github.com/owner/repo');
    return;
  }

  const owner = match[1];
  const repo = match[2];

  try {
    // 调用 GitHub API
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`);

    if (!response.ok) {
      if (response.status === 404) {
        showAlert('error', '仓库不存在或无法访问');
      } else if (response.status === 403) {
        showAlert('error', 'GitHub API 请求次数已达上限，请稍后再试');
      } else {
        showAlert('error', '获取仓库信息失败');
      }
      return;
    }

    const data = await response.json();

    // 自动填充表单
    document.getElementById('githubProjectName').value = data.name || '';
    document.getElementById('githubProjectDesc').value = data.description || '';

    showAlert('success', `成功获取项目信息！项目将在博客页面自动获取 Stars 和编程语言`);
  } catch (error) {
    showAlert('error', '获取失败: ' + error.message);
  }
}

document.getElementById('githubProjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  // 将 datetime-local 格式转换为 YAML 格式 (YYYY-MM-DD HH:mm)
  const datetimeLocal = document.getElementById('githubProjectAddtime').value;
  const addtime = datetimeLocal.replace('T', ' ');

  const tags = document.getElementById('githubProjectTags').value
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);

  // 如果用户没有填写任何标签，则添加默认的 "github" 标签
  if (tags.length === 0) {
    tags.push('github');
  }

  const project = {
    name: document.getElementById('githubProjectName').value,
    description: document.getElementById('githubProjectDesc').value,
    url: document.getElementById('githubProjectUrl').value,
    tags: tags,
    addtime: addtime
  };

  if (editingGithubProjectIndex >= 0) {
    githubProjectsData[editingGithubProjectIndex] = project;
  } else {
    // 添加到开头（最新的在前面）
    githubProjectsData.unshift(project);
  }

  await saveGithubProjectsData();
  resetGithubProjectForm();
});

async function saveGithubProjectsData() {
  try {
    const res = await fetch(`${API_BASE}/data/github-projects`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(githubProjectsData)
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', 'GitHub 项目保存成功');
      renderGithubProjectsList();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '保存失败: ' + error.message);
  }
}

// ============= 配置管理 =============

// 加载配置信息
async function loadConfig() {
  try {
    const res = await fetch(`${API_BASE}/config/info`);
    const { data } = await res.json();

    document.getElementById('configTitle').value = data.title || '';
    document.getElementById('configDescription').value = data.description || '';
    document.getElementById('configUrl').value = data.url || '';
    document.getElementById('configBaseurl').value = data.baseurl || '';
    document.getElementById('configGithubUrl').value = data.github_url || '';

    // Footer配置
    document.getElementById('configFooterText').value = data.footer_text || '';
    document.getElementById('configFooterPoweredBy').checked = data.footer_powered_by !== false;
    document.getElementById('configFooterPoweredByText').value = data.footer_powered_by_text || 'Powered by';
    document.getElementById('configFooterPoweredByName').value = data.footer_powered_by_name || 'Jekyll';
    document.getElementById('configFooterPoweredByLink').value = data.footer_powered_by_link || 'https://jekyllrb.com/';

    // 统计配置
    document.getElementById('configBaiduAnalytics').value = data.baidu_analytics || '';
    document.getElementById('configBusuanziCounter').checked = data.busuanzi_counter !== false;

    // 显示图标预览
    if (data.favicon) {
      document.getElementById('faviconPreview').innerHTML = `
        <img src="${data.favicon}?t=${Date.now()}" style="width: 64px; height: 64px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" alt="Favicon">
      `;
    } else {
      document.getElementById('faviconPreview').innerHTML = '<p style="color: #999;">暂无图标</p>';
    }

    if (data.avatar) {
      document.getElementById('avatarPreview').innerHTML = `
        <img src="${data.avatar}?t=${Date.now()}" style="width: 120px; height: 120px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); object-fit: cover;" alt="Avatar">
      `;
    } else {
      document.getElementById('avatarPreview').innerHTML = '<p style="color: #999;">暂无头像</p>';
    }
  } catch (error) {
    showAlert('error', '加载配置失败: ' + error.message);
  }
}

// 保存配置
document.getElementById('configForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const config = {
    title: document.getElementById('configTitle').value,
    description: document.getElementById('configDescription').value,
    url: document.getElementById('configUrl').value,
    baseurl: document.getElementById('configBaseurl').value,
    github_url: document.getElementById('configGithubUrl').value,
    footer_text: document.getElementById('configFooterText').value,
    footer_powered_by: document.getElementById('configFooterPoweredBy').checked,
    footer_powered_by_text: document.getElementById('configFooterPoweredByText').value,
    footer_powered_by_name: document.getElementById('configFooterPoweredByName').value,
    footer_powered_by_link: document.getElementById('configFooterPoweredByLink').value,
    baidu_analytics: document.getElementById('configBaiduAnalytics').value,
    busuanzi_counter: document.getElementById('configBusuanziCounter').checked
  };

  try {
    const res = await fetch(`${API_BASE}/config/info`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', '✅ 配置保存成功！\n\n请重启 Jekyll 服务使配置生效：\nbundle exec jekyll serve --host 0.0.0.0');
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '保存失败: ' + error.message);
  }
});

// 上传Favicon
async function uploadFavicon() {
  const input = document.getElementById('faviconInput');
  const file = input.files[0];

  if (!file) {
    showAlert('error', '请先选择图标文件');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const res = await fetch(`${API_BASE}/config/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'favicon',
          data: e.target.result,
          filename: file.name
        })
      });

      const result = await res.json();

      if (result.success) {
        showAlert('success', '图标上传成功');
        // 立即更新预览，不依赖loadConfig
        document.getElementById('faviconPreview').innerHTML = `
          <img src="/assets/images/favicon.ico?t=${Date.now()}" style="width: 64px; height: 64px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" alt="Favicon">
        `;
        input.value = '';
      } else {
        showAlert('error', result.error);
      }
    } catch (error) {
      showAlert('error', '上传失败: ' + error.message);
    }
  };

  reader.readAsDataURL(file);
}

// 上传Avatar
async function uploadAvatar() {
  const input = document.getElementById('avatarInput');
  const file = input.files[0];

  if (!file) {
    showAlert('error', '请先选择头像文件');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const res = await fetch(`${API_BASE}/config/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'avatar',
          data: e.target.result,
          filename: file.name
        })
      });

      const result = await res.json();

      if (result.success) {
        showAlert('success', '头像上传成功');
        // 立即更新预览，不依赖loadConfig
        document.getElementById('avatarPreview').innerHTML = `
          <img src="/assets/images/avatar.jpg?t=${Date.now()}" style="width: 120px; height: 120px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.1); object-fit: cover;" alt="Avatar">
        `;
        input.value = '';
      } else {
        showAlert('error', result.error);
      }
    } catch (error) {
      showAlert('error', '上传失败: ' + error.message);
    }
  };

  reader.readAsDataURL(file);
}

// ============= Git 操作 =============

// 加载 Git 状态
async function loadGitStatus() {
  try {
    const res = await fetch(`${API_BASE}/git/status`);
    const { data } = await res.json();

    const html = `
      <div class="git-section">
        <div class="status-box">
          <h3>已修改 (${data.modified.length})</h3>
          ${data.modified.map(f => `<div class="status-item">M ${f}</div>`).join('') || '<div class="status-item">无</div>'}
        </div>
        <div class="status-box">
          <h3>已删除 (${data.deleted.length})</h3>
          ${data.deleted.map(f => `<div class="status-item">D ${f}</div>`).join('') || '<div class="status-item">无</div>'}
        </div>
        <div class="status-box">
          <h3>新增 (${data.not_added.length})</h3>
          ${data.not_added.map(f => `<div class="status-item">A ${f}</div>`).join('') || '<div class="status-item">无</div>'}
        </div>
        <div class="status-box">
          <h3>已暂存 (${data.staged.length})</h3>
          ${data.staged.map(f => `<div class="status-item">S ${f}</div>`).join('') || '<div class="status-item">无</div>'}
        </div>
      </div>
    `;

    document.getElementById('gitStatus').innerHTML = html;

    // 加载提交记录
    await loadGitLog();
  } catch (error) {
    document.getElementById('gitStatus').innerHTML = `<p style="color:red;">加载失败: ${error.message}</p>`;
  }
}

// 刷新Git状态
function refreshGitStatus() {
  loadGitStatus();
}

// 加载提交记录
async function loadGitLog() {
  try {
    const res = await fetch(`${API_BASE}/git/log`);
    const { data } = await res.json();

    const html = data.all.map(commit => `
      <div class="list-item">
        <div>
          <div class="list-item-title">${commit.message}</div>
          <div class="list-item-meta">${commit.author_name} · ${new Date(commit.date).toLocaleString()}</div>
        </div>
        <div><code style="font-size:12px;">${commit.hash.substring(0, 7)}</code></div>
      </div>
    `).join('');

    document.getElementById('gitLog').innerHTML = html || '<p>暂无提交记录</p>';
  } catch (error) {
    document.getElementById('gitLog').innerHTML = `<p style="color:red;">加载失败: ${error.message}</p>`;
  }
}

// 提交并推送
document.getElementById('gitForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const message = document.getElementById('commitMessage').value;
  const branch = document.getElementById('gitBranch').value || 'main';

  if (!confirm(`确定要提交并推送到 ${branch} 分支吗？`)) return;

  try {
    const res = await fetch(`${API_BASE}/git/commit-and-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, branch })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', '提交并推送成功！');
      document.getElementById('commitMessage').value = '';
      loadGitStatus();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '操作失败: ' + error.message);
  }
});

// 拉取远程更新
async function pullFromRemote() {
  const branch = document.getElementById('gitBranch').value || 'main';

  if (!confirm(`确定要从远程拉取 ${branch} 分支的更新吗？`)) return;

  try {
    const res = await fetch(`${API_BASE}/git/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', '拉取成功！');
      loadGitStatus();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '拉取失败: ' + error.message);
  }
}

// 查看差异
async function showDiffModal() {
  try {
    const res = await fetch(`${API_BASE}/git/diff`);
    const { data } = await res.json();

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal" style="width: 90%; max-width: 1200px;">
        <div class="modal-header">
          <h3>📊 文件差异</h3>
        </div>
        <div class="modal-body">
          <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; overflow-x: auto; max-height: 500px; font-family: monospace; font-size: 13px; line-height: 1.6;">${data || '无差异'}</pre>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal(this)">关闭</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal);
    });
  } catch (error) {
    showAlert('error', '获取差异失败: ' + error.message);
  }
}

// 暂存改动
function showStashModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>💾 暂存当前改动</h3>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>暂存描述（可选）</label>
          <input type="text" id="stashMessage" placeholder="描述这次暂存的内容...">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" onclick="saveStash()">保存暂存</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

// 保存暂存
async function saveStash() {
  const message = document.getElementById('stashMessage').value;

  try {
    const res = await fetch(`${API_BASE}/git/stash/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', '已暂存当前改动！');
      closeModal(document.querySelector('.modal-overlay'));
      loadGitStatus();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '暂存失败: ' + error.message);
  }
}

// 加载分支列表
async function loadBranches() {
  document.getElementById('branchesList').innerHTML = '<div class="loading">加载中...</div>';

  try {
    const res = await fetch(`${API_BASE}/git/branches`);
    const { data } = await res.json();

    const html = `
      <div style="margin-bottom: 15px; padding: 10px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
        <strong>当前分支:</strong> ${data.current}
      </div>
      ${data.all.map(branch => `
        <div class="list-item">
          <div>
            <div class="list-item-title">
              ${branch}
              ${branch === data.current ? '<span style="color: #3b82f6; font-size: 12px; margin-left: 8px;">● 当前</span>' : ''}
            </div>
          </div>
          <div class="list-item-actions">
            ${branch !== data.current ? `<button class="btn btn-sm btn-primary" onclick="checkoutBranch('${branch}')">切换</button>` : ''}
            ${branch !== data.current ? `<button class="btn btn-sm btn-danger" onclick="deleteBranch('${branch}')">删除</button>` : ''}
          </div>
        </div>
      `).join('')}
    `;

    document.getElementById('branchesList').innerHTML = html;
  } catch (error) {
    document.getElementById('branchesList').innerHTML = `<p style="color:red;">加载失败: ${error.message}</p>`;
  }
}

// 创建分支模态框
function showCreateBranchModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>➕ 创建新分支</h3>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>分支名称 *</label>
          <input type="text" id="newBranchName" placeholder="例如: feature-new-ui" required>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" onclick="createBranch()">创建</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

// 创建分支
async function createBranch() {
  const name = document.getElementById('newBranchName').value.trim();

  if (!name) {
    showAlert('error', '请输入分支名称');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/git/branch/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      closeModal(document.querySelector('.modal-overlay'));
      loadBranches();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '创建失败: ' + error.message);
  }
}

// 切换分支
async function checkoutBranch(name) {
  if (!confirm(`确定要切换到分支 ${name} 吗？`)) return;

  try {
    const res = await fetch(`${API_BASE}/git/branch/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      loadBranches();
      loadGitStatus();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '切换失败: ' + error.message);
  }
}

// 删除分支
async function deleteBranch(name) {
  if (!confirm(`确定要删除分支 ${name} 吗？此操作不可恢复！`)) return;

  try {
    const res = await fetch(`${API_BASE}/git/branch/${name}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      loadBranches();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '删除失败: ' + error.message);
  }
}

// 合并分支模态框
function showMergeBranchModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>🔀 合并分支</h3>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>要合并的分支 *</label>
          <input type="text" id="mergeBranchName" placeholder="输入要合并到当前分支的分支名称" required>
        </div>
        <p style="color: #64748b; font-size: 13px;">提示: 将指定分支的内容合并到当前分支</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal(this)">取消</button>
        <button class="btn btn-success" onclick="mergeBranch()">合并</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

// 合并分支
async function mergeBranch() {
  const branch = document.getElementById('mergeBranchName').value.trim();

  if (!branch) {
    showAlert('error', '请输入要合并的分支名称');
    return;
  }

  if (!confirm(`确定要将分支 ${branch} 合并到当前分支吗？`)) return;

  try {
    const res = await fetch(`${API_BASE}/git/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      closeModal(document.querySelector('.modal-overlay'));
      loadGitStatus();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '合并失败: ' + error.message);
  }
}

// 加载暂存列表
async function loadStashList() {
  document.getElementById('stashList').innerHTML = '<div class="loading">加载中...</div>';

  try {
    const res = await fetch(`${API_BASE}/git/stash/list`);
    const { data } = await res.json();

    if (!data.all || data.all.length === 0) {
      document.getElementById('stashList').innerHTML = '<p style="color:#999;">暂无暂存</p>';
      return;
    }

    const html = data.all.map((stash, index) => `
      <div class="list-item">
        <div>
          <div class="list-item-title">stash@{${index}}</div>
          <div class="list-item-meta">${stash.message || stash.hash}</div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-sm btn-success" onclick="applyStash(${index})">应用</button>
          <button class="btn btn-sm btn-primary" onclick="popStash(${index})">弹出</button>
          <button class="btn btn-sm btn-danger" onclick="deleteStash(${index})">删除</button>
        </div>
      </div>
    `).join('');

    document.getElementById('stashList').innerHTML = html;
  } catch (error) {
    document.getElementById('stashList').innerHTML = `<p style="color:red;">加载失败: ${error.message}</p>`;
  }
}

// 应用暂存
async function applyStash(index) {
  try {
    const res = await fetch(`${API_BASE}/git/stash/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      loadGitStatus();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '应用失败: ' + error.message);
  }
}

// 弹出暂存
async function popStash(index) {
  if (!confirm('确定要弹出这个暂存吗？弹出后会从暂存列表中删除。')) return;

  try {
    const res = await fetch(`${API_BASE}/git/stash/pop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      loadStashList();
      loadGitStatus();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '弹出失败: ' + error.message);
  }
}

// 删除暂存
async function deleteStash(index) {
  if (!confirm('确定要删除这个暂存吗？此操作不可恢复！')) return;

  try {
    const res = await fetch(`${API_BASE}/git/stash/${index}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      loadStashList();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '删除失败: ' + error.message);
  }
}

// 加载远程仓库
async function loadRemotes() {
  document.getElementById('remotesList').innerHTML = '<div class="loading">加载中...</div>';

  try {
    const res = await fetch(`${API_BASE}/git/remotes`);
    const { data } = await res.json();

    if (!data || data.length === 0) {
      document.getElementById('remotesList').innerHTML = '<p style="color:#999;">暂无远程仓库</p>';
      return;
    }

    const html = data.map(remote => `
      <div class="list-item">
        <div>
          <div class="list-item-title">${remote.name}</div>
          <div class="list-item-meta">
            Fetch: ${remote.refs.fetch}<br>
            Push: ${remote.refs.push}
          </div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-sm btn-danger" onclick="deleteRemote('${remote.name}')">删除</button>
        </div>
      </div>
    `).join('');

    document.getElementById('remotesList').innerHTML = html;
  } catch (error) {
    document.getElementById('remotesList').innerHTML = `<p style="color:red;">加载失败: ${error.message}</p>`;
  }
}

// 添加远程仓库模态框
function showAddRemoteModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>➕ 添加远程仓库</h3>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>名称 *</label>
          <input type="text" id="remoteName" placeholder="例如: origin" required>
        </div>
        <div class="form-group">
          <label>URL *</label>
          <input type="text" id="remoteUrl" placeholder="例如: https://github.com/user/repo.git" required>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" onclick="addRemote()">添加</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

// 添加远程仓库
async function addRemote() {
  const name = document.getElementById('remoteName').value.trim();
  const url = document.getElementById('remoteUrl').value.trim();

  if (!name || !url) {
    showAlert('error', '请填写完整信息');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/git/remote/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      closeModal(document.querySelector('.modal-overlay'));
      loadRemotes();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '添加失败: ' + error.message);
  }
}

// 删除远程仓库
async function deleteRemote(name) {
  if (!confirm(`确定要删除远程仓库 ${name} 吗？`)) return;

  try {
    const res = await fetch(`${API_BASE}/git/remote/${name}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      loadRemotes();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '删除失败: ' + error.message);
  }
}

// 加载标签列表
async function loadTags() {
  document.getElementById('tagsList').innerHTML = '<div class="loading">加载中...</div>';

  try {
    const res = await fetch(`${API_BASE}/git/tags`);
    const { data } = await res.json();

    if (!data.all || data.all.length === 0) {
      document.getElementById('tagsList').innerHTML = '<p style="color:#999;">暂无标签</p>';
      return;
    }

    const html = data.all.map(tag => `
      <div class="list-item">
        <div>
          <div class="list-item-title">🏷️ ${tag}</div>
        </div>
        <div class="list-item-actions">
          <button class="btn btn-sm btn-success" onclick="pushTag('${tag}')">推送</button>
          <button class="btn btn-sm btn-danger" onclick="deleteTag('${tag}')">删除</button>
        </div>
      </div>
    `).join('');

    document.getElementById('tagsList').innerHTML = html;
  } catch (error) {
    document.getElementById('tagsList').innerHTML = `<p style="color:red;">加载失败: ${error.message}</p>`;
  }
}

// 创建标签模态框
function showCreateTagModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>🏷️ 创建标签</h3>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>标签名称 *</label>
          <input type="text" id="tagName" placeholder="例如: v1.0.0" required>
        </div>
        <div class="form-group">
          <label>标签描述（可选）</label>
          <textarea id="tagMessage" rows="3" placeholder="添加描述以创建附注标签"></textarea>
          <small>如果填写描述，将创建附注标签（annotated tag），否则创建轻量标签</small>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" onclick="createTag()">创建</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

// 创建标签
async function createTag() {
  const name = document.getElementById('tagName').value.trim();
  const message = document.getElementById('tagMessage').value.trim();

  if (!name) {
    showAlert('error', '请输入标签名称');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/git/tag/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      closeModal(document.querySelector('.modal-overlay'));
      loadTags();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '创建失败: ' + error.message);
  }
}

// 推送单个标签
async function pushTag(name) {
  if (!confirm(`确定要推送标签 ${name} 到远程吗？`)) return;

  try {
    const res = await fetch(`${API_BASE}/git/tag/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '推送失败: ' + error.message);
  }
}

// 推送所有标签
async function pushAllTags() {
  if (!confirm('确定要推送所有标签到远程吗？')) return;

  try {
    const res = await fetch(`${API_BASE}/git/tag/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '推送失败: ' + error.message);
  }
}

// 删除标签
async function deleteTag(name) {
  if (!confirm(`确定要删除标签 ${name} 吗？此操作不可恢复！`)) return;

  try {
    const res = await fetch(`${API_BASE}/git/tag/${name}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.success) {
      showAlert('success', result.message);
      loadTags();
    } else {
      showAlert('error', result.error);
    }
  } catch (error) {
    showAlert('error', '删除失败: ' + error.message);
  }
}

// ============= 工具函数 =============

function showAlert(type, message) {
  // 移除旧的提示
  const oldAlert = document.querySelector('.alert');
  if (oldAlert) oldAlert.remove();

  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.style.cssText = 'position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 10000; max-width: 600px; white-space: pre-wrap;';
  alert.textContent = message;

  document.body.appendChild(alert);

  setTimeout(() => alert.remove(), 8000);
}

// 显示技能模态框
function showSkillModal(skill, onSave) {
  const isEdit = !!skill;
  const skillItems = skill?.items || [];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${isEdit ? '编辑技能分类' : '添加技能分类'}</h3>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>分类名称 *</label>
          <input type="text" id="skillModalName" value="${skill?.name || ''}" placeholder="如：前端、后端、数据库">
        </div>
        <div class="form-group">
          <label>技能项目 *</label>
          <input type="text" id="skillModalItemInput" placeholder="输入技能名称后按回车添加">
          <div class="skill-items-input" id="skillItemsContainer"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" id="saveSkillBtn">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 渲染已有技能项
  const container = document.getElementById('skillItemsContainer');
  const renderItems = () => {
    container.innerHTML = skillItems.map((item, idx) => `
      <span class="skill-item-tag">
        ${item}
        <button onclick="removeSkillItem(${idx})">&times;</button>
      </span>
    `).join('');
  };
  renderItems();

  // 添加技能项
  const itemInput = document.getElementById('skillModalItemInput');
  itemInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = itemInput.value.trim();
      if (value) {
        skillItems.push(value);
        itemInput.value = '';
        renderItems();
      }
    }
  });

  // 移除技能项
  window.removeSkillItem = (idx) => {
    skillItems.splice(idx, 1);
    renderItems();
  };

  // 保存
  document.getElementById('saveSkillBtn').onclick = () => {
    const name = document.getElementById('skillModalName').value.trim();
    if (!name) {
      showAlert('error', '请输入分类名称');
      return;
    }
    if (skillItems.length === 0) {
      showAlert('error', '请至少添加一个技能项目');
      return;
    }
    onSave({ name, items: skillItems });
    closeModal(modal);
  };

  // 点击遮罩关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

// 显示当前在做模态框
function showCurrentlyModal(item, onSave) {
  const isEdit = !!item;

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${isEdit ? '编辑项目' : '添加项目'}</h3>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>内容 *</label>
          <textarea id="currentlyModalContent" rows="3" placeholder="描述你正在做的事情...">${item || ''}</textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="closeModal(this)">取消</button>
        <button class="btn btn-primary" id="saveCurrentlyBtn">保存</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // 保存
  document.getElementById('saveCurrentlyBtn').onclick = () => {
    const content = document.getElementById('currentlyModalContent').value.trim();
    if (!content) {
      showAlert('error', '请输入内容');
      return;
    }
    onSave(content);
    closeModal(modal);
  };

  // 点击遮罩关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(modal);
  });

  // 聚焦到输入框
  setTimeout(() => document.getElementById('currentlyModalContent').focus(), 100);
}

// 关闭模态框
function closeModal(element) {
  const modal = element.closest ? element.closest('.modal-overlay') : element;
  if (modal) modal.remove();
}

// 初始化
document.getElementById('docDate').value = new Date().toISOString().split('T')[0];

// 设置碎碎念的初始日期时间
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
document.getElementById('thoughtDatetime').value = `${year}-${month}-${day}T${hours}:${minutes}`;

// 设置 GitHub 精选项目的初始添加时间
document.getElementById('githubProjectAddtime').value = `${year}-${month}-${day}T${hours}:${minutes}`;

// 加载初始显示的标签页数据
const initialTab = document.querySelector('.tab.active');
if (initialTab) {
  const tabName = initialTab.dataset.tab;
  if (tabName === 'home') loadHomeData();
  else if (tabName === 'pages') loadPages();
  else if (tabName === 'docs') loadDocs();
  else if (tabName === 'data') loadDataManagement();
  else if (tabName === 'github') loadGithubProjects();
  else if (tabName === 'config') loadConfig();
  else if (tabName === 'git') loadGitStatus();
}
