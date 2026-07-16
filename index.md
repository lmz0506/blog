---
layout: default
title: 首页
---

{% assign project_items = site.data.projects | where: "star", true %}
{% assign selected_notes = site.docs | sort: "date" | reverse %}
{% assign current_year = 'now' | date: "%Y" %}

<div class="fixed top-[-15%] left-[-15%] -z-10 w-[65%] h-[65%] rounded-full bg-emerald-400/10 dark:bg-emerald-500/5 blur-[160px] pointer-events-none animate-float-1"></div>
<div class="fixed top-[30%] right-[-15%] -z-10 w-[60%] h-[60%] rounded-full bg-teal-400/10 dark:bg-teal-500/5 blur-[180px] pointer-events-none animate-float-2"></div>
<div class="fixed bottom-[-10%] left-[20%] -z-10 w-[50%] h-[50%] rounded-full bg-emerald-300/5 dark:bg-emerald-500/3 blur-[150px] pointer-events-none"></div>

<header class="sticky top-0 z-50 w-full glass-panel border-b border-slate-100/50 dark:border-slate-900/50 transition-all duration-300">
  <div class="max-w-[1400px] xl:max-w-[1680px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
    <a href="#home" class="flex items-center gap-2.5 group">
      <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">l</div>
      <span class="text-2xl font-bold tracking-tight bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300 bg-clip-text text-transparent group-hover:opacity-90 transition-opacity">{{ site.title }}</span>
    </a>

    <div class="flex items-center gap-8">
      <nav class="hidden md:flex items-center gap-10 text-sm font-medium">
        <a href="#home" class="text-emerald-600 dark:text-emerald-400 transition-colors py-1.5 relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-emerald-500 after:rounded-full">首页</a>
        <a href="{{ '/docs.html' | relative_url }}" class="text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors py-1.5">知识库</a>
        <a href="{{ '/github.html' | relative_url }}" class="text-slate-600 dark:text-slate-300 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors py-1.5">精选开源</a>
      </nav>
      <button id="mobileMenuBtn" class="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 md:hidden flex items-center justify-center text-slate-700 dark:text-slate-300">
        <i data-lucide="menu" class="w-5 h-5"></i>
      </button>
    </div>
  </div>
</header>

<div id="mobileMenu" class="fixed inset-y-0 right-0 z-50 w-72 bg-white dark:bg-[#090d16] shadow-2xl p-6 hidden flex-col justify-between transition-transform duration-300 transform translate-x-full">
  <div class="space-y-6">
    <div class="flex items-center justify-between border-b pb-4 dark:border-slate-800">
      <span class="font-bold text-slate-900 dark:text-white">菜单导航</span>
      <button id="closeMobileMenuBtn" class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <nav class="flex flex-col gap-4 text-base font-medium">
      <a href="#home" class="text-emerald-600 dark:text-emerald-400 py-2 border-b dark:border-slate-800">首页</a>
      <a href="{{ '/github.html' | relative_url }}" class="text-slate-600 dark:text-slate-300 py-2 border-b dark:border-slate-800">精选开源</a>
      <a href="{{ '/docs.html' | relative_url }}" class="text-slate-600 dark:text-slate-300 py-2 border-b dark:border-slate-800">知识库</a>
    </nav>
  </div>
  <div class="text-xs text-slate-400 text-center border-t pt-4 dark:border-slate-800">© {{ current_year }} {{ site.title }}</div>
</div>

