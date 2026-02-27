---
layout: page
title: 碎碎念
permalink: /thoughts.html
---

<script src="{{ '/assets/js/thoughts.js' | relative_url }}"></script>

<div style="position: relative;">
  <div class="thoughts-plum">
    <img src="{{ '/assets/images/plum.svg' | relative_url }}" alt="梅花装饰">
  </div>

  <div class="timeline">
    {% assign sorted_thoughts = site.data.thoughts | sort: 'datetime' | reverse %}
    {% assign emojis = "🌸,🐾,🍓,🦭,☁️,🧸,🫧,🐌,🌈,🍡,🐇,🪴,🧁,💤,🌟" | split: "," %}
    {% for thought in sorted_thoughts %}
    {% assign random_index = forloop.index | modulo: emojis.size %}
    <div class="timeline-item" data-emoji="{{ emojis[random_index] }}">
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <time>{{ thought.datetime }}</time>
        <p>{{ thought.content }}</p>
        {% if thought.tags %}
        <div class="tags">
          {% for tag in thought.tags %}
          <span class="tag">{{ tag }}</span>
          {% endfor %}
        </div>
        {% endif %}
      </div>
    </div>
    {% endfor %}
  </div>
</div>
