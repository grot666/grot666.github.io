---
layout: default
---

<h2>Projects</h2>

<ul>
  <li><a href="/ashen-crown/">ASHEN CROWN · 灰烬王冠</a> <small>原创暗黑奇幻 Hex 战棋 · 兽人 vs 精灵 · 战术 AI / 本地双人</small></li>
  <li><a href="/chess-tactics-trainer/">Chess Tactics Trainer · 国际象棋战术训练</a> <small>国际象棋战术训练 Web 应用</small></li>
  <li><a href="/middle-earth-atlas/">Middle-earth Interactive Atlas</a> <small>Interactive Middle-earth atlas with geography, history and politics across the Ages</small></li>
  <li><a href="/next-shore/">Next Shore · 彼岸</a> <small>A calm self-assessment for early-career professionals curious about working abroad</small></li>
  <li><a href="/pose-lab-spike/">POSE LAB</a> <small>In-browser realtime pose detection with MediaPipe (Vite + TS + three.js)</small></li>
  <li><a href="/waypoint/">Waypoint · 途径</a> <small>Bilingual immigration pathways atlas · 移民路径地图册</small></li>
  <li><a href="/zuofansong/">做饭松 · 粗粮减脂厨房</a> <small>Fat-loss meal-planning web app · 粗粮减脂餐计划</small></li>
</ul>

<h2>Posts</h2>


<ul>
  {% for post in site.posts %}
    <li>
      <strong>{{ forloop.index }}.</strong>
      <a href="{{ post.url }}">{{ post.title }}</a>
      <small>tags: <em>{{ post.tags | join: "</em> - <em>" }}</em></small>
      <small>date: <em>{{ post.date | date: "%-d %B %Y" }}</em></small>
    </li>
  {% endfor %}
</ul>

