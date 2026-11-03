/* Ple Chusorn portfolio: theme, TH/EN switch, and the hero face that follows the pointer (25 blended poses, blink, expressions). No libraries. */
(function () {
  'use strict';
  var root = document.documentElement;

  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  /* ---------- theme ---------- */
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var cur = root.getAttribute('data-theme');
    if (!cur) cur = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    store('ple-theme', next);
  });

  /* ---------- language: one language on screen at a time ---------- */
  function applyLang(lang) {
    if (lang !== 'th' && lang !== 'en') lang = 'th';
    root.setAttribute('lang', lang);
    root.setAttribute('data-lang', lang);
    var nodes = document.querySelectorAll('[data-i18n-attr]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i], v = el.getAttribute('data-' + lang);
      if (v === null) continue;
      var attr = el.getAttribute('data-i18n-attr');
      if (attr === 'text') el.textContent = v; else el.setAttribute(attr, v);
    }
    var btns = document.querySelectorAll('[data-set-lang]');
    for (var j = 0; j < btns.length; j++) {
      btns[j].setAttribute('aria-pressed', String(btns[j].getAttribute('data-set-lang') === lang));
    }
  }
  function syncUrl(lang) {
    try {
      var u = new URL(window.location.href);
      if (u.searchParams.has('lang')) { u.searchParams.set('lang', lang); window.history.replaceState(null, '', u.toString()); }
    } catch (e) {}
  }
  var startLang = window.__pleLang || root.getAttribute('data-lang') || 'th';
  applyLang(startLang);
  store('ple-lang', startLang);
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-set-lang]') : null;
    if (!b) return;
    var lang = b.getAttribute('data-set-lang');
    applyLang(lang); store('ple-lang', lang); syncUrl(lang);
  });

  /* ---------- the face that follows the pointer ----------
     A 5x5 grid of pre-rendered head poses (yaw -30..+30 deg across the columns, pitch +20..-20 deg down the rows,
     body fixed) is stacked in .look-card, plus a blink frame and nine expression frames. The pointer maps to a
     continuous (col, row) point inside the grid; the point is eased every frame (spring lerp 0.12) and the four
     frames around it are blended with bilinear weights, so the head turns continuously instead of snapping
     between cells. Stacked layers are normalised cumulatively (bottom layer w0/w0, next w1/(w0+w1), ...), which
     gives an exact weighted average of the four images. The card itself gets a small lerped translate and tilt.
     Only opacity and transform change per frame. */
  var card = document.querySelector('.look-card');
  if (!card || !window.requestAnimationFrame) return;
  var COLS = 5, ROWS = 5, CENTRE = { x: 2, y: 2 };
  var poses = [], exprs = {}, blink = null, all = card.querySelectorAll('.look');
  for (var k = 0; k < all.length; k++) {
    var nm = all[k].getAttribute('data-look');
    var m = /^pose-r(\d)c(\d)$/.exec(nm);
    if (m) poses[(+m[1]) * COLS + (+m[2])] = all[k];
    else if (nm === 'pose-blink') blink = all[k];
    else if (nm.indexOf('expr-') === 0) exprs[nm.slice(5)] = all[k];
  }
  if (poses.length !== COLS * ROWS) return;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var noHover = window.matchMedia('(hover: none)');

  var pointer = null, lastInput = performance.now();
  var head = { x: CENTRE.x, y: CENTRE.y }, headT = { x: CENTRE.x, y: CENTRE.y };
  var tilt = { x: 0, y: 0 }, tiltT = { x: 0, y: 0 };
  var raf = 0, visible = true, nextBlink = 0, blinkUntil = 0;
  var shown = {}; /* pose index -> opacity string last written */

  /* preload and decode every frame up front so a blend never shows an empty card */
  for (var p = 0; p < all.length; p++) {
    var im = all[p].querySelector('img');
    if (im && im.decode) im.decode().catch(function () {});
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function n(v) { return Math.round(v * 1000) / 1000; }
  function setOp(el, v) { if (el.style.opacity !== v) el.style.opacity = v; }

  function blend(x, y) {
    var x0 = clamp(Math.floor(x), 0, COLS - 2), y0 = clamp(Math.floor(y), 0, ROWS - 2);
    var fx = clamp(x - x0, 0, 1), fy = clamp(y - y0, 0, 1);
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); /* smoothstep: linger near a pose, cross between poses quickly, still continuous */
    var w = {};
    w[y0 * COLS + x0] = (1 - fx) * (1 - fy);
    w[y0 * COLS + x0 + 1] = fx * (1 - fy);
    w[(y0 + 1) * COLS + x0] = (1 - fx) * fy;
    w[(y0 + 1) * COLS + x0 + 1] = fx * fy;
    var acc = 0;
    for (var i = 0; i < poses.length; i++) { /* DOM order = stacking order, so walk bottom to top */
      var wi = w[i] || 0;
      if (wi < 0.002) { setOp(poses[i], '0'); continue; }
      acc += wi;
      setOp(poses[i], acc > 0 ? String(n(wi / acc)) : '0');
    }
  }
  function resetStatic() {
    for (var i = 0; i < poses.length; i++) poses[i].style.opacity = i === CENTRE.y * COLS + CENTRE.x ? '1' : '0';
    for (var e in exprs) exprs[e].style.opacity = '0';
    if (blink) blink.style.opacity = '0';
    head.x = headT.x = CENTRE.x; head.y = headT.y = CENTRE.y; blinkUntil = 0;
    tilt.x = tilt.y = 0; card.style.transform = '';
  }
  function scheduleBlink(now) { nextBlink = now + 2600 + Math.random() * 3800; }

  /* ---------- expressions: one at a time, cross-fade in CSS, never more than one every 3 s ---------- */
  var exprOn = null, exprUntil = 0, lastExpr = -1e9, EXPR_GAP = 3000;
  function express(name, hold) {
    if (reduce.matches || !exprs[name] || !visible) return false;
    var now = performance.now();
    if (exprOn || now - lastExpr < EXPR_GAP) return false;
    exprOn = name; exprUntil = hold ? now + hold : Infinity; lastExpr = now;
    exprs[name].style.opacity = '1';
    return true;
  }
  function relax() { if (exprOn) { exprs[exprOn].style.opacity = '0'; exprOn = null; } }
  function wake() { lastInput = performance.now(); if (exprOn === 'sleepy') relax(); }

  function frame(now) {
    raf = 0;
    if (reduce.matches || !visible) return;
    /* read phase: one layout read per frame */
    var r = card.getBoundingClientRect();
    var fx = r.left + r.width * 0.5, fy = r.top + r.height * 0.38; /* her face, between the eyes */
    var px = null, py = null;
    if (noHover.matches && now - lastInput > 4000) { /* touch screens: slow idle look-around after the last tap */
      var t = now / 1000, R = Math.max(220, r.width);
      px = fx + Math.sin(t * 0.42) * R; py = fy + Math.sin(t * 0.29 + 1.2) * R * 0.7;
    } else if (pointer) { px = pointer.x; py = pointer.y; }

    if (px === null) { headT.x = CENTRE.x; headT.y = CENTRE.y; tiltT.x = 0; tiltT.y = 0; }
    else {
      var dx = px - fx, dy = py - fy;
      var RX = Math.max(260, r.width * 1.1), RY = Math.max(220, r.height * 0.9); /* full turn about one card away */
      headT.x = CENTRE.x + clamp(dx / RX, -1, 1) * (COLS - 1) / 2;
      headT.y = CENTRE.y + clamp(dy / RY, -1, 1) * (ROWS - 1) / 2;
      tiltT.x = clamp(dx / (window.innerWidth * 0.45), -1, 1); tiltT.y = clamp(dy / (window.innerHeight * 0.45), -1, 1);
    }
    /* spring: ease towards the target so the head lags the pointer a little */
    head.x = lerp(head.x, headT.x, 0.12); head.y = lerp(head.y, headT.y, 0.12);
    if (Math.abs(head.x - headT.x) < 0.002) head.x = headT.x;
    if (Math.abs(head.y - headT.y) < 0.002) head.y = headT.y;

    /* expressions: release a held one, doze off after 20 s without input */
    if (exprOn && now >= exprUntil) relax();
    if (!exprOn && now - lastInput > 20000) express('sleepy', 0);
    if (surpriseAt && now - surpriseAt < 600) { if (express('surprised', 1200)) surpriseAt = 0; }

    /* blink only while she looks nearly straight at you and no expression is on, so the eyes never jump */
    if (!nextBlink) scheduleBlink(now);
    var centred = Math.abs(head.x - CENTRE.x) < 0.35 && Math.abs(head.y - CENTRE.y) < 0.35;
    if (blink) {
      if (!blinkUntil && now >= nextBlink && centred && !exprOn) { blink.style.opacity = '1'; blinkUntil = now + 120; }
      else if (blinkUntil && (now >= blinkUntil || !centred || exprOn)) { blink.style.opacity = '0'; blinkUntil = 0; scheduleBlink(now); }
      else if (!blinkUntil && now >= nextBlink) scheduleBlink(now);
    }

    /* write phase: opacity of the four nearest poses, transform of the card */
    blend(head.x, head.y);
    tilt.x = lerp(tilt.x, tiltT.x, 0.08); tilt.y = lerp(tilt.y, tiltT.y, 0.08);
    card.style.transform = 'translate3d(' + n(tilt.x * 6) + 'px,' + n(tilt.y * 5) + 'px,0) rotateY(' + n(tilt.x * 4) + 'deg) rotateX(' + n(-tilt.y * 4) + 'deg)';
    raf = window.requestAnimationFrame(frame);
  }
  function start() { if (!raf && visible && !reduce.matches) raf = window.requestAnimationFrame(frame); }
  function stop() { if (raf) { window.cancelAnimationFrame(raf); raf = 0; } }

  window.addEventListener('pointermove', function (ev) {
    if (ev.pointerType === 'mouse' || ev.pointerType === 'pen' || !noHover.matches) pointer = { x: ev.clientX, y: ev.clientY };
    wake();
  }, { passive: true });
  window.addEventListener('pointerdown', function (ev) { pointer = { x: ev.clientX, y: ev.clientY }; wake(); }, { passive: true });
  window.addEventListener('keydown', wake, { passive: true });
  document.addEventListener('mouseout', function (ev) { if (!ev.relatedTarget) pointer = null; });

  /* ---------- gentle triggers ---------- */
  var hoverOk = window.matchMedia('(hover: hover)');
  function onHover(selector, name, delay, hold) {
    var nodes = document.querySelectorAll(selector);
    for (var i = 0; i < nodes.length; i++) (function (el) {
      var timer = 0;
      el.addEventListener('pointerenter', function (ev) {
        if (!hoverOk.matches || ev.pointerType === 'touch') return;
        clearTimeout(timer); timer = setTimeout(function () { express(name, hold); }, delay);
      });
      el.addEventListener('pointerleave', function () { clearTimeout(timer); });
    })(nodes[i]);
  }
  onHover('.belief-card', 'thinking', 1000, 1600);  /* a belief read for a second: she thinks about it */
  onHover('.share-card', 'wave', 350, 1800);         /* the "come share" card: hello */
  onHover('.hero .btn', 'shy', 300, 1500);           /* hero buttons: a shy smile */
  var cycle = ['laugh', 'wink', 'heart'], cycleAt = 0;
  card.addEventListener('click', function () {      /* a tap on her: laugh, wink, heart hands in turn */
    wake();
    if (express(cycle[cycleAt % cycle.length], 1500)) cycleAt += 1;
  });
  var surpriseAt = 0, lastScrollY = window.scrollY || 0, lastScrollAt = performance.now();
  window.addEventListener('scroll', function () {   /* a fast scroll: surprised, once it settles */
    var now = performance.now(), y = window.scrollY || 0, dt = now - lastScrollAt;
    if (dt > 0 && dt < 250 && Math.abs(y - lastScrollY) / dt > 2.2 && Math.abs(y - lastScrollY) > 160) surpriseAt = now;
    lastScrollY = y; lastScrollAt = now; wake();
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting; if (visible) start(); else stop();
    }).observe(card);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else { lastInput = performance.now(); start(); } });
  var onReduce = function () { if (reduce.matches) { stop(); resetStatic(); } else start(); };
  if (reduce.addEventListener) reduce.addEventListener('change', onReduce); else if (reduce.addListener) reduce.addListener(onReduce);
  resetStatic();
  start();
})();

