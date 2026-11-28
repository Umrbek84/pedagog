/**
 * umamatov.uz - Qulaylik, Alifbo va Yagona Navigatsiya Skripti (qulaylik.js)
 * Muallif: Umrbek Mamatov · Bosh mutaxassis
 * 
 * 1. Mobil versiyada (<=991px):
 *    - 'Sh · Ch · O‘ · G‘' va ko'zcha tugmalari butunlay yashiriladi.
 *    - Barcha matnlar QAT'IY ravishda yangi lotin yozuviga (ş, ç, ö, ğ, Ş, Ç, Ö, Ğ) o'tkaziladi.
 * 2. Ichki sahifalarda (sub-pages):
 *    - Sahifa pastga aylantirilganda (scroll) ham doimo ko'rinib turadigan, chiroyli,
 *      ixcham va qulay "🏠 Boş sahifa" (Asosiy portalga qaytish) suzuvchi (floating)
 *      tugmasi avtomatik qo'shiladi. Foydalanuvchi hech qachon adashib qolmaydi!
 * 3. Kompyuterda:
 *    - Barcha qulaylik tugmalari o'z joyida to'liq ishlaydi.
 */
(function() {
  'use strict';
  if (window.__qz) return;
  window.__qz = 1;

  var LS = {
    get: function(k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e) { return d; }
    },
    set: function(k, v) {
      try { localStorage.setItem(k, v); } catch(e) {}
    }
  };

  // Mobil qurilmani aniqlash
  function isMobile() {
    return (window.innerWidth <= 991) || 
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  // Bosh sahifadami yoki ichki sahifadami?
  var path = window.location.pathname.toLowerCase();
  var isHome = path === '' || path === '/' || path.endsWith('/index.html') || path.endsWith('/index');

  var st = {
    a: isMobile() ? 'new' : LS.get('qz_a', 'new'),
    f: isMobile() ? 0 : (+LS.get('qz_f', '0') || 0),
    c: isMobile() ? 0 : (+LS.get('qz_c', '0') || 0)
  };

  // Yangi lotin -> Standart lotin
  var RX_NEW = /[şŞçÇöÖğĞ]/;
  var UP = /[A-ZÇŞÖĞ]/;
  function toStdLatin(s) {
    if (!s || !RX_NEW.test(s)) return s;
    return s.replace(/[şŞçÇöÖğĞ]/g, function(c, i, str) {
      switch (c) {
        case 'ş': return 'sh';
        case 'ç': return 'ch';
        case 'ö': return 'oʻ';
        case 'ğ': return 'gʻ';
        case 'Ö': return 'Oʻ';
        case 'Ğ': return 'Gʻ';
        default: {
          var up = UP.test(str.charAt(i + 1)) || UP.test(str.charAt(i - 1));
          var b = (c === 'Ş') ? 'S' : 'C';
          return up ? (b + 'H') : (b + 'h');
        }
      }
    });
  }

  // Standart lotin -> Yangi lotin (o', g', sh, ch -> ö, ğ, ş, ç)
  function toNewLatin(s) {
    if (!s) return s;
    return s
      .replace(/SH([A-ZÇŞÖĞ])/g, 'Ş$1')
      .replace(/CH([A-ZÇŞÖĞ])/g, 'Ç$1')
      .replace(/Sh/g, 'Ş')
      .replace(/SH/g, 'Ş')
      .replace(/Ch/g, 'Ç')
      .replace(/CH/g, 'Ç')
      .replace(/sh/g, 'ş')
      .replace(/ch/g, 'ç')
      .replace(/O[ʻʼ'`‘’]/g, 'Ö')
      .replace(/o[ʻʼ'`‘’]/g, 'ö')
      .replace(/G[ʻʼ'`‘’]/g, 'Ğ')
      .replace(/g[ʻʼ'`‘’]/g, 'ğ');
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var AT = ['placeholder', 'title', 'alt', 'aria-label'];
  var rec = [], arec = [], T0 = null;

  function skip(n) {
    var p = n.parentNode;
    if (!p || SKIP[p.nodeName]) return true;
    return !!(p.closest && p.closest('[data-noalpha]'));
  }

  function convStd(n) {
    var v = n.nodeValue;
    if (!v || !RX_NEW.test(v) || skip(n)) return;
    var c = toStdLatin(v);
    rec.push([n, v, c]);
    n.nodeValue = c;
  }

  function convNew(n) {
    var v = n.nodeValue;
    if (!v || skip(n)) return;
    var c = toNewLatin(v);
    if (c !== v) n.nodeValue = c;
  }

  function attrsStd(root) {
    if (root.nodeType !== 1) return;
    var L = [root];
    var q = root.querySelectorAll('[placeholder],[title],[alt],[aria-label]');
    for (var i = 0; i < q.length; i++) L.push(q[i]);
    for (var j = 0; j < L.length; j++) {
      var e = L[j];
      if (e.closest && e.closest('[data-noalpha]')) continue;
      for (var k = 0; k < AT.length; k++) {
        var v = e.getAttribute(AT[k]);
        if (v && RX_NEW.test(v)) {
          var c = toStdLatin(v);
          arec.push([e, AT[k], v, c]);
          e.setAttribute(AT[k], c);
        }
      }
    }
  }

  function attrsNew(root) {
    if (root.nodeType !== 1) return;
    var L = [root];
    var q = root.querySelectorAll('[placeholder],[title],[alt],[aria-label]');
    for (var i = 0; i < q.length; i++) L.push(q[i]);
    for (var j = 0; j < L.length; j++) {
      var e = L[j];
      if (e.closest && e.closest('[data-noalpha]')) continue;
      for (var k = 0; k < AT.length; k++) {
        var v = e.getAttribute(AT[k]);
        if (v) {
          var c = toNewLatin(v);
          if (c !== v) e.setAttribute(AT[k], c);
        }
      }
    }
  }

  function walkStd(root) {
    if (root.nodeType === 3) { convStd(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), a = [], n;
    while ((n = w.nextNode())) a.push(n);
    for (var i = 0; i < a.length; i++) convStd(a[i]);
    attrsStd(root);
  }

  function walkNew(root) {
    if (root.nodeType === 3) { convNew(root); return; }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), a = [], n;
    while ((n = w.nextNode())) a.push(n);
    for (var i = 0; i < a.length; i++) convNew(a[i]);
    attrsNew(root);
  }

  function revert() {
    for (var i = 0; i < rec.length; i++) {
      var r = rec[i];
      if (r[0].nodeValue === r[2]) r[0].nodeValue = r[1];
    }
    rec = [];
    for (var j = 0; j < arec.length; j++) {
      var q = arec[j];
      if (q[0].getAttribute(q[1]) === q[3]) q[0].setAttribute(q[1], q[2]);
    }
    arec = [];
  }

  function applyAlpha() {
    if (isMobile()) {
      revert();
      walkNew(document.documentElement);
      if (document.title) document.title = toNewLatin(document.title);
      return;
    }

    if (st.a === 'std') {
      walkStd(document.documentElement);
      if (T0 === null && RX_NEW.test(document.title)) {
        T0 = document.title;
        document.title = toStdLatin(T0);
      }
    } else {
      revert();
      walkNew(document.documentElement);
      if (T0 !== null) {
        document.title = T0;
        T0 = null;
      }
    }
    labelA();
  }

  var mo = new MutationObserver(function(ms) {
    if (isMobile()) {
      for (var i = 0; i < ms.length; i++) {
        var m = ms[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) walkNew(m.addedNodes[j]);
        } else if (m.type === 'characterData') {
          convNew(m.target);
        }
      }
      return;
    }

    if (st.a !== 'std') return;
    for (var k = 0; k < ms.length; k++) {
      var item = ms[k];
      if (item.type === 'childList') {
        for (var l = 0; l < item.addedNodes.length; l++) walkStd(item.addedNodes[l]);
      } else if (item.type === 'characterData') {
        convStd(item.target);
      }
    }
  });

  // CSS stillari (qulaylik paneli + ichki sahifalar uchun suzuvchi bosh sahifa tugmasi)
  var css = '#qz{position:fixed;right:24px;top:18px;z-index:2147483000;font-family:"Times New Roman",Times,serif;display:flex;gap:10px;align-items:center}'
    + '#qz .qzb{height:40px;min-width:40px;padding:0 14px;border-radius:20px;border:1px solid rgba(255,255,255,0.25);background:rgba(15,23,42,0.85);backdrop-filter:blur(8px);color:#ffffff;font:700 13px -apple-system,BlinkMacSystemFont,sans-serif;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.3);display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s ease}'
    + '#qz .qzb:hover{background:#17398a}'
    + '#qz .qzp{position:absolute;right:0;left:auto;top:52px;width:300px;max-width:calc(100vw - 24px);box-sizing:border-box;background:#fff;color:#0f172a;border:1px solid #cbd5e1;border-radius:14px;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);font-size:15px}'
    + '#qz .qzp[hidden]{display:none}'
    + '#qz .qzt{font-weight:700;margin-bottom:6px}#qz .qzl{color:#475569;margin:10px 0 6px;font-size:14px}'
    + '#qz .qzr{display:flex;gap:6px}#qz .qzr button{flex:1;padding:9px 4px;border:1px solid #cbd5e1;border-radius:8px;background:#f8fafc;color:#0f172a;font:700 14px "Times New Roman",Times,serif;cursor:pointer}'
    + '#qz .qzr button.on{background:#0f2a5c;border-color:#0f2a5c;color:#fff}'
    + '#qz .qzn{color:#b45309;font-size:13px;margin-top:6px}'
    + '#qz .qzx{margin-top:12px;width:100%;padding:9px;border:0;background:#e2e8f0;border-radius:8px;color:#0f172a;font:700 14px "Times New Roman",Times,serif;cursor:pointer}'
    + 'html.qz-f1 body{zoom:1.12}html.qz-f2 body{zoom:1.28}'
    + 'html.qz-c1 body,html.qz-c1 body *{background:#000!important;background-image:none!important;color:#fff!important;border-color:#ff0!important;box-shadow:none!important;text-shadow:none!important}'
    + 'html.qz-c1 body a,html.qz-c1 body a *{color:#ff0!important}'
    + 'html.qz-c2{filter:grayscale(1)}'
    + '@media print{#qz{display:none!important}}'
    + '@media (max-width:991px){#qz{display:none!important;visibility:hidden!important;pointer-events:none!important;opacity:0!important}}'
    
    // ICHKI SAHIFALAR UCHUN YAGONA SUZUVCHI "BOSH SAHIFA" TUGMASI (Scroll qilganda ham doimo ko'rinadi)
    + '#um-floating-home{position:fixed;bottom:24px;left:24px;z-index:2147482000;display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:30px;background:rgba(15,23,42,0.92);backdrop-filter:blur(10px);color:#ffffff!important;font:700 14px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-decoration:none!important;border:1px solid rgba(255,255,255,0.22);box-shadow:0 6px 20px rgba(0,0,0,0.35);transition:all 0.25s ease}'
    + '#um-floating-home:hover{background:#1d4ed8;transform:translateY(-2px);box-shadow:0 10px 25px rgba(29,78,216,0.45);color:#fff!important}'
    + '#um-floating-home svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}'
    + '@media (max-width:768px){#um-floating-home{bottom:18px;left:16px;padding:9px 14px;font-size:13px;border-radius:24px;box-shadow:0 4px 16px rgba(0,0,0,0.4)}}';

  var box, bA, bV, P;
  function $(s) { return box ? box.querySelector(s) : null; }

  function labelA() {
    if (!bA) return;
    if (st.a === 'std') {
      bA.textContent = 'Ş · Ç · Ö · Ğ';
      bA.title = 'Yangi alifboga ötiş (ş, ç, ö, ğ)';
    } else {
      bA.textContent = 'Sh · Ch · O‘ · G‘';
      bA.title = 'Standart alifboga oʻtish (sh, ch, oʻ, gʻ)';
    }
  }

  function paint() {
    var h = document.documentElement;
    h.classList.remove('qz-f1', 'qz-f2', 'qz-c1', 'qz-c2');
    if (!isMobile()) {
      if (st.f) h.classList.add('qz-f' + st.f);
      if (st.c) h.classList.add('qz-c' + st.c);
    }
    if (!box) return;
    var b = box.querySelectorAll('[data-f]');
    for (var i = 0; i < b.length; i++) b[i].classList.toggle('on', +b[i].getAttribute('data-f') === st.f);
    b = box.querySelectorAll('[data-c]');
    for (var j = 0; j < b.length; j++) b[j].classList.toggle('on', +b[j].getAttribute('data-c') === st.c);
  }

  // Ichki sahifalarga "Bosh sahifa" suzuvchi tugmasini o'rnatish
  function buildSubpageHomeBtn() {
    if (isHome) return; // Asosiy sahifada kerak emas
    if (document.getElementById('um-floating-home') || document.getElementById('um-portal-back')) return;
    if (location.hostname !== 'umamatov.uz' && location.hostname !== 'localhost') return;

    var btn = document.createElement('a');
    btn.id = 'um-floating-home';
    btn.href = 'index.html';
    btn.setAttribute('aria-label', 'Bosh sahifaga qaytish');
    btn.setAttribute('title', 'umamatov.uz asosiy portaliga qaytish');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg><span>Boş sahifa</span>';
    document.body.appendChild(btn);
  }

  function build() {
    var st0 = document.createElement('style');
    st0.id = 'qz-css';
    st0.textContent = css;
    document.head.appendChild(st0);

    buildSubpageHomeBtn();

    // Mobil bo'lsa yuqori o'ng paneli yaratilmaydi
    if (isMobile()) {
      applyAlpha();
      mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      return;
    }

    // Faqat bosh sahifada yoki kompyuterda yuqori panel
    if (isHome) {
      box = document.createElement('div');
      box.id = 'qz';
      box.innerHTML = '<button type="button" class="qzb" id="qzA" data-noalpha></button>'
        + '<button type="button" class="qzb" id="qzV" aria-label="Köriş imkoniyati" title="Köriş imkoniyati">'
        + '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg></button>'
        + '<div class="qzp" id="qzP" hidden><div class="qzt">Köriş imkoniyati çeklanganlar uçun</div>'
        + '<div class="qzl">Şrift ölçami:</div><div class="qzr"><button type="button" data-f="0">A</button><button type="button" data-f="1">A+</button><button type="button" data-f="2">A++</button></div>'
        + '<div class="qzl">Ranglar kontrasti:</div><div class="qzr"><button type="button" data-c="0">Oddiy</button><button type="button" data-c="1">Kontrast</button><button type="button" data-c="2">Oq-qora</button></div>'
        + '<button type="button" class="qzx" id="qzX">Asliga qaytariş</button></div>';
      document.documentElement.appendChild(box);

      bA = $('#qzA');
      bV = $('#qzV');
      P = $('#qzP');

      if (bA) {
        bA.addEventListener('click', function() {
          st.a = (st.a === 'std') ? 'new' : 'std';
          LS.set('qz_a', st.a);
          applyAlpha();
        });
      }

      if (bV) {
        bV.addEventListener('click', function(e) {
          e.stopPropagation();
          if (P) P.hidden = !P.hidden;
        });
      }

      if (P) {
        P.addEventListener('click', function(e) {
          e.stopPropagation();
          var t = e.target;
          if (t.hasAttribute('data-f')) {
            st.f = +t.getAttribute('data-f');
            LS.set('qz_f', st.f);
            paint();
          } else if (t.hasAttribute('data-c')) {
            st.c = +t.getAttribute('data-c');
            LS.set('qz_c', st.c);
            paint();
          } else if (t.id === 'qzX') {
            st.f = 0;
            st.c = 0;
            LS.set('qz_f', 0);
            LS.set('qz_c', 0);
            paint();
          }
        });
      }

      document.addEventListener('click', function() { if (P) P.hidden = true; });
      document.addEventListener('keydown', function(e) { if (e.key === 'Escape' && P) P.hidden = true; });

      paint();
      labelA();
    }

    applyAlpha();
    mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  window.addEventListener('resize', function() {
    if (isMobile()) {
      if (box) box.style.display = 'none';
      applyAlpha();
    } else {
      if (box && isHome) box.style.display = 'flex';
      applyAlpha();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }

  window.addEventListener('load', function() {
    buildSubpageHomeBtn();
    applyAlpha();
  });
})();
