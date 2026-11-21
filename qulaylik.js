/**
 * qulaylik.js — O'zbek lotin yozuvi (ş, ç, ö, ğ) va ko'rish imkoniyati cheklanganlar paneli
 * umamatov.uz va pedagog.umamatov.uz rasmiy portali uchun
 * Muallif: Umrbek Mamatov
 */
(function() {
  'use strict';
  if (window.__qz) return;
  window.__qz = 1;

  // LocalStorage yordamchisi
  var LS = {
    get: function(k, d) {
      try {
        var v = localStorage.getItem(k);
        return v === null ? d : v;
      } catch(e) { return d; }
    },
    set: function(k, v) {
      try { localStorage.setItem(k, v); } catch(e) {}
    }
  };

  // Holat: a: 'new' (ş,ç,ö,ğ) yoki 'std' (sh,ch,o',g')
  // f: shrift o'lchami (0: oddiy, 1: A+, 2: A++)
  // c: rang kontrasti (0: oddiy, 1: yuqori kontrast, 2: oq-qora)
  var st = {
    a: LS.get('qz_a', 'std'), // standart holat
    f: +LS.get('qz_f', '0') || 0,
    c: +LS.get('qz_c', '0') || 0
  };

  // Yangi alifbo harflari
  var RX_NEW = /[şŞçÇöÖğĞ]/;
  // Standart alifbo birikmalari
  var RX_STD = /[Ss][Hh]|[Cc][Hh]|[OoGg]['ʻ‘ʼ`\u02BC]/;

  // Standartdan Yangiga o'girish
  function toNew(text) {
    if (!text || typeof text !== 'string') return text;
    // s'h va c'h larni himoyalash
    var s = text.replace(/([SsCc])['ʻ‘ʼ`\u02BC]([Hh])/g, '$1__APO__$2');
    
    // O' va G'
    s = s.replace(/O['ʻ‘ʼ`\u02BC]/g, 'Ö');
    s = s.replace(/o['ʻ‘ʼ`\u02BC]/g, 'ö');
    s = s.replace(/G['ʻ‘ʼ`\u02BC]/g, 'Ğ');
    s = s.replace(/g['ʻ‘ʼ`\u02BC]/g, 'ğ');

    // SH va CH
    s = s.replace(/SH(?=[A-ZÖĞŞÇ\s,.\?!:;]|$)/g, 'Ş');
    s = s.replace(/Sh/g, 'Ş');
    s = s.replace(/sh/g, 'ş');
    s = s.replace(/CH(?=[A-ZÖĞŞÇ\s,.\?!:;]|$)/g, 'Ç');
    s = s.replace(/Ch/g, 'Ç');
    s = s.replace(/ch/g, 'ç');

    // Himoyalangan tutuqni qaytarish
    s = s.replace(/__APO__/g, "'");
    return s;
  }

  // Yangidan Standartga o'girish
  function toStd(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(/[şŞçÇöÖğĞ]/g, function(c, idx, fullStr) {
      var isUpperCtx = false;
      if (idx + 1 < fullStr.length && /[A-ZÇŞÖĞ]/.test(fullStr.charAt(idx + 1))) {
        isUpperCtx = true;
      } else if (idx > 0 && /[A-ZÇŞÖĞ]/.test(fullStr.charAt(idx - 1))) {
        isUpperCtx = true;
      }

      switch(c) {
        case 'ş': return 'sh';
        case 'Ş': return isUpperCtx ? 'SH' : 'Sh';
        case 'ç': return 'ch';
        case 'Ç': return isUpperCtx ? 'CH' : 'Ch';
        case 'ö': return "oʻ";
        case 'Ö': return "Oʻ";
        case 'ğ': return "gʻ";
        case 'Ğ': return "Gʻ";
        default: return c;
      }
    });
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, PRE: 1 };
  var ATTRS = ['placeholder', 'title', 'alt', 'aria-label'];
  var isMutating = false;

  function shouldSkip(node) {
    var p = node.parentNode;
    if (!p || SKIP[p.nodeName]) return true;
    return !!(p.closest && p.closest('[data-noalpha]'));
  }

  function transformNode(n, targetMode) {
    var val = n.nodeValue;
    if (!val || shouldSkip(n)) return;
    var res = targetMode === 'new' ? toNew(val) : toStd(val);
    if (res !== val) {
      n.nodeValue = res;
    }
  }

  function transformAttrs(root, targetMode) {
    if (!root || root.nodeType !== 1) return;
    var list = [];
    if (!root.closest || !root.closest('[data-noalpha]')) {
      list.push(root);
      var q = root.querySelectorAll('[placeholder],[title],[alt],[aria-label]');
      for (var i = 0; i < q.length; i++) {
        if (!q[i].closest('[data-noalpha]')) list.push(q[i]);
      }
    }

    for (var j = 0; j < list.length; j++) {
      var el = list[j];
      for (var k = 0; k < ATTRS.length; k++) {
        var attr = ATTRS[k];
        var v = el.getAttribute(attr);
        if (v) {
          var res = targetMode === 'new' ? toNew(v) : toStd(v);
          if (res !== v) el.setAttribute(attr, res);
        }
      }
    }
  }

  function walkDOM(root, targetMode) {
    if (!root) return;
    if (root.nodeType === 3) {
      transformNode(root, targetMode);
      return;
    }
    if (root.nodeType !== 1 || SKIP[root.nodeName]) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [];
    var n;
    while ((n = walker.nextNode())) {
      nodes.push(n);
    }
    for (var i = 0; i < nodes.length; i++) {
      transformNode(nodes[i], targetMode);
    }
    transformAttrs(root, targetMode);
  }

  function applyAlphabet() {
    isMutating = true;
    try {
      walkDOM(document.body || document.documentElement, st.a);
      if (document.title) {
        document.title = st.a === 'new' ? toNew(document.title) : toStd(document.title);
      }
    } finally {
      isMutating = false;
    }
    updateButtons();
  }

  // Dinamik qo'shilgan elementlar uchun MutationObserver
  var observer = new MutationObserver(function(mutations) {
    if (isMutating) return;
    isMutating = true;
    try {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'childList') {
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node.id === 'qz' || (node.closest && node.closest('#qz'))) continue;
            walkDOM(node, st.a);
          }
        } else if (m.type === 'characterData') {
          var target = m.target;
          if (target && !shouldSkip(target)) {
            var val = target.nodeValue;
            var res = st.a === 'new' ? toNew(val) : toStd(val);
            if (res !== val) target.nodeValue = res;
          }
        }
      }
    } finally {
      isMutating = false;
    }
  });

  // CSS stillari
  var css = ''
    + '#qz { position: fixed; left: 16px; bottom: 16px; z-index: 2147483000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; display: flex; gap: 8px; align-items: center; }'
    + '#qz .qzb { height: 42px; min-width: 42px; padding: 0 14px; border-radius: 21px; border: 1px solid rgba(255, 255, 255, 0.35); background: #0f2a5c; color: #ffffff; font-size: 13.5px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.28); display: inline-flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s ease; user-select: none; }'
    + '#qz .qzb:hover { background: #1a428a; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35); }'
    + '#qz .qzb:active { transform: translateY(0); }'
    + '#qz .qzb.active-alpha { background: #1e40af; border-color: #60a5fa; box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.4); }'
    + '#qz .qzp { position: absolute; left: 0; bottom: 52px; width: 310px; max-width: calc(100vw - 32px); box-sizing: border-box; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25); font-size: 14.5px; z-index: 2147483001; animation: qzFadeIn 0.2s ease; }'
    + '#qz .qzp[hidden] { display: none; }'
    + '#qz .qzt { font-weight: 700; font-size: 15px; margin-bottom: 8px; color: #0f2a5c; display: flex; align-items: center; gap: 6px; }'
    + '#qz .qzl { color: #64748b; margin: 10px 0 6px; font-size: 13px; font-weight: 600; }'
    + '#qz .qzr { display: flex; gap: 6px; }'
    + '#qz .qzr button { flex: 1; padding: 8px 4px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; color: #0f172a; font-weight: 600; font-size: 13.5px; cursor: pointer; transition: all 0.15s; }'
    + '#qz .qzr button:hover { background: #e2e8f0; }'
    + '#qz .qzr button.on { background: #0f2a5c; border-color: #0f2a5c; color: #ffffff; }'
    + '#qz .qzx { margin-top: 14px; width: 100%; padding: 9px; border: 0; background: #f1f5f9; border-radius: 8px; color: #334155; font-weight: 600; font-size: 13.5px; cursor: pointer; transition: background 0.15s; }'
    + '#qz .qzx:hover { background: #e2e8f0; color: #0f172a; }'
    + '@keyframes qzFadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }'
    + 'html.qz-f1 body { zoom: 1.15; }'
    + 'html.qz-f2 body { zoom: 1.30; }'
    + 'html.qz-c1 body, html.qz-c1 body * { background: #000000 !important; background-image: none !important; color: #ffffff !important; border-color: #ffff00 !important; box-shadow: none !important; text-shadow: none !important; }'
    + 'html.qz-c1 body a, html.qz-c1 body a * { color: #ffff00 !important; text-decoration: underline !important; }'
    + 'html.qz-c1 #qz .qzb { background: #000000 !important; border: 2px solid #ffff00 !important; color: #ffff00 !important; }'
    + 'html.qz-c1 #qz .qzp { background: #000000 !important; border: 2px solid #ffff00 !important; color: #ffffff !important; }'
    + 'html.qz-c1 #qz .qzr button { background: #000000 !important; border: 1px solid #ffff00 !important; color: #ffff00 !important; }'
    + 'html.qz-c1 #qz .qzr button.on { background: #ffff00 !important; color: #000000 !important; }'
    + 'html.qz-c1 #qz .qzx { background: #ffff00 !important; color: #000000 !important; }'
    + 'html.qz-c2 { filter: grayscale(100%); }'
    + '@media print { #qz { display: none !important; } }'
    + '@media (max-width: 600px) { #qz { left: 10px; bottom: 12px; gap: 6px; } #qz .qzb { height: 38px; min-width: 38px; padding: 0 10px; font-size: 12px; } #qz .qzp { bottom: 48px; width: 280px; } }';

  var box, btnAlpha, btnVision, popover;

  function updateButtons() {
    if (!btnAlpha) return;
    if (st.a === 'new') {
      btnAlpha.textContent = 'ş · ç · ö · ğ';
      btnAlpha.title = "Standart alifboga o'tish (sh, ch, o', g')";
      btnAlpha.classList.add('active-alpha');
    } else {
      btnAlpha.textContent = 'ş · ç · ö · ğ';
      btnAlpha.title = "Yangi alifboga o'tish (ş, ç, ö, ğ)";
      btnAlpha.classList.remove('active-alpha');
    }
  }

  function applyVision() {
    var root = document.documentElement;
    root.classList.remove('qz-f1', 'qz-f2', 'qz-c1', 'qz-c2');
    if (st.f) root.classList.add('qz-f' + st.f);
    if (st.c) root.classList.add('qz-c' + st.c);

    if (!box) return;
    var fontBtns = box.querySelectorAll('[data-f]');
    for (var i = 0; i < fontBtns.length; i++) {
      fontBtns[i].classList.toggle('on', +fontBtns[i].getAttribute('data-f') === st.f);
    }
    var colorBtns = box.querySelectorAll('[data-c]');
    for (var j = 0; j < colorBtns.length; j++) {
      colorBtns[j].classList.toggle('on', +colorBtns[j].getAttribute('data-c') === st.c);
    }
  }

  function initUI() {
    var styleEl = document.createElement('style');
    styleEl.id = 'qz-style';
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    box = document.createElement('div');
    box.id = 'qz';
    box.setAttribute('data-noalpha', 'true');
    box.innerHTML = ''
      + '<button type="button" class="qzb" id="qzA" data-noalpha="true" title="Yangi alifboga o\'tish (ş, ç, ö, ğ)">ş · ç · ö · ğ</button>'
      + '<button type="button" class="qzb" id="qzV" data-noalpha="true" aria-label="Ko\'rish imkoniyati" title="Ko\'rish imkoniyati">'
      + '  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + '    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>'
      + '    <circle cx="12" cy="12" r="3"></circle>'
      + '  </svg>'
      + '</button>'
      + '<div class="qzp" id="qzP" data-noalpha="true" hidden>'
      + '  <div class="qzt">👁 Ko\'rish imkoniyati cheklanganlar uchun</div>'
      + '  <div class="qzl">Shrift o\'lchami:</div>'
      + '  <div class="qzr">'
      + '    <button type="button" data-f="0">A</button>'
      + '    <button type="button" data-f="1">A+</button>'
      + '    <button type="button" data-f="2">A++</button>'
      + '  </div>'
      + '  <div class="qzl">Ranglar kontrasti:</div>'
      + '  <div class="qzr">'
      + '    <button type="button" data-c="0">Oddiy</button>'
      + '    <button type="button" data-c="1">Kontrast</button>'
      + '    <button type="button" data-c="2">Oq-qora</button>'
      + '  </div>'
      + '  <button type="button" class="qzx" id="qzX">Asliga qaytarish</button>'
      + '</div>';

    document.documentElement.appendChild(box);

    btnAlpha = document.getElementById('qzA');
    btnVision = document.getElementById('qzV');
    popover = document.getElementById('qzP');

    // Alifbo almashtirish
    btnAlpha.addEventListener('click', function(e) {
      e.preventDefault();
      st.a = st.a === 'new' ? 'std' : 'new';
      LS.set('qz_a', st.a);
      applyAlphabet();
    });

    // Ko'rish paneli ochish/yopish
    btnVision.addEventListener('click', function(e) {
      e.stopPropagation();
      popover.hidden = !popover.hidden;
    });

    // Panel ichidagi sozlamalar
    popover.addEventListener('click', function(e) {
      e.stopPropagation();
      var t = e.target;
      if (t.hasAttribute('data-f')) {
        st.f = +t.getAttribute('data-f');
        LS.set('qz_f', st.f);
        applyVision();
      } else if (t.hasAttribute('data-c')) {
        st.c = +t.getAttribute('data-c');
        LS.set('qz_c', st.c);
        applyVision();
      } else if (t.id === 'qzX') {
        st.f = 0;
        st.c = 0;
        LS.set('qz_f', 0);
        LS.set('qz_c', 0);
        applyVision();
      }
    });

    // Tashqariga bosganda yopish
    document.addEventListener('click', function() {
      if (popover) popover.hidden = true;
    });

    // ESC tugmasi bilan yopish
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && popover) popover.hidden = true;
    });

    applyVision();
    updateButtons();

    if (st.a === 'new') {
      applyAlphabet();
    }

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  window.addEventListener('load', function() {
    if (st.a === 'new') applyAlphabet();
  });
})();
