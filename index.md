---
layout: default
---

Text can be **bold**, _italic_, or ~~strikethrough~~.

[Link to another page](./another-page.html).
<ul>
  {% for post in site.posts %}
    <li>
      <a href="{{ post.url }}">{{ post.title }} <small>tags: <em>{{ post.tags | join: "</em> - <em>" }}</em></small></a>
    </li>
  {% endfor %}
</ul>


