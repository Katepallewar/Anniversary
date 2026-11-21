/* ==========================================================================
   Nikita & Parimal · One Year of Us — behaviour
   Sections: helpers · content binding · scene engine · input · envelope ·
             hero · scrapbook · lightbox · timeline · letter · finale ·
             music · particles (fx) · boot
   No dependencies. Everything personal lives in config.js.
   ========================================================================== */
(() => {
  'use strict';

  const CFG = window.ANNIVERSARY;
  if (!CFG) { console.error('config.js did not load'); return; }

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const pad = n => String(n).padStart(2, '0');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(pointer: fine)').matches;
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  /* ---------- content binding ---------- */
  const [WY, WM, WD] = CFG.weddingDate.split('-').map(Number);
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const bindings = {
    first: CFG.names.first,
    second: CFG.names.second,
    dateDots: `${pad(WD)} · ${pad(WM)} · ${WY}`,
    dateLong: `${WD} ${MONTHS[WM - 1]} ${WY}`
  };
  $$('[data-bind]').forEach(el => { el.textContent = bindings[el.dataset.bind] ?? ''; });
  document.title = `${CFG.names.first} & ${CFG.names.second} · One Year of Us`;

  // split headline text into letters for the staggered reveal
  $$('[data-split]').forEach(el => {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.textContent = '';
    [...text].forEach((c, i) => {
      const w = document.createElement('span');
      w.className = 'ch';
      w.setAttribute('aria-hidden', 'true');
      w.style.setProperty('--i', i);
      const k = document.createElement('i');
      k.textContent = c === ' ' ? ' ' : c;
      w.append(k);
      el.append(w);
    });
  });

  // hero photograph (opening backdrop + arch). Broken images fall back to gradients.
  $$('img[data-hero]').forEach(img => {
    img.addEventListener('error', () => img.classList.add('is-broken'));
    img.alt = img === $('.arch-img img') ? (CFG.heroPhoto.alt || '') : '';
    img.src = CFG.heroPhoto.src;
  });

  /* ======================================================================
     SCENE ENGINE
     ====================================================================== */
  const stage = $('#stage');
  const scenes = $$('.scene', stage);
  // belt and braces: focus() or scrollIntoView() must never shift the fixed stage
  [stage, ...scenes].forEach(el => el.addEventListener('scroll', () => { el.scrollTop = 0; el.scrollLeft = 0; }));
  const LAST = scenes.length - 1;
  const hooks = {};            // per-scene enter/leave callbacks
  let cur = -1;
  let lockUntil = 0;
  let unlocked = false;        // the envelope must be opened once
  let themeTimer;

  const modalOpen = () => Lightbox.isOpen() || Music.isPanelOpen();

  function go(n) {
    n = clamp(n, 0, LAST);
    if (n === cur) return;
    const prev = cur;
    cur = n;
    lockUntil = performance.now() + (RM ? 450 : 1350);

    scenes.forEach((s, i) => {
      const involved = i === n || i === prev;
      if (!involved) s.style.transition = 'none';   // skipped scenes: snap, don't animate
      s.dataset.state = i < n ? 'behind' : i > n ? 'ahead' : 'active';
      s.classList.toggle('active', i === n);
      s.toggleAttribute('inert', i !== n);
      if (!involved) { void s.offsetWidth; s.style.transition = ''; }
    });

    // chrome follows the new scene (slightly delayed so it matches the wipe)
    clearTimeout(themeTimer);
    themeTimer = setTimeout(() => {
      document.body.dataset.theme = scenes[n].dataset.theme;
    }, prev === -1 ? 0 : 450);
    document.body.classList.toggle('is-intro', n === 0);
    document.body.classList.toggle('is-last', n === LAST);
    updateChrome(n);

    if (prev >= 0 && hooks[prev]?.leave) hooks[prev].leave();
    if (hooks[n]?.enter) hooks[n].enter();
    // clear parallax offset on the new scene
    scenes[n].style.setProperty('--px', 0);
    scenes[n].style.setProperty('--py', 0);
  }

  function step(dir) {
    if (performance.now() < lockUntil || modalOpen()) return;
    if (cur === 0 && (!unlocked || dir < 0)) return;
    go(cur + dir);
  }

  /* ---------- chrome: rail, chapter label, cue ---------- */
  const rail = $('#rail');
  const chLabel = $('#chapterLabel'), chNum = $('#chNum'), chTitle = $('#chTitle');
  scenes.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'rail-dot';
    b.type = 'button';
    b.setAttribute('aria-label', `Chapter ${ROMAN[i]}: ${s.dataset.name}`);
    b.innerHTML = `<i></i><span>${s.dataset.name}</span>`;
    b.addEventListener('click', () => {
      if (performance.now() < lockUntil || modalOpen()) return;
      go(i);
    });
    rail.append(b);
  });
  let labelTimer;
  function updateChrome(n) {
    $$('.rail-dot', rail).forEach((b, i) => b.setAttribute('aria-current', String(i === n)));
    rail.style.setProperty('--p', n / LAST);
    chLabel.classList.add('swap');
    clearTimeout(labelTimer);
    labelTimer = setTimeout(() => {
      chNum.textContent = ROMAN[n];
      chTitle.textContent = scenes[n].dataset.name;
      chLabel.classList.remove('swap');
    }, 350);
  }
  $('#nextCue').addEventListener('click', () => step(1));

  /* ======================================================================
     INPUT — wheel, touch, keyboard
     ====================================================================== */
  function canScroll(el, dir) {
    if (!el || el.scrollHeight <= el.clientHeight + 1) return false;
    return dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0;
  }

  let lastWheel = 0, wheelUsed = false;
  window.addEventListener('wheel', e => {
    if (modalOpen()) return;
    e.preventDefault();
    const now = performance.now();
    if (now - lastWheel > 140) wheelUsed = false;      // a new gesture
    lastWheel = now;
    const dir = Math.sign(e.deltaY);
    if (!dir || wheelUsed) return;
    const sc = e.target.closest?.('[data-scroll]');
    if (canScroll(sc, dir)) {                          // let long content scroll first
      sc.scrollTop += e.deltaY;
      wheelUsed = true;
      return;
    }
    if (Math.abs(e.deltaY) < 10 || now < lockUntil) return;
    wheelUsed = true;
    step(dir);
  }, { passive: false });

  let touch = null;
  window.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { touch = null; return; }
    const t = e.touches[0];
    touch = { x: t.clientX, y: t.clientY, t: performance.now(), target: e.target };
  }, { passive: true });
  window.addEventListener('touchend', e => {
    if (!touch || modalOpen()) { touch = null; return; }
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    const { target, t: t0 } = touch;
    touch = null;
    if (target.closest?.('[data-nonav],input,button,label')) return;
    if (performance.now() - t0 > 900) return;
    if (Math.abs(dy) < 56 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
    const dir = dy < 0 ? 1 : -1;
    const sc = target.closest?.('[data-scroll]');
    if (canScroll(sc, dir)) return;
    step(dir);
  }, { passive: true });

  window.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || Lightbox.isOpen()) return;
    if (e.key === 'Escape') { Music.closePanel(); return; }
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const onButton = tag === 'BUTTON' || tag === 'A' || tag === 'LABEL' || e.target.getAttribute('role') === 'button';
    let dir = 0;
    switch (e.key) {
      case 'ArrowDown': case 'PageDown': dir = 1; break;
      case 'ArrowUp': case 'PageUp': dir = -1; break;
      case ' ': if (onButton) return; dir = e.shiftKey ? -1 : 1; break;
      case 'ArrowRight': if (cur === 3 && Timeline.step(1)) { e.preventDefault(); return; } dir = 1; break;
      case 'ArrowLeft': if (cur === 3 && Timeline.step(-1)) { e.preventDefault(); return; } dir = -1; break;
      default: return;
    }
    const sc = e.target.closest?.('[data-scroll]');
    if (canScroll(sc, dir) && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'PageDown' || e.key === 'PageUp')) return;
    e.preventDefault();
    step(dir);
  });

  // gentle pointer parallax on the active scene (desktop only)
  if (!RM && FINE) {
    let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
    const tick = () => {
      cx += (tx - cx) * .08; cy += (ty - cy) * .08;
      const s = scenes[cur];
      if (s) { s.style.setProperty('--px', cx.toFixed(3)); s.style.setProperty('--py', cy.toFixed(3)); }
      raf = (Math.abs(tx - cx) > .002 || Math.abs(ty - cy) > .002) ? requestAnimationFrame(tick) : 0;
    };
    window.addEventListener('pointermove', e => {
      tx = (e.clientX / innerWidth - .5) * 2;
      ty = (e.clientY / innerHeight - .5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
  }

  /* ======================================================================
     SCENE 1 — THE ENVELOPE
     ====================================================================== */
  const openScene = scenes[0];
  const envelope = $('#envelope');
  let opening = false;
  function openEnvelope() {
    if (opening) return;
    opening = true;
    unlocked = true;
    openScene.classList.add('is-opening');
    envelope.classList.add('is-open');
    envelope.setAttribute('aria-expanded', 'true');
    setTimeout(() => openScene.classList.add('is-bloom'), RM ? 100 : 2000);
    setTimeout(() => { lockUntil = 0; go(1); }, RM ? 600 : 2900);
  }
  function resetEnvelope() {
    opening = false;
    openScene.classList.remove('is-opening', 'is-bloom');
    envelope.classList.remove('is-open');
    envelope.removeAttribute('aria-expanded');
  }
  envelope.addEventListener('click', openEnvelope);
  hooks[0] = { leave() { setTimeout(() => { if (cur !== 0) resetEnvelope(); }, 1500); } };

  /* ======================================================================
     SCENE 2 — HERO: live day counter + floating elements
     ====================================================================== */
  function daysTogether() {
    const t = new Date();
    const a = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.max(0, Math.round((a - Date.UTC(WY, WM - 1, WD)) / 864e5));
  }
  const daysEl = $('#daysCount');
  let countRaf;
  function countUp(target) {
    cancelAnimationFrame(countRaf);
    if (RM) { daysEl.textContent = target; return; }
    daysEl.textContent = '0';
    const t0 = performance.now() + 1100, dur = 2000;
    const tick = now => {
      const k = clamp((now - t0) / dur, 0, 1);
      daysEl.textContent = Math.round((1 - Math.pow(1 - k, 4)) * target);
      if (k < 1) countRaf = requestAnimationFrame(tick);
    };
    countRaf = requestAnimationFrame(tick);
  }
  hooks[1] = { enter() { countUp(daysTogether()); } };

  (function buildFloaters() {
    const box = $('.floaters');
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span');
      const petal = i % 3 === 0;
      s.className = 'fl ' + (petal ? 'fl--petal' : 'fl--spark');
      const size = petal ? rand(9, 17) : rand(7, 15);
      s.style.cssText = `left:${rand(2, 96)}%;top:${rand(4, 92)}%;--s:${size}px;--o:${rand(.35, .8).toFixed(2)};` +
        `--t:${rand(9, 18).toFixed(1)}s;--dl:${(-rand(0, 14)).toFixed(1)}s;` +
        `--dx:${rand(-60, 60).toFixed(0)}px;--dy:${rand(-90, 40).toFixed(0)}px;--rot:${rand(-200, 200).toFixed(0)}deg`;
      box.append(s);
    }
  })();

  /* ======================================================================
     SCENE 3 — THE SCRAPBOOK
     ====================================================================== */
  const board = $('#board');
  const boardEmpty = $('#boardEmpty');
  const photos = [];
  let zTop = 10;

  function makePolaroid(p, isNew) {
    const el = document.createElement('div');
    el.className = 'polaroid' + (isNew ? ' is-new' : '');
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Open photo: ${p.caption}`);
    el.setAttribute('data-nonav', '');
    el.innerHTML = '<span class="tape"></span><div class="ph"><img draggable="false" decoding="async" alt=""></div><div class="cap"></div>';
    const img = $('img', el);
    img.alt = p.alt || p.caption;
    img.addEventListener('error', () => el.classList.add('noimg'));
    img.src = p.src;
    $('.cap', el).textContent = p.caption;
    p.el = el;
    p.rot = (Math.random() < .5 ? -1 : 1) * rand(1.5, 6.5);
    p.z = ++zTop;
    p.moved = false;
    el.style.setProperty('--rot', p.rot.toFixed(2) + 'deg');
    el.style.zIndex = p.z;
    el.style.setProperty('--i', photos.length);
    attachDrag(p);
    board.append(el);
  }

  function place(p) {
    const BW = board.clientWidth, BH = board.clientHeight;
    const h = p.el.offsetHeight || p.w * 1.3;
    p.el.style.left = (p.fx * BW - p.w / 2) + 'px';
    p.el.style.top = (p.fy * BH - h / 2) + 'px';
  }

  function layoutBoard() {
    const BW = board.clientWidth, BH = board.clientHeight;
    const n = photos.length;
    boardEmpty.hidden = n > 0;
    if (!BW || !BH || !n) return;
    let best = { w: 0, c: 1, r: n };
    for (let c = 1; c <= n; c++) {
      const r = Math.ceil(n / c);
      const w = Math.min(BW / c * 1.02, BH / r / 1.42, 280);
      if (w > best.w) best = { w, c, r };
    }
    const { w, c, r } = best;
    const cw = BW / c, ch = BH / r;
    photos.forEach((p, i) => {
      p.w = Math.min(w, BW - 8);
      p.el.style.setProperty('--w', p.w.toFixed(0) + 'px');
      if (!p.moved) {
        const row = Math.floor(i / c), col = i % c;
        const inRow = row === r - 1 ? n - row * c : c;     // centre a short last row
        const off = (c - inRow) * cw / 2;
        const jx = rand(-.1, .1) * cw, jy = rand(-.08, .08) * ch;
        const x = clamp(off + col * cw + cw / 2 + jx, p.w / 2 + 6, Math.max(BW - p.w / 2 - 6, p.w / 2 + 6));
        const y = clamp(row * ch + ch / 2 + jy, p.w * .65 + 4, Math.max(BH - p.w * .65 - 4, p.w * .65 + 4));
        p.fx = x / BW; p.fy = y / BH;
      }
      place(p);
    });
  }

  function attachDrag(p) {
    const el = p.el;
    let drag = null;
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = board.getBoundingClientRect();
      drag = {
        sx: e.clientX, sy: e.clientY, moved: false,
        ox: e.clientX - (rect.left + p.fx * rect.width),
        oy: e.clientY - (rect.top + p.fy * rect.height)
      };
      p.z = ++zTop; el.style.zIndex = p.z;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
        drag.moved = true;
        el.classList.add('dragging');
      }
      const rect = board.getBoundingClientRect();
      p.fx = clamp((e.clientX - drag.ox - rect.left) / rect.width, .02, .98);
      p.fy = clamp((e.clientY - drag.oy - rect.top) / rect.height, .02, .98);
      p.moved = true;
      el.style.transition = 'transform .3s var(--ease-out),box-shadow .3s';   // no left/top easing while dragging
      place(p);
    });
    const end = (e, cancelled) => {
      if (!drag) return;
      const wasMoved = drag.moved;
      drag = null;
      el.classList.remove('dragging');
      el.style.transition = '';
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!wasMoved && !cancelled) Lightbox.open(photos.indexOf(p), el);
    };
    el.addEventListener('pointerup', e => end(e, false));
    el.addEventListener('pointercancel', e => end(e, true));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); Lightbox.open(photos.indexOf(p), el); }
    });
  }

  CFG.photos.forEach(ph => { const p = { ...ph }; makePolaroid(p, false); photos.push(p); });
  new ResizeObserver(layoutBoard).observe(board);
  layoutBoard();

  $('#upload').addEventListener('change', e => {
    const files = [...e.target.files].filter(f => f.type.startsWith('image/'));
    if (!files.length) { toast('Please choose image files'); e.target.value = ''; return; }
    files.forEach(f => {
      const p = { src: URL.createObjectURL(f), caption: 'a favourite memory', alt: 'A photo you added' };
      makePolaroid(p, true);
      photos.push(p);
    });
    layoutBoard();
    toast(files.length === 1 ? 'Added to the scrapbook ♡' : `${files.length} memories added ♡`);
    e.target.value = '';
  });
  hooks[2] = { enter() { layoutBoard(); } };

  /* ======================================================================
     LIGHTBOX
     ====================================================================== */
  const Lightbox = (() => {
    const box = $('#lightbox'), frame = $('.lb-frame', box), img = $('#lbImg');
    const cap = $('#lbCap'), count = $('#lbCount');
    let idx = 0, opener = null, open = false;

    function show(i, animate = true) {
      idx = (i + photos.length) % photos.length;
      const p = photos[idx];
      const apply = () => {
        box.classList.remove('noimg');
        img.alt = p.alt || p.caption;
        img.onerror = () => box.classList.add('noimg');
        img.src = p.src;
        cap.textContent = p.caption;
        count.textContent = `${idx + 1} / ${photos.length}`;
        frame.classList.remove('swap');
      };
      if (animate && !RM) { frame.classList.add('swap'); setTimeout(apply, 220); } else apply();
    }
    function openAt(i, from) {
      if (!photos.length) return;
      opener = from || null; open = true;
      box.classList.add('open');
      show(i, false);
      $('#lbClose').focus({ preventScroll: true });
    }
    function close() {
      if (!open) return;
      open = false;
      box.classList.remove('open');
      opener?.focus?.({ preventScroll: true });
    }
    const nav = d => show(idx + d);
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => nav(-1));
    $('#lbNext').addEventListener('click', () => nav(1));
    box.addEventListener('click', e => { if (e.target === box || e.target.classList.contains('lb-fig')) close(); });
    window.addEventListener('keydown', e => {
      if (!open) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') nav(1);
      else if (e.key === 'ArrowLeft') nav(-1);
      else if (e.key === 'Tab') {                       // keep focus inside the dialog
        const f = $$('button', box);
        const i = f.indexOf(document.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    let sx = null;                                      // swipe between photos
    box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => {
      if (sx == null) return;
      const dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50) nav(dx < 0 ? 1 : -1);
    }, { passive: true });
    return { open: openAt, close, isOpen: () => open };
  })();

  /* ======================================================================
     SCENE 4 — TIMELINE
     ====================================================================== */
  const Timeline = (() => {
    const items = CFG.timeline;
    const nodes = $('#tlNodes'), fill = $('#tlFill'), detail = $('#tlDetail');
    const dEl = $('#tlDate'), tEl = $('#tlTitle'), xEl = $('#tlText'), next = $('#tlNext');
    const n = items.length;
    let idx = -1, timer, swapTimer;
    $('#tl').style.setProperty('--n', n);

    items.forEach((it, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tl-node';
      b.setAttribute('data-nonav', '');
      b.innerHTML = '<span class="dot"></span><span class="lab"></span>';
      $('.lab', b).textContent = it.label || it.title;
      b.addEventListener('click', () => select(i));
      li.append(b);
      nodes.append(li);
    });

    function select(i) {
      i = clamp(i, 0, n - 1);
      if (i === idx) return;
      const first = idx === -1;
      idx = i;
      $$('.tl-node', nodes).forEach((b, k) => {
        b.classList.toggle('is-active', k === i);
        b.classList.toggle('is-done', k < i);
        b.setAttribute('aria-current', String(k === i));
      });
      fill.style.setProperty('--p', n > 1 ? i / (n - 1) : 0);
      const apply = () => {
        dEl.textContent = items[i].date || '';
        tEl.textContent = items[i].title;
        xEl.textContent = items[i].text;
        detail.classList.remove('is-swap');
      };
      clearTimeout(swapTimer);
      if (first || RM) apply(); else { detail.classList.add('is-swap'); swapTimer = setTimeout(apply, 260); }
      next.textContent = i < n - 1 ? 'Next moment →' : 'Continue the story ↓';
    }
    function reset() {
      clearTimeout(timer);
      idx = -1;
      $$('.tl-node', nodes).forEach(b => b.classList.remove('is-active', 'is-done'));
      fill.style.setProperty('--p', 0);
      dEl.textContent = tEl.textContent = xEl.textContent = '';
      next.textContent = 'Next moment →';
      timer = setTimeout(() => select(0), RM ? 100 : 1300);
    }
    next.addEventListener('click', () => { if (idx < n - 1) select(idx + 1); else step(1); });
    // returns true if it handled the key (so the scene doesn't change)
    function stepBy(d) {
      if (idx === -1) return true;
      const t = idx + d;
      if (t < 0 || t > n - 1) return false;
      select(t);
      return true;
    }
    hooks[3] = { enter: reset, leave() { clearTimeout(timer); } };
    return { step: stepBy };
  })();

  /* ======================================================================
     SCENE 5 — THE LETTER
     ====================================================================== */
  (function buildLetter() {
    const L = CFG.letter;
    $('#letterEyebrow').textContent = L.eyebrow || '';
    const paper = $('#paper');
    let i = 0;
    const add = (tag, cls, text) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      el.setAttribute('data-r', '');
      el.style.setProperty('--i', i++);
      paper.append(el);
      return el;
    };
    add('p', 'salute script', L.salutation);
    L.paragraphs.forEach(t => add('p', 'body', t));
    add('p', 'close', L.closing);
    const sign = document.createElement('div');
    sign.className = 'sign';
    sign.style.setProperty('--i', i);
    const span = document.createElement('span');
    span.textContent = L.signature;
    sign.append(span);
    paper.append(sign);
    const hint = () => paper.classList.toggle('more', canScroll(paper, 1));
    paper.addEventListener('scroll', hint, { passive: true });
    window.addEventListener('resize', hint);
    hooks[4] = { enter() { paper.scrollTop = 0; [300, 1800, 4500].forEach(t => setTimeout(hint, t)); } };
  })();

  /* ======================================================================
     SCENE 6 — FINALE
     ====================================================================== */
  $('#finaleMsg').textContent = CFG.finale.message;
  const finale = scenes[5];
  const note = $('#finaleNote');
  let noteTimer;
  function showNote(text) {
    note.classList.remove('show');
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note.textContent = text; note.classList.add('show'); }, 250);
  }
  let lastF = -1, lastD = -1;
  const fresh = (arr, last) => { let i; do { i = Math.floor(Math.random() * arr.length); } while (arr.length > 1 && i === last); return i; };
  $('#fortune').addEventListener('click', () => { lastF = fresh(CFG.fortunes, lastF); showNote('✧ ' + CFG.fortunes[lastF]); if (!RM) FX.firework(innerWidth * rand(.3, .7), innerHeight * rand(.25, .45)); });
  $('#dateIdea').addEventListener('click', () => { lastD = fresh(CFG.dateIdeas, lastD); showNote('Your next date: ' + CFG.dateIdeas[lastD]); });
  $('#celebrate').addEventListener('click', () => {
    finale.classList.add('is-celebrating');
    setTimeout(() => finale.classList.remove('is-celebrating'), 5000);
    if (RM) { toast(`Happy anniversary, ${CFG.names.first} & ${CFG.names.second} ♡`); return; }
    FX.show();
  });
  $('#replay').addEventListener('click', () => {
    unlocked = false;
    resetEnvelope();
    note.classList.remove('show');
    lockUntil = 0;
    go(0);
  });
  finale.addEventListener('click', e => {                 // tap the night sky for a firework
    if (RM || e.target.closest('button,a,input,label')) return;
    FX.firework(e.clientX, e.clientY);
  });
  hooks[5] = {
    enter() { if (!RM) setTimeout(() => { if (cur === 5) FX.show(true); }, 1500); },
    leave() { note.classList.remove('show'); }
  };

  /* ======================================================================
     MUSIC
     ====================================================================== */
  const Music = (() => {
    const root = $('#music'), btn = $('#musicToggle'), label = $('#musicLabel');
    const edit = $('#musicEdit'), panel = $('#musicPanel'), input = $('#musicUrl');
    const KEY = 'anniversary.song';
    let src = null, audio = null, ytFrame = null, playing = false, ytId = null;

    const saved = () => { try { return localStorage.getItem(KEY) || ''; } catch { return ''; } };
    const parse = raw => {
      const u = (raw || '').trim();
      if (!u) return null;
      const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
      if (yt) return { type: 'yt', id: yt[1] };
      if (/spotify\.com|spotify:/i.test(u)) return { type: 'bad', why: "Spotify links can't play inside a web page. Use an mp3 link or a YouTube link." };
      if (/^(https?:)?\/\//i.test(u) || /^[\w./-]+\.(mp3|m4a|aac|ogg|oga|wav|webm|flac)(\?.*)?$/i.test(u)) return { type: 'audio', url: u };
      return { type: 'bad', why: "That doesn't look like a valid song link." };
    };

    function setState(on) {
      playing = on;
      root.classList.toggle('is-playing', on);
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', on ? 'Pause music' : src ? 'Play music' : 'Add a song');
      label.textContent = on ? 'Playing' : src ? (CFG.song.title || 'Play music') : 'Add a song';
    }
    function fadeTo(a, to, ms, done) {
      try {
        if (RM) { a.volume = to; done?.(); return; }
        const from = a.volume, t0 = performance.now();
        const f = now => {
          const k = clamp((now - t0) / ms, 0, 1);
          a.volume = clamp(from + (to - from) * k, 0, 1);
          if (k < 1) requestAnimationFrame(f); else done?.();
        };
        requestAnimationFrame(f);
      } catch { done?.(); }
    }
    function fail(msg) {
      setState(false);
      toast(msg || "That song couldn't be played. Check the link in the music settings (♪).");
    }
    const ytCmd = fn => ytFrame?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: fn, args: [] }), '*');

    async function play() {
      if (!src) { openPanel(); return; }
      if (src.type === 'audio') {
        if (!audio) {
          audio = new Audio();
          audio.loop = true;
          audio.preload = 'auto';
          audio.addEventListener('error', () => fail());
          audio.src = src.url;
        }
        try {
          audio.volume = 0;
          await audio.play();
          fadeTo(audio, .75, 1500);
          setState(true);
        } catch (err) {
          if (err && err.name === 'AbortError') return;
          fail();
        }
      } else if (src.type === 'yt') {
        if (!ytFrame) {
          ytFrame = document.createElement('iframe');
          const origin = location.protocol.startsWith('http') ? `&origin=${encodeURIComponent(location.origin)}` : '';
          ytFrame.src = `https://www.youtube-nocookie.com/embed/${src.id}?enablejsapi=1&autoplay=1&controls=0&loop=1&playlist=${src.id}&playsinline=1${origin}`;
          ytFrame.allow = 'autoplay; encrypted-media';
          ytFrame.title = 'Background music';
          ytFrame.setAttribute('aria-hidden', 'true');
          ytFrame.tabIndex = -1;
          ytFrame.style.cssText = 'position:fixed;width:2px;height:2px;left:-10px;bottom:-10px;border:0;opacity:0;pointer-events:none';
          document.body.append(ytFrame);
        } else ytCmd('playVideo');
        setState(true);
      }
    }
    function pause() {
      if (src?.type === 'audio' && audio) fadeTo(audio, 0, 600, () => audio.pause());
      else if (src?.type === 'yt') ytCmd('pauseVideo');
      setState(false);
    }
    function teardown() {
      if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
      if (ytFrame) { ytFrame.remove(); ytFrame = null; }
      playing = false;
    }
    function useSource(raw, autoplay) {
      teardown();
      const s = parse(raw);
      if (s && s.type === 'bad') { src = null; setState(false); toast(s.why); return false; }
      src = s;
      setState(false);
      if (src && autoplay) play();
      return true;
    }

    function openPanel() { panel.hidden = false; edit.setAttribute('aria-expanded', 'true'); input.value = saved(); input.focus({ preventScroll: true }); }
    function closePanel() { if (panel.hidden) return; panel.hidden = true; edit.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', () => { if (!src) openPanel(); else (playing ? pause() : play()); });
    edit.addEventListener('click', () => (panel.hidden ? openPanel() : closePanel()));
    panel.addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) { toast('Paste a song link first'); return; }
      if (useSource(v, true)) {
        try { localStorage.setItem(KEY, v); } catch { /* private mode: fine, just won't persist */ }
        closePanel();
      }
    });
    $('#musicClear').addEventListener('click', () => {
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      input.value = '';
      useSource(CFG.song.url, false);
      toast(CFG.song.url ? 'Back to the original song' : 'Song removed');
      closePanel();
    });
    document.addEventListener('pointerdown', e => { if (!panel.hidden && !root.contains(e.target)) closePanel(); });

    useSource(saved() || CFG.song.url, false);
    return { isPanelOpen: () => !panel.hidden, closePanel };
  })();

  /* ======================================================================
     FX — one canvas: ambient dust, night stars, fireworks, confetti
     ====================================================================== */
  const FX = (() => {
    const cv = $('#fx');
    const noop = { firework() {}, show() {} };
    if (RM) return noop;
    const ctx = cv.getContext('2d');
    let W = 0, H = 0, DPR = 1;
    const motes = [], stars = [], rockets = [], sparks = [], confetti = [];
    const COLORS = ['#d6b77c', '#ecd9b0', '#d68b9c', '#fff7ee', '#e9a3b3'];
    const small = () => W < 640;

    function resize() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const moteCount = () => (small() ? 24 : 44);
    for (let i = 0; i < 44; i++) motes.push({ x: rand(0, 1), y: rand(0, 1), r: rand(.8, 2.4), vx: rand(-.12, .12), vy: rand(-.28, -.05), ph: rand(0, 6.28), sp: rand(.6, 1.6) });
    for (let i = 0; i < 90; i++) stars.push({ x: rand(0, 1), y: rand(0, .8), r: rand(.4, 1.3), ph: rand(0, 6.28), sp: rand(.5, 2) });

    function burst(x, y, kind) {
      const n = small() ? 60 : 90;
      const base = pick(COLORS), alt = pick(COLORS);
      if (kind === 'heart') {
        for (let i = 0; i < 110; i++) {
          const t = (i / 110) * Math.PI * 2;
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          const k = small() ? .2 : .27;
          sparks.push({ x, y, vx: hx * k, vy: hy * k, life: 0, max: rand(90, 120), color: i % 2 ? '#e9a3b3' : '#d68b9c', size: 1.8, g: .012, drag: .975 });
        }
        return;
      }
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand(-.05, .05);
        const sp = kind === 'ring' ? 4.6 : rand(1.2, 6);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: rand(55, 105), color: Math.random() < .7 ? base : alt, size: rand(1.1, 2.2), g: .045, drag: .985 });
      }
      if (sparks.length > 1400) sparks.splice(0, sparks.length - 1400);
    }
    function firework(tx, ty, kind) {
      const x0 = clamp(tx ?? rand(W * .15, W * .85), 20, W - 20);
      const ty2 = ty ?? rand(H * .18, H * .45);
      const h = Math.max(H - ty2, 120);
      const g = .2;
      rockets.push({ x: x0 + rand(-30, 30), y: H + 10, tx: x0, vx: 0, vy: -Math.sqrt(2 * g * h), g, kind: kind || (Math.random() < .3 ? 'ring' : 'peony'), color: '#ecd9b0', tail: [] });
    }
    function confettiShower(count) {
      for (let i = 0; i < count; i++) {
        confetti.push({
          x: rand(0, W), y: rand(-H * .5, -10), vx: rand(-.6, .6), vy: rand(1.2, 3.2), sway: rand(0, 6.28), sv: rand(.02, .06),
          rot: rand(0, 6.28), vr: rand(-.1, .1), w: rand(5, 10), h: rand(3, 7), petal: Math.random() < .4,
          color: pick(['#d6b77c', '#ecd9b0', '#d68b9c', '#fff7ee', '#9a3a54', '#e9a3b3'])
        });
      }
    }
    async function show(soft) {
      const seq = soft ? 3 : 7;
      for (let i = 0; i < seq; i++) { firework(); await wait(soft ? 420 : 300); }
      if (!soft) { firework(W / 2, H * .3, 'heart'); confettiShower(small() ? 90 : 160); }
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(2.5, (now - last) / 16.667); last = now;
      const t = now / 1000;
      ctx.clearRect(0, 0, W, H);
      const light = document.body.dataset.theme === 'light';
      const mc = moteCount();

      // ambient dust
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < mc; i++) {
        const m = motes[i];
        m.x += m.vx * dt / W * 60; m.y += m.vy * dt / H * 60;
        if (m.y < -.02) { m.y = 1.02; m.x = rand(0, 1); }
        if (m.x < -.02) m.x = 1.02; else if (m.x > 1.02) m.x = -.02;
        const a = (.18 + .32 * (.5 + .5 * Math.sin(t * m.sp + m.ph))) * (light ? .8 : 1);
        ctx.fillStyle = light ? `rgba(190,135,95,${a})` : `rgba(236,217,176,${a})`;
        ctx.beginPath(); ctx.arc(m.x * W, m.y * H, m.r, 0, 6.283); ctx.fill();
      }
      // stars only on the finale
      if (cur === 5) {
        for (const s of stars) {
          const a = .15 + .6 * (.5 + .5 * Math.sin(t * s.sp + s.ph));
          ctx.fillStyle = `rgba(255,247,238,${a})`;
          ctx.fillRect(s.x * W, s.y * H, s.r, s.r);
        }
      }
      // rockets
      ctx.globalCompositeOperation = 'lighter';
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.tail.push(r.x, r.y); if (r.tail.length > 12) r.tail.splice(0, 2);
        r.x += (r.tx - r.x) * .02 * dt; r.y += r.vy * dt; r.vy += r.g * dt;
        ctx.strokeStyle = 'rgba(236,217,176,.75)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(r.tail[0], r.tail[1]);
        for (let k = 2; k < r.tail.length; k += 2) ctx.lineTo(r.tail[k], r.tail[k + 1]);
        ctx.lineTo(r.x, r.y); ctx.stroke();
        if (r.vy >= -.6) { burst(r.x, r.y, r.kind); rockets.splice(i, 1); }
      }
      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const px = s.x, py = s.y;
        s.vx *= Math.pow(s.drag, dt); s.vy = s.vy * Math.pow(s.drag, dt) + s.g * dt;
        s.x += s.vx * dt; s.y += s.vy * dt; s.life += dt;
        const k = s.life / s.max;
        if (k >= 1) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = Math.pow(1 - k, 1.5);
        ctx.strokeStyle = s.color; ctx.lineWidth = s.size;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // confetti
      ctx.globalCompositeOperation = 'source-over';
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.sway += c.sv * dt; c.x += (c.vx + Math.sin(c.sway) * .8) * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
        if (c.y > H + 20) { confetti.splice(i, 1); continue; }
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.scale(1, Math.abs(Math.cos(c.sway * 1.4)) * .8 + .2);
        ctx.fillStyle = c.color;
        if (c.petal) { ctx.beginPath(); ctx.ellipse(0, 0, c.w * .6, c.h * .9, 0, 0, 6.283); ctx.fill(); } else ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { last = performance.now(); });
    return { firework, show };
  })();

  /* ======================================================================
     BOOT
     ====================================================================== */
  // wait for fonts (but never block longer than 1.2s) so the opening doesn't jump
  const fontsReady = document.fonts?.ready ? Promise.race([document.fonts.ready, wait(1200)]) : Promise.resolve();
  fontsReady.then(() => requestAnimationFrame(() => requestAnimationFrame(() => go(0))));

  // expose a tiny hook for testing / debugging
  window.__anniversary = { go, step, get scene() { return cur; } };
})();
