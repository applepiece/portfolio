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

  /* ---------- the face that follows the pointer ----------
     Ten pre-rendered frames (3x3 look directions + a blink) are stacked in .look-card.
     The pointer angle around her face picks a frame; frames cross-fade by opacity and the
     card gets a small lerped translate and tilt. Only opacity and transform change per frame. */
  var card = document.querySelector('.look-card');
  if (!card || !window.requestAnimationFrame) return;
  var looks = {}, all = card.querySelectorAll('.look');
  for (var k = 0; k < all.length; k++) looks[all[k].getAttribute('data-look')] = all[k];
  var SECTORS = ['r', 'dr', 'd', 'dl', 'l', 'ul', 'u', 'ur']; /* 0 deg = right, clockwise because screen y points down */
  var DEAD_IN = 120, DEAD_OUT = 136, HYST = 7; /* px around the face where she looks straight at you; degrees of hysteresis */
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var noHover = window.matchMedia('(hover: none)');

  var pointer = null, lastInput = 0, cur = 'c', swapAt = 0, z = 2;
  var tilt = { x: 0, y: 0 }, tiltT = { x: 0, y: 0 };
  var raf = 0, visible = true, nextBlink = 0, blinkUntil = 0;

  /* preload and decode every frame up front so a swap never shows an empty card */
  for (var p in looks) {
    var im = looks[p].querySelector('img');
    if (im && im.decode) im.decode().catch(function () {});
  }
  for (var q in looks) looks[q].style.opacity = q === 'c' ? '1' : '0';
  looks.c.style.zIndex = '1';

  function clamp(v) { return v < -1 ? -1 : v > 1 ? 1 : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function n(v) { return Math.round(v * 1000) / 1000; }

  function pick(dx, dy) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < (cur === 'c' ? DEAD_OUT : DEAD_IN)) return 'c';
    var ang = Math.atan2(dy, dx) * 180 / Math.PI; /* -180..180 */
    var idx = ((Math.round(ang / 45) % 8) + 8) % 8;
    var ci = SECTORS.indexOf(cur);
    if (ci >= 0 && ci !== idx) { /* stay on the current frame until the pointer is clearly past the boundary */
      var diff = Math.abs(((ang - ci * 45) % 360 + 540) % 360 - 180);
      if (diff < 22.5 + HYST) return cur;
    }
    return SECTORS[idx];
  }
  function show(name) {
    if (name === cur) return;
    var el = looks[name];
    z += 1; el.style.zIndex = String(z); el.style.opacity = '1';
    cur = name; swapAt = performance.now();
  }
  function settle(now) { /* once the new frame is fully in, hide the ones underneath */
    if (!swapAt || now - swapAt < 170) return;
    for (var nm in looks) if (nm !== cur && nm !== 'blink' && looks[nm].style.opacity !== '0') looks[nm].style.opacity = '0';
    swapAt = 0;
    if (z > 5000) { z = 2; looks[cur].style.zIndex = '2'; }
  }
  function scheduleBlink(now) { nextBlink = now + 2600 + Math.random() * 3800; }
  function resetStatic() {
    for (var nm in looks) { looks[nm].style.opacity = nm === 'c' ? '1' : '0'; looks[nm].style.zIndex = nm === 'c' ? '1' : ''; }
    cur = 'c'; swapAt = 0; tilt.x = tilt.y = 0; card.style.transform = '';
  }

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

    if (px === null) { show('c'); tiltT.x = 0; tiltT.y = 0; }
    else {
      var dx = px - fx, dy = py - fy;
      show(pick(dx, dy));
      tiltT.x = clamp(dx / (window.innerWidth * 0.45)); tiltT.y = clamp(dy / (window.innerHeight * 0.45));
    }
    settle(now);

    /* blink only while she looks straight at you, so the frame never jumps */
    if (!nextBlink) scheduleBlink(now);
    var bl = looks.blink;
    if (bl) {
      if (!blinkUntil && now >= nextBlink && cur === 'c' && !swapAt) {
        bl.style.zIndex = String(z + 1); bl.style.opacity = '1'; blinkUntil = now + 120;
      } else if (blinkUntil && (now >= blinkUntil || cur !== 'c')) {
        bl.style.opacity = '0'; blinkUntil = 0; scheduleBlink(now);
      } else if (!blinkUntil && now >= nextBlink) scheduleBlink(now);
    }

    /* write phase: transform only */
    tilt.x = lerp(tilt.x, tiltT.x, 0.08); tilt.y = lerp(tilt.y, tiltT.y, 0.08);
    card.style.transform = 'translate3d(' + n(tilt.x * 6) + 'px,' + n(tilt.y * 5) + 'px,0) rotateY(' + n(tilt.x * 4) + 'deg) rotateX(' + n(-tilt.y * 4) + 'deg)';
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
  document.addEventListener('mouseout', function (ev) { if (!ev.relatedTarget) pointer = null; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting; if (visible) start(); else stop();
    }).observe(card);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  var onReduce = function () { if (reduce.matches) { stop(); resetStatic(); } else start(); };
  if (reduce.addEventListener) reduce.addEventListener('change', onReduce); else if (reduce.addListener) reduce.addListener(onReduce);
  if (reduce.matches) resetStatic();
  start();
})();
