---
layout: page
title: 知识库
permalink: /docs.html
---

{% assign docs_by_category = site.docs | group_by: "category" %}
{% assign recent_docs = site.docs | sort: "date" | reverse %}
{% assign first_category = docs_by_category.first %}

<div class="docs-redesign">
  <section class="docs-hero-panel">
    <div>
      <span class="docs-kicker">Knowledge Flow</span>
      <h1>知识库</h1>
    </div>
    <div class="docs-hero-stat">
      <strong>{{ site.docs.size }}</strong>
      <span>篇文章</span>
    </div>
  </section>

  <div class="docs-flow-layout">
    <aside class="docs-sidebar-panel">
      <div class="docs-sidebar-sticky">
        <span class="docs-kicker">Categories</span>
        <h2>分类导航</h2>
        <div class="docs-category-list" id="docs-category-list">
          {% for category in docs_by_category %}
          {% assign category_docs = category.items | sort: "date" | reverse %}
          {% assign category_latest_doc = category_docs.first %}
          <button
            class="docs-category-button {% if forloop.first %}active{% endif %}"
            type="button"
            data-category="{{ category.name }}"
            data-latest="{{ category_latest_doc.date | date: '%Y-%m-%d' }}"
            data-count="{{ category.items | size }}">
            <strong>{{ category.name | default: "未分类" }}</strong>
            <span>{{ category.items | size }} 篇</span>
          </button>
          {% endfor %}
        </div>
        <nav class="docs-category-pagination" id="docs-category-pagination" aria-label="分类分页"></nav>
      </div>
    </aside>

    <section class="docs-main-panel">
      <div class="docs-stage-card">
        <div class="docs-stage-head">
          <div>
            <span class="docs-kicker">Directory</span>
            <h2 id="docs-current-title">{{ first_category.name | default: "未分类" }}</h2>
          </div>
          <span class="docs-count" id="docs-current-count">{{ first_category.items | size }} 篇内容</span>
        </div>
        <div class="docs-river" id="docs-river">
          {% assign first_docs = first_category.items | sort: "date" | reverse %}
          {% for doc in first_docs %}
          <article class="docs-river-item">
            <div class="docs-river-index">{% if forloop.index < 10 %}0{% endif %}{{ forloop.index }}</div>
            <div class="docs-river-main">
              <h3><a href="{{ doc.url | relative_url }}">{{ doc.title }}</a></h3>
              <div class="docs-river-meta">
                <span>{{ doc.date | date: "%Y-%m-%d" }}</span>
                {% if doc.tags and doc.tags.size > 0 %}
                <span>{{ doc.tags | join: " / " }}</span>
                {% endif %}
              </div>
            </div>
            <a class="docs-open-link" href="{{ doc.url | relative_url }}" aria-label="阅读 {{ doc.title }}">
              <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
            </a>
          </article>
          {% endfor %}
        </div>
      </div>
    </section>

    <aside class="docs-recent-panel">
      <div class="docs-recent-card">
        <span class="docs-kicker">Latest</span>
        <h3>最近更新</h3>
        <ul class="docs-recent-list">
          {% for doc in recent_docs limit: 8 %}
          <li>
            <a href="{{ doc.url | relative_url }}">{{ doc.title }}</a>
            <span>{{ doc.date | date: "%Y-%m-%d" }}</span>
          </li>
          {% endfor %}
        </ul>
      </div>
    </aside>
  </div>
</div>

