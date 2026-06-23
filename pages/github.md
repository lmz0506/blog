---
layout: page
title: 精选开源
permalink: /github.html
---

<link rel="stylesheet" href="{{ '/assets/css/github-projects.css' | relative_url }}">
<script src="{{ '/assets/js/github-projects.js' | relative_url }}"></script>

{% assign sorted_projects = site.data.github_projects | sort: 'addtime' | reverse %}

<div class="github-curation">
  <section class="github-topbar">
    <div>
      <span class="github-kicker">Curation</span>
      <h2>项目收藏轨迹</h2>
    </div>
    <div class="github-hero-stat">
      <strong>{{ sorted_projects.size }}</strong>
      <span>个开源项目</span>
    </div>
    <div class="github-filter-row">
      <button class="github-filter active" data-tag="all" type="button">全部</button>
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
      <button class="github-filter" data-tag="{{ tag }}" type="button">{{ tag }}</button>
      {% endfor %}
    </div>
  </section>

  <div class="github-layout">
    <section class="github-stream">
      {% for project in sorted_projects %}
      {% assign project_year = project.addtime | slice: 0, 4 %}
      <article class="github-wave-card" data-tags="{{ project.tags | join: ',' }}" data-year="{{ project_year }}">
        <div class="github-year-badge">{{ project_year }}</div>
        <div class="github-wave-main">
          <div class="github-wave-head">
            <h3><a href="{{ project.url }}" target="_blank" rel="noreferrer">{{ project.name }}</a></h3>
            <span class="github-wave-date">{{ project.addtime }}</span>
          </div>
          <p>{{ project.description }}</p>
          {% if project.languages and project.languages.size > 0 %}
          <div class="github-language-row">
            {% for language in project.languages limit: 5 %}
            <span class="github-language">{{ language }}</span>
            {% endfor %}
          </div>
          {% elsif project.language and project.language != '' %}
          <div class="github-language-row">
            <span class="github-language">{{ project.language }}</span>
          </div>
          {% endif %}
          <div class="github-tag-row">
            {% for tag in project.tags %}
            {% if tag != 'github' %}
            <span class="github-tag">{{ tag }}</span>
            {% endif %}
            {% endfor %}
          </div>
        </div>
        <div class="github-wave-side">
          {% if project.stars and project.stars > 0 %}
          <div class="github-metric-badge">{{ project.stars }} ★</div>
          {% endif %}
          <span class="github-side-note">按时间与标签浏览收藏偏好</span>
        </div>
      </article>
      {% endfor %}
    </section>

    <aside class="github-rail-panel">
      <div class="github-rail-card">
        <span class="github-kicker">Timeline</span>
        <h3>年份轨迹</h3>
        <div class="github-year-rail" id="github-year-rail">
          {% assign current_year = "" %}
          {% for project in sorted_projects %}
            {% assign project_year = project.addtime | slice: 0, 4 %}
            {% if project_year != current_year %}
              {% assign count = 0 %}
              {% for project_count in sorted_projects %}
                {% assign count_year = project_count.addtime | slice: 0, 4 %}
                {% if count_year == project_year %}
                  {% assign count = count | plus: 1 %}
                {% endif %}
              {% endfor %}
              <button class="github-year-row" type="button" data-year="{{ project_year }}">
                <span class="github-year-label">{{ project_year }}</span>
                <span class="github-year-bar"><span style="width: {{ count | times: 22 }}%"></span></span>
                <span class="github-year-count">{{ count }}</span>
              </button>
              {% assign current_year = project_year %}
            {% endif %}
          {% endfor %}
        </div>
      </div>
    </aside>
  </div>
</div>
