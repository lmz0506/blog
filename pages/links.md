---
layout: page
title: 友情链接
permalink: /links.html
---

<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 30px;">
  <h2 style="margin: 0;">友情链接</h2>
  <div class="help-icon" style="position: relative; display: inline-block; cursor: help;">
    <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: #667eea; color: white; border-radius: 50%; font-size: 14px; font-weight: bold;">?</span>
    <div class="help-tooltip" style="display: none; position: absolute; left: 30px; top: -10px; background: white; border: 1px solid #e1e4e8; border-radius: 8px; padding: 15px; width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000;">
      <h4 style="margin: 0 0 10px 0; color: #667eea;">如何添加友链</h4>
      <p style="margin: 0 0 10px 0; font-size: 14px;">如果你想交换友链，请提交 <a href="https://github.com/en-o/blog/issues" target="_blank" style="color: #667eea; text-decoration: none;">Issue</a> 或 <a href="https://github.com/en-o/blog/pulls" target="_blank" style="color: #667eea; text-decoration: none;">PR</a>，格式如下：</p>
      <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
        <li>名称：你的名字</li>
        <li>链接：你的网站</li>
        <li>描述：一句话介绍</li>
        <li>头像：头像链接</li>
      </ul>
    </div>
  </div>
</div>

<script>
(function() {
  var helpIcon = document.querySelector('.help-icon');
  var isActive = false;

  helpIcon.addEventListener('click', function(e) {
    e.stopPropagation();
    isActive = !isActive;
    if (isActive) {
      this.classList.add('active');
    } else {
      this.classList.remove('active');
    }
  });

  // 点击页面其他地方关闭提示框
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.help-icon') && isActive) {
      helpIcon.classList.remove('active');
      isActive = false;
    }
  });
})();
</script>

<div class="friends-links">
  {% for link in site.data.links %}
  <div class="link-card">
    <img src="{{ link.avatar }}" alt="{{ link.name }}">
    <div class="link-info">
      <h3><a href="{{ link.url }}" target="_blank">{{ link.name }}</a></h3>
      <p>{{ link.description }}</p>
    </div>
  </div>
  {% endfor %}
</div>
