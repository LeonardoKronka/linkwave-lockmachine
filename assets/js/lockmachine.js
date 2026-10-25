/* LockMachine — página do produto */
(() => {
  'use strict';
  if (!window.gsap || !window.LW) return;

  const { reduce, ready } = window.LW;
  const ICON = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
  const wait = (s) => new Promise((resolve) => setTimeout(resolve, s * 1000));

  // Layout position of `el` inside `ancestor` (ignores transforms).
  function offsetWithin(el, ancestor) {
    let x = 0;
    let y = 0;
    let node = el;
    while (node && node !== ancestor) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return { x, y, w: el.offsetWidth, h: el.offsetHeight };
  }

  /* ---------- Reader helpers (hero + simulator) ---------- */
  function readerParts(reader) {
    return {
      reader,
      pad: reader.querySelector('.reader__pad'),
      ripple: reader.querySelector('.reader__ripple'),
      msg: reader.querySelector('[data-msg]'),
      sub: reader.querySelector('[data-sub]'),
      leds: {
        y: reader.querySelector('.led--y'),
        g: reader.querySelector('.led--g'),
        r: reader.querySelector('.led--r'),
      },
    };
  }
  function setLeds(parts, which) {
    ['y', 'g', 'r'].forEach((k) => parts.leds[k].classList.toggle('is-on', which === k));
  }
  function setScreen(parts, msg, sub, result = '') {
    parts.msg.textContent = msg;
    parts.sub.textContent = sub;
    parts.reader.dataset.result = result;
  }
  function ripple(parts) {
    return gsap.fromTo(parts.ripple, { scale: 0.3, opacity: 1 }, { scale: 2.6, opacity: 0, duration: 0.8, ease: 'power2.out' });
  }
  function setRelay(relay, on) {
    relay.classList.toggle('is-on', on);
    relay.querySelector('[data-relay]').textContent = on ? 'Energizada' : 'Desenergizada';
  }
  function react(parts, ok) {
    if (reduce) return;
    if (ok) {
      gsap.fromTo(parts.reader, { y: 0 }, { keyframes: { y: [0, -8, 0] }, duration: 0.45, ease: 'power2.out' });
    } else {
      gsap.fromTo(parts.reader, { x: 0 }, { keyframes: { x: [0, -8, 8, -5, 4, 0] }, duration: 0.4, ease: 'none' });
    }
  }

  /* ---------- Hero: looping demo at the reader ---------- */
  const heroDevice = document.querySelector('[data-hero-device]');
  if (heroDevice) initHeroDevice(heroDevice);

  function initHeroDevice(dev) {
    const parts = readerParts(dev.querySelector('.reader'));
    const relay = dev.querySelector('.relay');
    const cardA = dev.querySelector('[data-card-a]');
    const cardB = dev.querySelector('[data-card-b]');

    const spot = (card) => {
      const p = offsetWithin(parts.pad, dev);
      return { x: p.x + p.w / 2 - card.offsetWidth / 2, y: p.y + p.h / 2 - card.offsetHeight / 2 };
    };

    if (reduce) {
      const s = spot(cardA);
      gsap.set(cardA, { x: s.x, y: s.y - 6, rotation: -3 });
      gsap.set(cardB, { autoAlpha: 0 });
      setLeds(parts, 'g');
      setScreen(parts, 'Liberado', 'P-01 · AUTORIZADO', 'ok');
      setRelay(relay, true);
      return;
    }

    gsap.set([cardA, cardB], { autoAlpha: 0 });

    const pass = (card, outcome) => {
      const t = gsap.timeline();
      t.set(card, { x: () => dev.clientWidth + 40, y: () => spot(card).y - 220, rotation: 26, scale: 1, autoAlpha: 1 })
        .to(card, { x: () => spot(card).x + 16, y: () => spot(card).y - 28, rotation: -7, duration: 0.85, ease: 'power3.out' })
        .to(card, { x: () => spot(card).x, y: () => spot(card).y, rotation: -2, scale: 0.96, duration: 0.18, ease: 'power2.in' })
        .call(() => { setLeds(parts, 'y'); setScreen(parts, 'Lendo cartão', 'UID ' + outcome.uid); })
        .add(ripple(parts))
        .to(card, { scale: 1, duration: 0.3, ease: 'power3.out' }, '<')
        .call(() => setScreen(parts, 'Validando…', 'POST /api/acessos/validar.php'), null, '+=0.2')
        .call(() => {
          setLeds(parts, outcome.ok ? 'g' : 'r');
          setScreen(parts, outcome.ok ? 'Liberado' : 'Bloqueado', outcome.sub, outcome.ok ? 'ok' : 'no');
          setRelay(relay, outcome.ok);
          react(parts, outcome.ok);
        }, null, '+=0.6')
        .to(card, { x: () => dev.clientWidth + 40, y: () => spot(card).y - 300, rotation: 30, duration: 0.7, ease: 'power3.in' }, '+=1.3')
        .call(() => {
          setLeds(parts, null);
          setScreen(parts, 'Aproxime o cartão', 'P-01 · Prensa hidráulica');
          setRelay(relay, false);
        });
      return t;
    };

    const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.35, paused: true });
    loop.add(pass(cardA, { uid: '04A1B2C3D4', ok: true, sub: 'P-01 · AUTORIZADO' }))
      .add(pass(cardB, { uid: '04B7E1A290', ok: false, sub: 'TREINAMENTO_VENCIDO' }), '+=0.4');

    ScrollTrigger.addEventListener('refresh', () => loop.invalidate());

    ready.then(() => {
      gsap.from([parts.reader, relay], { y: 40, scale: 0.9, autoAlpha: 0, duration: 0.9, stagger: 0.12, ease: 'expo.out', delay: 0.2 });
      ScrollTrigger.create({
        trigger: dev,
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
      });
      gsap.delayedCall(0.9, () => { if (ScrollTrigger.isInViewport(dev)) loop.play(); });
    });
  }

  /* ---------- Problem: scattered pieces become one record ---------- */
  const record = document.querySelector('[data-record]');
  if (record) {
    const frags = gsap.utils.toArray('.frag', record);
    const srcs = frags.map((f) => f.querySelector('.frag__src'));
    const vals = frags.map((f) => f.querySelector('.frag__val'));
    const head = record.querySelector('.record__head');
    const scatter = [[-0.34, -0.95, -13], [0.04, -1.35, 9], [0.36, -0.8, -6], [-0.27, 0.8, 10], [0.06, 1.25, -11], [0.33, 0.65, 14]];
    const mm = gsap.matchMedia();

    // matchMedia only runs when some condition matches, so phones need their own entry
    mm.add({ desk: '(min-width: 861px)', mob: '(max-width: 860px)', rm: '(prefers-reduced-motion: reduce)' }, (ctx) => {
      const { desk, rm } = ctx.conditions;
      if (rm) {
        gsap.set(srcs, { autoAlpha: 0 });
        return;
      }
      // Offsets are relative to each fragment (three columns on desktop, one on phones), so
      // nothing has to be measured again on resize and the start state never goes stale.
      const spread = desk ? 300 : 42;
      const yUnit = desk ? 110 : 44;
      gsap.set(vals, { yPercent: 115, autoAlpha: 0 });
      const tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: record,
          start: desk ? 'center 52%' : 'top 82%',
          end: desk ? '+=900' : 'bottom 40%',
          scrub: 0.9,
          pin: desk,
          anticipatePin: 1,
        },
      });
      tl.fromTo(frags,
        { xPercent: (i) => scatter[i][0] * spread, y: (i) => scatter[i][1] * yUnit, rotation: (i) => scatter[i][2] * (desk ? 1 : 0.7), scale: 0.94 },
        { xPercent: 0, y: 0, rotation: 0, scale: 1, duration: 1, stagger: 0.05 })
        .fromTo(record,
          { backgroundColor: 'rgba(233, 236, 242, 0)', borderColor: 'rgba(17, 19, 31, 0)' },
          { backgroundColor: 'rgba(233, 236, 242, 1)', borderColor: 'rgba(17, 19, 31, 1)', duration: 0.35 }, '-=0.3')
        .fromTo(head, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.3 }, '<')
        // each value rolls in like a counter: the old note leaves upwards, clipped by .frag__swap
        .to(srcs, { yPercent: -115, autoAlpha: 0, duration: 0.3, stagger: 0.04, ease: 'power2.in' }, '-=0.05')
        .to(vals, { yPercent: 0, autoAlpha: 1, duration: 0.32, stagger: 0.04, ease: 'power3.out' }, '<0.14');
    });
  }

  /* ---------- How it works: cable drawn between the steps ---------- */
  const how = document.querySelector('[data-how]');
  if (how) {
    const svg = how.querySelector('.how__cable');
    const paths = svg.querySelectorAll('path');
    const badges = gsap.utils.toArray('.how__badge', how);

    const build = () => {
      const pts = badges.map((b) => {
        const o = offsetWithin(b, how);
        return [o.x + o.w / 2, o.y + o.h / 2];
      });
      svg.setAttribute('viewBox', `0 0 ${how.clientWidth} ${how.clientHeight}`);
      let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        if (Math.abs(x1 - x0) > Math.abs(y1 - y0)) {
          const mx = (x0 + x1) / 2;
          const bow = i % 2 ? 70 : -70;
          d += ` C${mx.toFixed(1)},${(y0 + bow).toFixed(1)} ${mx.toFixed(1)},${(y1 - bow).toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
        } else {
          const my = (y0 + y1) / 2;
          const bow = i % 2 ? 44 : -44;
          d += ` C${(x0 + bow).toFixed(1)},${my.toFixed(1)} ${(x1 + bow).toFixed(1)},${my.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}`;
        }
      }
      paths.forEach((p) => p.setAttribute('d', d));
    };
    build();
    ScrollTrigger.addEventListener('refreshInit', build);

    if (!reduce) {
      gsap.fromTo(paths, { drawSVG: '0%' }, {
        drawSVG: '100%',
        ease: 'none',
        scrollTrigger: { trigger: how, start: 'top 72%', end: 'bottom 72%', scrub: 0.8, invalidateOnRefresh: true },
      });
      gsap.utils.toArray('.how__step', how).forEach((step) => {
        gsap.timeline({ scrollTrigger: { trigger: step, start: 'top 84%', once: true } })
          .from(step.querySelector('.how__badge'), { scale: 0, rotation: -40, duration: 0.8, ease: 'expo.out' })
          .from(step.querySelector('.how__n'), { scale: 0, duration: 0.5, ease: 'expo.out' }, '-=0.35')
          .from(step.querySelectorAll('h3, p'), { y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.6 }, '-=0.5');
      });
    }
  }

  /* ---------- Simulator ---------- */
  const sim = document.querySelector('[data-sim]');
  if (sim) initSim(sim);

  function initSim(sim) {
    const DAY = 86400000;
    const today = new Date();
    const inDays = (n) => new Date(today.getTime() + n * DAY);
    const fmt = (d) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const mask = (uid) => uid.slice(0, 4) + '••••' + uid.slice(-2);

    const TRAININGS = {
      nr12: 'NR-12 — fundamentos',
      prensa: 'Operação de prensa',
      fresa: 'Operação de fresadora',
      cnc: 'Operação de torno CNC',
    };
    const MACHINES = {
      'P-01': { nome: 'Prensa hidráulica', status: 'ativa', exige: ['nr12', 'prensa'] },
      'F-03': { nome: 'Fresadora', status: 'ativa', exige: ['nr12', 'fresa'] },
      'T-02': { nome: 'Torno CNC', status: 'manutencao', exige: ['nr12', 'cnc'] },
    };
    const OPS = {
      ana: { nome: 'Ana Ribeiro', ini: 'AR', tone: 'var(--green)', matricula: 'OP-1042', uid: '04A1B2C3D4', ativo: true,
        cap: { nr12: inDays(214), prensa: inDays(461), cnc: inDays(305) } },
      bruno: { nome: 'Bruno Teixeira', ini: 'BT', tone: 'var(--yellow)', matricula: 'OP-1077', uid: '04B7E1A290', ativo: true,
        cap: { nr12: inDays(-61), prensa: inDays(270), fresa: inDays(332) } },
      carla: { nome: 'Carla Mendes', ini: 'CM', tone: 'var(--steel)', matricula: 'OP-0988', uid: '04C93F0B11', ativo: false,
        cap: { nr12: inDays(150), fresa: inDays(240) } },
      desconhecido: { nome: 'Cartão sem cadastro', ini: '?', tone: 'var(--paper)', matricula: 'Sem matrícula', uid: '04FF19D0AE', unknown: true, cap: {} },
    };
    const REASONS = {
      AUTORIZADO: 'Todas as condições cadastrais foram atendidas.',
      CARTAO_DESCONHECIDO: 'UID não associado a operador.',
      OPERADOR_INATIVO: 'Cadastro do operador desativado.',
      MAQUINA_INDISPONIVEL: 'Máquina bloqueada, inativa ou em manutenção.',
      TREINAMENTO_AUSENTE: 'Operador não possui uma capacitação exigida.',
      TREINAMENTO_VENCIDO: 'Capacitação encontrada, porém fora da validade.',
      SERVICO_INDISPONIVEL: 'Não foi possível concluir a validação com segurança.',
    };

    const $ = (sel) => sim.querySelector(sel);
    const opValue = () => $('input[name="op"]:checked').value;
    const mqValue = () => $('input[name="mq"]:checked').value;
    const onlineInput = $('[data-online]');
    const onlineLabel = $('[data-online-label]');
    const card = $('[data-sim-card]');
    const cardEls = { avatar: $('[data-card-avatar]'), name: $('[data-card-name]'), meta: $('[data-card-meta]'), uid: $('[data-card-uid]') };
    const parts = readerParts($('[data-reader]'));
    const relay = sim.querySelector('.sim__stage .relay');
    const tapBtn = $('[data-tap]');
    const checks = {};
    const defaultDetail = {};
    sim.querySelectorAll('[data-check]').forEach((li) => {
      checks[li.dataset.check] = li;
      defaultDetail[li.dataset.check] = li.querySelector('[data-detail]').textContent;
    });
    const verdict = $('[data-verdict]');
    const stamp = $('[data-stamp]');
    const reason = $('[data-reason]');
    const httpEl = $('[data-http]');
    const jsonEl = $('[data-json]');
    const logBody = $('[data-log]');
    const statEls = { total: $('[data-stat="total"]'), ok: $('[data-stat="ok"]'), no: $('[data-stat="no"]') };
    const stats = { total: 0, ok: 0, no: 0 };
    let accessId = 184;
    let busy = false;
    let idleTimer;
    let drag = null;

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function highlight(obj) {
      const json = escapeHtml(JSON.stringify(obj, null, 2)).replace(/&quot;/g, '"');
      return json.replace(/("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?)/g, (m, str, colon, lit, num) => {
        if (str) return colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`;
        if (lit) return `<span class="b">${lit}</span>`;
        return `<span class="n">${num}</span>`;
      });
    }

    function isoLocal(d) {
      const p = (n) => String(n).padStart(2, '0');
      const off = -d.getTimezoneOffset();
      const a = Math.abs(off);
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${off >= 0 ? '+' : '-'}${p(Math.floor(a / 60))}:${p(a % 60)}`;
    }

    // Same order as the project's validation rule.
    function evaluate(opKey, mqKey, online) {
      const op = OPS[opKey];
      const mq = MACHINES[mqKey];
      const steps = [];
      const stop = (id, detail, code) => {
        steps.push({ id, ok: false, detail });
        return { steps, code };
      };

      if (!online) return stop('servidor', 'Sem resposta da API. A leitora nega e a saída continua desenergizada.', 'SERVICO_INDISPONIVEL');
      steps.push({ id: 'servidor', ok: true, detail: 'Requisição recebida pela API' });

      if (op.unknown) return stop('cartao', `UID ${mask(op.uid)} não está associado a nenhum operador`, 'CARTAO_DESCONHECIDO');
      steps.push({ id: 'cartao', ok: true, detail: `UID ${op.uid} → ${op.nome} (${op.matricula})` });

      if (!op.ativo) return stop('operador', 'Cadastro desativado. O histórico continua preservado.', 'OPERADOR_INATIVO');
      steps.push({ id: 'operador', ok: true, detail: 'Cadastro ativo' });

      if (mq.status !== 'ativa') return stop('maquina', `${mqKey} · ${mq.nome} está em manutenção`, 'MAQUINA_INDISPONIVEL');
      steps.push({ id: 'maquina', ok: true, detail: `${mqKey} · ${mq.nome} ativa` });

      const missing = mq.exige.filter((t) => !op.cap[t]);
      if (missing.length) return stop('exigidas', `Falta: ${missing.map((t) => TRAININGS[t]).join(', ')}`, 'TREINAMENTO_AUSENTE');
      steps.push({ id: 'exigidas', ok: true, detail: mq.exige.map((t) => TRAININGS[t]).join(' + ') });

      const expired = mq.exige.filter((t) => op.cap[t] < today);
      if (expired.length) return stop('validade', `${TRAININGS[expired[0]]} venceu em ${fmt(op.cap[expired[0]])}`, 'TREINAMENTO_VENCIDO');
      const next = mq.exige.map((t) => op.cap[t]).sort((a, b) => a - b)[0];
      steps.push({ id: 'validade', ok: true, detail: `Próximo vencimento em ${fmt(next)}` });

      return { steps, code: 'AUTORIZADO' };
    }

    function idleScreen() {
      setLeds(parts, null);
      setScreen(parts, 'Aproxime o cartão', `${mqValue()} · ${MACHINES[mqValue()].nome}`);
    }

    function paintCard() {
      const op = OPS[opValue()];
      cardEls.avatar.textContent = op.ini;
      cardEls.name.textContent = op.nome;
      cardEls.meta.textContent = op.matricula;
      cardEls.uid.textContent = op.uid;
      card.style.setProperty('--tone', op.tone);
    }

    function showRequest() {
      const op = OPS[opValue()];
      httpEl.textContent = '—';
      httpEl.removeAttribute('data-code');
      jsonEl.innerHTML = highlight({ rfid_uid: op.uid, maquina_codigo: mqValue() });
    }

    function resetResult() {
      Object.entries(checks).forEach(([k, li]) => {
        li.dataset.state = 'idle';
        li.querySelector('.check__dot').innerHTML = '';
        li.querySelector('[data-detail]').textContent = defaultDetail[k];
      });
      verdict.dataset.result = 'idle';
      stamp.textContent = 'Aguardando';
      reason.textContent = 'Aproxime um cartão para validar.';
    }

    function markCheck(id, state, detail) {
      const li = checks[id];
      li.dataset.state = state;
      const dot = li.querySelector('.check__dot');
      dot.innerHTML = state === 'ok' ? ICON('i-check') : state === 'fail' ? ICON('i-x') : state === 'skip' ? ICON('i-minus') : '';
      if (detail) li.querySelector('[data-detail]').textContent = detail;
      if (!reduce && (state === 'ok' || state === 'fail')) {
        gsap.fromTo(dot, { scale: 0.4, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.45, ease: 'back.out(3)' });
      }
    }

    function setBusy(b) {
      busy = b;
      sim.querySelectorAll('.sim__setup input').forEach((i) => { i.disabled = b; });
      tapBtn.disabled = b;
      if (drag) { if (b) drag.disable(); else drag.enable(); }
    }

    function addLog(entry) {
      const empty = logBody.querySelector('.log__empty');
      if (empty) empty.remove();
      const tr = document.createElement('tr');
      tr.className = 'is-new';
      const time = entry.when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const who = entry.op.unknown ? 'Não cadastrado' : escapeHtml(entry.op.nome);
      const label = entry.ok ? 'Liberado' : entry.online ? 'Bloqueado' : 'Negado';
      const local = entry.online ? '' : '<span class="log__local">Registro local da leitora</span>';
      tr.innerHTML = `<td>${time}</td><td>${who}${local}</td><td class="mono">${mask(entry.op.uid)}</td><td class="mono">${entry.mq}</td><td><span class="res res--${entry.kind}">${label}</span></td><td class="mono">${entry.code}</td>`;
      logBody.prepend(tr);
      if (!reduce) gsap.from(tr.children, { y: -14, autoAlpha: 0, duration: 0.45, stagger: 0.03, ease: 'expo.out' });
      while (logBody.children.length > 6) logBody.lastElementChild.remove();
    }

    function bumpStats(ok) {
      stats.total += 1;
      if (ok) stats.ok += 1; else stats.no += 1;
      Object.keys(statEls).forEach((k) => {
        const el = statEls[k];
        if (el.textContent === String(stats[k])) return;
        el.textContent = String(stats[k]);
        if (!reduce) gsap.fromTo(el, { scale: 1.7, rotation: -12 }, { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(3)' });
      });
    }

    function showResult(opKey, mqKey, online, code) {
      const op = OPS[opKey];
      const ok = code === 'AUTORIZADO';
      const kind = ok ? 'ok' : online ? 'no' : 'err';
      const when = new Date();
      const status = online ? 200 : 503;
      const body = online
        ? { sucesso: true, dados: { autorizado: ok, motivo_codigo: code, acesso_id: ++accessId, data_hora: isoLocal(when) }, mensagem: REASONS[code] }
        : { sucesso: false, codigo: code, mensagem: REASONS[code] };

      httpEl.textContent = 'HTTP ' + status;
      httpEl.dataset.code = String(status);
      jsonEl.innerHTML = highlight(body);

      setLeds(parts, ok ? 'g' : 'r');
      setScreen(parts, ok ? 'Liberado' : online ? 'Bloqueado' : 'Sem conexão', ok ? `${mqKey} · AUTORIZADO` : code, kind);
      setRelay(relay, ok);
      react(parts, ok);

      verdict.dataset.result = kind;
      stamp.textContent = ok ? 'Liberado' : online ? 'Bloqueado' : 'Negado';
      reason.innerHTML = `<code>${code}</code> ${REASONS[code]}`;
      if (!reduce) {
        gsap.fromTo(stamp, { scale: 2.4, rotation: -18, autoAlpha: 0 }, { scale: 1, rotation: -3, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.2)' });
        gsap.fromTo(verdict, { x: 0 }, { keyframes: { x: [0, -6, 6, -3, 0] }, duration: 0.35, delay: 0.14, ease: 'none' });
      }

      addLog({ when, op, mq: mqKey, code, ok, kind, online });
      bumpStats(ok);

      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => { setRelay(relay, false); idleScreen(); }, 3400);
    }

    function validate() {
      const opKey = opValue();
      const mqKey = mqValue();
      const online = onlineInput.checked;
      const op = OPS[opKey];
      const { steps, code } = evaluate(opKey, mqKey, online);
      const sp = reduce ? 0 : 1;

      clearTimeout(idleTimer);
      resetResult();
      stamp.textContent = 'Validando';
      reason.textContent = 'Conferindo as regras no servidor…';
      setRelay(relay, false);
      httpEl.textContent = '…';
      httpEl.removeAttribute('data-code');
      jsonEl.innerHTML = highlight({ rfid_uid: op.uid, maquina_codigo: mqKey });

      const tl = gsap.timeline();
      tl.call(() => { setLeds(parts, 'y'); setScreen(parts, 'Lendo cartão', 'UID ' + op.uid); }, null, 0);
      if (!reduce) tl.add(ripple(parts), 0);
      tl.call(() => setScreen(parts, online ? 'Validando…' : 'Sem conexão', online ? 'POST /api/acessos/validar.php' : 'Tentando falar com a API…'), null, 0.45 * sp);

      let t = 0.6 * sp;
      const seen = new Set();
      steps.forEach((s) => {
        seen.add(s.id);
        tl.call(() => markCheck(s.id, 'run'), null, t);
        t += 0.3 * sp;
        tl.call(() => markCheck(s.id, s.ok ? 'ok' : 'fail', s.detail), null, t);
        t += 0.12 * sp;
      });
      tl.call(() => {
        Object.keys(checks).forEach((k) => {
          if (!seen.has(k)) markCheck(k, 'skip', 'Não avaliado: a validação para no primeiro bloqueio');
        });
        showResult(opKey, mqKey, online, code);
      }, null, t + 0.12 * sp);
      tl.to({}, { duration: 0.01 });
      return tl.then();
    }

    // Card movement between the dock and the reader.
    gsap.set(card, { transformPerspective: 700 });
    const padDelta = () => {
      const c = card.getBoundingClientRect();
      const p = parts.pad.getBoundingClientRect();
      return { dx: p.left + p.width / 2 - (c.left + c.width / 2), dy: p.top + p.height / 2 - (c.top + c.height / 2) };
    };
    function toPad(fromTap) {
      const { dx, dy } = padDelta();
      if (reduce) {
        gsap.set(card, { x: '+=' + dx, y: '+=' + dy, rotation: 0, scale: 1 });
        return Promise.resolve();
      }
      if (fromTap) {
        return gsap.timeline()
          .to(card, { y: '-=26', rotation: -7, scale: 1.05, duration: 0.18, ease: 'power2.out' })
          .to(card, { x: '+=' + dx, y: '+=' + (dy + 26), rotation: -2, scale: 0.96, duration: 0.5, ease: 'power3.inOut' })
          .to(card, { scale: 1, rotation: 0, duration: 0.22, ease: 'power3.out' })
          .then();
      }
      return gsap.to(card, { x: '+=' + dx, y: '+=' + dy, rotation: 0, scale: 1, duration: 0.25, ease: 'power3.out' }).then();
    }
    function toDock() {
      const vars = { x: 0, y: 0, rotation: 0, rotationY: 0, scale: 1 };
      return reduce ? gsap.set(card, vars) : gsap.to(card, { ...vars, duration: 0.9, ease: 'elastic.out(1, 0.7)' });
    }

    async function attempt(fromTap) {
      if (busy) return;
      setBusy(true);
      try {
        await toPad(fromTap);
        // Stacked layout: bring the checklist into view so the decision is seen.
        if (window.matchMedia('(max-width: 760px)').matches) window.LW.scrollTo(sim.querySelector('.sim__out'));
        await validate();
        await wait(reduce ? 0.2 : 1.1);
      } finally {
        toDock();
        setBusy(false);
        ScrollTrigger.refresh();
      }
    }

    if (window.Draggable) {
      drag = Draggable.create(card, {
        type: 'x,y',
        onPress() {
          if (!reduce) gsap.to(card, { scale: 1.05, rotation: -4, duration: 0.2, overwrite: 'auto' });
        },
        onDrag() {
          parts.pad.classList.toggle('is-hot', this.hitTest(parts.pad, '25%'));
        },
        onRelease() {
          const hit = this.hitTest(parts.pad, '25%');
          parts.pad.classList.remove('is-hot');
          if (hit) attempt(false);
          else toDock();
        },
      })[0];
    }

    tapBtn.addEventListener('click', () => attempt(true));

    sim.querySelectorAll('input[name="op"]').forEach((input) => input.addEventListener('change', () => {
      resetResult();
      showRequest();
      if (reduce) { paintCard(); return; }
      gsap.timeline()
        .to(card, { rotationY: 90, duration: 0.16, ease: 'power2.in' })
        .call(paintCard)
        .to(card, { rotationY: 0, duration: 0.45, ease: 'expo.out' });
    }));
    sim.querySelectorAll('input[name="mq"]').forEach((input) => input.addEventListener('change', () => {
      resetResult();
      showRequest();
      if (!busy) idleScreen();
    }));
    onlineInput.addEventListener('change', () => {
      onlineLabel.textContent = onlineInput.checked ? 'online' : 'offline';
      resetResult();
    });

    paintCard();
    showRequest();
    idleScreen();

    if (!reduce) {
      gsap.from(['.sim__setup', '.sim__stage', '.sim__out'], {
        y: 50,
        autoAlpha: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'expo.out',
        scrollTrigger: { trigger: '.sim__grid', start: 'top 82%', once: true },
      });
      // A small nudge toward the reader says "drag me".
      ScrollTrigger.create({
        trigger: '.sim__stage',
        start: 'top 60%',
        once: true,
        onEnter: () => {
          if (busy) return;
          gsap.timeline({ delay: 1 })
            .to(card, { y: 22, rotation: 3, duration: 0.3, ease: 'power2.out' })
            .to(card, { y: 0, rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.6)' })
            .to(card, { y: 14, rotation: -2, duration: 0.25, ease: 'power2.out' })
            .to(card, { y: 0, rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.6)' });
        },
      });
    }
  }

  /* ---------- Architecture: packet travels the wires ---------- */
  const arch = document.querySelector('[data-arch]');
  if (arch) initArch(arch);

  function initArch(arch) {
    const NS = 'http://www.w3.org/2000/svg';
    const svg = arch.querySelector('.arch__wires');
    const packet = arch.querySelector('.arch__packet');
    const caption = arch.querySelector('[data-arch-caption]');
    const node = (k) => arch.querySelector(`[data-node="${k}"]`);
    const pairs = { 'device-api': ['device', 'api'], 'api-db': ['api', 'db'], 'browser-api': ['browser', 'api'] };
    const wires = {};

    Object.keys(pairs).forEach((id) => {
      const under = document.createElementNS(NS, 'path');
      under.setAttribute('class', 'arch__wire-under');
      const line = document.createElementNS(NS, 'path');
      line.setAttribute('class', 'arch__wire');
      svg.append(under, line);
      wires[id] = { under, line };
    });

    function build() {
      svg.setAttribute('viewBox', `0 0 ${arch.clientWidth} ${arch.clientHeight}`);
      const c = (k) => {
        const o = offsetWithin(node(k), arch);
        return { x: o.x + o.w / 2, y: o.y + o.h / 2 };
      };
      Object.entries(pairs).forEach(([id, [a, b]]) => {
        const A = c(a);
        const B = c(b);
        let d;
        if (Math.abs(B.x - A.x) >= Math.abs(B.y - A.y)) {
          const mx = (A.x + B.x) / 2;
          d = `M${A.x},${A.y} C${mx},${A.y} ${mx},${B.y} ${B.x},${B.y}`;
        } else {
          const my = (A.y + B.y) / 2;
          d = `M${A.x},${A.y} C${A.x},${my} ${B.x},${my} ${B.x},${B.y}`;
        }
        wires[id].under.setAttribute('d', d);
        wires[id].line.setAttribute('d', d);
      });
    }
    build();
    ScrollTrigger.addEventListener('refreshInit', build);

    const allPaths = Object.values(wires).flatMap((w) => [w.under, w.line]);
    const nodes = gsap.utils.toArray('.arch__node', arch);

    if (reduce || !window.MotionPathPlugin) return;

    gsap.timeline({ scrollTrigger: { trigger: arch, start: 'top 78%', once: true } })
      .from(nodes, { y: 50, rotation: (i) => (i % 2 ? 4 : -4), autoAlpha: 0, duration: 0.8, stagger: 0.12, ease: 'expo.out' })
      .from(allPaths, {
        drawSVG: 0,
        duration: 0.9,
        stagger: 0.08,
        ease: 'power2.inOut',
        onComplete: () => gsap.set(allPaths, { clearProps: 'strokeDasharray,strokeDashoffset' }),
      }, '-=0.4');

    const seq = [
      { w: 'device-api', rev: false, cap: 'ESP32 → POST /api/acessos/validar.php', hit: 'api' },
      { w: 'api-db', rev: false, cap: 'API → consulta preparada com PDO', hit: 'db' },
      { w: 'api-db', rev: true, cap: 'MySQL → capacitações exigidas e validade', hit: 'api' },
      { w: 'device-api', rev: true, cap: 'API → JSON 200 com autorizado e motivo_codigo', hit: 'device' },
      { w: 'browser-api', rev: false, cap: 'Navegador → GET /api/acessos/index.php', hit: 'api' },
      { w: 'browser-api', rev: true, cap: 'API → histórico atualizado no dashboard', hit: 'browser' },
    ];

    const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.6, paused: true });
    seq.forEach((s) => {
      const path = wires[s.w].line;
      loop.call(() => { caption.textContent = s.cap; })
        .fromTo(caption, { y: 8, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.25 })
        .to(packet, { autoAlpha: 1, duration: 0.12 }, '<')
        .to(packet, {
          duration: 1.05,
          ease: 'power1.inOut',
          motionPath: { path, align: path, alignOrigin: [0.5, 0.5], start: s.rev ? 1 : 0, end: s.rev ? 0 : 1 },
        }, '<')
        .fromTo(node(s.hit), { scale: 1 }, { keyframes: { scale: [1, 1.06, 1] }, duration: 0.4, ease: 'power2.out' })
        .to(packet, { autoAlpha: 0, duration: 0.12 }, '<')
        .to({}, { duration: 0.3 });
    });

    ScrollTrigger.addEventListener('refresh', () => loop.invalidate());
    ScrollTrigger.create({
      trigger: arch,
      start: 'top 70%',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
    });

    gsap.from('.api__list li, .tables__list li', {
      x: -24,
      autoAlpha: 0,
      duration: 0.5,
      stagger: 0.04,
      scrollTrigger: { trigger: '.arch__cols', start: 'top 82%', once: true },
    });
  }

  /* ---------- Status: roadmap fill ---------- */
  const road = document.querySelector('[data-road] .road__list');
  if (road) {
    const fill = document.createElement('span');
    fill.className = 'road__fill';
    fill.setAttribute('aria-hidden', 'true');
    road.prepend(fill);
    const stops = gsap.utils.toArray('.road__stop', road);
    if (reduce) {
      gsap.set(fill, { scaleY: 1 });
      stops.forEach((stop) => stop.classList.add('is-reached'));
    } else {
      gsap.to(fill, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: road, start: 'top 65%', end: 'bottom 60%', scrub: 0.6 } });
      stops.forEach((stop) => {
        ScrollTrigger.create({
          trigger: stop,
          start: 'top 64%',
          onEnter: () => stop.classList.add('is-reached'),
          onLeaveBack: () => stop.classList.remove('is-reached'),
        });
      });
    }
  }

  /* ---------- App: APK button only works when the file is published ---------- */
  const apk = document.querySelector('[data-apk]');
  if (apk) {
    const indisponivel = () => {
      apk.classList.add('is-off');
      apk.setAttribute('aria-disabled', 'true');
      apk.removeAttribute('download');
      apk.querySelector('[data-apk-label]').textContent = 'APK em breve';
      const nota = document.querySelector('[data-apk-note]');
      if (nota) nota.textContent = 'O APK é gerado assim que o app estiver publicado no servidor. Enquanto isso, use a versão web: ela é o mesmo app, com o mesmo login.';
    };
    if (location.protocol === 'file:') {
      indisponivel();
    } else {
      fetch(apk.getAttribute('href'), { method: 'HEAD', cache: 'no-store' })
        .then((r) => { if (!r.ok) indisponivel(); })
        .catch(indisponivel);
    }
  }

  if (reduce) return;

  /* ---------- App phones float in and drift apart on scroll ---------- */
  const getapp = document.querySelector('[data-getapp]');
  if (getapp) {
    const back = getapp.querySelector('[data-phone-back]');
    const front = getapp.querySelector('[data-phone-front]');
    gsap.timeline({ scrollTrigger: { trigger: getapp, start: 'top 75%', once: true } })
      .from(back, { y: 120, rotation: -20, autoAlpha: 0, duration: 1, ease: 'expo.out' })
      .from(front, { y: 160, rotation: 18, autoAlpha: 0, duration: 1, ease: 'expo.out' }, '-=0.75')
      .from(getapp.querySelectorAll('.ph-chart i'), { scaleY: 0, duration: 0.5, stagger: 0.05, ease: 'expo.out' }, '-=0.5')
      .from(getapp.querySelectorAll('.role'), { x: 30, autoAlpha: 0, duration: 0.6, stagger: 0.12 }, '-=0.9');
    gsap.to(back, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: getapp, start: 'top bottom', end: 'bottom top', scrub: 1 } });
    gsap.to(front, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: getapp, start: 'top bottom', end: 'bottom top', scrub: 1 } });
  }

  /* ---------- Who the competitors are ---------- */
  gsap.from('[data-rivals] .rival', {
    y: 50,
    rotation: (i) => (i - 1) * 3,
    autoAlpha: 0,
    duration: 0.8,
    stagger: 0.12,
    ease: 'expo.out',
    scrollTrigger: { trigger: '[data-rivals]', start: 'top 82%', once: true },
  });

  /* ---------- Hardware rows slide onto the tray ---------- */
  ScrollTrigger.batch('[data-bom] .part', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.from(batch, { x: (i) => (i % 2 ? 60 : -60), autoAlpha: 0, duration: 0.7, stagger: 0.08, ease: 'expo.out' }),
  });

  /* ---------- Failures: stamped as they arrive ---------- */
  ScrollTrigger.batch('[data-fails] .fail', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => {
      gsap.from(batch, { y: 40, autoAlpha: 0, duration: 0.6, stagger: 0.08 });
      gsap.from(batch.map((b) => b.querySelector('.stamp')), {
        scale: 2.8,
        rotation: -32,
        autoAlpha: 0,
        duration: 0.45,
        delay: 0.35,
        stagger: 0.08,
        ease: 'back.out(2)',
      });
    },
  });

  /* ---------- Compare table rows ---------- */
  gsap.from('.compare__table tbody tr', {
    y: 18,
    autoAlpha: 0,
    duration: 0.5,
    stagger: 0.06,
    scrollTrigger: { trigger: '.compare__scroll', start: 'top 84%', once: true },
  });

  /* ---------- Status: module list ---------- */
  gsap.from('.modules__list li', {
    x: -24,
    autoAlpha: 0,
    duration: 0.5,
    stagger: 0.05,
    scrollTrigger: { trigger: '.modules', start: 'top 82%', once: true },
  });

  /* ---------- Canvas cells assemble ---------- */
  gsap.from('.bmc__cell', {
    y: 30,
    scale: 0.86,
    rotation: () => gsap.utils.random(-5, 5),
    autoAlpha: 0,
    duration: 0.8,
    ease: 'expo.out',
    stagger: { each: 0.06, from: 'center' },
    scrollTrigger: { trigger: '[data-bmc]', start: 'top 82%', once: true },
  });
})();
