(function(){
  var roots=document.querySelectorAll('.icase');
  roots.forEach(function(root){
    if(root.getAttribute('data-ok'))return; root.setAttribute('data-ok','1');
    var m=root.querySelector('.icase__modal'), mc=root.querySelector('.icase__mc');
    document.body.appendChild(m);
    function close(){m.classList.remove('is-open');m.setAttribute('aria-hidden','true');document.documentElement.style.overflow='';}
    root.querySelectorAll('.icase__more').forEach(function(b){
      b.addEventListener('click',function(){
        var c=b.closest('.icase__card');
        mc.innerHTML='';
        ['.icase__logo','.icase__meta','.icase__t','.icase__res'].forEach(function(q){var e=c.querySelector(q);if(e)mc.appendChild(e.cloneNode(true));});
        var f=c.querySelector('.icase__full'); if(f) mc.insertAdjacentHTML('beforeend',f.innerHTML);
        m.classList.add('is-open');m.setAttribute('aria-hidden','false');document.documentElement.style.overflow='hidden';
      });
    });
    m.querySelector('.icase__ov').addEventListener('click',close);
    m.querySelector('.icase__x').addEventListener('click',close);
    m.querySelector('.icase__cta').addEventListener('click',close);
    document.addEventListener('keydown',function(e){if(e.key==='Escape')close();});
  });
})();
