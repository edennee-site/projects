(function(){
  var roots=document.querySelectorAll('.icase');
  roots.forEach(function(root){
    if(root.getAttribute('data-ok'))return; root.setAttribute('data-ok','1');
    var m=root.querySelector('.icase__modal'), mc=root.querySelector('.icase__mc');
    document.body.appendChild(m);
    function close(){m.classList.remove('is-open');m.setAttribute('aria-hidden','true');document.documentElement.style.overflow='';}
    function open(c){
      mc.innerHTML='';
      ['.icase__logo','.icase__meta','.icase__t','.icase__res','.icase__note'].forEach(function(q){var e=c.querySelector(q);if(e)mc.appendChild(e.cloneNode(true));});
      var f=c.querySelector('.icase__full'); if(f) mc.insertAdjacentHTML('beforeend',f.innerHTML);
      m.classList.add('is-open');m.setAttribute('aria-hidden','false');document.documentElement.style.overflow='hidden';
    }
    root.querySelectorAll('.icase__card').forEach(function(c){
      c.setAttribute('tabindex','0'); c.setAttribute('role','button');
      c.addEventListener('click',function(){open(c);});
      c.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();open(c);}});
    });
    var ab=root.querySelector('.icase__all'); if(ab) ab.addEventListener('click',function(){root.classList.add('is-all');});
    m.querySelector('.icase__ov').addEventListener('click',close);
    m.querySelector('.icase__x').addEventListener('click',close);
    m.querySelector('.icase__cta').addEventListener('click',close);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  });
})();
