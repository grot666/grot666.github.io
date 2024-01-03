---
layout: default
---


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


