// GitHub 贡献图加载
(function() {
  // 从 GitHub URL 提取用户名
  const githubUrl = document.querySelector('.profile-social a[href*="github.com"]');
  if (!githubUrl) {
    console.log('未找到 GitHub 链接');
    return;
  }

  const username = githubUrl.href.split('github.com/')[1]?.replace('/', '');
  if (!username) {
    console.log('无法解析 GitHub 用户名');
    return;
  }

  const chartContainer = document.getElementById('github-chart');
  if (!chartContainer) return;

  // 使用 githubchart API 的 SVG 格式
  const apiUrl = `https://ghchart.rshah.org/${username}`;

  // 创建 img 元素加载 SVG
  const img = document.createElement('img');
  img.src = apiUrl;
  img.alt = 'GitHub 贡献图';
  img.style.width = '100%';
  img.style.height = 'auto';

  img.onload = function() {
    chartContainer.innerHTML = '';
    chartContainer.appendChild(img);
  };

  img.onerror = function() {
    chartContainer.innerHTML = '<div class="error-text">加载失败</div>';
  };
})();
