/* ALUPROF — мелкие визуальные элементы: чертежи сечения, паттерн, точечная карта. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  if (window.Profile3D) {
    var parts = window.Profile3D.sectionPaths();
    var add = function (target, cls, fill) {
      parts.forEach(function (p) {
        var el = document.createElementNS(NS, 'path'); el.setAttribute('d', p.d);
        var c = cls(p); if (c) el.setAttribute('class', c);
        if (fill && p.mat === 'alu') el.style.fill = fill;
        target.appendChild(el);
      });
    };
    document.querySelectorAll('svg[data-section]').forEach(function (svg) { add(svg, function (p) { return p.mat === 'red' ? 'red' : ''; }); });
    document.querySelectorAll('[data-section-qc], [data-section-viz]').forEach(function (g) {
      add(g, function (p) { return p.mat === 'red' ? 'rd fillin' : 'ln draw'; }, g.getAttribute('data-fill'));
    });
  }
  var dots = document.querySelector('.geo__dots');
  if (dots) {
    var html = '';
    for (var y = 40; y < 620; y += 18) {
      for (var x = 20; x < 880; x += 18) {
        var n = Math.sin(x * 0.012) * 60 + Math.cos(y * 0.02 + x * 0.004) * 50 + Math.sin(x * 0.03 + y * 0.01) * 18;
        var inside = y > 150 + n * 0.7 && y < 560 - n * 0.5 && x > 60 + Math.sin(y * 0.03) * 30 && x < 850 - Math.cos(y * 0.02) * 40;
        if (!inside) continue;
        var hot = Math.hypot(x - 300, y - 420) < 60 || Math.hypot(x - 700, y - 270) < 46;
        html += '<circle class="geo__dot' + (hot ? ' hot' : '') + '" cx="' + x + '" cy="' + y + '" r="' + (hot ? 2.6 : 2.1) + '"/>';
      }
    }
    dots.innerHTML = html;
  }
})();
