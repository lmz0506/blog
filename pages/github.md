---
layout: page
title: GitHub 精选
permalink: /github.html
---

<link rel="stylesheet" href="{{ '/assets/css/github-projects.css' | relative_url }}">
<script src="{{ '/assets/js/github-projects.js' | relative_url }}"></script>

<div style="display: none;">
<!-- 移动端悬浮时间线按钮 -->
<button class="mobile-timeline-toggle" id="mobileTimelineToggle" aria-label="收录时间"><span class="timeline-icon">🐙</span></button>

<!-- 移动端时间线遮罩 -->
<div class="mobile-timeline-overlay" id="mobileTimelineOverlay"></div>

<!-- 移动端底部弹出时间线 -->
<div class="mobile-bottom-timeline" id="mobileBottomTimeline">
  <div class="mobile-bottom-timeline-header">
    <h3>📅 收录时间</h3>
    <button class="mobile-bottom-timeline-close" id="mobileTimelineClose">×</button>
  </div>
  <div class="mobile-bottom-timeline-nav" id="mobileTimelineNav">
    <!-- 时间线内容将通过 JavaScript 动态填充 -->
  </div>
</div>
</div>

<div class="github-projects-container">
  <!-- 顶部标签过滤 -->
  <div class="filter-section">
    <div class="filter-label">筛选标签：</div>
    <div class="filter-tags-wrapper">
      <button class="tag-filter active" data-tag="all">全部</button>
      {% assign all_tags = "" | split: "" %}
      {% for project in site.data.github_projects %}
        {% for tag in project.tags %}
          {% unless all_tags contains tag %}
            {% assign all_tags = all_tags | push: tag %}
          {% endunless %}
        {% endfor %}
      {% endfor %}
      {% assign sorted_tags = all_tags | sort %}
      {% for tag in sorted_tags %}
      <button class="tag-filter" data-tag="{{ tag }}">{{ tag }}</button>
      {% endfor %}
    </div>
    <button class="toggle-tags-btn" id="toggleTagsBtn">
      <span class="toggle-text">展开更多</span>
      <svg class="toggle-icon" width="12" height="12" viewBox="0 0 12 12">
        <path fill="currentColor" d="M6 9L1 4h10z"/>
      </svg>
    </button>
  </div>

  <!-- 主要内容区域：左侧项目卡片 + 右侧时间线 -->
  <div class="main-content">
    <!-- 左侧项目列表 -->
    <div class="projects-list">
      {% assign sorted_projects = site.data.github_projects | sort: 'addtime' | reverse %}
      {% for project in sorted_projects %}
      <div class="project-card" data-tags="{{ project.tags | join: ',' }}" data-time="{{ project.addtime }}">
        <div class="project-header">
          <div class="project-title-row">
            <h3 class="project-name">
              <a href="{{ project.url }}" target="_blank">{{ project.name }}</a>
            </h3>
            {% if project.stars and project.stars > 0 %}
            <div class="project-stars">
              <svg class="star-icon" viewBox="0 0 16 16" width="16" height="16">
                <path fill="currentColor" d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"></path>
              </svg>
              <span>{{ project.stars | divided_by: 1000 }}k</span>
            </div>
            {% endif %}
          </div>
        </div>

        <p class="project-description">{{ project.description }}</p>

        <div class="project-meta">
          {% if project.languages and project.languages.size > 0 %}
          <div class="project-language-section">
            <span class="meta-label">语言：</span>
            <div class="project-languages">
              {% for language in project.languages limit:5 %}
              <span class="project-language" data-language="{{ language }}">
                <span class="language-dot"></span>
                <span class="language-text">{{ language }}</span>
              </span>
              {% endfor %}
              {% if project.languages.size > 5 %}
              <span class="language-more">+{{ project.languages.size | minus: 5 }}</span>
              {% endif %}
            </div>
          </div>
          {% elsif project.language and project.language != '' %}
          <div class="project-language-section">
            <span class="meta-label">语言：</span>
            <div class="project-languages">
              <span class="project-language" data-language="{{ project.language }}">
                <span class="language-dot"></span>
                <span class="language-text">{{ project.language }}</span>
              </span>
            </div>
          </div>
          {% endif %}

          {% if project.tags %}
          <div class="project-tags-section">
            <span class="meta-label">分类：</span>
            <div class="project-tags">
              {% for tag in project.tags %}
              {% if tag != 'github' %}
              <span class="tag">{{ tag }}</span>
              {% endif %}
              {% endfor %}
            </div>
          </div>
          {% endif %}
        </div>
      </div>
      {% endfor %}
    </div>

    <!-- 右侧时间线（按年份分组） -->
    <div class="timeline-sidebar">
      <h3 class="timeline-title">收录时间</h3>
      <div class="timeline">
        {% assign sorted_projects = site.data.github_projects | sort: 'addtime' | reverse %}
        {% assign current_year = '' %}
        {% for project in sorted_projects %}
          {% assign project_year = project.addtime | slice: 0, 4 %}
          {% if project_year != current_year %}
            {% if current_year != '' %}
              </div> <!-- 关闭上一年的项目列表 -->
              </div> <!-- 关闭上一年的分组 -->
            {% endif %}
            <div class="timeline-year-group" data-year="{{ project_year }}">
              <div class="timeline-year-header" onclick="toggleYear('{{ project_year }}')">
                <div class="timeline-year">{{ project_year }}</div>
                <svg class="year-toggle-icon" width="16" height="16" viewBox="0 0 16 16">
                  <path fill="currentColor" d="M8 11L3 6h10z"/>
                </svg>
              </div>
              <div class="timeline-year-items">
            {% assign current_year = project_year %}
          {% endif %}
          <div class="timeline-item" data-tags="{{ project.tags | join: ',' }}" data-project="{{ forloop.index0 }}">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-project-name">{{ project.name }}</div>
              <div class="timeline-time">{{ project.addtime | slice: 5, 5 }}</div>
            </div>
          </div>
          {% if forloop.last %}
            </div> <!-- 关闭最后一年的项目列表 -->
            </div> <!-- 关闭最后一年的分组 -->
          {% endif %}
        {% endfor %}
      </div>
    </div>
  </div>
</div>
