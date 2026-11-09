(function(){
  function bpOf(w){return w>=1200?1200:w>=960?960:w>=640?640:w>=480?480:320;}
  var roots=document.querySelectorAll('.icase');
  roots.forEach(function(root){
    if(root.getAttribute('data-ok'))return; root.setAttribute('data-ok','1');
    var m=root.querySelector('.icase__modal'), mc=root.querySelector('.icase__mc'), inn=root.querySelector('.icase__in'), box=m.querySelector('.icase__box');
    document.body.appendChild(m);
    /* автоскейл как у зеро-блоков Тильды: вёрстка в ширине брейкпоинта, масштаб под окно */
    function fit(){var w=document.documentElement.clientWidth||window.innerWidth,bp=bpOf(w),z=w/bp;
      inn.style.width=bp+'px';inn.style.maxWidth='none';inn.style.zoom=z;
      box.style.zoom=bp>=960?Math.min(z,1.5):'';}
    fit(); window.addEventListener('resize',fit);
    function close(){m.classList.remove('is-open');m.setAttribute('aria-hidden','true');document.documentElement.style.overflow='';}
    function open(c){
      mc.innerHTML='';
      ['.icase__logo','.icase__meta','.icase__t','.icase__res'].forEach(function(q){var e=c.querySelector(q);if(e)mc.appendChild(e.cloneNode(true));});
      var f=c.querySelector('.icase__full'); if(f) mc.insertAdjacentHTML('beforeend',f.innerHTML);
      m.classList.add('is-open');m.setAttribute('aria-hidden','false');document.documentElement.style.overflow='hidden';
    }
    root.querySelectorAll('.icase__card').forEach(function(c){
      c.setAttribute('tabindex','0'); c.setAttribute('role','button');
      c.addEventListener('click',function(){open(c);});
      c.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(c);}});
    });
    m.querySelector('.icase__ov').addEventListener('click',close);
    m.querySelector('.icase__x').addEventListener('click',close);
    m.querySelector('.icase__cta').addEventListener('click',close);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  });
})();