<main class="max-w-[1400px] xl:max-w-[1680px] mx-auto px-6 lg:px-12 py-12 space-y-16">
  <section id="home" class="relative group rounded-[32px] p-6 md:p-8 lg:p-10 glass-panel glow-green overflow-hidden transition-all duration-500 hover:shadow-emerald-500/5 hover:border-emerald-500/10">
    <div class="absolute -right-10 -top-10 w-96 h-96 rounded-full bg-emerald-400/15 dark:bg-emerald-500/10 blur-[100px] group-hover:scale-110 transition-transform duration-700 pointer-events-none"></div>
    <div class="relative grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
      <div class="lg:col-span-7 space-y-5">
        <div class="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <div class="relative flex-shrink-0 group">
            <div class="absolute -inset-1.5 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-3xl blur opacity-75 group-hover:opacity-100 transition-opacity duration-500 animate-pulse"></div>
            <div class="relative w-24 h-24 sm:w-32 sm:h-32 rounded-3xl overflow-hidden bg-slate-50 dark:bg-slate-800 flex items-center justify-center border-2 border-white dark:border-slate-700 p-2 shadow-inner">
              <img src="{{ site.data.profile.avatar | relative_url }}" alt="{{ site.data.profile.name }}" class="w-full h-full object-cover rounded-2xl">
            </div>
          </div>
          <div class="text-center sm:text-left space-y-4">
            <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white flex flex-col sm:flex-row items-center gap-3">
              {{ site.data.profile.name }}
              <span class="text-xs font-normal px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Full Stack Developer</span>
            </h1>
            <div class="space-y-2 text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">
              <p class="italic font-serif flex items-center justify-center sm:justify-start gap-1">
                <i data-lucide="quote" class="w-3.5 h-3.5 text-emerald-500/60 rotate-180"></i>{{ site.data.profile.bio }}
              </p>
              <p class="flex items-center justify-center sm:justify-start gap-1.5">
                <i data-lucide="compass" class="w-4.5 h-4.5 text-teal-500"></i>{{ site.data.profile.intro | strip }}
              </p>
            </div>
          </div>
        </div>

        <div class="h-[1px] bg-slate-200/50 dark:bg-slate-800/50"></div>

        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-3.5">
          {% if site.data.profile.social.github %}
          <a href="{{ site.data.profile.social.github }}" target="_blank" rel="noreferrer" class="home-action-btn home-action-github">
            <svg class="home-action-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.22-3.37-1.22-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.34 1.12 2.91.85.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.96c.85 0 1.7.12 2.5.34 1.9-1.33 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.95.68 1.91 0 1.38-.01 2.49-.01 2.82 0 .27.18.59.69.49A10.18 10.18 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z"/>
            </svg>
            GitHub
          </a>
          {% endif %}
          {% if site.data.profile.social.gitee %}
          <a href="{{ site.data.profile.social.gitee }}" target="_blank" rel="noreferrer" class="home-action-btn home-action-gitee"><i data-lucide="git-branch" class="w-4.5 h-4.5"></i> Gitee</a>
          {% endif %}
          {% if site.data.profile.social.email %}
          <a href="mailto:{{ site.data.profile.social.email }}" class="home-action-btn home-action-email"><i data-lucide="mail" class="w-4.5 h-4.5"></i> Email</a>
          {% endif %}
        </div>
      </div>

      <div class="lg:col-span-5 relative min-h-[220px] flex items-center">
        <div class="relative flex flex-wrap gap-3 content-center">
          {% for group in site.data.profile.skills %}
            {% for item in group.items %}
              {% assign skill_cat = "be" %}
              {% assign dot_color = "bg-green-600" %}
              {% if group.name contains "前端" %}
                {% assign skill_cat = "fe" %}
                {% assign dot_color = "bg-blue-500" %}
              {% elsif group.name contains "数据库" %}
                {% assign skill_cat = "ai" %}
                {% assign dot_color = "bg-indigo-500" %}
              {% elsif group.name contains "工具" %}
                {% assign skill_cat = "tools" %}
                {% assign dot_color = "bg-orange-500" %}
              {% endif %}
              {% if item contains "Lang" %}
                {% assign skill_cat = "ai" %}
                {% assign dot_color = "bg-teal-500 animate-pulse" %}
              {% elsif item contains "Java" %}
                {% assign dot_color = "bg-red-500" %}
              {% elsif item contains "Python" %}
                {% assign dot_color = "bg-yellow-500" %}
              {% elsif item contains "Redis" %}
                {% assign dot_color = "bg-red-600" %}
              {% endif %}
              <span data-cat="{{ skill_cat }}" class="skill-tag flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/40 dark:border-slate-700/40 text-sm font-medium hover:border-emerald-500 dark:hover:border-emerald-400 shadow-sm transition-all duration-300 hover:scale-105 select-none cursor-default">
                <span class="w-2 h-2 rounded-full {{ dot_color }}"></span> {{ item }}
              </span>
            {% endfor %}
          {% endfor %}
        </div>
      </div>
    </div>
  </section>

  <section id="knowledge" class="rounded-[32px] p-8 md:p-12 glass-panel border border-slate-200/20 dark:border-slate-800/20 glow-green space-y-8">
    <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
      <div class="space-y-1.5">
        <h2 class="text-3xl font-bold font-serif text-slate-900 dark:text-white flex flex-wrap items-center gap-3">
          <i data-lucide="book-open" class="w-6 h-6 text-emerald-500"></i>
          <span>知识库精选笔记</span>
          <span class="text-xs font-sans font-medium px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Latest 5</span>
        </h2>
        <p class="text-xs sm:text-sm text-slate-400 dark:text-slate-500">在这里，我用系统的知识图谱沉淀学习和开发过程中的点滴积累。</p>
      </div>
      <a href="{{ '/docs.html' | relative_url }}" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all">进入知识库 <i data-lucide="arrow-up-right" class="w-4.5 h-4.5 text-emerald-500"></i></a>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
      <div class="lg:col-span-4 knowledge-latest-column">
        <div class="knowledge-column-heading">
          <span><i data-lucide="clock-3" class="w-4 h-4"></i>最近更新</span>
          <small>按发布时间排序</small>
        </div>
        <div class="knowledge-latest-list" role="tablist" aria-label="最新知识库文章">
        {% for doc in selected_notes limit: 5 %}
          <button
            type="button"
            id="knowledge-note-tab-{{ forloop.index0 }}"
            class="knowledge-note-btn {% if forloop.first %}is-active{% endif %}"
            data-note-index="{{ forloop.index0 }}"
            role="tab"
            aria-selected="{% if forloop.first %}true{% else %}false{% endif %}"
            aria-controls="knowledge-note-panel-{{ forloop.index0 }}"
          >
            <span class="knowledge-note-index">{% if forloop.index < 10 %}0{% endif %}{{ forloop.index }}</span>
            <span class="knowledge-note-copy">
              <span class="knowledge-note-meta">
                <span>{{ doc.category | default: "未分类" }}</span>
                <time datetime="{{ doc.date | date_to_xmlschema }}">{{ doc.date | date: "%Y.%m.%d" }}</time>
              </span>
              <strong>{{ doc.title }}</strong>
              <small>{{ doc.excerpt | strip_html | strip_newlines | truncate: 68 }}</small>
            </span>
            <span class="knowledge-note-arrow"><i data-lucide="chevron-right" class="w-4 h-4"></i></span>
          </button>
        {% endfor %}
        </div>
      </div>

      <div class="lg:col-span-8 knowledge-preview-shell">
        {% for doc in selected_notes limit: 5 %}
        <article
          id="knowledge-note-panel-{{ forloop.index0 }}"
          class="knowledge-preview-panel {% unless forloop.first %}hidden{% endunless %}"
          data-note-panel="{{ forloop.index0 }}"
          role="tabpanel"
          aria-labelledby="knowledge-note-tab-{{ forloop.index0 }}"
          aria-hidden="{% if forloop.first %}false{% else %}true{% endif %}"
        >
          <header class="knowledge-preview-header">
            <div class="knowledge-preview-title">
              <div class="knowledge-preview-meta">
                <span><i data-lucide="folder" class="w-3.5 h-3.5"></i>{{ doc.category | default: "未分类" }}</span>
                <time datetime="{{ doc.date | date_to_xmlschema }}"><i data-lucide="calendar-days" class="w-3.5 h-3.5"></i>{{ doc.date | date: "%Y年%m月%d日" }}</time>
              </div>
              <h3>{{ doc.title }}</h3>
            </div>
            <a href="{{ doc.url | relative_url }}" class="knowledge-preview-link">
              <span>阅读全文</span>
              <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
            </a>
          </header>
          <div class="knowledge-preview-rule"></div>
          <div class="knowledge-preview-scroll kb-markdown-preview" tabindex="0" aria-label="{{ doc.title }}文章预览，可滚动阅读">
            {{ doc.content | markdownify }}
          </div>
        </article>
        {% endfor %}
      </div>
    </div>
  </section>

  <section id="projects" class="space-y-8" aria-labelledby="projects-title">
    <div class="flex items-center justify-between">
      <div class="space-y-1.5">
        <h2 id="projects-title" class="text-3xl font-bold font-serif text-slate-900 dark:text-white flex items-center gap-3">
          <span>推荐项目</span>
          <span class="text-xs font-sans font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">{{ project_items.size }} Active</span>
        </h2>
      </div>
    </div>

    <div id="projectCarousel" class="project-carousel" aria-roledescription="carousel" aria-label="推荐项目">
      <div class="project-grid" aria-live="polite">
      {% for project in project_items %}
      {% assign project_page = forloop.index0 | divided_by: 4 %}
      {% assign project_icon_mod = forloop.index0 | modulo: 4 %}
      <article class="project-card group" data-project-page="{{ project_page }}" data-project-position="{{ forloop.index }}" {% unless forloop.index <= 4 %}hidden{% endunless %}>
        <a href="{{ project.url }}" target="_blank" rel="noreferrer" class="project-repo-link" aria-label="打开 {{ project.name }} 远程仓库">
          <span>远程仓库</span>
          <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
        </a>

        <span class="project-number" aria-hidden="true">{% if forloop.index < 10 %}0{% endif %}{{ forloop.index }}</span>

        <div class="project-visual" aria-hidden="true">
          <span class="project-orbit project-orbit-main"></span>
          <span class="project-orbit-dot project-orbit-dot-left"></span>
          <span class="project-orbit-dot project-orbit-dot-right"></span>
          <span class="project-icon-tile project-icon-tile-{{ project_icon_mod }}">
            {% case project_icon_mod %}
              {% when 0 %}<i data-lucide="book-open"></i>
              {% when 1 %}<i data-lucide="panels-top-left"></i>
              {% when 2 %}<i data-lucide="images"></i>
              {% else %}<i data-lucide="blocks"></i>
            {% endcase %}
          </span>
        </div>

        <div class="project-content">
          <div class="project-heading">
            <h3>{{ project.name }}</h3>
            <span class="project-featured"><i data-lucide="star"></i> 精选</span>
          </div>
          <p class="project-description">{{ project.description }}</p>
          <div class="project-tags">
            {% for tag in project.tags %}
            {% assign tag_mod = forloop.index0 | modulo: 5 %}
            <span class="project-tag-palette project-tag-palette-{{ tag_mod }}">{{ tag }}</span>
            {% endfor %}
          </div>
        </div>
      </article>
      {% endfor %}
      </div>

      {% assign project_last_page = project_items.size | minus: 1 | divided_by: 4 %}
      <div class="project-pagination" role="group" aria-label="推荐项目分页">
        {% for page_index in (0..project_last_page) %}
        <button
          type="button"
          class="project-page-dot {% if forloop.first %}is-active{% endif %}"
          data-project-page-target="{{ page_index }}"
          aria-label="查看第 {{ forloop.index }} 页项目"
          aria-current="{% if forloop.first %}true{% else %}false{% endif %}"
        ></button>
        {% endfor %}
      </div>
    </div>
  </section>