<script type="application/json" id="docs-data">
{
  {% for category in docs_by_category %}
  "{{ category.name }}": [
    {% assign category_docs = category.items | sort: "date" | reverse %}
    {% for doc in category_docs %}
    {
      "title": {{ doc.title | jsonify }},
      "url": {{ doc.url | relative_url | jsonify }},
      "date": {{ doc.date | date: "%Y-%m-%d" | jsonify }},
      "category": {{ doc.category | jsonify }},
      "tags": {{ doc.tags | jsonify }}
    }{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ]{% unless forloop.last %},{% endunless %}
  {% endfor %}
}
</script>

<script>
document.addEventListener('DOMContentLoaded', function() {
  var docsDataNode = document.getElementById('docs-data');
  var docsData = docsDataNode ? JSON.parse(docsDataNode.textContent) : {};
  var categoryList = document.getElementById('docs-category-list');
  var categoryPagination = document.getElementById('docs-category-pagination');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.docs-category-button'));
  var river = document.getElementById('docs-river');
  var title = document.getElementById('docs-current-title');
  var count = document.getElementById('docs-current-count');
  var categoriesPerPage = 8;
  var currentCategoryPage = 0;

  buttons.sort(function(a, b) {
    var latestDifference = (b.dataset.latest || '').localeCompare(a.dataset.latest || '');
    if (latestDifference !== 0) return latestDifference;
    var countDifference = Number(b.dataset.count || 0) - Number(a.dataset.count || 0);
    if (countDifference !== 0) return countDifference;
    return a.dataset.category.localeCompare(b.dataset.category, 'zh-CN');
  });
  buttons.forEach(function(button) {
    categoryList.appendChild(button);
  });

  function renderCategoryPagination() {
    var pageCount = Math.ceil(buttons.length / categoriesPerPage);
    categoryPagination.innerHTML = '';
    if (pageCount <= 1) {
      categoryPagination.hidden = true;
      return;
    }
    categoryPagination.hidden = false;

    var previous = document.createElement('button');
    previous.type = 'button';
    previous.className = 'docs-category-page docs-category-page-arrow';
    previous.setAttribute('aria-label', '上一页分类');
    previous.textContent = '‹';
    previous.disabled = currentCategoryPage === 0;
    previous.addEventListener('click', function() {
      renderCategoryPage(currentCategoryPage - 1);
    });
    categoryPagination.appendChild(previous);

    for (var pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
      (function(index) {
        var pageButton = document.createElement('button');
        pageButton.type = 'button';
        pageButton.className = 'docs-category-page' + (index === currentCategoryPage ? ' active' : '');
        pageButton.textContent = String(index + 1);
        pageButton.setAttribute('aria-label', '查看第 ' + (index + 1) + ' 页分类');
        if (index === currentCategoryPage) pageButton.setAttribute('aria-current', 'page');
        pageButton.addEventListener('click', function() {
          renderCategoryPage(index);
        });
        categoryPagination.appendChild(pageButton);
      })(pageIndex);
    }

    var next = document.createElement('button');
    next.type = 'button';
    next.className = 'docs-category-page docs-category-page-arrow';
    next.setAttribute('aria-label', '下一页分类');
    next.textContent = '›';
    next.disabled = currentCategoryPage === pageCount - 1;
    next.addEventListener('click', function() {
      renderCategoryPage(currentCategoryPage + 1);
    });
    categoryPagination.appendChild(next);
  }

  function renderCategoryPage(page) {
    var pageCount = Math.max(1, Math.ceil(buttons.length / categoriesPerPage));
    currentCategoryPage = Math.max(0, Math.min(page, pageCount - 1));
    var start = currentCategoryPage * categoriesPerPage;
    var end = start + categoriesPerPage;
    buttons.forEach(function(button, index) {
      button.hidden = index < start || index >= end;
    });
    renderCategoryPagination();
  }

  function renderCategory(categoryName) {
    var docs = docsData[categoryName] || [];
    title.textContent = categoryName || '未分类';
    count.textContent = docs.length + ' 篇内容';
    river.innerHTML = docs.map(function(doc, index) {
      var tags = Array.isArray(doc.tags) && doc.tags.length ? '<span>' + doc.tags.join(' / ') + '</span>' : '';
      var number = index + 1 < 10 ? '0' + (index + 1) : String(index + 1);
      return [
        '<article class="docs-river-item">',
        '  <div class="docs-river-index">' + number + '</div>',
        '  <div class="docs-river-main">',
        '    <h3><a href="' + doc.url + '">' + doc.title + '</a></h3>',
        '    <div class="docs-river-meta"><span>' + doc.date + '</span>' + tags + '</div>',
        '  </div>',
        '  <a class="docs-open-link" href="' + doc.url + '" aria-label="阅读 ' + doc.title + '"><i data-lucide="arrow-up-right" class="w-4 h-4"></i></a>',
        '</article>'
      ].join('');
    }).join('');
    buttons.forEach(function(button) {
      button.classList.toggle('active', button.dataset.category === categoryName);
    });
    if (window.lucide) lucide.createIcons();
  }

  buttons.forEach(function(button) {
    button.addEventListener('click', function() {
      renderCategory(button.dataset.category);
    });
  });

  if (buttons.length) {
    buttons.forEach(function(button) { button.classList.remove('active'); });
    renderCategory(buttons[0].dataset.category);
  }
  renderCategoryPage(0);
});
</script>
