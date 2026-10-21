/* LinkWave — página inicial */
(() => {
  'use strict';
  if (!window.gsap || !window.LW) return;

  const { reduce, finePointer, ready } = window.LW;
  const clamp = gsap.utils.clamp;

  /* ---------- Hero: the living link wave ---------- */
  function initWave(el) {
    const svg = el.querySelector('svg');
    const under = el.querySelector('.wave__under');
    const line = el.querySelector('.wave__line');
    const pulse = el.querySelector('.wave__pulse');
    const hero = el.closest('.hero') || el;
    const nodes = gsap.utils.toArray('.node', el).map((node) => ({
      el: node,
      fx: parseFloat(node.dataset.x),
      icon: node.querySelector('.node__icon'),
      w: 0,
      ih: 0,
      lastHit: 0,
    }));

    const state = { amp: reduce ? 1 : 0, phase: 0.6, t: 0.02, speed: 1 };
    let W = 0;
    let H = 0;

    function measure() {
      W = el.clientWidth;
      H = el.clientHeight;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      nodes.forEach((n) => {
        n.w = n.el.offsetWidth;
        n.ih = n.icon.offsetHeight;
      });
    }

    function yAt(x) {
      const mid = H * 0.46;
      const A = Math.min(H * 0.24, 74) * state.amp;
      const k = (Math.PI * 2) / Math.max(W * 0.62, 340);
      return mid + Math.sin(x * k + state.phase) * A + Math.sin(x * k * 0.43 - state.phase * 0.7) * A * 0.32;
    }

    function render() {
      const step = W < 700 ? 9 : 13;
      let d = '';
      for (let x = -30; x <= W + 30; x += step) {
        d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + yAt(x).toFixed(1);
      }
      under.setAttribute('d', d);
      line.setAttribute('d', d);

      const px = (state.t % 1) * (W + 60) - 30;
      pulse.setAttribute('cx', px.toFixed(1));
      pulse.setAttribute('cy', yAt(px).toFixed(1));

      const now = performance.now();
      for (const n of nodes) {
        const x = n.fx * W;
        const y = yAt(x);
        n.el.style.transform = `translate3d(${(x - n.w / 2).toFixed(1)}px, ${(y - n.ih / 2).toFixed(1)}px, 0)`;
        if (!reduce && Math.abs(px - x) < 14 && now - n.lastHit > 900) {
          n.lastHit = now;
          gsap.fromTo(n.icon, { scaleX: 1.2, scaleY: 0.8 }, { scaleX: 1, scaleY: 1, duration: 0.8, ease: 'elastic.out(1, 0.35)', overwrite: true });
        }
      }
    }

    measure();
    render();

    const ro = new ResizeObserver(() => { measure(); render(); });
    ro.observe(el);

    if (reduce) return;

    const tick = (time, dt) => {
      const d = Math.min(dt, 50);
      state.phase += d * 0.0015 * state.speed;
      state.t += d * 0.00017 * state.speed;
      render();
    };

    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? gsap.ticker.add(tick) : gsap.ticker.remove(tick)),
    });

    // Pointer stirs the wave: closer to the line, bigger the swell.
    const ampTo = gsap.quickTo(state, 'amp', { duration: 0.9, ease: 'power3.out' });
    const speedTo = gsap.quickTo(state, 'speed', { duration: 0.6, ease: 'power2.out' });
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(e.clientY - (r.top + H * 0.46));
        const near = 1 - clamp(0, 1, dist / (H * 1.4));
        ampTo(1 + near * 0.85);
        speedTo(1 + near * 1.6);
      });
      hero.addEventListener('pointerleave', () => { ampTo(1); speedTo(1); });
    }

    // Entrance: wave swells up, nodes pop onto it.
    gsap.set(nodes.map((n) => n.icon), { scale: 0 });
    gsap.set(gsap.utils.toArray('.node__label', el), { autoAlpha: 0, y: -8 });
    ready.then(() => {
      gsap.timeline({ delay: 0.25 })
        .to(state, { amp: 1, duration: 1.6, ease: 'elastic.out(1, 0.35)' })
        .to(nodes.map((n) => n.icon), { scale: 1, duration: 0.7, stagger: 0.09, ease: 'back.out(2.4)' }, 0.15)
        .to(gsap.utils.toArray('.node__label', el), { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.09 }, 0.45);
    });
  }

  const wave = document.querySelector('[data-wave]');
  if (wave) initWave(wave);

  /* ---------- About: statement fills word by word ---------- */
  const statement = document.querySelector('[data-scrub-text]');
  if (statement && !reduce) {
    SplitText.create(statement, {
      type: 'words',
      wordsClass: 'sw',
      onSplit(self) {
        return gsap.fromTo(self.words, { opacity: 0.16 }, {
          opacity: 1,
          stagger: 0.1,
          ease: 'none',
          scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 48%', scrub: true },
        });
      },
    });
  }

  // Tags swing in on their grommets; nudge them and they swing again.
  function swing(el, dir = 1, amount = 5) {
    gsap.killTweensOf(el, 'rotation');
    gsap.timeline()
      .to(el, { rotation: dir * amount, duration: 0.18, ease: 'power2.out' })
      .to(el, { rotation: 0, duration: 1.5, ease: 'elastic.out(1, 0.22)' });
  }

  const tagCards = gsap.utils.toArray('[data-tag-card]');
  if (!reduce) {
    tagCards.forEach((card, i) => {
      gsap.from(card, {
        rotation: i ? 16 : -16,
        y: -60,
        autoAlpha: 0,
        duration: 1.6,
        ease: 'elastic.out(1, 0.4)',
        scrollTrigger: { trigger: card, start: 'top 88%', once: true },
      });
      if (finePointer) card.addEventListener('pointerenter', (e) => swing(card, e.movementX >= 0 ? 1 : -1, 4));
    });

    const link = document.querySelector('[data-about-link]');
    if (link) {
      gsap.from(link.querySelectorAll('path'), {
        drawSVG: '50% 50%',
        ease: 'none',
        scrollTrigger: { trigger: link, start: 'top 85%', end: 'top 45%', scrub: 0.8 },
      });
    }
  }

  /* ---------- Services: accordion rows ---------- */
  const rows = gsap.utils.toArray('[data-rows] .row');
  function setRow(row, open) {
    const body = row.querySelector('.row__body');
    const btn = row.querySelector('.row__head');
    row.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    body.inert = !open;
    gsap.to(body, {
      height: open ? 'auto' : 0,
      duration: reduce ? 0 : 0.6,
      ease: 'power3.inOut',
      overwrite: true,
      onComplete: () => ScrollTrigger.refresh(),
    });
    if (open && !reduce) {
      gsap.fromTo(body.querySelectorAll('.chips li'),
        { y: 16, autoAlpha: 0, rotation: () => gsap.utils.random(-8, 8) },
        { y: 0, autoAlpha: 1, rotation: 0, duration: 0.55, stagger: 0.05, delay: 0.18, ease: 'back.out(2.2)' });
    }
  }
  rows.forEach((row) => {
    const body = row.querySelector('.row__body');
    if (!row.classList.contains('is-open')) {
      gsap.set(body, { height: 0 });
      body.inert = true;
    }
    row.querySelector('.row__head').addEventListener('click', () => {
      const open = !row.classList.contains('is-open');
      if (open) rows.forEach((r) => r !== row && r.classList.contains('is-open') && setRow(r, false));
      setRow(row, open);
    });
  });
  if (rows.length && !reduce) {
    gsap.from(rows, {
      x: 70,
      rotation: 2.5,
      autoAlpha: 0,
      duration: 0.9,
      stagger: 0.1,
      ease: 'back.out(1.4)',
      scrollTrigger: { trigger: '[data-rows]', start: 'top 82%', once: true },
    });
  }

  /* ---------- Spotlight: the hanging lockout tag ---------- */
  const bigtag = document.querySelector('[data-bigtag]');
  if (bigtag && !reduce) {
    gsap.from(bigtag, {
      rotation: -28,
      duration: 2.4,
      ease: 'elastic.out(1, 0.22)',
      scrollTrigger: { trigger: bigtag, start: 'top 80%', once: true },
    });
    gsap.from('[data-padlock]', {
      y: -50,
      rotation: -10,
      duration: 1,
      ease: 'bounce.out',
      scrollTrigger: { trigger: bigtag, start: 'top 80%', once: true },
    });
    // Scrolling fast makes the tag sway against the motion.
    let settle;
    ScrollTrigger.create({
      trigger: '#projeto',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate(self) {
        const lean = clamp(-14, 14, self.getVelocity() / -140);
        if (Math.abs(lean) < 1.5) return;
        gsap.to(bigtag, { rotation: lean, duration: 0.4, ease: 'power2.out', overwrite: 'auto' });
        clearTimeout(settle);
        settle = setTimeout(() => gsap.to(bigtag, { rotation: 0, duration: 1.8, ease: 'elastic.out(1, 0.2)', overwrite: 'auto' }), 140);
      },
    });
    if (finePointer) bigtag.addEventListener('pointerenter', (e) => swing(bigtag, e.movementX >= 0 ? 1 : -1, 9));
    bigtag.addEventListener('click', () => swing(bigtag, 1, 12));

    gsap.from('.mini-steps li', {
      x: -30,
      autoAlpha: 0,
      duration: 0.7,
      stagger: 0.12,
      scrollTrigger: { trigger: '.mini-steps', start: 'top 85%', once: true },
    });
  }

  /* ---------- Process: pinned horizontal run ---------- */
  const proc = document.querySelector('[data-process]');
  if (proc) {
    const track = proc.querySelector('[data-process-track]');
    const viewport = proc.querySelector('.process__viewport');
    const meter = proc.querySelector('[data-process-meter]');
    const steps = gsap.utils.toArray('.step', track);
    const mm = gsap.matchMedia();

    mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
      const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth);
      const startAt = () => (proc.offsetHeight > window.innerHeight ? 'bottom bottom' : 'center center');

      const run = gsap.timeline({
        scrollTrigger: {
          trigger: proc,
          start: startAt,
          end: () => '+=' + distance(),
          pin: true,
          scrub: 0.8,
          invalidateOnRefresh: true,
          anticipatePin: 1,
        },
      });
      run.to(track, { x: () => -distance(), ease: 'none' }, 0)
        .to(meter, { scaleX: 1, ease: 'none' }, 0);

      steps.forEach((step) => {
        gsap.from(step, {
          rotation: 7,
          y: 50,
          scale: 0.88,
          ease: 'none',
          scrollTrigger: {
            trigger: step,
            containerAnimation: run,
            start: 'left 105%',
            end: 'left 65%',
            scrub: true,
          },
        });
      });
    });

    mm.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      steps.forEach((step, i) => {
        gsap.from(step, {
          x: i % 2 ? 50 : -50,
          rotation: i % 2 ? 3 : -3,
          autoAlpha: 0,
          duration: 0.8,
          ease: 'back.out(1.4)',
          scrollTrigger: { trigger: step, start: 'top 88%', once: true },
        });
      });
    });
  }

  /* ---------- Team: hanging badges that flip ---------- */
  const badges = gsap.utils.toArray('[data-badges] .badge');
  badges.forEach((badge) => {
    const card = badge.querySelector('.badge__card');
    let flipped = false;
    card.addEventListener('click', () => {
      flipped = !flipped;
      card.setAttribute('aria-pressed', String(flipped));
      gsap.to(card, { rotationY: flipped ? 180 : 0, duration: reduce ? 0 : 0.85, ease: 'back.out(1.3)', overwrite: true });
      if (!reduce) swing(badge, flipped ? 1 : -1, 7);
    });
    if (finePointer && !reduce) {
      badge.addEventListener('pointerenter', (e) => swing(badge, e.movementX >= 0 ? 1 : -1, 5));
    }
  });
  if (badges.length && !reduce) {
    gsap.from(badges, {
      yPercent: -55,
      rotation: (i) => (i % 2 ? 10 : -10),
      autoAlpha: 0,
      duration: 1.6,
      stagger: 0.09,
      ease: 'elastic.out(1, 0.42)',
      scrollTrigger: { trigger: '[data-badges]', start: 'top 82%', once: true },
    });
    gsap.from('.advisors', {
      y: 30,
      autoAlpha: 0,
      duration: 0.8,
      scrollTrigger: { trigger: '.advisors', start: 'top 92%', once: true },
    });
  }

  /* ---------- Tech board: draggable stickers ---------- */
  const board = document.querySelector('[data-board]');
  if (board) {
    const stickers = gsap.utils.toArray('.sticker', board);
    const hint = document.querySelector('[data-board-hint]');
    let draggables = [];

    // Pack stickers into justified rows with a little hand-placed jitter.
    function place() {
      const bw = board.clientWidth;
      const small = bw < 640;
      const pad = small ? 16 : 34;
      const gapX = small ? 12 : 26;
      const gapY = small ? 22 : 58;
      const rowsOut = [];
      let row = [];
      let x = pad;
      stickers.forEach((s) => {
        const w = s.offsetWidth;
        if (row.length && x + w > bw - pad) {
          rowsOut.push(row);
          row = [];
          x = pad;
        }
        row.push(s);
        x += w + gapX;
      });
      if (row.length) rowsOut.push(row);

      let y = pad + 6;
      let n = 0;
      rowsOut.forEach((r) => {
        const used = r.reduce((sum, s) => sum + s.offsetWidth, 0);
        const spare = Math.max(0, bw - pad * 2 - used);
        const gap = r.length > 1 ? spare / (r.length - 1) : 0;
        let cx = pad + (r.length === 1 ? spare / 2 : 0);
        let rowH = 0;
        r.forEach((s) => {
          const jx = ((n * 37) % 15) - 7;
          const jy = ((n * 53) % 19) - 9;
          const rot = ((n * 29) % 17) - 8;
          s._home = { x: cx + (r.length > 1 ? jx : 0), y: y + jy, rotation: rot };
          cx += s.offsetWidth + gap;
          rowH = Math.max(rowH, s.offsetHeight);
          n += 1;
        });
        y += rowH + gapY;
      });
      board.style.height = Math.round(y - gapY + pad + 16) + 'px';
      stickers.forEach((s) => gsap.set(s, { x: s._home.x, y: s._home.y, rotation: s._home.rotation }));
      draggables.forEach((d) => d.update());
    }

    place();

    if (finePointer && !reduce) {
      board.classList.add('can-drag');
      draggables = Draggable.create(stickers, {
        type: 'x,y',
        bounds: board,
        inertia: true,
        edgeResistance: 0.75,
        zIndexBoost: true,
        onPress() {
          gsap.to(this.target, { scale: 1.08, rotation: '+=' + gsap.utils.random(-6, 6), duration: 0.2, overwrite: 'auto' });
        },
        onRelease() {
          gsap.to(this.target, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
        },
      });
    } else {
      if (hint) hint.textContent = 'Toque nas peças.';
      stickers.forEach((s) => {
        s.addEventListener('click', () => {
          if (reduce || !s._home) return;
          gsap.timeline({ overwrite: true })
            .to(s, { y: s._home.y - 46, rotation: s._home.rotation + gsap.utils.random(-14, 14), duration: 0.24, ease: 'power2.out' })
            .to(s, { y: s._home.y, rotation: s._home.rotation, duration: 0.7, ease: 'bounce.out' });
        });
      });
    }

    let resizeTimer;
    const rePlace = () => { place(); ScrollTrigger.refresh(); };
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rePlace, 180);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(rePlace);

    if (!reduce) {
      // Drop in from above when the board arrives (positions read at that moment).
      gsap.set(stickers, { autoAlpha: 0 });
      ScrollTrigger.create({
        trigger: board,
        start: 'top 78%',
        once: true,
        onEnter: () => {
          gsap.fromTo(stickers,
            { y: (i, s) => s._home.y - 320 - (i % 4) * 60, rotation: (i) => (i % 2 ? 40 : -40), autoAlpha: 0 },
            { y: (i, s) => s._home.y, rotation: (i, s) => s._home.rotation, autoAlpha: 1, duration: 1.1, ease: 'bounce.out', stagger: { each: 0.06, from: 'random' } });
        },
      });
    }
  }
})();
