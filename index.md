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
          <button id="viewResumeBtn" class="home-action-btn home-action-resume">
            <i data-lucide="file-text" class="w-4.5 h-4.5"></i> 查看简历
          </button>
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

  <section id="projects" class="space-y-8">
    <div class="flex items-center justify-between">
      <div class="space-y-1.5">
        <h2 class="text-3xl font-bold font-serif text-slate-900 dark:text-white flex items-center gap-3">
          <span>推荐项目</span>
          <span class="text-xs font-sans font-medium px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400">{{ project_items.size }} Active</span>
        </h2>
      </div>
    </div>

    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {% for project in project_items %}
      <div class="project-card group relative rounded-2xl border border-slate-100/50 dark:border-slate-900/30 bg-white/65 dark:bg-[#0c111d]/50 p-6 md:p-8 transition-all duration-500 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-500/20 flex flex-col justify-between">
        <a href="{{ project.url }}" target="_blank" rel="noreferrer" class="project-repo-link" aria-label="打开 {{ project.name }} 远程仓库">
          <span>远程仓库</span>
          <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
        </a>
        <div class="space-y-5">
          <div class="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div class="flex items-start gap-4 sm:gap-6">
              <span class="font-serif text-4xl text-emerald-500/20 dark:text-emerald-400/15 group-hover:text-emerald-500/40 transition-colors select-none font-bold">{% if forloop.index < 10 %}0{% endif %}{{ forloop.index }}</span>
              <div class="space-y-2">
                <div class="flex flex-wrap items-center gap-2.5">
                  <h3 class="text-xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors">{{ project.name }}</h3>
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10"><i data-lucide="star" class="w-3 h-3 fill-emerald-500"></i> 精选</span>
                </div>
                <p class="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{{ project.description }}</p>
              </div>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100/60 dark:border-slate-900/30">
          <div class="flex flex-wrap gap-1.5">
            {% for tag in project.tags %}
            {% assign tag_mod = forloop.index0 | modulo: 5 %}
            <span class="project-tag-palette project-tag-palette-{{ tag_mod }}">{{ tag }}</span>
            {% endfor %}
          </div>
        </div>
      </div>
      {% endfor %}
    </div>
  </section>
</main>

<div id="resumeModal" class="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4 hidden">
  <div class="w-full max-w-2xl bg-white dark:bg-[#0f172a] rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col max-h-[90vh]">
    <div class="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
      <div class="flex items-center gap-3">
        <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><i data-lucide="file-text" class="w-5 h-5"></i></div>
        <div>
          <h3 class="font-bold text-slate-900 dark:text-white text-lg">{{ site.data.profile.name }}的简历档案</h3>
          <p class="text-xs text-slate-400">Full-Stack / AI Developer / Architect</p>
        </div>
      </div>
      <button id="closeResumeBtn" class="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-all"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>
    <div class="p-6 overflow-y-auto space-y-6 text-sm">
      <div class="grid grid-cols-2 gap-4">
        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
          <span class="text-xs text-slate-400 block mb-1">专业经历</span>
          <span class="font-bold text-slate-800 dark:text-white"><span id="workYears"></span>+ 年全栈开发经验</span>
        </div>
        <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80">
          <span class="text-xs text-slate-400 block mb-1">偏好领域</span>
          <span class="font-bold text-slate-800 dark:text-white">AI Agent、微服务架构</span>
        </div>
      </div>
      <div class="space-y-4">
        <h4 class="font-bold text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400">实践成长历程</h4>
        <div class="relative border-l border-emerald-500/30 ml-2.5 pl-5 space-y-6">
          {% for work in site.data.resume.work_experience limit: 2 %}
          <div class="relative">
            <span class="absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full {% if forloop.first %}bg-emerald-500 ring-4 ring-emerald-500/20{% else %}bg-slate-300 dark:bg-slate-600{% endif %}"></span>
            <span class="text-xs font-semibold {% if forloop.first %}text-emerald-600 dark:text-emerald-400{% else %}text-slate-400{% endif %}">{{ work.period }}</span>
            <h5 class="font-bold text-slate-800 dark:text-white text-sm mt-0.5">{{ work.position }}</h5>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{{ work.description }}</p>
          </div>
          {% endfor %}
        </div>
      </div>
    </div>
    <div class="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 flex justify-end gap-2">
      <button onclick="copyEmailToClipboard()" class="px-4 py-2 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1.5"><i data-lucide="copy" class="w-4 h-4"></i> 复制联系邮箱</button>
      <button id="closeResumeBtnSecondary" class="px-5 py-2 text-xs font-bold rounded-xl bg-slate-950 text-white dark:bg-slate-800 dark:text-slate-100 hover:opacity-90 transition-all">我知道了</button>
    </div>
  </div>
</div>

<div id="toastMessage" class="fixed bottom-6 right-6 z-[110] px-4 py-3 rounded-2xl bg-slate-900 text-white dark:bg-emerald-600 dark:text-white shadow-xl shadow-slate-950/10 border border-white/10 hidden items-center gap-2.5 transition-all text-sm transform translate-y-2 opacity-0">
  <i data-lucide="info" class="w-4 h-4 text-emerald-400 dark:text-white"></i>
  <span id="toastText">通知内容</span>
</div>

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

  const resumeModal = document.getElementById('resumeModal');
  const viewResumeBtn = document.getElementById('viewResumeBtn');
  const closeResumeBtn = document.getElementById('closeResumeBtn');
  const closeResumeBtnSecondary = document.getElementById('closeResumeBtnSecondary');
  const workYears = new Date().getFullYear() - {{ site.data.resume.start_year | default: 2018 }};
  document.getElementById('workYears').textContent = workYears;

  function openModal() {
    resumeModal.classList.remove('hidden');
    resumeModal.style.animation = 'fadeIn 0.3s ease forwards';
  }
  function closeModal() {
    resumeModal.classList.add('hidden');
  }
  viewResumeBtn.addEventListener('click', openModal);
  closeResumeBtn.addEventListener('click', closeModal);
  closeResumeBtnSecondary.addEventListener('click', closeModal);
  resumeModal.addEventListener('click', e => { if (e.target === resumeModal) closeModal(); });

  function copyEmailToClipboard() {
    const text = {{ site.data.profile.social.email | jsonify }};
    const input = document.createElement('input');
    input.setAttribute('value', text);
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    showToast('联系邮箱已复制到剪贴板，欢迎来信！');
  }

  function showToast(message) {
    const toast = document.getElementById('toastMessage');
    const toastText = document.getElementById('toastText');
    toastText.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('flex');
    setTimeout(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    }, 50);
    setTimeout(() => {
      toast.style.transform = 'translateY(8px)';
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.classList.add('hidden');
        toast.classList.remove('flex');
      }, 300);
    }, 3000);
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
