---
layout: page
title: 知识库
permalink: /docs.html
---

<div class="docs-page-wrapper">
  <!-- 移动端专属布局 -->
  <div class="docs-mobile-layout">
    <!-- 第一块：最近文档 -->
    <section class="mobile-recent-docs">
      <h3 class="mobile-section-title">最近更新</h3>
      <div class="mobile-recent-grid">
        {% assign all_docs = site.docs | sort: 'date' | reverse %}
        {% assign recent_docs = all_docs | slice: 0, 3 %}
        {% for doc in recent_docs %}
        <a href="{{ doc.url }}" class="mobile-recent-card">
          <img src="{{ '/assets/images/book_text_128.png' | relative_url }}" alt="{{ doc.title }}">
          <span class="mobile-recent-title">{{ doc.title }}</span>
        </a>
        {% endfor %}
      </div>
    </section>

    <!-- 第二块：知识库分类 -->
    <section class="mobile-categories">
      <h3 class="mobile-section-title">知识库</h3>
      <div class="mobile-category-grid">
        {% assign docs_by_category = site.docs | group_by: "category" %}
        {% for category in docs_by_category %}
        <div class="mobile-category-card" data-category="{{ category.name }}">
          <img src="{{ '/assets/images/book_128.svg' | relative_url }}" alt="{{ category.name }}" class="category-icon" data-color-index="{{ forloop.index }}">
          <span class="mobile-category-name">{{ category.name }}</span>
          <span class="mobile-category-count">{{ category.items | size }}篇</span>
        </div>
        {% endfor %}
      </div>
    </section>

    <!-- 第三块：文档列表（点击分类后显示） -->
    <section class="mobile-docs-list" id="mobile-docs-section" style="display: none;">
      <div class="mobile-docs-header">
        <button class="mobile-back-btn" id="mobile-back-btn">← 返回</button>
        <h3 class="mobile-docs-title" id="mobile-current-category"></h3>
      </div>
      <ul class="mobile-doc-items" id="mobile-doc-list"></ul>
    </section>
  </div>

  <!-- 桌面端布局（保持原样） -->
  <aside class="docs-sidebar">
    <div class="docs-sidebar-sticky">
      <h3>分类</h3>
      <nav class="category-nav">
        <ul class="category-list">
          {% assign docs_by_category = site.docs | group_by: "category" %}
          {% for category in docs_by_category %}
          <li class="category-item {% if forloop.first %}active{% endif %}" data-category="{{ category.name }}">
            <span class="category-name">{{ category.name }}</span>
            <span class="category-count">{{ category.items | size }}</span>
          </li>
          {% endfor %}
        </ul>
      </nav>
    </div>
  </aside>

  <div class="docs-main">
    <div class="content-section">
      <div id="docs-list-container">
        {% assign docs_by_category = site.docs | group_by: "category" %}
        {% assign first_category = docs_by_category.first %}

        <h2 id="current-category-title">{{ first_category.name }}</h2>

        <ul class="doc-list" id="doc-list">
          {% for doc in first_category.items %}
          <li>
            <a href="{{ doc.url }}">{{ doc.title }}</a>
            <span class="doc-meta">{{ doc.date | date: "%Y-%m-%d" }}</span>
          </li>
          {% endfor %}
        </ul>
      </div>
    </div>
  </div>
</div>

<!-- 存储所有分类数据供JavaScript使用 -->
<script type="application/json" id="docs-data">
{
  {% for category in docs_by_category %}
  "{{ category.name }}": [
    {% for doc in category.items %}
    {
      "title": "{{ doc.title | escape }}",
      "url": "{{ doc.url }}",
      "date": "{{ doc.date | date: '%Y-%m-%d' }}"
    }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ]{% unless forloop.last %},{% endunless %}
  {% endfor %}
}
</script>

<script>
  // 分类切换逻辑
  document.addEventListener('DOMContentLoaded', function() {
    const docsData = JSON.parse(document.getElementById('docs-data').textContent);
    const categoryItems = document.querySelectorAll('.category-item');
    const docList = document.getElementById('doc-list');
    const categoryTitle = document.getElementById('current-category-title');

    // 移动端元素
    const mobileCategoryCards = document.querySelectorAll('.mobile-category-card');
    const mobileDocsSection = document.getElementById('mobile-docs-section');
    const mobileDocList = document.getElementById('mobile-doc-list');
    const mobileCurrentCategory = document.getElementById('mobile-current-category');
    const mobileBackBtn = document.getElementById('mobile-back-btn');
    const mobileRecentDocs = document.querySelector('.mobile-recent-docs');
    const mobileCategories = document.querySelector('.mobile-categories');

    // 桌面端：侧边栏点击事件
    categoryItems.forEach(item => {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        const categoryName = item.dataset.category;

        // 更新激活状态
        categoryItems.forEach(ci => ci.classList.remove('active'));
        item.classList.add('active');

        // 更新标题
        categoryTitle.textContent = categoryName;

        // 更新文档列表
        const docs = docsData[categoryName] || [];
        let html = '';
        docs.forEach(doc => {
          html += `
            <li>
              <a href="${doc.url}">${doc.title}</a>
              <span class="doc-meta">${doc.date}</span>
            </li>
          `;
        });

        docList.innerHTML = html || '<li style="color: #999;">暂无文档</li>';
      });
    });

    // 移动端：分类卡片点击事件
    mobileCategoryCards.forEach(card => {
      card.addEventListener('click', function() {
        const categoryName = this.dataset.category;

        // 隐藏最近文档和分类列表
        mobileRecentDocs.style.display = 'none';
        mobileCategories.style.display = 'none';

        // 显示文档列表
        mobileDocsSection.style.display = 'block';
        mobileCurrentCategory.textContent = categoryName;

        // 更新移动端文档列表（添加from参数）
        const docs = docsData[categoryName] || [];
        let html = '';
        docs.forEach(doc => {
          html += `
            <li>
              <a href="${doc.url}?from=${encodeURIComponent(categoryName)}">${doc.title}</a>
              <span class="mobile-doc-date">${doc.date}</span>
            </li>
          `;
        });

        mobileDocList.innerHTML = html || '<li style="color: #999;">暂无文档</li>';

        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // 移动端：返回按钮
    if (mobileBackBtn) {
      mobileBackBtn.addEventListener('click', function() {
        mobileDocsSection.style.display = 'none';
        mobileRecentDocs.style.display = 'block';
        mobileCategories.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }

    // 为分类图标添加随机颜色
    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#feca57'];
    document.querySelectorAll('.category-icon').forEach((icon, index) => {
      const colorIndex = icon.dataset.colorIndex % colors.length;
      icon.style.filter = `drop-shadow(0 2px 4px ${colors[colorIndex]}40)`;
      icon.parentElement.style.setProperty('--icon-color', colors[colorIndex]);
    });
  });
</script>

