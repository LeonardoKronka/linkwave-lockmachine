/* LinkWave — comportamento compartilhado (GSAP) */
(() => {
  'use strict';

  const root = document.documentElement;

  // Sem GSAP (CDN fora do ar): mostra o conteúdo estático.
  if (!window.gsap || !window.ScrollTrigger) {
    root.classList.remove('js', 'is-loading');
    return;
  }

  const plugins = [ScrollTrigger, ScrollToPlugin, SplitText, Draggable, InertiaPlugin, DrawSVGPlugin];
  if (window.ScrollSmoother) plugins.push(ScrollSmoother);
  if (window.MotionPathPlugin) plugins.push(MotionPathPlugin);
  gsap.registerPlugin(...plugins);
  gsap.defaults({ ease: 'power3.out', duration: 0.7 });

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let smoother = null;
  if (!reduce && window.ScrollSmoother) {
    smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.1,
      effects: true,
      smoothTouch: false,
    });
  }

  const navOffset = () => (window.innerWidth <= 560 ? 84 : 100);

  function scrollToTarget(target, instant = false) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    if (smoother) {
      smoother.scrollTo(el, !instant, `top ${navOffset()}px`);
    } else {
      gsap.to(window, {
        duration: reduce || instant ? 0 : 0.9,
        ease: 'power3.inOut',
        scrollTo: { y: el, offsetY: navOffset(), autoKill: true },
      });
    }
  }

  function scrollToTop() {
    if (smoother) smoother.scrollTo(0, true);
    else gsap.to(window, { duration: reduce ? 0 : 0.9, ease: 'power3.inOut', scrollTo: { y: 0 } });
  }

  let readyResolve;
  const ready = new Promise((resolve) => { readyResolve = resolve; });

  const LW = (window.LW = { smoother, reduce, finePointer, ready, scrollTo: scrollToTarget });

  /* ---------- Opening: the mark breathes, opens a hole into the page and lands on the nav ---------- */
  const loader = document.querySelector('[data-loader]');
  const veil = loader ? loader.querySelector('[data-loader-veil]') : null;
  const lMark = loader ? loader.querySelector('[data-loader-mark]') : null;
  const lSpin = lMark ? lMark.querySelector('.mark__spin') : null;
  const lChars = loader ? gsap.utils.toArray('[data-loader-word] span', loader) : [];
  const lTag = loader ? loader.querySelector('[data-loader-tag]') : null;
  const nav = document.querySelector('[data-nav]');
  const navBar = nav ? nav.querySelector('.nav__bar') : null;
  const navMark = nav ? nav.querySelector('.brand__mark') : null;
  const BUILD_SECONDS = 2.3; // length of the CSS build in styles.css (last letter ends at 2.27 s)
  const farRadius = () => Math.hypot(window.innerWidth, window.innerHeight) * 0.75 + 40;

  function fimAbertura() {
    root.classList.remove('is-loading', 'is-continuing', 'is-built');
    if (loader) loader.classList.remove('is-on');
    if (navMark) navMark.style.opacity = '';
    if (navBar) gsap.set(navBar, { clearProps: 'clipPath' });
  }

  // Waits for the CSS build, the fonts and the page (never more than 6 s).
  // The build is awaited by its real animations: a slow first frame delays them.
  function pronto(continuing) {
    const minimo = continuing ? 0 : Math.max(0, BUILD_SECONDS * 1000 - performance.now());
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const fontes = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    const carregou = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }));
    const construcao = continuing || !loader.getAnimations ? Promise.resolve()
      : Promise.all(loader.getAnimations({ subtree: true }).map((a) => a.finished.catch(() => {})));
    return Promise.race([Promise.all([fontes, carregou, espera(minimo), construcao]), espera(6000)])
      .then(() => root.classList.add('is-built'));
  }

  function unrollNav(tl, at) {
    if (!navBar) return;
    const sobra = Math.max(0, navBar.offsetWidth - 58);
    tl.fromTo(navBar, { clipPath: `inset(0px ${sobra}px 0px 0px round 999px)` }, {
      clipPath: 'inset(0px 0px -12px 0px round 999px)',
      duration: 0.9,
      ease: 'expo.out',
      clearProps: 'clipPath',
    }, at);
    tl.from(navBar.querySelectorAll('.brand__name, .nav__links a, .nav__cta, .nav__toggle'), {
      x: -14,
      autoAlpha: 0,
      duration: 0.6,
      stagger: 0.04,
      ease: 'power3.out',
    }, at + 0.1);
  }

  function intro() {
    const continuing = root.classList.contains('is-continuing');
    if (!loader || root.classList.contains('boot-timeout')) {
      fimAbertura();
      readyResolve();
      return;
    }
    if (reduce) {
      gsap.to(loader, { autoAlpha: 0, duration: 0.3, onComplete: () => { fimAbertura(); gsap.set(loader, { clearProps: 'all' }); } });
      readyResolve();
      return;
    }

    // While the page is still arriving, the halves rock gently.
    const breathe = continuing ? null : gsap.to(lSpin, {
      rotation: 16,
      svgOrigin: '32 32',
      duration: 1.3,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: Math.max(0, BUILD_SECONDS - performance.now() / 1000),
    });

    pronto(continuing).then(() => {
      if (breathe) breathe.kill();
      const r0 = lMark.getBoundingClientRect();
      const r1 = navMark ? navMark.getBoundingClientRect() : { left: 24, top: 24, width: 40, height: 40 };
      const dx = r1.left + r1.width / 2 - (r0.left + r0.width / 2);
      const dy = r1.top + r1.height / 2 - (r0.top + r0.height / 2);
      const s = r1.width / r0.width;
      gsap.set(veil, { '--hx': `${r0.left + r0.width / 2}px`, '--hy': `${r0.top + r0.height / 2}px` });

      const tl = gsap.timeline({ onComplete: fimAbertura });
      tl.to(lSpin, { rotation: 0, svgOrigin: '32 32', duration: 0.35, ease: 'power2.out' }, 0)
        .to(lChars, { yPercent: -115, duration: 0.42, stagger: 0.022, ease: 'power3.in' }, 0)
        .to(lTag, { autoAlpha: 0, y: -8, duration: 0.3, ease: 'power2.in' }, 0)
        // a small breath in before it leaves
        .to(lMark, { scale: 0.88, duration: 0.24, ease: 'power2.out' }, 0.22)
        .to(lMark, { x: dx, y: dy, scale: s, duration: 1.05, ease: 'expo.inOut' }, 0.44)
        .to(lMark, { '--mk-line': '#11131F', duration: 0.35, ease: 'none' }, 1.05)
        .to(veil, { '--hole': `${farRadius()}px`, duration: 1.2, ease: 'expo.inOut' }, 0.44)
        .add(() => readyResolve(), 0.95)
        .add(() => {
          if (navMark) navMark.style.opacity = '1';
          gsap.set(lMark, { autoAlpha: 0 });
        }, 1.49);
      unrollNav(tl, 1.45);
    });
  }

  // Leaving for another page: the hole closes where you clicked and the mark rebuilds.
  // Going to the app only the ink closes: the app builds its own padlock on it.
  function leaveTo(href, x, y, toApp) {
    if (reduce || !loader) { window.location.href = href; return; }
    if (!toApp) {
      try { sessionStorage.setItem('lw:transicao', '1'); } catch (e) { /* sem sessionStorage */ }
    }
    loader.classList.add('is-on');
    gsap.set(loader, { clearProps: 'all' });
    gsap.set(lMark, { x: 0, y: 0, scale: 0.6, autoAlpha: 0, '--mk-line': '#fff' });
    gsap.set(lSpin, { rotation: -90, svgOrigin: '32 32' });
    gsap.set(lChars, { yPercent: 115 });
    gsap.set(lTag, { autoAlpha: 0, y: 8 });
    gsap.set(veil, { '--hx': `${x}px`, '--hy': `${y}px`, '--hole': `${farRadius() * 1.6}px` });
    if (toApp) {
      gsap.to(veil, { '--hole': '0px', duration: 0.7, ease: 'power3.inOut', onComplete: () => { window.location.href = href; } });
      return;
    }
    gsap.timeline({ onComplete: () => { window.location.href = href; } })
      .to(veil, { '--hole': '0px', duration: 0.75, ease: 'power3.inOut' })
      .to(lMark, { scale: 1, autoAlpha: 1, duration: 0.55, ease: 'expo.out' }, 0.5)
      .to(lSpin, { rotation: 0, duration: 0.6, ease: 'expo.out' }, 0.5)
      .to(lChars, { yPercent: 0, duration: 0.5, stagger: 0.025, ease: 'expo.out' }, 0.6)
      .to(lTag, { autoAlpha: 1, y: 0, duration: 0.4 }, 0.75)
      .to({}, { duration: 0.15 });
  }

  window.addEventListener('pageshow', (e) => {
    if (e.persisted && loader) {
      loader.classList.remove('is-on');
      gsap.set(veil, { '--hole': '0px' });
    }
  });

  /* ---------- Navigation ---------- */
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.querySelector('[data-menu]');
  const wrapper = document.getElementById('smooth-wrapper');
  let menuOpen = false;
  let navHidden = false;

  function setNavHidden(hide) {
    if (!nav || hide === navHidden) return;
    navHidden = hide;
    gsap.to(nav, { yPercent: hide ? -170 : 0, duration: hide ? 0.35 : 0.5, ease: hide ? 'power2.in' : 'power3.out', overwrite: true });
  }

  function openMenu() {
    if (!menu || menuOpen) return;
    menuOpen = true;
    menu.hidden = false;
    root.classList.add('menu-open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Fechar menu');
    if (wrapper) wrapper.inert = true;
    if (smoother) smoother.paused(true);
    setNavHidden(false);

    const r = toggle.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
    const links = menu.querySelectorAll('.menu__links a');

    const focusFirst = () => { if (menuOpen && links[0]) links[0].focus({ preventScroll: true }); };
    gsap.killTweensOf([menu, links]);
    if (reduce) {
      gsap.set(menu, { clipPath: 'none' });
      focusFirst();
    } else {
      gsap.fromTo(menu, { clipPath: `circle(0px at ${cx}px ${cy}px)` }, { clipPath: `circle(${radius}px at ${cx}px ${cy}px)`, duration: 0.65, ease: 'power3.inOut' });
      gsap.fromTo(links, { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.7, stagger: 0.045, delay: 0.2, ease: 'expo.out', onComplete: focusFirst });
    }
  }

  function closeMenu(then) {
    if (!menu || !menuOpen) { if (then) then(); return; }
    menuOpen = false;
    root.classList.remove('menu-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menu');
    if (wrapper) wrapper.inert = false;
    if (smoother) smoother.paused(false);

    const finish = () => { menu.hidden = true; if (then) then(); };
    if (reduce) { finish(); return; }
    const r = toggle.getBoundingClientRect();
    gsap.to(menu, {
      clipPath: `circle(0px at ${r.left + r.width / 2}px ${r.top + r.height / 2}px)`,
      duration: 0.5,
      ease: 'power3.inOut',
      onComplete: finish,
    });
  }

  if (toggle && menu) {
    toggle.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) { closeMenu(); toggle.focus(); }
    });
    window.addEventListener('resize', () => { if (menuOpen && window.innerWidth > 980) closeMenu(); });
  }

  /* ---------- Links: anchors and page wipes ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank') return;

    const url = new URL(a.getAttribute('href'), window.location.href);
    const samePage = url.pathname === window.location.pathname && url.search === window.location.search;

    if (samePage && !url.hash) {
      e.preventDefault();
      if (menuOpen) closeMenu(scrollToTop); else scrollToTop();
      return;
    }

    if (samePage && url.hash) {
      const target = document.querySelector(decodeURIComponent(url.hash));
      if (!target) return;
      e.preventDefault();
      const go = () => {
        scrollToTarget(target);
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
        history.replaceState(null, '', url.hash);
      };
      if (menuOpen) closeMenu(go); else go();
      return;
    }

    if (a.hasAttribute('data-wipe') && !samePage) {
      e.preventDefault();
      const px = e.clientX || window.innerWidth / 2;
      const py = e.clientY || window.innerHeight / 2;
      const toApp = a.getAttribute('data-wipe') === 'app';
      if (menuOpen) closeMenu(() => leaveTo(url.href, px, py, toApp)); else leaveTo(url.href, px, py, toApp);
    }
  });

  document.querySelectorAll('[data-totop]').forEach((btn) => btn.addEventListener('click', scrollToTop));

  /* ---------- Generic scroll-driven pieces (after page scripts) ---------- */
  function setupCommon() {
    // Nav hides on the way down, returns on the way up.
    if (nav) {
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate(self) {
          if (menuOpen) return;
          const y = self.scroll();
          setNavHidden(self.direction === 1 && y > 320);
        },
      });
    }

    // Reading progress: a thin line along the bottom of the nav pill.
    if (navBar) {
      const barra = document.createElement('span');
      barra.className = 'nav__progress';
      barra.setAttribute('aria-hidden', 'true');
      navBar.append(barra);
      gsap.to(barra, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });
    }

    // Section in view: a single yellow pill slides between the nav links.
    const navLinks = document.querySelector('.nav__links');
    if (navLinks) {
      const pip = document.createElement('span');
      pip.className = 'nav__pip';
      pip.setAttribute('aria-hidden', 'true');
      navLinks.prepend(pip);
      let atual = null;
      const mover = () => {
        const ativo = navLinks.querySelector('a.is-active');
        if (ativo === atual) return;
        atual = ativo;
        if (!ativo) {
          gsap.to(pip, { autoAlpha: 0, scale: 0.8, duration: 0.3, ease: 'power2.out' });
          return;
        }
        gsap.to(pip, {
          x: ativo.offsetLeft,
          width: ativo.offsetWidth,
          autoAlpha: 1,
          scale: 1,
          duration: reduce ? 0 : 0.55,
          ease: 'expo.out',
        });
      };
      navLinks.querySelectorAll('a[href^="#"]').forEach((link) => {
        const sec = document.querySelector(link.getAttribute('href'));
        if (!sec) return;
        ScrollTrigger.create({
          trigger: sec,
          start: 'top 45%',
          end: 'bottom 45%',
          onToggle: (self) => { link.classList.toggle('is-active', self.isActive); mover(); },
        });
      });
    }

    // Section heads: the title rises line by line, then its paragraph follows it.
    if (!reduce) {
      gsap.utils.toArray('[data-split]').forEach((el) => {
        const lede = el.parentElement && el.parentElement.querySelector(':scope > .lede');
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'ln',
          autoSplit: true,
          onSplit(self) {
            const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
            tl.from(self.lines, { yPercent: 108, duration: 1.05, stagger: 0.09, ease: 'expo.out' });
            if (lede) tl.from(lede, { y: 18, autoAlpha: 0, duration: 0.9, ease: 'expo.out' }, 0.22);
            return tl;
          },
        });
      });

      // Plates rise slightly as they come in, so sections stack instead of popping.
      gsap.utils.toArray('main > .plate').forEach((plate) => {
        if (plate.matches('.hero') || plate.querySelector('[data-record], [data-process-track]') || plate.matches('[data-process]')) return;
        gsap.from(plate, {
          y: 56,
          scale: 0.975,
          transformOrigin: '50% 0%',
          ease: 'none',
          scrollTrigger: { trigger: plate, start: 'top bottom', end: 'top 62%', scrub: 0.6 },
        });
      });
    }

    // Marquee bands: steady drift, kicked by scroll speed.
    gsap.utils.toArray('[data-marquee]').forEach((band) => {
      const track = band.querySelector('.marquee__track');
      if (!track) return;
      track.innerHTML += track.innerHTML;
      if (reduce) return;
      const loop = gsap.to(track, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
      const speed = { v: 1 };
      const apply = () => loop.timeScale(speed.v);
      ScrollTrigger.create({
        trigger: band,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? loop.resume() : loop.pause()),
        onUpdate(self) {
          const kick = 1 + Math.min(5, Math.abs(self.getVelocity()) / 350);
          gsap.to(speed, {
            v: kick,
            duration: 0.2,
            overwrite: true,
            onUpdate: apply,
            onComplete: () => gsap.to(speed, { v: 1, duration: 1.1, ease: 'power2.out', onUpdate: apply }),
          });
        },
      });
    });

    // Footer wordmark: letters rise in one after another, lift on hover.
    const word = document.querySelector('[data-footer-word]');
    if (word) {
      const split = SplitText.create(word, { type: 'chars', charsClass: 'ch' });
      if (!reduce) {
        gsap.from(split.chars, {
          yPercent: 105,
          duration: 1.1,
          stagger: 0.05,
          ease: 'expo.out',
          scrollTrigger: { trigger: word, start: 'top 96%', once: true },
        });
        if (finePointer) {
          split.chars.forEach((ch) => {
            ch.addEventListener('pointerenter', () => {
              gsap.fromTo(ch, { yPercent: 0 }, { yPercent: -9, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: true });
            });
          });
        }
      }
    }

    // Arriving with a hash (e.g. lockmachine.html#simulador).
    if (window.location.hash) {
      const target = document.querySelector(decodeURIComponent(window.location.hash));
      if (target) {
        ScrollTrigger.refresh();
        scrollToTarget(target, true);
      }
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh());
    }
  }

  function heroEntrance() {
    const title = document.querySelector('[data-hero-title]');
    const aside = gsap.utils.toArray('[data-hero-aside]');
    if (!title) return;
    if (reduce) {
      gsap.set([title, ...aside], { autoAlpha: 1 });
      return;
    }
    const hl = title.querySelector('.hl');
    if (hl) gsap.set(hl, { '--hl': 0 });
    const split = SplitText.create(title, { type: 'lines', mask: 'lines', linesClass: 'ln' });
    gsap.set(title, { autoAlpha: 1 });
    const tl = gsap.timeline();
    tl.from(split.lines, { yPercent: 112, duration: 1.15, stagger: 0.1, ease: 'expo.out' });
    // the marker sweeps in behind the highlighted word once its line has risen
    if (hl) tl.to(hl, { '--hl': 1, duration: 0.85, ease: 'expo.inOut' }, 0.5);
    if (aside.length) tl.from(aside, { y: 22, autoAlpha: 0, duration: 0.95, stagger: 0.09, ease: 'expo.out' }, 0.4);
  }

  document.addEventListener('DOMContentLoaded', () => {
    try {
      setupCommon();
    } catch (err) {
      console.error(err);
    }
    intro();
    ready.then(heroEntrance);
  });

  // Last-resort: never leave content hidden.
  setTimeout(() => {
    document.querySelectorAll('[data-hero-title], [data-hero-aside]').forEach((el) => {
      if (getComputedStyle(el).visibility === 'hidden') gsap.set(el, { autoAlpha: 1 });
    });
  }, 5000);
})();
