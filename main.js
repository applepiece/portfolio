/* Ple Chusorn portfolio: theme, TH/EN switch, and the hero face that follows the pointer. No libraries. */
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

  /* ---------- the face that follows the pointer ---------- */
  var svg = document.querySelector('.woman');
  if (!svg || !window.requestAnimationFrame) return;
  var head = svg.querySelector('.w-head'), face = svg.querySelector('.w-face');
  var hairB = svg.querySelector('.w-hair-back'), hairF = svg.querySelector('.w-hair-front');
  var bodyG = svg.querySelector('.w-body');
  var pupils = svg.querySelectorAll('.pupil'), eyes = svg.querySelectorAll('.eye'), brows = svg.querySelectorAll('.brow');
  var PX = 200, PY = 300; /* neck pivot in SVG units */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var noHover = window.matchMedia('(hover: none)');

  var target = { x: 0, y: 0 }, pointer = null, lastInput = 0;
  var eyeS = { x: 0, y: 0 }, headS = { x: 0, y: 0 };
  function spring(k, d) { return { x: 0, y: 0, vx: 0, vy: 0, k: k, d: d }; }
  var backS = spring(0.045, 0.82), frontS = spring(0.07, 0.76);
  var raf = 0, visible = true, nextBlink = 0, blinkStart = -1;

  function clamp(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function n(v) { return Math.round(v * 100) / 100; }
  function step(s, tx, ty) {
    s.vx = (s.vx + (tx - s.x) * s.k) * s.d; s.vy = (s.vy + (ty - s.y) * s.k) * s.d;
    s.x += s.vx; s.y += s.vy;
  }
  function pose(g, x, y, rot) {
    g.setAttribute('transform', 'translate(' + n(x) + ' ' + n(y) + ') rotate(' + n(rot) + ' ' + PX + ' ' + PY + ')');
  }
  function reset() {
    [head, face, hairB, hairF, bodyG].forEach(function (g) { if (g) g.removeAttribute('transform'); });
    [].forEach.call(pupils, function (g) { g.removeAttribute('transform'); });
    [].forEach.call(eyes, function (g) { g.removeAttribute('transform'); });
    [].forEach.call(brows, function (g) { g.removeAttribute('transform'); });
  }
  function scheduleBlink(now) { nextBlink = now + 2400 + Math.random() * 3600; }

  function frame(now) {
    raf = 0;
    if (reduce.matches || !visible) return;
    /* read phase: one layout read per frame, before any write */
    if (pointer) {
      var r = svg.getBoundingClientRect();
      var cx = r.left + r.width * 0.5, cy = r.top + r.height * 0.44;
      target.x = clamp((pointer.x - cx) / (window.innerWidth * 0.42));
      target.y = clamp((pointer.y - cy) / (window.innerHeight * 0.42));
    }
    if (noHover.matches && now - lastInput > 4000) { /* gentle look-around on touch screens */
      var t = now / 1000;
      target.x = Math.sin(t * 0.55) * 0.65; target.y = Math.sin(t * 0.37 + 1) * 0.35;
    }
    eyeS.x = lerp(eyeS.x, target.x, 0.2); eyeS.y = lerp(eyeS.y, target.y, 0.2);
    headS.x = lerp(headS.x, target.x, 0.09); headS.y = lerp(headS.y, target.y, 0.09);
    step(backS, headS.x, headS.y); step(frontS, headS.x, headS.y);

    /* write phase: transforms only */
    var rot = headS.x * 6 - headS.y * headS.x * 1.5;
    pose(head, headS.x * 5, headS.y * 4, rot);
    face.setAttribute('transform', 'translate(' + n(eyeS.x * 6) + ' ' + n(eyeS.y * 5) + ')');
    var px = n(eyeS.x * 4.6), py = n(eyeS.y * 3.4);
    for (var i = 0; i < pupils.length; i++) pupils[i].setAttribute('transform', 'translate(' + px + ' ' + py + ')');
    var lift = n(Math.min(0, eyeS.y) * 3);
    for (var b = 0; b < brows.length; b++) brows[b].setAttribute('transform', 'translate(0 ' + lift + ')');
    pose(hairB, backS.x * 3.5, backS.y * 3, backS.x * 6 - backS.y * backS.x * 1.5);
    pose(hairF, frontS.x * 6.5, frontS.y * 5, frontS.x * 6 - frontS.y * frontS.x * 1.5);
    bodyG.setAttribute('transform', 'translate(' + n(headS.x * 1.5) + ' 0)');

    /* idle blink every few seconds */
    if (!nextBlink) scheduleBlink(now);
    if (blinkStart < 0 && now >= nextBlink) blinkStart = now;
    var sy = 1;
    if (blinkStart >= 0) {
      var p = (now - blinkStart) / 160;
      if (p >= 1) { blinkStart = -1; scheduleBlink(now); } else sy = 1 - 0.92 * Math.sin(Math.PI * p);
    }
    for (var e = 0; e < eyes.length; e++) {
      var ex = eyes[e].getAttribute('data-cx'), ey = eyes[e].getAttribute('data-cy');
      if (sy === 1) eyes[e].removeAttribute('transform');
      else eyes[e].setAttribute('transform', 'translate(' + ex + ' ' + ey + ') scale(1 ' + n(sy) + ') translate(' + (-ex) + ' ' + (-ey) + ')');
    }
    raf = window.requestAnimationFrame(frame);
  }
  function start() { if (!raf && visible && !reduce.matches) raf = window.requestAnimationFrame(frame); }
  function stop() { if (raf) { window.cancelAnimationFrame(raf); raf = 0; } }

  window.addEventListener('pointermove', function (ev) {
    if (ev.pointerType === 'mouse' || ev.pointerType === 'pen' || !noHover.matches) {
      pointer = { x: ev.clientX, y: ev.clientY }; lastInput = performance.now();
    }
  }, { passive: true });
  window.addEventListener('pointerdown', function (ev) {
    pointer = { x: ev.clientX, y: ev.clientY }; lastInput = performance.now();
  }, { passive: true });
  window.addEventListener('mouseout', function (ev) { if (!ev.relatedTarget) { pointer = null; target.x = 0; target.y = 0; } });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting; if (visible) start(); else stop();
    }).observe(svg);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  var onReduce = function () { if (reduce.matches) { stop(); reset(); } else start(); };
  if (reduce.addEventListener) reduce.addEventListener('change', onReduce); else if (reduce.addListener) reduce.addListener(onReduce);
  start();
})();
