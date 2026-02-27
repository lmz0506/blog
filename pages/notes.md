---
layout: page
title: 手札
permalink: /notes.html
---

<div class="notes-page" id="notes-page">
  <div class="notes-header">
    <span class="notes-current-name" id="notes-current-name">{{ site.data.notes[0].icon }} {{ site.data.notes[0].name }}</span>
    <select id="notes-mobile-select" class="notes-mobile-select">
      {% for note in site.data.notes %}
      <option value="{{ note.url }}" data-name="{{ note.icon }} {{ note.name }}" {% if forloop.first %}selected{% endif %}>
        {{ note.icon }} {{ note.name }}
      </option>
      {% endfor %}
    </select>
    <div class="notes-actions">
      <button id="notes-fullscreen-btn" class="notes-action-btn" title="最大化">
        <span class="fullscreen-icon" id="fullscreen-icon">⛶</span>
      </button>
      <a id="notes-external-link" href="{{ site.data.notes[0].url }}" target="_blank" class="notes-action-btn" title="在新窗口打开">
        ↗
      </a>
    </div>
  </div>

  <div class="notes-content" id="notes-content">
    <iframe
      id="notes-iframe"
      src="{{ site.data.notes[0].url }}"
      class="yuque-iframe"
      frameborder="0"
      allowfullscreen>
    </iframe>
  </div>
</div>

<script type="application/json" id="notes-map">
{
  {% for note in site.data.notes %}
  "{{ note.name }}": { "url": "{{ note.url }}", "icon": "{{ note.icon }}" }{% unless forloop.last %},{% endunless %}
  {% endfor %}
}
</script>

<script>
document.addEventListener('DOMContentLoaded', function() {
  var iframe = document.getElementById('notes-iframe');
  var externalLink = document.getElementById('notes-external-link');
  var fullscreenBtn = document.getElementById('notes-fullscreen-btn');
  var fullscreenIcon = document.getElementById('fullscreen-icon');
  var notesPage = document.getElementById('notes-page');
  var currentName = document.getElementById('notes-current-name');
  var mobileSelect = document.getElementById('notes-mobile-select');
  var notesMap = JSON.parse(document.getElementById('notes-map').textContent);

  function switchNote(url, name) {
    iframe.src = url;
    externalLink.href = url;
    currentName.textContent = name;
  }

  // 根据 hash 切换笔记
  function loadFromHash() {
    var name = decodeURIComponent(location.hash.replace('#', ''));
    if (name && notesMap[name]) {
      switchNote(notesMap[name].url, notesMap[name].icon + ' ' + name);
    }
  }

  // 初始加载
  loadFromHash();

  // hash 变化时切换
  window.addEventListener('hashchange', loadFromHash);

  // 移动端 select 切换
  mobileSelect.addEventListener('change', function() {
    var selected = this.options[this.selectedIndex];
    switchNote(this.value, selected.dataset.name);
  });

  // 切换最大化
  fullscreenBtn.addEventListener('click', function() {
    notesPage.classList.toggle('notes-maximized');
    if (notesPage.classList.contains('notes-maximized')) {
      fullscreenIcon.style.transform = 'rotate(45deg)';
    } else {
      fullscreenIcon.style.transform = 'rotate(0deg)';
    }
  });
});
</script>
