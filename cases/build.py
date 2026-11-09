# Сборка блоков «Кейсы» для страниц услуг iCORP.  python3 build.py <commit>
import sys, html, json
from data import PAGES

def esc(s): return html.escape(s, quote=False)

def li(items): return '<ul>' + ''.join(f'<li>{esc(i)}</li>' for i in items) + '</ul>'

def card(c, B):
    o = ['      <article class="icase__card">']
    if c.get('logo'):
        o.append(f'        <div class="icase__logo"><img src="{B}/img/{c["logo"]}" alt="{esc(c["name"])}" loading="lazy"></div>')
    o.append(f'        <div class="icase__meta"><span class="icase__ind">{esc(c["ind"])}</span><span class="icase__size">{esc(c["name"])}{(" · " + esc(c["place"])) if c.get("place") else ""}</span></div>')
    o.append(f'        <h3 class="icase__t">{esc(c["title"])}</h3>')
    o.append(f'        <p class="icase__d">{esc(c["desc"])}</p>')
    if c.get('res'):
        o.append('        <ul class="icase__res">' + ''.join(f'<li><b>{esc(v)}</b><span>{esc(t)}</span></li>' for v, t in c['res']) + '</ul>')
        if c.get('resnote'):
            o.append(f'        <p class="icase__note">{esc(c["resnote"])}</p>')
    o.append('        <button class="icase__more" type="button">Подробнее о проекте<i></i></button>')
    f = ['        <div class="icase__full" hidden>']
    for kind, val in c['full']:
        if kind == 'h': f.append(f'<h4>{esc(val)}</h4>')
        elif kind == 'p': f.append(f'<p>{esc(val)}</p>')
        elif kind == 'ul': f.append(li(val))
        elif kind == 'img': f.append(f'<img src="{B}/img/{val[0]}" alt="{esc(val[1])}" loading="lazy">')
        elif kind == 'table':
            f.append('<table>' + ''.join('<tr>' + ''.join(f'<{"th" if i == 0 else "td"}>{esc(x)}</{"th" if i == 0 else "td"}>' for x in r) + '</tr>' for i, r in enumerate(val)) + '</table>')
    f.append('</div>')
    o.append('\n          '.join(f))
    o.append('      </article>')
    return '\n'.join(o)

def page(p, B):
    cards = '\n\n'.join(card(c, B) for c in p['cases'])
    return f'''<!-- iCORP · «Кейсы» для {p["url"]} -->
<section class="icase" id="cases">
  <div class="icase__in">
    <div class="icase__head">
      <span class="icase__kicker">{esc(p.get("kicker", "Кейсы"))}</span>
      <h2 class="icase__h">{esc(p["h"])}</h2>
      <p class="icase__sub">{esc(p["sub"])}</p>
    </div>
    <div class="icase__grid">

{cards}

    </div>
  </div>
  <div class="icase__modal" aria-hidden="true">
    <div class="icase__ov"></div>
    <div class="icase__box" role="dialog" aria-modal="true">
      <button class="icase__x" type="button" aria-label="Закрыть"></button>
      <div class="icase__mc"></div>
      <a class="icase__cta" href="{p.get("cta", "#contacts")}">Обсудить похожий проект</a>
    </div>
  </div>
</section>
<link rel="stylesheet" href="{B}/icase.css">
<script src="{B}/icase.js"></script>
'''

if __name__ == '__main__':
    commit = sys.argv[1] if len(sys.argv) > 1 else None
    B = f'https://cdn.jsdelivr.net/gh/edennee-site/projects@{commit}/cases' if commit else '.'
    out = 'out' if commit else 'preview'
    import os; os.makedirs(out, exist_ok=True)
    for slug, p in PAGES.items():
        open(f'{out}/{slug}.html', 'w', encoding='utf-8').write(page(p, B))
        print(slug, len(p['cases']))