/* Decorative props: one loop for pointer depth and a small, eased scroll offset. */
(function () {
  'use strict';
  var nodes = document.querySelectorAll('[data-prop]');
  if (!nodes.length || !window.requestAnimationFrame) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var hover = window.matchMedia('(hover: hover)');
  var items = [];
  var target = { x: 0, y: 0 };
  var current = { x: 0, y: 0 };
  var scrollY = window.scrollY || 0;
  var raf = 0;

  for (var i = 0; i < nodes.length; i++) {
    items.push({
      el: nodes[i],
      depth: Math.min(18, Math.max(0, Number(nodes[i].getAttribute('data-depth')) || 0)),
      scroll: Number(nodes[i].getAttribute('data-scroll')) || 0,
      anchor: 0,
      offset: 0,
      active: true
    });
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function round(value) { return Math.round(value * 100) / 100; }

  /* Read layout only when the page dimensions or language change. */
  function measure() {
    scrollY = window.scrollY || 0;
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      item.anchor = item.el.parentElement.getBoundingClientRect().top + scrollY;
      item.active = window.getComputedStyle(item.el).display !== 'none';
    }
  }

  function frame() {
    raf = 0;
    if (reduce.matches || document.hidden) return;
    current.x += (target.x - current.x) * 0.06;
    current.y += (target.y - current.y) * 0.06;
    for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (!item.active) continue;
      var offset = clamp((scrollY - item.anchor) * item.scroll, -18, 18);
      item.offset += (offset - item.offset) * 0.055;
      item.el.style.transform = 'translate3d(' + round(current.x * item.depth) + 'px,' + round(current.y * item.depth + item.offset) + 'px,0)';
    }
    raf = window.requestAnimationFrame(frame);
  }

  function start() {
    if (!raf && !reduce.matches && !document.hidden) raf = window.requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
  }
  function reset() {
    target.x = target.y = current.x = current.y = 0;
    for (var j = 0; j < items.length; j++) {
      items[j].offset = 0;
      items[j].el.style.transform = '';
    }
  }

  window.addEventListener('pointermove', function (ev) {
    if (!hover.matches || ev.pointerType === 'touch' || reduce.matches) return;
    target.x = clamp(ev.clientX / Math.max(1, window.innerWidth) * 2 - 1, -1, 1);
    target.y = clamp(ev.clientY / Math.max(1, window.innerHeight) * 2 - 1, -1, 1);
  }, { passive: true });
  document.addEventListener('mouseout', function (ev) {
    if (!ev.relatedTarget) target.x = target.y = 0;
  });
  window.addEventListener('scroll', function () { scrollY = window.scrollY || 0; }, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);
  document.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('[data-set-lang]')) measure();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else { measure(); start(); }
  });

  function onReduce() {
    if (reduce.matches) { stop(); reset(); }
    else { measure(); start(); }
  }
  if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
  else if (reduce.addListener) reduce.addListener(onReduce);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

  measure();
  if (reduce.matches) reset();
  start();
})();
