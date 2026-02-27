// 编程语言颜色映射
const languageColors = {
  'JavaScript': '#f1e05a',
  'TypeScript': '#3178c6',
  'Python': '#3572A5',
  'Java': '#b07219',
  'C++': '#f34b7d',
  'C': '#555555',
  'C#': '#178600',
  'Go': '#00ADD8',
  'Rust': '#dea584',
  'Ruby': '#701516',
  'PHP': '#4F5D95',
  'Swift': '#ffac45',
  'Kotlin': '#A97BFF',
  'Shell': '#89e051',
  'HTML': '#e34c26',
  'CSS': '#563d7c',
  'Vue': '#41b883',
  'React': '#61dafb',
  'default': '#8b92a0'
};

// 缓存配置
const CACHE_KEY = 'github_projects_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24小时

// 从缓存中获取数据
function getCachedData(url) {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    if (!cache) return null;

    const cacheData = JSON.parse(cache);
    const item = cacheData[url];

    if (!item) return null;

    // 检查缓存是否过期
    if (Date.now() - item.timestamp > CACHE_DURATION) {
      return null;
    }

    return item.data;
  } catch (error) {
    console.error('Failed to get cached data:', error);
    return null;
  }
}

// 保存数据到缓存
function setCachedData(url, data) {
  try {
    const cache = localStorage.getItem(CACHE_KEY);
    const cacheData = cache ? JSON.parse(cache) : {};

    cacheData[url] = {
      data: data,
      timestamp: Date.now()
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Failed to set cached data:', error);
  }
}

// 从GitHub API获取项目信息（带缓存）
async function fetchGithubRepoInfo(url) {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) return null;

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

  // 先尝试从缓存获取
  const cachedData = getCachedData(apiUrl);
  if (cachedData) {
    console.log(`Using cached data for ${repo}`);
    return cachedData;
  }

  try {
    // 获取基本信息
    const response = await fetch(apiUrl);

    if (!response.ok) {
      if (response.status === 403) {
        console.warn(`GitHub API rate limit exceeded for ${repo}`);
      }
      return null;
    }

    const data = await response.json();

    // 获取所有语言信息
    let languages = [];
    try {
      const languagesResponse = await fetch(data.languages_url);
      if (languagesResponse.ok) {
        const languagesData = await languagesResponse.json();
        // 获取语言列表并按使用量排序
        languages = Object.keys(languagesData).sort((a, b) => languagesData[b] - languagesData[a]);
      }
    } catch (error) {
      console.warn(`Failed to fetch languages for ${repo}:`, error);
    }

    // 如果没有获取到语言列表，使用主语言
    if (languages.length === 0 && data.language) {
      languages = [data.language];
    }

    const result = {
      stars: data.stargazers_count || 0,
      languages: languages
    };

    // 保存到缓存
    setCachedData(apiUrl, result);

    return result;
  } catch (error) {
    console.error('Failed to fetch GitHub data:', error);
    return null;
  }
}

// 更新GitHub项目数据到后端
async function updateGithubProjectsData(projects) {
  try {
    const response = await fetch('http://localhost:3001/api/data/github-projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projects)
    });

    if (!response.ok) {
      console.error('Failed to update GitHub projects data');
    }
  } catch (error) {
    console.error('Error updating GitHub projects:', error);
  }
}

// 自动获取并更新GitHub项目的stars和languages（仅在需要时）
async function autoFetchGithubData() {
  try {
    // 获取当前的项目数据
    const response = await fetch('http://localhost:3001/api/data/github-projects');
    if (!response.ok) return;

    const { data: projects } = await response.json();
    if (!projects || projects.length === 0) return;

    let hasUpdates = false;
    let fetchCount = 0;
    const MAX_FETCH_PER_SESSION = 5; // 每次最多只获取5个项目数据

    // 遍历所有项目，优先更新最需要的数据
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i];

      // 如果已达到单次获取上限，停止
      if (fetchCount >= MAX_FETCH_PER_SESSION) {
        console.log(`Reached fetch limit (${MAX_FETCH_PER_SESSION} projects), will continue on next visit`);
        break;
      }

      // 检查是否需要更新（stars为0或没有languages数据）
      const needsUpdate = project.url && (
        project.stars === 0 ||
        !project.languages ||
        project.languages.length === 0 ||
        // 兼容旧的language字段
        (project.language && !project.languages)
      );

      if (needsUpdate) {
        console.log(`Fetching data for ${project.name}...`);
        const githubData = await fetchGithubRepoInfo(project.url);

        if (githubData) {
          projects[i].stars = githubData.stars;
          projects[i].languages = githubData.languages;
          // 删除旧的language字段
          delete projects[i].language;
          hasUpdates = true;
          fetchCount++;

          // 避免GitHub API限流，每个请求间隔2秒
          if (fetchCount < MAX_FETCH_PER_SESSION) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }
    }

    // 如果有更新，保存到后端
    if (hasUpdates) {
      console.log(`Updated ${fetchCount} projects, saving to backend...`);
      await updateGithubProjectsData(projects);
      console.log('GitHub projects data updated successfully');

      // 重新加载页面以显示更新后的数据
      setTimeout(() => {
        location.reload();
      }, 1000);
    } else {
      console.log('All projects data is up to date');
    }
  } catch (error) {
    console.error('Error in autoFetchGithubData:', error);
  }
}

