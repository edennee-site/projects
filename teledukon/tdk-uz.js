
(function(){
  var W=document.querySelectorAll('.tdk'); if(!W.length) return;
  Array.prototype.forEach.call(W,function(w){w.classList.add('tdk-js');});
  var root=document;
  Array.prototype.forEach.call(root.querySelectorAll('[data-same]'),function(im){var s=root.querySelector('[data-img="'+im.getAttribute('data-same')+'"]');if(s)im.src=s.src;});
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO='IntersectionObserver' in window;
  function $(s,c){return (c||root).querySelector(s);}
  function $$(s,c){return Array.prototype.slice.call((c||root).querySelectorAll(s));}
  function pill(box,sel){var p=$(sel,box),b=$('button.is-on',box);if(p&&b){p.style.left=b.offsetLeft+'px';p.style.width=b.offsetWidth+'px';}}
  function onFonts(fn){fn();window.addEventListener('resize',fn);if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fn);}
  function watch(el,cb,th){if(!hasIO){cb(true);return;}new IntersectionObserver(function(es){es.forEach(function(e){cb(e.isIntersecting);});},{threshold:th||0}).observe(el);}

  /* появление */
  var rs=$$('[data-r],[data-tree],[data-grow]');
  if(hasIO&&!reduce){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target);}});},{rootMargin:'0px 0px -6% 0px'});
    rs.forEach(function(el){io.observe(el);});
  } else rs.forEach(function(el){el.classList.add('is-in');});

  /* якоря */
  $$('[data-scroll]').forEach(function(a){a.addEventListener('click',function(e){
    var t=$(a.getAttribute('href')); if(!t) return; e.preventDefault();
    window.scrollTo({top:t.getBoundingClientRect().top+window.pageYOffset-80,behavior:'smooth'});
  });});

  /* КАК ЭТО РАБОТАЕТ */
  var how=$('[data-how]');
  if(how){
    var fl=$('.tdk-fl',how),pk=$('.tdk-pk',how),cards=$$('[data-go]',how),cart=$('[data-cart]',how),cartBox=$('.tdk-fl__cart',how),
        prog=$('[data-prog]',how),pb=$('b',prog),hub=$('.tdk-hub',how),ring=$('.tdk-hub__ring',how),pills=$$('.tdk-pill',how),
        paths=$$('.tdk-fl__mid .tdk-ln',how),arrow=$('.tdk-fl__arr .tdk-ln',how),screen=$('.tdk-fl__ph .tdk-phone__s',how),
        rows=$('.tdk-rows',how);
    var D=[600,2700,3300,4800],cur=-1,timer=null,sub=[],vis=false,parts=[],raf=0;
    function clr(){clearTimeout(timer);sub.forEach(clearTimeout);sub=[];parts.forEach(function(p){p.kill();});parts=[];comets=[];}
    function later(fn,ms){sub.push(setTimeout(fn,ms));}
    function base(){return fl.getBoundingClientRect();}
    function rel(x,y){var b=base();return {x:x-b.left,y:y-b.top};}
    function center(el){var r=el.getBoundingClientRect();return rel(r.left+r.width/2,r.top+r.height/2);}
    function visible(el){return el&&el.getClientRects().length&&el.getBoundingClientRect().width>0;}
    function onPath(path,t){
      var L=path.getTotalLength(),pt=path.getPointAtLength(L*t),m=path.getScreenCTM();
      if(!m) return null; var p=new DOMPoint(pt.x,pt.y).matrixTransform(m); return rel(p.x,p.y);
    }
    function ease(t){return -(Math.cos(Math.PI*t)-1)/2;}
    function sm(a,b,x){x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x);}
    var pcv=document.createElement('canvas'),pcx=pcv.getContext('2d'),dpr=1;pk.appendChild(pcv);
    function fit(){var b=base();dpr=Math.min(2,window.devicePixelRatio||1);pcv.width=Math.round(b.width*dpr);pcv.height=Math.round(b.height*dpr);pcv.style.width=b.width+'px';pcv.style.height=b.height+'px';}
    var comets=[];
    function drawComets(now){
      pcx.setTransform(dpr,0,0,dpr,0,0);pcx.clearRect(0,0,pcv.width/dpr,pcv.height/dpr);
      comets=comets.filter(function(c){
        var k=(now-c.t0)/c.dur; if(k<0) return true;
        var L=c.len,sv=ease(Math.min(1,k))*(1+L),head=Math.min(1,sv),tail=Math.max(0,Math.min(1,sv-L));
        if(c.marks)c.marks.forEach(function(m,j){if(!c.f[j]&&head>=m[0]){c.f[j]=1;m[1]();}});
        if(!c.done&&head>=1){c.done=1;if(c.onEnd)c.onEnd();}
        if(k>=1) return false;
        var env=sm(0,.16,k);
        var N=28,pts=[];for(var i=0;i<=N;i++){var p=c.pos(tail+(head-tail)*i/N);if(p)pts.push(p);}
        if(pts.length<2) return true;
        pcx.lineCap='round';
        for(var i=1;i<pts.length;i++){var a=i/(pts.length-1);pcx.strokeStyle='rgba(14,208,162,'+(a*a*.85*env)+')';pcx.lineWidth=.5+a*2.3;pcx.beginPath();pcx.moveTo(pts[i-1].x,pts[i-1].y);pcx.lineTo(pts[i].x,pts[i].y);pcx.stroke();}
        var hp=pts[pts.length-1],fade=env*(1-sm(1,1+L*.7,sv));
        if(fade>0.01){var g=pcx.createRadialGradient(hp.x,hp.y,0,hp.x,hp.y,10);g.addColorStop(0,'rgba(255,255,255,'+fade+')');g.addColorStop(.3,'rgba(14,208,162,'+fade+')');g.addColorStop(1,'rgba(14,208,162,0)');pcx.fillStyle=g;pcx.beginPath();pcx.arc(hp.x,hp.y,10,0,7);pcx.fill();}
        return true;
      });
      return comets.length>0;
    }
    function tick(){
      var now=performance.now();
      parts=parts.filter(function(p){return p.step(now);});
      var any=drawComets(now);
      raf=(parts.length||any)?requestAnimationFrame(tick):0;
    }
    function kick(){if(!raf)raf=requestAnimationFrame(tick);}
    function add(p){parts.push(p);kick();}
    function el(cls,html){var d=document.createElement('div');d.className=cls;if(html)d.innerHTML=html;pk.appendChild(d);return d;}
    function put(d,p,s,o){d.style.transform='translate('+p.x+'px,'+p.y+'px)'+(s!=null?' scale('+s+')':'');if(o!=null)d.style.opacity=o;}
    function comet(pos,dur,opt){opt=opt||{};comets.push({pos:pos,dur:dur,t0:performance.now()+(opt.delay||0),len:opt.len||.32,onEnd:opt.onEnd,marks:opt.marks,f:{}});kick();}
    var pv=0,ptg=0,praf=0;
    function paint(){var v=Math.round(pv);prog.style.setProperty('--p',v+'%');pb.textContent=v+'%';ring.style.setProperty('--p',pv.toFixed(1));}
    function setProg(p,instant){ptg=p;if(instant){cancelAnimationFrame(praf);praf=0;pv=p;paint();return;}if(!praf)praf=requestAnimationFrame(function st(){pv+=(ptg-pv)*.1;if(Math.abs(ptg-pv)<.3)pv=ptg;paint();praf=pv!==ptg?requestAnimationFrame(st):0;});}
    /* товар летит в корзину */
    function flyItem(from,to,delay,onEnd){
      var d=el('tdk-pk__i','+1'),t0=performance.now()+delay,dur=640,alive=true,tapped=false;d.style.opacity=0;
      var c={x:(from.x+to.x)/2,y:Math.min(from.y,to.y)-60};
      return {kill:function(){alive=false;d.remove();},
        step:function(now){
          if(!alive) return false; var k=(now-t0)/dur; if(k<0) return true;
          if(!tapped){tapped=true;var tp=el('tdk-pk__tap');put(tp,from);setTimeout(function(){tp.remove();},600);}
          if(k>=1){onEnd();this.kill();return false;}
          var t=ease(k),u=1-t,p={x:u*u*from.x+2*u*t*c.x+t*t*to.x,y:u*u*from.y+2*u*t*c.y+t*t*to.y};
          put(d,p,1-.4*t,sm(0,.15,k)*(1-sm(.8,1,k)));return true;
        }};
    }
    function bump(){hub.classList.remove('is-bump');void hub.offsetWidth;hub.classList.add('is-bump');later(function(){hub.classList.remove('is-bump');},350);}
    function hitCart(n){cart.textContent=n;cart.classList.remove('is-pop');void cart.offsetWidth;cart.classList.add('is-pop');cartBox.classList.add('is-hit');later(function(){cartBox.classList.remove('is-hit');},250);}
    var fx=!reduce;
    function go(s,auto){
      clr(); fit(); cur=s; fl.setAttribute('data-s',s); fl.classList.remove('t1','t3','arrived'); ring.style.setProperty('--o',s===3?0:1);
      pills.forEach(function(p){p.classList.remove('is-lit');});
      cards.forEach(function(c){var k=+c.getAttribute('data-go');c.classList.toggle('is-on',k===s);c.style.setProperty('--dur',(D[k]||3000)+'ms');var b=$('i',c);b.style.animation='none';void b.offsetWidth;b.style.animation='';});
      if(s===0){cart.textContent='0';setProg(0,true);}
      if(s===1){
        cart.textContent='0';setProg(0,true);
        var sr=screen.getBoundingClientRect(),to=center(cartBox),Y=[.36,.47,.57,.68,.78];
        Y.forEach(function(y,n){
          var from=rel(sr.left+sr.width*.82,sr.top+sr.height*y);
          if(fx) add(flyItem(from,to,150+n*300,function(){hitCart(n+1);}));
          else later(function(){hitCart(n+1);},150+n*300);
        });
        later(function(){fl.classList.add('t1');},150+5*300+500);
      }
      if(s===2){
        cart.textContent='5';setProg(0,true);
        var useP=fx&&paths.length&&visible(paths[0]),landed=0,TOTAL=6;
        var land=function(){landed++;bump();setProg(Math.round(landed/TOTAL*100));};
        [0,1].forEach(function(w){
          paths.forEach(function(path,i){
            var dl=w*1150+i*200,pill=pills[i];
            if(useP){
              comet(function(t){return onPath(path,t);},1300,{delay:dl,onEnd:land,marks:[[.5,function(){pill.classList.add('is-lit');}]]});
            } else {
              later(function(){pill.classList.add('is-lit');},dl+400);
              later(land,dl+900);
            }
          });
        });
      }
      if(s===3){
        cart.textContent='5';setProg(100,true);
        pills.forEach(function(p){p.classList.add('is-lit');});
        var arrive=function(){fl.classList.add('arrived');later(function(){fl.classList.add('t3');},700);};
        if(fx&&visible(arrow)){
          var a0=onPath(arrow,0);
          var hr=hub.getBoundingClientRect(),h=rel(hr.right,hr.top+hr.height/2);
          var rr=rows.getBoundingClientRect(),r=rel(rr.left+12,rr.top+14);
          var a1=onPath(arrow,1),r2={x:r.x+22,y:r.y+10},wp={x:(a1.x+r.x)/2,y:(a1.y+r.y)/2-16};
          /* плавная кривая (Catmull-Rom) через хаб → стрелку → строку списка, с равномерной скоростью */
          var P=[h,h,a0,a1,wp,r2,r2],S=[],acc=[0];
          for(var si=1;si<P.length-2;si++){for(var q=0;q<20;q++){var u=q/20,p0=P[si-1],p1=P[si],p2=P[si+1],p3=P[si+2],u2=u*u,u3=u2*u;
            S.push({x:.5*((2*p1.x)+(-p0.x+p2.x)*u+(2*p0.x-5*p1.x+4*p2.x-p3.x)*u2+(-p0.x+3*p1.x-3*p2.x+p3.x)*u3),y:.5*((2*p1.y)+(-p0.y+p2.y)*u+(2*p0.y-5*p1.y+4*p2.y-p3.y)*u2+(-p0.y+3*p1.y-3*p2.y+p3.y)*u3)});}}
          S.push(r2);
          for(var si=1;si<S.length;si++)acc.push(acc[si-1]+Math.hypot(S[si].x-S[si-1].x,S[si].y-S[si-1].y));
          var LT=acc[acc.length-1]||1;
          var seg=function(t){var d=t*LT,i=1;while(i<acc.length-1&&acc[i]<d)i++;var f=(d-acc[i-1])/((acc[i]-acc[i-1])||1);return {x:S[i-1].x+(S[i].x-S[i-1].x)*f,y:S[i-1].y+(S[i].y-S[i-1].y)*f};};
          var doc=el('tdk-pk__doc','<i><svg><use href="#i-doc"/></svg></i>№1042');doc.style.opacity=0;
          var t0=performance.now()+250,dur=1500,alive=true,arrived=false;
          var eio=function(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;};
          add({kill:function(){alive=false;doc.remove();},step:function(now){
            if(!alive) return false;var k=(now-t0)/dur;if(k<0) return true;
            if(k>=1.25){this.kill();return false;}
            if(!arrived&&k>=.86){arrived=true;arrive();}
            var kk=Math.min(1,k),t=eio(kk),p=seg(t);
            /* в конце карточка «садится» в строку: уменьшается и растворяется уже на месте */
            var land=sm(.82,1.25,k);
            put(doc,{x:p.x,y:p.y-12},(.85+.15*Math.sin(Math.PI*Math.min(1,t/.8)))*(1-.25*land),(k<.1?k/.1:1)*(1-land));return true;}});
          comet(function(t){return seg(t*.55);},950,{delay:250,len:.3});
        } else later(arrive,500);
      }
      if(auto!==false&&vis&&!reduce) timer=setTimeout(function(){go((s+1)%4);},D[s]);
    }
    cards.forEach(function(c){c.addEventListener('click',function(){go(+c.getAttribute('data-go'));});});
    function reserve(){
      if(!rows) return; rows.style.minHeight='';
      var nr=$('.tdk-newrow',rows),prev=fl.getAttribute('data-s'),had=fl.classList.contains('arrived');
      nr.style.transition='none'; fl.setAttribute('data-s','3'); fl.classList.add('arrived');
      var h=rows.offsetHeight; fl.setAttribute('data-s',prev); if(!had)fl.classList.remove('arrived'); void nr.offsetWidth; nr.style.transition='';
      rows.style.minHeight=h+'px';
    }
    reserve(); window.addEventListener('resize',reserve);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(reserve);
    if(reduce){go(3,false);}
    else watch(how,function(v){vis=v; if(v){go(cur<0?0:cur);} else clr();},.25);
  }

  /* ВНУТРИ ПРИЛОЖЕНИЯ: карусель телефонов */
  var cf=$('[data-cf]');
  if(cf){
    var DUR=4500,tabs=$$('.tdk-tab',cf),phs=$$('.tdk-cf__ph',cf),n=phs.length,ci=0,ct=null,cv=false,hov=false,left=DUR,t0=0;
    cf.style.setProperty('--cfd',DUR+'ms');
    function layout(){
      var mob=window.innerWidth<960,step=mob?8:13.5;
      phs.forEach(function(p,i){
        var o=i-ci; if(o>n/2)o-=n; if(o<-n/2)o+=n;
        var a=Math.abs(o),sc=a?0.86:1;
        if(a>1){o=o>0?2:-2;}
        p.style.transform='translateX('+(o*step)+'em) translateY('+(a?1.4:0)+'em) scale('+(a>1?.75:sc)+')';
        p.style.opacity=a>1?0:1; p.style.zIndex=10-a; p.style.filter=a?'brightness(.5)':'none';
        p.style.pointerEvents=a===1?'auto':(a?'none':'auto');
      });
      tabs.forEach(function(t,i){t.classList.toggle('is-on',i===ci);});
    }
    function bar(){var t=tabs[ci],b=$('.tdk-tab__bar',t);b.style.animation='none';void b.offsetWidth;b.style.animation='';}
    var manual=false;
    function run(ms){clearTimeout(ct);if(manual||!cv||reduce)return;ct=setTimeout(function(){show(ci+1);},ms);}
    function glare(){if(reduce)return;var p=phs[ci];p.classList.remove('is-glare');void p.offsetWidth;p.classList.add('is-glare');setTimeout(function(){p.classList.remove('is-glare');},1800);}
    function show(i){ci=(i+n)%n;layout();bar();glare();run(DUR);}
    function pick(i){manual=true;clearTimeout(ct);cf.classList.add('is-manual');show(i);}
    tabs.forEach(function(t,i){t.addEventListener('click',function(){pick(i);});});
    phs.forEach(function(p,i){p.addEventListener('click',function(){pick(i);});});
    var pv=$('[data-prev]',cf),nx=$('[data-next]',cf);
    if(pv)pv.addEventListener('click',function(){pick(ci-1);});
    if(nx)nx.addEventListener('click',function(){pick(ci+1);});
    var tbox=$('.tdk-tabs',cf);
    function lock(){
      tbox.style.minHeight=''; var mx=0;
      tabs.forEach(function(t,i){
        tabs.forEach(function(x,k){x.classList.toggle('is-on',k===i);$('.tdk-tab__d',x).style.transition='none';});
        mx=Math.max(mx,tbox.offsetHeight);
      });
      tabs.forEach(function(x,k){x.classList.toggle('is-on',k===ci);void x.offsetWidth;$('.tdk-tab__d',x).style.transition='';});
      tbox.style.minHeight=mx+'px';
    }
    lock(); window.addEventListener('resize',function(){lock();layout();});
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(lock);
    layout();
    watch(cf,function(v){var was=cv;cv=v;if(v&&!was){bar();run(DUR);}else if(!v)clearTimeout(ct);},.3);
  }

  /* счётчики */
  $$('[data-count]').forEach(function(el){
    var to=+el.getAttribute('data-count'),plain=el.hasAttribute('data-plain'),done=false;
    if(reduce) return;
    var from=plain?to-10:0; el.textContent=from;
    watch(el,function(v){
      if(!v||done) return; done=true; var t0=null;
      requestAnimationFrame(function st(ts){if(!t0)t0=ts;var k=Math.min((ts-t0)/1400,1),e=1-Math.pow(1-k,3);el.textContent=Math.round(from+(to-from)*e);if(k<1)requestAnimationFrame(st);});
    },.6);
  });

  /* ТАРИФЫ */
  var pr=$('[data-pricing]');
  if(pr){
    var sw=$('.tdk-sw',pr),sb=$$('[data-period]',sw);
    function fmt(x){return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');}
    function setP(p){
      sb.forEach(function(b){b.classList.toggle('is-on',b.getAttribute('data-period')===p);});
      pill(sw,'.tdk-sw__p');
      $$('.tdk-pl__price b',pr).forEach(function(el){
        var to=+el.getAttribute('data-'+p),from=+el.textContent.replace(/\s/g,''),t0=null;
        if(reduce||from===to){el.textContent=fmt(to);return;}
        requestAnimationFrame(function st(ts){if(!t0)t0=ts;var k=Math.min((ts-t0)/450,1),e=1-Math.pow(1-k,3);el.textContent=fmt(from+(to-from)*e);if(k<1)requestAnimationFrame(st);});
      });
      $$('.tdk-pl__note',pr).forEach(function(x){x.textContent=x.getAttribute('data-'+p);});
      pr.classList.toggle('is-year',p==='y');
    }
    sb.forEach(function(b){b.addEventListener('click',function(){setP(b.getAttribute('data-period'));});});
    onFonts(function(){pill(sw,'.tdk-sw__p');});
    var cb=$('[data-cmp]',pr),tbl=$('[data-tbl]',pr);
    cb.addEventListener('click',function(){var on=tbl.classList.toggle('is-on');cb.classList.toggle('is-on',on);$('span',cb).textContent=on?'Taqqoslashni yashirish':'Barcha funksiyalarni taqqoslash';});
  }

  /* ДЕМО: лента событий */
  var fs=$('[data-feedstack]');
  if(fs){
    var ev=$$('.tdk-ev',fs),k=0,fv=false;
    function paint(){ev.forEach(function(e,i){var p=(k-i+ev.length)%ev.length;e.setAttribute('data-p',p);});}
    paint();
    if(!reduce){
      watch(fs,function(v){fv=v;},0);
      setInterval(function(){
        if(!fv||document.hidden) return;
        k=(k+1)%ev.length;
        var nw=ev[k]; nw.setAttribute('data-p','-1'); void nw.offsetWidth;
        paint();
      },2400);
    }
  }

  /* ВЫЛЕТ ТОВАРОВ ИЗ КОРОБКИ — привязан к скроллу (v2) */
  (function(){
    var bu=document.querySelector('.tdk [data-burst]'); if(!bu) return;
    var art=bu.closest('.tdk-art'), os=[].slice.call(bu.querySelectorAll('.tdk-burst__o')), fx=[].slice.call(bu.querySelectorAll('.tdk-burst__fx'));
    var box=bu.querySelector('.tdk-burst__box'), glow=bu.querySelector('.tdk-burst__glow');
    var MX=.51, MY=.88, raf=0, lastK='';
    var D=os.map(function(o,i){
      var a=o.offsetWidth||1;
      o.style.animationDelay=(-(i*0.73)%4.2).toFixed(2)+'s'; o.style.animationDuration=(3.6+(i%5)*.45).toFixed(2)+'s';
      return {el:o,d:+o.getAttribute('data-d'),r:+o.getAttribute('data-rot'),cx:+o.getAttribute('data-cx'),cy:+o.getAttribute('data-cy'),z:.35+(1-+o.getAttribute('data-d'))*.9};
    });
    function cl(v){return v<0?0:v>1?1:v;}
    function back(t){var c=1.6;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);}
    var mx=0,my=0,tx=0,ty=0;
    function paint(p){
      var k=p.toFixed(4)+'|'+mx.toFixed(3)+'|'+my.toFixed(3); if(k===lastK) return; lastK=k;
      var W=bu.offsetWidth,H=bu.offsetHeight;
      D.forEach(function(o){
        var t=cl((p-o.d*.5)/.5), ex=1-Math.pow(1-t,2), ey=1-Math.pow(1-t,4), e=1-Math.pow(1-t,3), sb=back(t);
        var dx=(MX-o.cx)*W*(1-ex)+mx*o.z*5, dy=(MY-o.cy)*H*(1-ey)+my*o.z*3.5;
        o.el.style.transform='translate3d('+dx.toFixed(1)+'px,'+dy.toFixed(1)+'px,0) scale('+(.1+.9*sb).toFixed(3)+') rotate('+(o.r*(1-e)).toFixed(1)+'deg)';
        o.el.style.opacity=t>=1?'':cl(t*5).toFixed(3);
      });
      var f=cl((p-.7)/.3).toFixed(3); fx.forEach(function(x){x.style.opacity=f;});
      /* вспышка из коробки и «толчок» коробки */
      var g=Math.sin(Math.PI*cl(p/.75));
      if(glow){glow.style.opacity=(g*.95).toFixed(3);glow.style.transform='translate(-50%,-50%) scale('+(.6+p*.9).toFixed(3)+')';}
      if(box){var q=Math.sin(Math.PI*cl(p/.35));box.style.transform='translate3d('+(mx*1.5).toFixed(1)+"px,"+(my*1).toFixed(1)+'px,0) scale('+(1+q*.035).toFixed(4)+','+(1-q*.03).toFixed(4)+')';}
      art.classList.toggle('is-done',p>.97);
    }
    /* низ коробки заходит под плашку, чтобы не было щели */
    var bar=art.querySelector('.tdk-art__bar');
    /* считаем по offset-размерам: на них не влияют анимации появления (transform) */
    function fitBox(){if(!bar)return;var v=art.clientHeight-bar.offsetTop-bar.offsetHeight*.25;if(v>0&&v<art.clientHeight*.5)bu.style.marginBottom=v+'px';}
    fitBox(); window.addEventListener('resize',fitBox); window.addEventListener('load',fitBox);
    if(window.ResizeObserver){new ResizeObserver(fitBox).observe(art);new ResizeObserver(fitBox).observe(bar);}
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(fitBox);
    if(reduce){art.classList.add('is-burst','is-done');paint(1);return;}
    art.classList.add('is-burst');
    watch(art,function(v){art.classList.toggle('is-off',!v);},0);
    function prog(){
      var r=art.getBoundingClientRect(), vh=window.innerHeight||800;
      /* начинается, как только верх карточки показался; заканчивается, когда карточка поднялась до ~40% экрана */
      /* старт — верх карточки показался; финиш — низ экрана дошёл до низа карточки */
      return cl((vh-r.top)/Math.max(200,r.height*.97));
    }
    var cur=-1;
    function tick(){
      raf=0; var t=prog(); if(cur<0)cur=t;
      cur+=(t-cur)*.14; if(Math.abs(t-cur)<.001)cur=t;
      mx+=(tx-mx)*.03; my+=(ty-my)*.03; if(Math.abs(tx-mx)<.0005)mx=tx; if(Math.abs(ty-my)<.0005)my=ty;
      paint(cur);
      if(cur!==t||mx!==tx||my!==ty) raf=requestAnimationFrame(tick);
    }
    function on(){if(!raf)raf=requestAnimationFrame(tick);}
    window.addEventListener('scroll',on,{passive:true});
    window.addEventListener('resize',function(){lastK='';on();});
    cur=prog();paint(cur);
  })();

  /* HERO: сборка сцены */
  (function(){var hc=document.querySelector('.tdk [data-hc]'); if(!hc) return;
    var imgs=[].slice.call(hc.querySelectorAll('img')), n=0, rd=false, vis=false, fire=function(){if(rd&&vis)hc.classList.add('is-on');}, go=function(){rd=true;fire();};
    watch(hc,function(v){if(v){vis=true;fire();}},.25);
    watch(hc,function(v){hc.classList.toggle('is-off',!v);},0);
    var t=setTimeout(go,1800);
    imgs.forEach(function(i){if(i.complete){n++;}else{i.addEventListener('load',function(){if(++n===imgs.length){clearTimeout(t);go();}});i.addEventListener('error',function(){if(++n===imgs.length){clearTimeout(t);go();}});}});
    if(n===imgs.length){clearTimeout(t);requestAnimationFrame(go);}
  })();

  /* ПАНЕЛЬ ВЛАДЕЛЬЦА: уведомление о заказе — по кругу, пока блок на экране */
  (function(){var ph=document.querySelector('.tdk [data-ntf]'); if(!ph) return;
    var t1=null,t2=null,on=false,n=1043,tt=$('.tdk-ntf__t',ph),sums=['412 000','268 500','1 150 000','734 000'],ss=$('.tdk-ntf__s',ph);
    function play(){
      if(!on) return;
      if(tt) tt.textContent='🛒 Yangi buyurtma №'+n; if(ss) ss.textContent=(2+n%3)+' ta mahsulot · '+sums[n%sums.length]+' so‘m'; n++;
      ph.classList.remove('is-ntf'); void ph.offsetWidth; ph.classList.add('is-ntf');
      t1=setTimeout(function(){ph.classList.remove('is-ntf');},7600);   /* подсветка плавно гаснет */
      t2=setTimeout(play,9200);                                        /* пауза и заново */
    }
    watch(ph,function(v){
      if(v&&!on){on=true;t2=setTimeout(play,700);}
      else if(!v&&on){on=false;clearTimeout(t1);clearTimeout(t2);ph.classList.remove('is-ntf');}
    },.5);
  })();
})();
