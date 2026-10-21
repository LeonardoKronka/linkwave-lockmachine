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

  /* ---------- Page wipe (intro + transitions) ---------- */
  const wipe = document.querySelector('.wipe');
  const panels = wipe ? gsap.utils.toArray('.wipe__panel', wipe) : [];
  const mark = wipe ? wipe.querySelector('.wipe__mark') : null;

  // The loader is already covering the page (CSS in <head>); here it only leaves.
  function intro() {
    const timedOut = root.classList.contains('boot-timeout');
    if (!wipe || reduce || timedOut) {
      root.classList.remove('is-loading');
      if (wipe) gsap.set(wipe, { autoAlpha: 0 });
      readyResolve();
      return;
    }
    gsap.set(panels, { yPercent: 0 });
    root.classList.remove('is-loading');
    const bar = wipe.querySelector('.wipe__bar');
    const fontsReady = document.fonts && document.fonts.ready
      ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))])
      : Promise.resolve();
    fontsReady.then(() => {
      gsap.timeline({ onComplete: () => gsap.set(wipe, { autoAlpha: 0 }) })
        .to(bar, { autoAlpha: 0, y: 10, duration: 0.2, ease: 'power2.in' })
        .to(mark, { scale: 1.14, rotation: -8, duration: 0.18, ease: 'power2.out' }, 0)
        .to(mark, { scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(3)' })
        .to(panels.slice().reverse(), { yPercent: -100, duration: 0.72, stagger: 0.08, ease: 'power4.inOut' }, '-=0.1')
        .add(() => readyResolve(), '-=0.6');
    });
  }

  function leaveTo(href) {
    if (reduce || !wipe) { window.location.href = href; return; }
    gsap.set(wipe, { autoAlpha: 1 });
    gsap.set(wipe.querySelector('.wipe__bar'), { autoAlpha: 1, y: 0 });
    gsap.timeline({ onComplete: () => { window.location.href = href; } })
      .fromTo(panels, { yPercent: 100 }, { yPercent: 0, duration: 0.58, stagger: 0.08, ease: 'power4.inOut' })
      .fromTo(mark, { scale: 0.5, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2)' }, '-=0.22');
  }

  window.addEventListener('pageshow', (e) => {
    if (e.persisted && wipe) {
      gsap.set(panels, { yPercent: 100 });
      gsap.set(wipe, { autoAlpha: 0 });
    }
  });

  /* ---------- Navigation ---------- */
  const nav = document.querySelector('[data-nav]');
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
      gsap.fromTo(links, { yPercent: 110, rotation: 4, autoAlpha: 0 }, { yPercent: 0, rotation: 0, autoAlpha: 1, duration: 0.6, stagger: 0.05, delay: 0.18, ease: 'back.out(1.6)', onComplete: focusFirst });
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
      if (menuOpen) closeMenu(() => leaveTo(url.href)); else leaveTo(url.href);
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

    // Highlight the section in view.
    document.querySelectorAll('.nav__links a[href^="#"]').forEach((link) => {
      const sec = document.querySelector(link.getAttribute('href'));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: (self) => link.classList.toggle('is-active', self.isActive),
      });
    });

    // Headings: masked line rise.
    if (!reduce) {
      gsap.utils.toArray('[data-split]').forEach((el) => {
        SplitText.create(el, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'ln',
          autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 108,
              duration: 0.95,
              stagger: 0.09,
              ease: 'expo.out',
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            });
          },
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

    // Footer wordmark: letters rise in, bounce on hover.
    const word = document.querySelector('[data-footer-word]');
    if (word) {
      const split = SplitText.create(word, { type: 'chars', charsClass: 'ch' });
      if (!reduce) {
        gsap.from(split.chars, {
          yPercent: 105,
          duration: 0.9,
          stagger: 0.045,
          ease: 'back.out(1.5)',
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
    const split = SplitText.create(title, { type: 'words', wordsClass: 'w' });
    const hl = title.querySelector('.hl');
    gsap.set(title, { autoAlpha: 1 });
    const tl = gsap.timeline();
    tl.from(split.words, {
      yPercent: 80,
      rotation: (i) => (i % 2 ? 7 : -7),
      autoAlpha: 0,
      duration: 0.8,
      stagger: 0.055,
      ease: 'back.out(1.7)',
    });
    if (hl) tl.fromTo(hl, { scale: 0.4, rotation: -18 }, { scale: 1, rotation: -2.5, duration: 0.9, ease: 'elastic.out(1, 0.45)' }, 0.3);
    if (aside.length) tl.from(aside, { y: 28, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, 0.35);
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