</main>

<script>
  lucide.createIcons();

  document.querySelectorAll('.knowledge-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const index = btn.getAttribute('data-note-index');
      document.querySelectorAll('.knowledge-note-btn').forEach(item => {
        const isActive = item === btn;
        item.classList.toggle('is-active', isActive);
        item.setAttribute('aria-selected', String(isActive));
      });
      document.querySelectorAll('[data-note-panel]').forEach(panel => {
        const isActive = panel.getAttribute('data-note-panel') === index;
        panel.classList.toggle('hidden', !isActive);
        panel.setAttribute('aria-hidden', String(!isActive));
        if (isActive) {
          const preview = panel.querySelector('.knowledge-preview-scroll');
          if (preview) preview.scrollTop = 0;
        }
      });
      lucide.createIcons();
    });
  });

  const projectCarousel = document.getElementById('projectCarousel');
  if (projectCarousel) {
    const projectCards = [...projectCarousel.querySelectorAll('[data-project-page]')];
    const projectDots = [...projectCarousel.querySelectorAll('[data-project-page-target]')];
    let currentProjectPage = 0;

    function showProjectPage(page) {
      if (!projectDots.length) return;
      currentProjectPage = (page + projectDots.length) % projectDots.length;
      projectCards.forEach(card => {
        const isVisible = Number(card.dataset.projectPage) === currentProjectPage;
        card.hidden = !isVisible;
        card.setAttribute('aria-hidden', String(!isVisible));
      });
      projectDots.forEach((dot, index) => {
        const isActive = index === currentProjectPage;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-current', String(isActive));
      });
    }

    projectDots.forEach((dot, index) => {
      dot.addEventListener('click', () => showProjectPage(index));
    });
    projectCarousel.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      showProjectPage(currentProjectPage + (event.key === 'ArrowRight' ? 1 : -1));
      projectDots[currentProjectPage].focus();
    });
    showProjectPage(0);
  }

  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const closeMobileMenuBtn = document.getElementById('closeMobileMenuBtn');
  mobileMenuBtn.addEventListener('click', () => {
    mobileMenu.classList.remove('hidden');
    mobileMenu.classList.add('flex');
    setTimeout(() => mobileMenu.classList.remove('translate-x-full'), 50);
  });
  function closeMobileMenu() {
    mobileMenu.classList.add('translate-x-full');
    setTimeout(() => {
      mobileMenu.classList.add('hidden');
      mobileMenu.classList.remove('flex');
    }, 300);
  }
  closeMobileMenuBtn.addEventListener('click', closeMobileMenu);
  document.querySelectorAll('#mobileMenu nav a').forEach(link => link.addEventListener('click', closeMobileMenu));
</script>