// 年份折叠切换函数（全局函数，供内联 onclick 调用）
window.toggleYear = function(year) {
  console.log('toggleYear called with year:', year);
  const yearGroup = document.querySelector(`.timeline-year-group[data-year="${year}"]`);
  console.log('Found yearGroup:', yearGroup);
  if (yearGroup) {
    yearGroup.classList.toggle('collapsed');
    console.log('Toggled collapsed class, now has:', yearGroup.classList.contains('collapsed'));
  } else {
    console.error('Year group not found for year:', year);
    // 尝试列出所有年份组
    const allYearGroups = document.querySelectorAll('.timeline-year-group');
    console.log('All year groups:', allYearGroups);
    allYearGroups.forEach(group => {
      console.log('  - data-year:', group.getAttribute('data-year'));
    });
  }
};

document.addEventListener('DOMContentLoaded', function() {
  const filterButtons = document.querySelectorAll('.tag-filter');
  const projectCards = document.querySelectorAll('.project-card');
  const timelineItems = document.querySelectorAll('.timeline-item');
  const timelineYearGroups = document.querySelectorAll('.timeline-year-group');
  const toggleTagsBtn = document.getElementById('toggleTagsBtn');
  const filterTagsWrapper = document.querySelector('.filter-tags-wrapper');

  // 移动端时间线相关元素
  const mobileTimelineToggle = document.getElementById('mobileTimelineToggle');
  const mobileTimelineOverlay = document.getElementById('mobileTimelineOverlay');
  const mobileBottomTimeline = document.getElementById('mobileBottomTimeline');
  const mobileTimelineClose = document.getElementById('mobileTimelineClose');
  const mobileTimelineNav = document.getElementById('mobileTimelineNav');
  const timelineSidebar = document.querySelector('.timeline-sidebar');

  // 自动获取GitHub数据（在后台运行，不阻塞页面渲染）
  autoFetchGithubData();

  // 默认折叠所有年份
  timelineYearGroups.forEach(group => {
    group.classList.add('collapsed');
  });

  // 为桌面端时间线的年份头部绑定点击事件（作为 onclick 的备份）
  const desktopYearHeaders = timelineSidebar ? timelineSidebar.querySelectorAll('.timeline-year-header') : [];
  desktopYearHeaders.forEach(header => {
    // 移除可能存在的 onclick，改用事件监听器
    header.removeAttribute('onclick');
    header.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      const yearGroup = this.closest('.timeline-year-group');
      if (yearGroup) {
        yearGroup.classList.toggle('collapsed');
        console.log('Desktop year toggled:', yearGroup.getAttribute('data-year'), 'collapsed:', yearGroup.classList.contains('collapsed'));
      }
    });
  });

  // 设置编程语言颜色（支持多语言）
  document.querySelectorAll('.project-language').forEach(langElement => {
    const language = langElement.getAttribute('data-language');
    const dot = langElement.querySelector('.language-dot');
    if (dot && language) {
      const color = languageColors[language] || languageColors['default'];
      dot.style.backgroundColor = color;
    }
  });

  // 移动端时间线显示/隐藏
  if (mobileTimelineToggle && mobileTimelineOverlay && mobileBottomTimeline && timelineSidebar) {
    // 初始化时将桌面端时间线内容复制到移动端
    if (mobileTimelineNav && timelineSidebar) {
      const timelineContent = timelineSidebar.querySelector('.timeline');
      if (timelineContent) {
        // 克隆时间线内容
        const clonedContent = timelineContent.cloneNode(true);
        mobileTimelineNav.appendChild(clonedContent);

        // 为移动端时间线重新绑定年份折叠事件
        const mobileYearHeaders = mobileTimelineNav.querySelectorAll('.timeline-year-header');
        mobileYearHeaders.forEach(header => {
          header.addEventListener('click', function() {
            const yearGroup = this.closest('.timeline-year-group');
            if (yearGroup) {
              yearGroup.classList.toggle('collapsed');
            }
          });
        });
      }
    }

    // 显示移动端按钮（仅在移动端）
    if (window.innerWidth <= 768) {
      mobileTimelineToggle.style.display = 'flex';
      mobileTimelineToggle.parentElement.style.display = 'block';
    }

    // 打开时间线
    mobileTimelineToggle.addEventListener('click', function() {
      mobileBottomTimeline.classList.add('open');
      mobileTimelineOverlay.classList.add('show');
      document.body.style.overflow = 'hidden';
    });

    // 关闭时间线的函数
    function closeTimeline() {
      mobileBottomTimeline.classList.remove('open');
      mobileTimelineOverlay.classList.remove('show');
      document.body.style.overflow = '';
    }

    // 点击遮罩关闭
    mobileTimelineOverlay.addEventListener('click', closeTimeline);

    // 点击关闭按钮关闭
    if (mobileTimelineClose) {
      mobileTimelineClose.addEventListener('click', closeTimeline);
    }

    // 点击移动端时间线项目后滚动到对应项目并关闭
    mobileTimelineNav.addEventListener('click', function(e) {
      const timelineItem = e.target.closest('.timeline-item');
      if (timelineItem) {
        const projectIndex = timelineItem.getAttribute('data-project');
        const targetCard = projectCards[projectIndex];

        if (targetCard && !targetCard.classList.contains('hidden')) {
          // 关闭时间线
          closeTimeline();

          // 延迟滚动，让关闭动画完成
          setTimeout(() => {
            targetCard.scrollIntoView({
              behavior: 'smooth',
              block: 'center'
            });

            // 添加高亮效果
            targetCard.style.transform = 'translateY(-4px) scale(1.02)';
            targetCard.style.boxShadow = '0 16px 40px rgba(102, 126, 234, 0.3)';
            targetCard.style.borderColor = 'rgba(118, 75, 162, 0.5)';

            // 2秒后恢复
            setTimeout(() => {
              targetCard.style.transform = '';
              targetCard.style.boxShadow = '';
              targetCard.style.borderColor = '';
            }, 2000);
          }, 300);
        }
      }
    });

    // 响应窗口大小变化
    window.addEventListener('resize', function() {
      if (window.innerWidth <= 768) {
        mobileTimelineToggle.style.display = 'flex';
        mobileTimelineToggle.parentElement.style.display = 'block';
      } else {
        mobileTimelineToggle.style.display = 'none';
        // 如果时间线是打开的，关闭它
        if (mobileBottomTimeline.classList.contains('open')) {
          closeTimeline();
        }
      }
    });
  }

  // 标签展开/收起功能
  if (toggleTagsBtn) {
    toggleTagsBtn.addEventListener('click', function() {
      const isExpanded = filterTagsWrapper.classList.toggle('expanded');
      this.classList.toggle('expanded');

      const toggleText = this.querySelector('.toggle-text');
      if (isExpanded) {
        toggleText.textContent = '收起';
      } else {
        toggleText.textContent = '展开更多';
      }
    });
  }

  // 标签过滤功能
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      const selectedTag = this.getAttribute('data-tag');

      // 更新按钮活动状态
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');

      // 过滤项目卡片
      projectCards.forEach(card => {
        const cardTags = card.getAttribute('data-tags');

        if (selectedTag === 'all') {
          card.classList.remove('hidden');
        } else {
          if (cardTags && cardTags.split(',').includes(selectedTag)) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        }
      });

      // 同步过滤时间线项，并隐藏空年份组
      timelineYearGroups.forEach(yearGroup => {
        const itemsInGroup = yearGroup.querySelectorAll('.timeline-item');
        let hasVisibleItems = false;

        itemsInGroup.forEach(item => {
          const itemTags = item.getAttribute('data-tags');

          if (selectedTag === 'all') {
            item.classList.remove('hidden');
            hasVisibleItems = true;
          } else {
            if (itemTags && itemTags.split(',').includes(selectedTag)) {
              item.classList.remove('hidden');
              hasVisibleItems = true;
            } else {
              item.classList.add('hidden');
            }
          }
        });

        // 如果年份组中没有可见项目，隐藏整个年份组
        if (hasVisibleItems) {
          yearGroup.style.display = '';
        } else {
          yearGroup.style.display = 'none';
        }
      });
    });
  });

  // 时间线项点击高亮对应的项目卡片
  timelineItems.forEach((item, index) => {
    item.addEventListener('click', function() {
      const projectIndex = this.getAttribute('data-project');
      const targetCard = projectCards[projectIndex];

      if (targetCard && !targetCard.classList.contains('hidden')) {
        // 滚动到对应的项目卡片
        targetCard.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // 添加高亮效果
        targetCard.style.transform = 'translateY(-4px) scale(1.02)';
        targetCard.style.boxShadow = '0 16px 40px rgba(102, 126, 234, 0.3)';
        targetCard.style.borderColor = 'rgba(118, 75, 162, 0.5)';

        // 2秒后恢复
        setTimeout(() => {
          targetCard.style.transform = '';
          targetCard.style.boxShadow = '';
          targetCard.style.borderColor = '';
        }, 2000);
      }
    });
  });

  // 项目卡片悬停时，高亮对应的时间线项
  projectCards.forEach((card, index) => {
    card.addEventListener('mouseenter', function() {
      const timelineItem = timelineItems[index];
      if (timelineItem && !timelineItem.classList.contains('hidden')) {
        timelineItem.style.background = 'rgba(102, 126, 234, 0.12)';
        timelineItem.style.borderRadius = '8px';
      }
    });

    card.addEventListener('mouseleave', function() {
      const timelineItem = timelineItems[index];
      if (timelineItem) {
        timelineItem.style.background = '';
        timelineItem.style.borderRadius = '';
      }
    });
  });
});
