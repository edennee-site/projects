# Сборка блоков «Кейсы» для страниц услуг iCORP.  python3 build.py <commit>
import sys, html, json
from data import PAGES
UZURL = {'asterisk': '/uz/ip-telefoniya', 'amo': '/uz/amocrm-tizimi', 'bitriks24': '/uz/bitrix24-tizimi', 'flatris': '/uz/flatris', 'sklad': '/uz/moysklad-ombor-dasturi'}

def esc(s): return html.escape(s, quote=False)

def li(items): return '<ul>' + ''.join(f'<li>{esc(i)}</li>' for i in items) + '</ul>'

def card(c, B, T):
    o = ['      <article class="icase__card">']
    if c.get('logo'):
        o.append(f'        <div class="icase__logo"><img src="{B}/img/{c["logo"]}" alt="{esc(T(c["name"]))}" loading="lazy"></div>')
    o.append(f'        <div class="icase__meta"><span class="icase__ind">{esc(T(c["ind"]))}</span><span class="icase__size">{esc(T(c["name"]))}{(" · " + esc(T(c["place"]))) if c.get("place") else ""}</span></div>')
    o.append(f'        <h3 class="icase__t">{esc(T(c["title"]))}</h3>')
    o.append(f'        <p class="icase__d">{esc(T(c["desc"]))}</p>')
    if c.get('res'):
        o.append('        <ul class="icase__res">' + ''.join(f'<li><b>{esc(T(v))}</b><span>{esc(T(t))}</span></li>' for v, t in c['res']) + '</ul>')
        if c.get('resnote'):
            o.append(f'        <p class="icase__note">{esc(T(c["resnote"]))}</p>')
    o.append(f'        <button class="icase__more" type="button">{T("Подробнее о проекте")}<i></i></button>')
    f = ['        <div class="icase__full" hidden>']
    for kind, val in c['full']:
        if kind == 'h': f.append(f'<h4>{esc(T(val))}</h4>')
        elif kind == 'p': f.append(f'<p>{esc(T(val))}</p>')
        elif kind == 'ul': f.append(li([T(x) for x in val]))
        elif kind == 'img': f.append(f'<img src="{B}/img/{val[0]}" alt="{esc(T(val[1]))}" loading="lazy">')
        elif kind == 'table':
            f.append('<table>' + ''.join('<tr>' + ''.join(f'<{"th" if i == 0 else "td"}>{esc(T(x))}</{"th" if i == 0 else "td"}>' for x in r) + '</tr>' for i, r in enumerate(val)) + '</table>')
    f.append('</div>')
    o.append('\n          '.join(f))
    o.append('      </article>')
    return '\n'.join(o)

def page(p, B, T=lambda x: x):
    cards = '\n\n'.join(card(c, B, T) for c in p['cases'])
    return f'''<!-- iCORP · «Кейсы» для {p["url"]} -->
<section class="icase" id="cases">
  <div class="icase__in">
    <div class="icase__head">
      <span class="icase__kicker">{esc(T(p.get("kicker", "Кейсы")))}</span>
      <h2 class="icase__h">{esc(T(p["h"]))}</h2>
      <p class="icase__sub">{esc(T(p["sub"]))}</p>
    </div>
    <div class="icase__grid">

{cards}

    </div>
  </div>
  <div class="icase__modal" aria-hidden="true">
    <div class="icase__ov"></div>
    <div class="icase__box" role="dialog" aria-modal="true">
      <button class="icase__x" type="button" aria-label="{T("Закрыть")}"></button>
      <div class="icase__mc"></div>
      <a class="icase__cta" href="{p.get("cta", "#contacts")}">{T("Обсудить похожий проект")}</a>
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
    sys.path.insert(0, 'i18n'); from uz_fix import UZ
    def Tuz(x):
        import re
        if not re.search('[А-Яа-яЁё]', x): return x
        if x not in UZ: raise KeyError(x)
        return UZ[x]
    for slug, p in PAGES.items():
        open(f'{out}/{slug}.html', 'w', encoding='utf-8').write(page(p, B))
        q = dict(p, url=UZURL[slug])
        open(f'{out}/uz-{slug}.html', 'w', encoding='utf-8').write(page(q, B, Tuz).replace('<section class="icase"', '<section lang="uz" class="icase"'))
        print(slug, len(p['cases']))
