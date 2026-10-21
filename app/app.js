/* LockMachine — app (PWA) para administradores e funcionários.
   Mesma API e mesmo banco do site: o que é cadastrado aqui vale no APK e no navegador. */
(() => {
  'use strict';

  const API = new URL('../api/', location.href);
  const SITE = new URL('../lockmachine.html', location.href).href;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const anima = () => !!window.gsap && !reduce;

  const state = { user: null, seq: 0, vivo: () => true, timers: [], install: null, filtros: { func: { q: '', situacao: 'ativos' }, acessos: {} } };

  /* ================= Utilidades ================= */

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  const TONS = [['var(--yellow)', 'var(--ink)'], ['var(--green)', 'var(--ink)'], ['var(--cobalt)', '#fff'], ['var(--red)', 'var(--ink)'], ['var(--steel)', 'var(--ink)']];
  function iniciais(nome) {
    const p = String(nome || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  }
  function avatar(nome, extra = '') {
    let h = 0;
    for (const ch of String(nome)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const t = TONS[h % TONS.length];
    return `<span class="avatar ${extra}" style="--tone:${t[0]};--tone-fg:${t[1]}" aria-hidden="true">${esc(iniciais(nome))}</span>`;
  }

  function lerData(v) {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const [a, m, d] = v.split('-').map(Number);
      return new Date(a, m - 1, d);
    }
    return new Date(v);
  }
  const fData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fDataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
  const fHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fDia = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
  const fExtenso = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const dataBR = (v) => (v ? fData.format(lerData(v)) : '—');
  function quando(v) {
    if (!v) return '—';
    const d = lerData(v);
    const seg = (Date.now() - d.getTime()) / 1000;
    if (seg < 60) return 'agora';
    if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
    const hoje = new Date();
    const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
    if (d.toDateString() === hoje.toDateString()) return `hoje, ${fHora.format(d)}`;
    if (d.toDateString() === ontem.toDateString()) return `ontem, ${fHora.format(d)}`;
    return `${fDataCurta.format(d)}, ${fHora.format(d)}`;
  }
  function prazo(dias) {
    if (dias < 0) return `venceu há ${plural(-dias, 'dia', 'dias')}`;
    if (dias === 0) return 'vence hoje';
    return `vence em ${plural(dias, 'dia', 'dias')}`;
  }
  const hojeISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const MOTIVOS = {
    AUTORIZADO: 'Autorizado',
    CARTAO_DESCONHECIDO: 'Cartão desconhecido',
    OPERADOR_INATIVO: 'Operador inativo',
    MAQUINA_INDISPONIVEL: 'Máquina indisponível',
    TREINAMENTO_AUSENTE: 'Treinamento ausente',
    TREINAMENTO_VENCIDO: 'Treinamento vencido',
    SERVICO_INDISPONIVEL: 'Serviço indisponível',
  };
  const STATUS_MAQ = { ativa: ['Ativa', 'ok'], manutencao: ['Em manutenção', 'warn'], bloqueada: ['Bloqueada', 'bad'], inativa: ['Inativa', 'soft'] };
  const SITUACAO = { valida: ['Válida', 'ok'], vencendo: ['Vencendo', 'warn'], vencida: ['Vencida', 'bad'], ausente: ['Ausente', 'bad'] };

  const pill = (txt, tipo = '', ic = '') => `<span class="pill${tipo ? ' pill--' + tipo : ''}">${ic ? icon(ic) : ''}${esc(txt)}</span>`;
  const pillMaq = (s) => pill((STATUS_MAQ[s] || [s])[0], (STATUS_MAQ[s] || [])[1]);
  const pillSit = (s) => pill((SITUACAO[s] || [s])[0], (SITUACAO[s] || [])[1]);
  const pillResultado = (ok) => (ok ? pill('Liberado', 'ok', 'check') : pill('Bloqueado', 'bad', 'x'));
  const vazio = (titulo, texto = '', ic = 'info') => `<div class="empty">${icon(ic)}<strong>${esc(titulo)}</strong>${texto ? `<span>${esc(texto)}</span>` : ''}</div>`;
  const esqueleto = (n = 3) => `<div class="skeleton">${'<span></span>'.repeat(n)}</div>`;

  function campo({ nome, rotulo, tipo = 'text', valor = '', dica = '', attrs = '', mono = false }) {
    return `<label class="field" data-field="${nome}">
      <span class="field__label">${rotulo}</span>
      <input class="input${mono ? ' input--mono' : ''}" name="${nome}" type="${tipo}" value="${esc(valor)}" ${attrs}>
      ${dica ? `<span class="field__hint">${dica}</span>` : ''}
    </label>`;
  }
  function selecao({ nome, rotulo, opcoes, valor = '', vaziaTexto = '' }) {
    return `<label class="field" data-field="${nome}">
      <span class="field__label">${rotulo}</span>
      <select class="select" name="${nome}">
        ${vaziaTexto ? `<option value="">${esc(vaziaTexto)}</option>` : ''}
        ${opcoes.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(valor) ? ' selected' : ''}>${esc(t)}</option>`).join('')}
      </select>
    </label>`;
  }
  function senhaCampo(nome, rotulo, auto, dica = '') {
    return `<label class="field" data-field="${nome}">
      <span class="field__label">${rotulo}</span>
      <span class="input-wrap">
        <input class="input" name="${nome}" type="password" autocomplete="${auto}" required>
        <button class="icon-btn" type="button" data-olho aria-label="Mostrar senha">${icon('eye')}</button>
      </span>
      ${dica ? `<span class="field__hint">${dica}</span>` : ''}
    </label>`;
  }

  /* ================= API ================= */

  class ApiError extends Error {
    constructor(status, codigo, mensagem, erros) {
      super(mensagem);
      this.status = status;
      this.codigo = codigo;
      this.erros = erros || null;
    }
  }

  async function api(caminho, { metodo = 'GET', corpo, query } = {}) {
    const url = new URL(caminho, API);
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== '' && v != null) url.searchParams.set(k, v);
      });
    }
    let res;
    try {
      res = await fetch(url, {
        method: metodo,
        credentials: 'same-origin',
        headers: Object.assign({ 'X-Requested-With': 'LockMachine', Accept: 'application/json' }, corpo ? { 'Content-Type': 'application/json' } : {}),
        body: corpo ? JSON.stringify(corpo) : undefined,
      });
    } catch (e) {
      throw new ApiError(0, 'SEM_CONEXAO', 'Sem conexão com o servidor. Confira a internet e tente de novo.');
    }
    if (res.status === 204) return null;
    let json = null;
    try {
      json = await res.json();
    } catch (e) { /* resposta sem JSON */ }
    if (!res.ok || !json || json.sucesso === false) {
      const err = new ApiError(res.status, (json && json.codigo) || 'ERRO',
        (json && json.mensagem) || `O servidor respondeu ${res.status}. Tente de novo em instantes.`, json && json.erros);
      if (res.status === 401 && !/auth\/(login|me)\.php$/.test(caminho)) {
        state.user = null;
        toast('Sua sessão expirou. Entre novamente.', 'bad');
        ir('#/login');
      } else if (err.codigo === 'TROCA_DE_SENHA') {
        if (state.user) state.user.deve_trocar_senha = true;
        ir('#/trocar-senha');
      }
      throw err;
    }
    return json;
  }

  /* ================= Feedback ================= */

  function toast(msg, tipo = 'ok') {
    const el = document.createElement('div');
    el.className = `toast toast--${tipo}`;
    el.innerHTML = icon(tipo === 'ok' ? 'check' : 'alert') + `<span>${esc(msg)}</span>`;
    $('.toasts').append(el);
    if (anima()) gsap.from(el, { y: 20, autoAlpha: 0, duration: 0.3, ease: 'back.out(2)' });
    setTimeout(() => {
      if (anima()) gsap.to(el, { autoAlpha: 0, y: 10, duration: 0.25, onComplete: () => el.remove() });
      else el.remove();
    }, 3800);
  }

  function confirmar({ titulo, texto, ok = 'Confirmar', perigo = false }) {
    return new Promise((resolve) => {
      const d = $('#dialog');
      d.innerHTML = `<form method="dialog" class="dialog__body">
        <h2 class="dialog__title">${esc(titulo)}</h2>
        <p>${esc(texto)}</p>
        <div class="dialog__actions">
          <button class="btn btn--ghost" value="nao">Cancelar</button>
          <button class="btn ${perigo ? 'btn--red' : 'btn--yellow'}" value="sim">${esc(ok)}</button>
        </div>
      </form>`;
      d.returnValue = '';
      d.addEventListener('close', () => resolve(d.returnValue === 'sim'), { once: true });
      d.showModal();
    });
  }

  function segredo({ titulo, itens, nota }) {
    return `<div class="secret" role="status">
      <strong class="card__title">${esc(titulo)}</strong>
      ${itens.map(([rotulo, valor]) => `<div class="stack" style="gap:4px"><span class="field__label">${esc(rotulo)}</span>
        <div class="secret__value"><span>${esc(valor)}</span><button class="btn btn--sm" type="button" data-copiar="${esc(valor)}">${icon('copy')}Copiar</button></div></div>`).join('')}
      ${nota ? `<p class="field__hint" style="color:var(--ink)">${esc(nota)}</p>` : ''}
    </div>`;
  }

  /* ================= Formulários ================= */

  function lerForm(form) {
    const dados = {};
    new FormData(form).forEach((v, k) => {
      if (k.endsWith('[]')) {
        const chave = k.slice(0, -2);
        (dados[chave] = dados[chave] || []).push(v);
      } else {
        dados[k] = typeof v === 'string' ? v.trim() : v;
      }
    });
    return dados;
  }
  function limparErros(form) {
    $$('.field.has-error', form).forEach((f) => f.classList.remove('has-error'));
    $$('.field__error, .form-alert', form).forEach((e) => e.remove());
  }
  function mostrarErros(form, err) {
    limparErros(form);
    if (err.erros) {
      Object.entries(err.erros).forEach(([nome, msg]) => {
        const f = $(`[data-field="${nome}"]`, form);
        if (f) {
          f.classList.add('has-error');
          f.insertAdjacentHTML('beforeend', `<span class="field__error">${esc(msg)}</span>`);
        }
      });
    }
    form.insertAdjacentHTML('afterbegin', `<div class="alert form-alert" role="alert">${icon('alert')}<span>${esc(err.message)}</span></div>`);
    const alvo = $('.has-error input, .has-error select', form);
    if (alvo) alvo.focus();
  }
  async function enviar(form, acao) {
    const btn = $('button[type="submit"]', form);
    if (btn) {
      btn.classList.add('is-loading');
      btn.disabled = true;
    }
    limparErros(form);
    try {
      return await acao(lerForm(form));
    } catch (e) {
      if (e instanceof ApiError) {
        mostrarErros(form, e);
        return null;
      }
      throw e;
    } finally {
      if (btn) {
        btn.classList.remove('is-loading');
        btn.disabled = false;
      }
    }
  }
  async function executar(btn, acao) {
    btn.classList.add('is-loading');
    btn.disabled = true;
    try {
      return await acao();
    } catch (e) {
      if (e instanceof ApiError) toast(e.message, 'bad');
      else throw e;
      return null;
    } finally {
      btn.classList.remove('is-loading');
      btn.disabled = false;
    }
  }

  // Ações globais: copiar, mostrar senha, botão de voltar.
  document.addEventListener('click', async (e) => {
    const copiar = e.target.closest('[data-copiar]');
    if (copiar) {
      try {
        await navigator.clipboard.writeText(copiar.dataset.copiar);
        toast('Copiado.');
      } catch (err) {
        toast('Não foi possível copiar. Selecione o texto e copie manualmente.', 'bad');
      }
    }
    const olho = e.target.closest('[data-olho]');
    if (olho) {
      const input = olho.parentElement.querySelector('input');
      const mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      olho.innerHTML = icon(mostrar ? 'eye-off' : 'eye');
      olho.setAttribute('aria-label', mostrar ? 'Esconder senha' : 'Mostrar senha');
    }
  });

  /* ================= Animação ================= */

  function entrar(main) {
    if (!anima()) return;
    gsap.from($$('.page > *', main), { y: 16, autoAlpha: 0, duration: 0.38, stagger: 0.045, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
  }
  function listar(el) {
    if (!anima() || !el) return;
    gsap.from($$('.row, .row--card', el), { x: -12, autoAlpha: 0, duration: 0.3, stagger: 0.025, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }
  function contar(el) {
    if (!anima()) return;
    $$('[data-contar]', el).forEach((n) => {
      const alvo = Number(n.dataset.contar);
      const obj = { v: 0 };
      gsap.to(obj, { v: alvo, duration: 0.8, ease: 'power2.out', onUpdate: () => { n.textContent = Math.round(obj.v); } });
    });
  }

  /* ================= Navegação ================= */

  const NAV = {
    admin: [
      { grupo: 'Gestão' },
      { rota: '/painel', rotulo: 'Painel', ic: 'grid', tab: true },
      { rota: '/funcionarios', rotulo: 'Funcionários', ic: 'users', tab: true },
      { rota: '/maquinas', rotulo: 'Máquinas', ic: 'machine', tab: true },
      { rota: '/treinamentos', rotulo: 'Treinamentos', ic: 'book' },
      { grupo: 'Acessos' },
      { rota: '/acessos', rotulo: 'Histórico', ic: 'history', tab: true },
      { rota: '/simular', rotulo: 'Simular leitura', ic: 'waves' },
      { rota: '/leitoras', rotulo: 'Leitoras RFID', ic: 'chip' },
      { grupo: 'Sistema' },
      { rota: '/admins', rotulo: 'Administradores', ic: 'shield' },
      { rota: '/conta', rotulo: 'Minha conta', ic: 'user' },
    ],
    funcionario: [
      { rota: '/inicio', rotulo: 'Início', ic: 'home', tab: true },
      { rota: '/capacitacoes', rotulo: 'Capacitações', ic: 'book', tab: true },
      { rota: '/minhas-maquinas', rotulo: 'Máquinas', ic: 'machine', tab: true },
      { rota: '/historico', rotulo: 'Histórico', ic: 'history', tab: true },
      { rota: '/conta', rotulo: 'Conta', ic: 'user', tab: true },
    ],
  };

  const MARCA = `<svg class="brand__mark" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="1.5" y="1.5" width="45" height="45" rx="13" fill="#FF3D2E" stroke="#11131F" stroke-width="3"/>
      <path d="M17 22v-4.5a7 7 0 0 1 14 0V22" fill="none" stroke="#11131F" stroke-width="4" stroke-linecap="round"/>
      <rect x="12" y="21" width="24" height="17" rx="5" fill="#fff" stroke="#11131F" stroke-width="3"/>
      <circle cx="24" cy="28.5" r="2.6" fill="#11131F"/><path d="M24 30v3.5" stroke="#11131F" stroke-width="3" stroke-linecap="round"/>
    </svg>`;

  function montarShell() {
    const u = state.user;
    const itens = NAV[u.perfil];
    if (state.shellDe === u.perfil + u.id && $('#main')) return;
    state.shellDe = u.perfil + u.id;
    const tabs = itens.filter((i) => i.tab);
    const extras = itens.filter((i) => i.rota && !i.tab);
    $('#app').innerHTML = `
      <div class="shell">
        <aside class="side" aria-label="Menu principal">
          <a class="brand" href="#${tabs[0].rota}">${MARCA}<span class="brand__name">LockMachine<span class="brand__sub">${u.perfil === 'admin' ? 'Administração' : 'Área do funcionário'}</span></span></a>
          <nav class="side__nav">
            ${itens.map((i) => (i.grupo ? `<p class="side__group">${i.grupo}</p>` : `<a class="navlink" href="#${i.rota}" data-rota="${i.rota}">${icon(i.ic)}${i.rotulo}</a>`)).join('')}
          </nav>
          <div class="side__foot">
            <div class="who">${avatar(u.nome)}<div style="min-width:0"><p class="who__name">${esc(u.nome)}</p><p class="who__role">${esc(u.login)}</p></div></div>
            <a class="navlink" href="${SITE}">${icon('globe')}Site do LockMachine</a>
            <button class="navlink" type="button" data-sair style="border:0;background:none;width:100%;cursor:pointer">${icon('logout')}Sair</button>
          </div>
        </aside>
        <header class="top">
          <a class="brand" href="#${tabs[0].rota}">${MARCA}<span class="brand__name">LockMachine</span></a>
          <span class="top__title" data-titulo></span>
        </header>
        <main class="main" id="main" tabindex="-1"></main>
        <nav class="tabbar" aria-label="Navegação">
          ${tabs.map((i) => `<a class="tab" href="#${i.rota}" data-rota="${i.rota}">${icon(i.ic)}<span>${i.rotulo}</span></a>`).join('')}
          ${extras.length ? `<button class="tab" type="button" data-mais aria-haspopup="dialog">${icon('more')}<span>Mais</span></button>` : ''}
        </nav>
      </div>`;
    $$('[data-sair]').forEach((b) => b.addEventListener('click', sair));
    const mais = $('[data-mais]');
    if (mais) mais.addEventListener('click', () => abrirMais(extras));
  }

  function abrirMais(extras) {
    const s = document.createElement('div');
    s.className = 'sheet';
    s.innerHTML = `<div class="sheet__panel" role="dialog" aria-label="Mais opções">
      <span class="sheet__handle"></span>
      ${extras.map((i) => `<a class="navlink" href="#${i.rota}">${icon(i.ic)}${i.rotulo}</a>`).join('')}
      <a class="navlink" href="${SITE}">${icon('globe')}Site do LockMachine</a>
      <button class="navlink" type="button" data-sair style="border:0;background:none;width:100%;cursor:pointer">${icon('logout')}Sair</button>
    </div>`;
    document.body.append(s);
    const fechar = () => {
      if (anima()) gsap.to($('.sheet__panel', s), { yPercent: 100, duration: 0.25, ease: 'power2.in', onComplete: () => s.remove() });
      else s.remove();
    };
    s.addEventListener('click', (e) => {
      if (e.target === s || e.target.closest('a')) fechar();
      if (e.target.closest('[data-sair]')) { fechar(); sair(); }
    });
    if (anima()) gsap.from($('.sheet__panel', s), { yPercent: 100, duration: 0.35, ease: 'power3.out' });
  }

  function marcarNav(caminho) {
    $$('[data-rota]').forEach((a) => {
      const r = a.dataset.rota;
      a.classList.toggle('is-active', caminho === r || caminho.startsWith(r + '/'));
    });
    const ativo = $(`.navlink.is-active`);
    const titulo = $('[data-titulo]');
    if (titulo) titulo.textContent = ativo ? ativo.textContent.trim() : '';
  }

  async function sair() {
    try { await api('auth/logout.php', { metodo: 'POST' }); } catch (e) { /* já saiu */ }
    state.user = null;
    state.shellDe = null;
    ir('#/login');
  }

  /* ================= Rotas ================= */

  const ADMIN = { perfil: 'admin' };
  const FUNC = { perfil: 'funcionario' };
  const ROTAS = [
    ['/login', vLogin, { publica: true }],
    ['/trocar-senha', vTrocarSenha, { tela: true }],
    ['/painel', vPainel, ADMIN],
    ['/funcionarios', vFuncionarios, ADMIN],
    ['/funcionarios/novo', vFuncionarioForm, ADMIN],
    ['/funcionarios/:id', vFuncionario, ADMIN],
    ['/funcionarios/:id/editar', vFuncionarioForm, ADMIN],
    ['/maquinas', vMaquinas, ADMIN],
    ['/maquinas/nova', vMaquinaForm, ADMIN],
    ['/maquinas/:id', vMaquinaForm, ADMIN],
    ['/treinamentos', vTreinamentos, ADMIN],
    ['/acessos', vAcessos, ADMIN],
    ['/simular', vSimular, ADMIN],
    ['/leitoras', vLeitoras, ADMIN],
    ['/admins', vAdmins, ADMIN],
    ['/inicio', vInicio, FUNC],
    ['/capacitacoes', vCapacitacoes, FUNC],
    ['/minhas-maquinas', vMinhasMaquinas, FUNC],
    ['/historico', vHistorico, FUNC],
    ['/conta', vConta, {}],
  ];

  function casar(caminho) {
    for (const [padrao, view, opts] of ROTAS) {
      const a = padrao.split('/');
      const b = caminho.split('/');
      if (a.length !== b.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < a.length; i++) {
        if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
        else if (a[i] !== b[i]) { ok = false; break; }
      }
      if (ok) return { view, opts, params };
    }
    return null;
  }

  function inicial() {
    if (!state.user) return '/login';
    if (state.user.deve_trocar_senha) return '/trocar-senha';
    return state.user.perfil === 'admin' ? '/painel' : '/inicio';
  }

  function ir(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  async function render() {
    state.timers.forEach(clearInterval);
    state.timers = [];
    const token = ++state.seq;
    state.vivo = () => token === state.seq;

    const caminho = location.hash.replace(/^#/, '').split('?')[0] || inicial();
    const m = casar(caminho);
    if (!m) return ir('#' + inicial());

    if (m.opts.publica) {
      if (state.user) return ir('#' + inicial());
      state.shellDe = null;
      return m.view($('#app'));
    }
    if (!state.user) return ir('#/login');
    if (state.user.deve_trocar_senha && caminho !== '/trocar-senha') return ir('#/trocar-senha');
    if (m.opts.tela) {
      state.shellDe = null;
      return m.view($('#app'));
    }
    if (m.opts.perfil && m.opts.perfil !== state.user.perfil) return ir('#' + inicial());

    montarShell();
    marcarNav(caminho);
    const main = $('#main');
    main.innerHTML = esqueleto(4);
    window.scrollTo(0, 0);
    try {
      await m.view(main, m.params);
      if (state.vivo()) entrar(main);
    } catch (e) {
      if (!state.vivo()) return;
      if (e instanceof ApiError && (e.status === 401 || e.codigo === 'TROCA_DE_SENHA')) return;
      console.error(e);
      main.innerHTML = `<section class="page"><div class="card">${vazio('Não foi possível carregar esta tela.', e.message || 'Erro inesperado.', 'alert')}
        <div class="inline" style="justify-content:center"><button class="btn btn--yellow" type="button" data-tentar>${icon('refresh')}Tentar de novo</button></div></div></section>`;
      $('[data-tentar]', main).addEventListener('click', render);
    }
  }

  /* ================= Login e senha ================= */

  const CADEADO = `<svg class="auth__lock" viewBox="0 0 200 230" aria-hidden="true">
      <path d="M58 112V70a42 42 0 0 1 84 0v42" fill="none" stroke="#11131F" stroke-width="30" stroke-linecap="round"/>
      <path d="M58 112V70a42 42 0 0 1 84 0v42" fill="none" stroke="#C5CAD8" stroke-width="18" stroke-linecap="round"/>
      <rect x="26" y="104" width="148" height="116" rx="26" fill="#fff" stroke="#11131F" stroke-width="6"/>
      <circle cx="100" cy="152" r="13" fill="#11131F"/><rect x="94" y="156" width="12" height="32" rx="6" fill="#11131F"/>
    </svg>`;

  function telaAuth(alvo, conteudo) {
    alvo.innerHTML = `<div class="auth">
      <section class="auth__brand">
        ${CADEADO}
        <h1 class="auth__title">Lock<br>Machine</h1>
        <p class="auth__lede">Controle de acesso a máquinas por capacitação. Administradores e funcionários usam o mesmo app.</p>
      </section>
      <section class="auth__form"><div class="auth__card">${conteudo}</div></section>
    </div>`;
    if (anima()) {
      gsap.from($('.auth__lock', alvo), { y: -40, rotation: -10, autoAlpha: 0, duration: 0.9, ease: 'bounce.out' });
      gsap.from($('.auth__card', alvo), { y: 24, autoAlpha: 0, duration: 0.5, ease: 'power3.out', delay: 0.1 });
    }
  }

  function vLogin(alvo) {
    telaAuth(alvo, `
      <form class="card form" novalidate>
        <h2 class="card__title">Entrar</h2>
        ${campo({ nome: 'login', rotulo: 'Usuário ou matrícula', attrs: 'autocomplete="username" autocapitalize="none" spellcheck="false" required' })}
        ${senhaCampo('senha', 'Senha', 'current-password')}
        <button class="btn btn--yellow btn--block" type="submit">Entrar ${icon('chevron')}</button>
        <p class="field__hint">Primeiro acesso? Use a senha provisória que o administrador passou. Logo depois você cria a sua.</p>
      </form>
      <div class="auth__links">
        <a href="${SITE}">${'←'} Voltar ao site</a>
        <button class="btn btn--ghost btn--sm" type="button" data-instalar hidden>${icon('download')}Instalar app</button>
      </div>`);
    const form = $('form', alvo);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await enviar(form, (d) => api('auth/login.php', { metodo: 'POST', corpo: { login: d.login, senha: d.senha } }));
      if (!r) return;
      state.user = r.dados;
      toast(r.mensagem);
      ir('#' + inicial());
    });
    $('input[name="login"]', form).focus();
    mostrarInstalar();
  }

  function vTrocarSenha(alvo) {
    const provisoria = state.user.deve_trocar_senha;
    telaAuth(alvo, `
      <form class="card form" novalidate>
        <h2 class="card__title">${provisoria ? 'Crie a sua senha' : 'Trocar senha'}</h2>
        <p class="muted">${provisoria ? `Olá, ${esc(state.user.nome.split(' ')[0])}! Por segurança, troque a senha provisória antes de continuar.` : ''}</p>
        ${senhaCampo('senha_atual', provisoria ? 'Senha provisória' : 'Senha atual', 'current-password')}
        ${senhaCampo('nova_senha', 'Nova senha', 'new-password', 'Pelo menos 8 caracteres, com letras e números.')}
        ${senhaCampo('confirmar', 'Repita a nova senha', 'new-password')}
        <button class="btn btn--yellow btn--block" type="submit">Salvar senha</button>
        <button class="btn btn--ghost btn--block" type="button" data-sair>Sair</button>
      </form>`);
    const form = $('form', alvo);
    $('[data-sair]', form).addEventListener('click', sair);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = lerForm(form);
      if (d.nova_senha !== d.confirmar) {
        mostrarErros(form, new ApiError(400, 'DADOS_INVALIDOS', 'As senhas não conferem.', { confirmar: 'Digite a mesma senha nos dois campos.' }));
        return;
      }
      const r = await enviar(form, () => api('auth/senha.php', { metodo: 'POST', corpo: { senha_atual: d.senha_atual, nova_senha: d.nova_senha } }));
      if (!r) return;
      state.user = r.dados;
      toast('Senha criada. Tudo pronto!');
      ir('#' + inicial());
    });
    $('input', form).focus();
  }

  /* ================= Admin: Painel ================= */

  function grafico(serie) {
    const W = 560;
    const H = 200;
    const base = H - 28;
    const topo = 22;
    const gap = 16;
    const max = Math.max(1, ...serie.map((s) => s.liberados + s.bloqueados));
    const bw = (W - gap * (serie.length - 1)) / serie.length;
    const esc_ = (v) => ((base - topo) * v) / max;
    const barras = serie.map((s, i) => {
      const x = i * (bw + gap);
      const hL = esc_(s.liberados);
      const hB = esc_(s.bloqueados);
      const total = s.liberados + s.bloqueados;
      const dia = fDia.format(lerData(s.dia)).replace('.', '');
      return `<g class="chart__col">
        ${hL ? `<rect class="chart__bar" x="${x}" y="${base - hL}" width="${bw}" height="${hL}" rx="6" fill="#22D07B" stroke="#11131F" stroke-width="2.5"/>` : ''}
        ${hB ? `<rect class="chart__bar" x="${x}" y="${base - hL - hB}" width="${bw}" height="${hB}" rx="6" fill="#FF3D2E" stroke="#11131F" stroke-width="2.5"/>` : ''}
        ${!total ? `<rect x="${x}" y="${base - 3}" width="${bw}" height="3" rx="1.5" fill="#C5CAD8"/>` : ''}
        <text x="${x + bw / 2}" y="${base - hL - hB - 7}" text-anchor="middle">${total || ''}</text>
        <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(dia)}</text>
      </g>`;
    }).join('');
    const totalSemana = serie.reduce((a, s) => a + s.liberados + s.bloqueados, 0);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Tentativas nos últimos 7 dias: ${totalSemana} no total">
      <line x1="0" x2="${W}" y1="${base}" y2="${base}" stroke="#11131F" stroke-width="2.5"/>${barras}</svg>`;
  }

  function linhaAcesso(a, { mostrarOperador = true } = {}) {
    const quem = a.operador_nome || 'Cartão não cadastrado';
    return `<li class="row">
      <span class="dot" style="--tone:${a.autorizado ? 'var(--green)' : 'var(--red)'}" aria-hidden="true"></span>
      <span class="row__main">
        <span class="row__title">${mostrarOperador ? esc(quem) + ' · ' : ''}<span class="code">${esc(a.maquina_codigo)}</span>${a.maquina_nome && !mostrarOperador ? ' ' + esc(a.maquina_nome) : ''}</span>
        <span class="row__meta">${esc(quando(a.data_hora))} · UID ${esc(a.uid)}${a.origem === 'simulador' ? ' · simulador' : ''}</span>
      </span>
      <span class="row__end">${a.autorizado ? pill('Liberado', 'ok', 'check') : pill(MOTIVOS[a.motivo_codigo] || a.motivo_codigo, 'bad', 'x')}</span>
    </li>`;
  }

  async function vPainel(main) {
    const vivo = state.vivo;
    const { dados: d } = await api('dashboard/resumo.php');
    if (!vivo()) return;
    const proximas = d.capacitacoes.proximas;
    const totalMotivos = d.motivos_30_dias.reduce((a, m) => a + m.total, 0);
    main.innerHTML = `<section class="page">
      <div class="page__head">
        <div><h1 class="page__title">Painel</h1><p class="page__sub">${esc(fExtenso.format(new Date()))} · dados do banco, atualizados ${esc(fHora.format(new Date()))}</p></div>
        <div class="page__actions">
          <button class="btn btn--sm" type="button" data-atualizar>${icon('refresh')}Atualizar</button>
          <a class="btn btn--yellow btn--sm" href="#/simular">${icon('waves')}Simular leitura</a>
        </div>
      </div>
      <div class="kpis">
        <div class="kpi"><span class="kpi__n" data-contar="${d.hoje.tentativas}">${d.hoje.tentativas}</span><span class="kpi__l">Tentativas hoje</span></div>
        <div class="kpi" style="--tone:var(--green)"><span class="kpi__n" data-contar="${d.hoje.liberados}">${d.hoje.liberados}</span><span class="kpi__l">Liberadas hoje</span></div>
        <div class="kpi" style="--tone:var(--red)"><span class="kpi__n" data-contar="${d.hoje.bloqueados}">${d.hoje.bloqueados}</span><span class="kpi__l">Bloqueadas hoje</span></div>
        <div class="kpi"><span class="kpi__n" data-contar="${d.operadores.ativos}">${d.operadores.ativos}</span><span class="kpi__l">Funcionários ativos</span></div>
        <div class="kpi" style="--tone:${d.capacitacoes.vencidas ? 'var(--yellow)' : 'var(--paper)'}"><span class="kpi__n" data-contar="${d.capacitacoes.vencidas}">${d.capacitacoes.vencidas}</span><span class="kpi__l">Capacitações vencidas</span></div>
      </div>
      <div class="grid grid--2">
        <article class="card">
          <div class="card__head"><h2 class="card__title">Últimos 7 dias</h2>
            <div class="legend"><span><i style="background:var(--green)"></i>Liberadas</span><span><i style="background:var(--red)"></i>Bloqueadas</span></div></div>
          ${grafico(d.serie_7_dias)}
        </article>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Vencimentos</h2><span class="card__note">vencidas e próximos 30 dias</span></div>
          ${proximas.length ? `<ul class="list">${proximas.map((p) => `<li><a class="row" href="#/funcionarios/${p.operador_id}">
              ${avatar(p.operador)}
              <span class="row__main"><span class="row__title">${esc(p.operador)}</span><span class="row__meta">${esc(p.treinamento)} · ${esc(prazo(p.dias))}</span></span>
              <span class="row__end">${pillSit(p.situacao)}</span></a></li>`).join('')}</ul>`
            : vazio('Nada vencendo.', 'Nenhuma capacitação vence nos próximos 30 dias.', 'check')}
        </article>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Últimas tentativas</h2><a class="btn btn--ghost btn--sm" href="#/acessos">Ver histórico</a></div>
          ${d.recentes.length ? `<ul class="list">${d.recentes.map((a) => linhaAcesso(a)).join('')}</ul>` : vazio('Nenhuma tentativa registrada ainda.', 'Use "Simular leitura" ou a leitora ESP32.', 'history')}
        </article>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Máquinas</h2><a class="btn btn--ghost btn--sm" href="#/maquinas">Gerenciar</a></div>
          ${d.lista_maquinas.length ? `<ul class="list">${d.lista_maquinas.map((m) => `<li><a class="row" href="#/maquinas/${m.id}">
              <span class="code">${esc(m.codigo)}</span>
              <span class="row__main"><span class="row__title">${esc(m.nome)}</span></span>
              <span class="row__end">${pillMaq(m.status)}</span></a></li>`).join('')}</ul>` : vazio('Nenhuma máquina cadastrada.')}
        </article>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Motivos de bloqueio</h2><span class="card__note">últimos 30 dias</span></div>
          ${totalMotivos ? `<div class="bars">${d.motivos_30_dias.map((m) => `<div class="bar">
              <div class="bar__top"><span>${esc(MOTIVOS[m.motivo_codigo] || m.motivo_codigo)}</span><span>${m.total}</span></div>
              <div class="bar__track"><div class="bar__fill" style="width:${Math.max(4, (m.total / totalMotivos) * 100)}%"></div></div></div>`).join('')}</div>`
            : vazio('Nenhum bloqueio no período.', '', 'check')}
        </article>
      </div>
    </section>`;
    contar(main);
    if (anima()) {
      gsap.from($$('.chart__bar', main), { scaleY: 0, transformOrigin: '50% 100%', duration: 0.6, stagger: 0.05, ease: 'back.out(1.6)' });
      gsap.from($$('.bar__fill', main), { scaleX: 0, duration: 0.7, stagger: 0.06, ease: 'power3.out' });
    }
    $('[data-atualizar]', main).addEventListener('click', () => vPainel(main));
    state.timers.push(setInterval(() => {
      if (document.visibilityState === 'visible' && vivo()) vPainel(main).catch(() => {});
    }, 60000));
  }

  /* ================= Admin: Funcionários ================= */

  function linhaFuncionario(o) {
    const marcas = [];
    if (!o.ativo) marcas.push(pill('Inativo', 'soft'));
    if (o.vencidas) marcas.push(pill(plural(o.vencidas, 'vencida', 'vencidas'), 'bad'));
    if (o.vencendo) marcas.push(pill(`${o.vencendo} vencendo`, 'warn'));
    if (!o.tem_cartao) marcas.push(pill('Sem cartão'));
    return `<li><a class="row" href="#/funcionarios/${o.id}">
      ${avatar(o.nome)}
      <span class="row__main"><span class="row__title">${esc(o.nome)}</span>
        <span class="row__meta">${esc(o.matricula)}${o.setor ? ' · ' + esc(o.setor) : ''}${o.tem_login ? ' · usa o app' : ''}</span></span>
      <span class="row__end">${marcas.join('')}${icon('chevron')}</span>
    </a></li>`;
  }

  async function vFuncionarios(main) {
    const vivo = state.vivo;
    const f = state.filtros.func;
    main.innerHTML = `<section class="page">
      <div class="page__head">
        <div><h1 class="page__title">Funcionários</h1><p class="page__sub">Cadastro, cartão RFID, capacitações e acesso ao app.</p></div>
        <div class="page__actions"><a class="btn btn--yellow" href="#/funcionarios/novo">${icon('plus')}Novo funcionário</a></div>
      </div>
      <div class="toolbar">
        <label class="search"><span class="sr">Buscar funcionário</span>${icon('search')}<input class="input" type="search" placeholder="Nome, matrícula ou setor" value="${esc(f.q)}"></label>
        <div class="checks" role="radiogroup" aria-label="Situação">
          ${[['ativos', 'Ativos'], ['inativos', 'Inativos'], ['', 'Todos']].map(([v, t]) => `<label class="chip"><input type="radio" name="situacao" value="${v}"${f.situacao === v ? ' checked' : ''}><span>${t}</span></label>`).join('')}
        </div>
      </div>
      <div class="card" data-lista>${esqueleto(4)}</div>
    </section>`;
    const lista = $('[data-lista]', main);
    async function carregar() {
      const { dados } = await api('operadores/index.php', { query: { q: f.q, situacao: f.situacao } });
      if (!vivo()) return;
      lista.innerHTML = dados.length
        ? `<ul class="list">${dados.map(linhaFuncionario).join('')}</ul>`
        : vazio(f.q ? 'Nenhum funcionário encontrado.' : 'Nenhum funcionário nesta lista.', f.q ? 'Tente outro nome ou matrícula.' : 'Cadastre o primeiro em "Novo funcionário".', 'users');
      listar(lista);
    }
    let t;
    $('input[type="search"]', main).addEventListener('input', (e) => {
      clearTimeout(t);
      t = setTimeout(() => { f.q = e.target.value.trim(); carregar().catch((err) => toast(err.message, 'bad')); }, 250);
    });
    $$('input[name="situacao"]', main).forEach((r) => r.addEventListener('change', () => { f.situacao = r.value; carregar().catch((err) => toast(err.message, 'bad')); }));
    await carregar();
  }

  async function vFuncionarioForm(main, { id }) {
    const vivo = state.vivo;
    const editando = !!id;
    let o = { nome: '', matricula: '', setor: '', rfid_uid: '' };
    if (editando) {
      o = (await api('operadores/index.php', { query: { id } })).dados;
      if (!vivo()) return;
    }
    main.innerHTML = `<section class="page">
      <div>
        <a class="back" href="${editando ? '#/funcionarios/' + id : '#/funcionarios'}">${icon('back')}${editando ? esc(o.nome) : 'Funcionários'}</a>
        <h1 class="page__title">${editando ? 'Editar cadastro' : 'Novo funcionário'}</h1>
      </div>
      <div class="grid grid--2" style="align-items:start">
        <form class="card form" novalidate>
          <div class="form__row">
            ${campo({ nome: 'nome', rotulo: 'Nome completo', valor: o.nome, attrs: 'required autocomplete="off"' })}
          </div>
          <div class="form__row">
            ${campo({ nome: 'matricula', rotulo: 'Matrícula', valor: o.matricula, mono: true, dica: 'Também é o login do funcionário no app.', attrs: 'required autocapitalize="characters" spellcheck="false"' })}
            ${campo({ nome: 'setor', rotulo: 'Setor', valor: o.setor || '', attrs: 'autocomplete="off"' })}
          </div>
          ${campo({ nome: 'rfid_uid', rotulo: 'UID do cartão RFID', valor: o.rfid_uid || '', mono: true, dica: 'Hexadecimal, de 8 a 20 caracteres (ex.: 04A1B2C3D4). Deixe vazio se ainda não houver cartão.', attrs: 'autocapitalize="characters" spellcheck="false" inputmode="text"' })}
          ${editando ? '' : `
          <label class="toggle"><input type="checkbox" name="criar_login" value="1" checked> Criar acesso ao app (login = matrícula)</label>
          ${campo({ nome: 'senha', rotulo: 'Senha inicial (opcional)', tipo: 'password', dica: 'Em branco, o sistema gera uma senha provisória. O funcionário troca no primeiro acesso.', attrs: 'autocomplete="new-password"' })}`}
          <div class="inline">
            <button class="btn btn--yellow" type="submit">${editando ? 'Salvar alterações' : 'Cadastrar funcionário'}</button>
            <a class="btn btn--ghost" href="${editando ? '#/funcionarios/' + id : '#/funcionarios'}">Cancelar</a>
          </div>
        </form>
        <div class="stack" data-resultado>
          <div class="card card--flat">
            <h2 class="card__title" style="margin-bottom:8px">Como o cartão é usado</h2>
            <p class="muted">O UID só identifica a pessoa. Na leitora, o servidor confere se o cadastro está ativo, se a máquina está disponível e se as capacitações exigidas estão em dia. Cada cartão pertence a um único funcionário.</p>
          </div>
        </div>
      </div>
    </section>`;
    const form = $('form', main);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await enviar(form, (d) => api('operadores/index.php', {
        metodo: 'POST',
        query: editando ? { id } : null,
        corpo: { nome: d.nome, matricula: d.matricula, setor: d.setor, rfid_uid: d.rfid_uid, criar_login: !!d.criar_login, senha: d.senha || '' },
      }));
      if (!r) return;
      toast(r.mensagem);
      if (!editando && r.dados.senha_provisoria) {
        $('[data-resultado]', main).innerHTML = segredo({
          titulo: 'Acesso ao app criado',
          itens: [['Login', r.dados.login], ['Senha provisória', r.dados.senha_provisoria]],
          nota: 'Anote e entregue ao funcionário. Esta senha não aparece de novo; ele cria a própria no primeiro acesso.',
        }) + `<a class="btn btn--yellow" href="#/funcionarios/${r.dados.id}">Ver cadastro e capacitações ${icon('chevron')}</a>`;
        form.reset();
        $$('input, button', form).forEach((el) => { el.disabled = true; });
        if (anima()) gsap.from($('[data-resultado] > *', main), { y: 20, autoAlpha: 0, duration: 0.4, stagger: 0.08 });
        return;
      }
      ir('#/funcionarios/' + (editando ? id : r.dados.id));
    });
    $('input[name="nome"]', form).focus();
  }

  async function vFuncionario(main, { id }) {
    const vivo = state.vivo;
    const [{ dados: o }, { dados: treinos }] = await Promise.all([
      api('operadores/index.php', { query: { id } }),
      api('treinamentos/index.php'),
    ]);
    if (!vivo()) return;

    const caps = o.capacitacoes;
    main.innerHTML = `<section class="page">
      <div>
        <a class="back" href="#/funcionarios">${icon('back')}Funcionários</a>
        <div class="page__head">
          <div class="inline" style="gap:14px">
            ${avatar(o.nome, 'avatar--lg')}
            <div><h1 class="page__title" style="font-size:clamp(1.3rem,1rem + 1.4vw,2rem)">${esc(o.nome)}</h1>
              <p class="page__sub">${esc(o.matricula)}${o.setor ? ' · ' + esc(o.setor) : ''} · ${o.ativo ? pill('Ativo', 'ok') : pill('Inativo', 'soft')}</p></div>
          </div>
          <div class="page__actions">
            <a class="btn btn--sm" href="#/funcionarios/${o.id}/editar">${icon('edit')}Editar</a>
            <button class="btn btn--sm" type="button" data-senha>${icon('key')}${o.app ? 'Nova senha do app' : 'Criar acesso ao app'}</button>
            <button class="btn btn--sm ${o.ativo ? 'btn--red' : 'btn--green'}" type="button" data-ativo>${o.ativo ? 'Desativar' : 'Reativar'}</button>
          </div>
        </div>
      </div>
      <div data-segredo></div>
      <div class="grid grid--2">
        <article class="card">
          <div class="card__head"><h2 class="card__title">Cartão RFID</h2>${icon('card')}</div>
          ${o.rfid_uid ? `<p class="secret__value" style="background:var(--ground)"><span>${esc(o.rfid_uid)}</span></p><p class="card__note" style="margin-top:8px">Cada cartão pertence a um único funcionário.</p>`
            : vazio('Sem cartão vinculado.', 'Edite o cadastro e informe o UID lido na leitora.', 'card')}
        </article>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Acesso ao app</h2>${icon('user')}</div>
          ${o.app ? `<ul class="list">
              <li class="row"><span>${icon('user')}</span><span class="row__main"><span class="row__title">Login: ${esc(o.app.login)}</span><span class="row__meta">${o.app.ultimo_login ? 'Último acesso ' + esc(quando(o.app.ultimo_login)) : 'Ainda não entrou no app'}</span></span>
              <span class="row__end">${o.app.senha_provisoria ? pill('Senha provisória', 'warn') : pill('Senha própria', 'ok')}</span></li></ul>`
            : vazio('Sem acesso ao app.', 'Use "Criar acesso ao app" para gerar login e senha provisória.', 'user')}
        </article>
      </div>
      <article class="card">
        <div class="card__head"><h2 class="card__title">Capacitações</h2><span class="card__note">${plural(caps.length, 'registro', 'registros')}</span></div>
        ${caps.length ? `<ul class="list">${caps.map((c) => `<li class="row">
            <span class="dot" style="--tone:${c.situacao === 'valida' ? 'var(--green)' : c.situacao === 'vencendo' ? 'var(--yellow)' : 'var(--red)'}"></span>
            <span class="row__main"><span class="row__title">${esc(c.nome)}</span>
              <span class="row__meta">Concluída em ${esc(dataBR(c.concluido_em))} · válida até ${esc(dataBR(c.valido_ate))} · ${esc(prazo(c.dias))}</span></span>
            <span class="row__end">${pillSit(c.situacao)}
              <button class="btn btn--sm" type="button" data-renovar="${c.treinamento_id}">Renovar</button>
              <button class="icon-btn" type="button" data-remover="${c.id}" aria-label="Remover ${esc(c.nome)}">${icon('trash')}</button></span>
          </li>`).join('')}</ul>` : vazio('Nenhuma capacitação registrada.', 'Registre abaixo os treinamentos concluídos.', 'book')}
        <form class="form" data-cap novalidate style="margin-top:16px;padding-top:16px;border-top:3px dashed var(--ground)">
          <h3 class="field__label" style="font-size:1rem">Registrar ou renovar capacitação</h3>
          <div class="form__row">
            ${selecao({ nome: 'treinamento_id', rotulo: 'Treinamento', opcoes: treinos.map((t) => [t.id, `${t.nome} (${plural(t.validade_meses, 'mês', 'meses')})`]), vaziaTexto: 'Escolha…' })}
            ${campo({ nome: 'concluido_em', rotulo: 'Concluído em', tipo: 'date', valor: hojeISO(), attrs: `max="${hojeISO()}" required` })}
            ${campo({ nome: 'valido_ate', rotulo: 'Vence em (opcional)', tipo: 'date', dica: 'Em branco: calculado pela validade do treinamento.' })}
          </div>
          <div><button class="btn btn--yellow" type="submit">${icon('plus')}Registrar</button></div>
        </form>
      </article>
      <div class="grid grid--2">
        <article class="card">
          <div class="card__head"><h2 class="card__title">Máquinas</h2><span class="card__note">situação hoje</span></div>
          ${o.maquinas.length ? `<ul class="list">${o.maquinas.map((m) => `<li class="row">
              <span class="code">${esc(m.codigo)}</span>
              <span class="row__main"><span class="row__title">${esc(m.nome)}</span><span class="row__meta">${esc(m.liberada ? 'Pode operar' : m.detalhe)}</span></span>
              <span class="row__end">${m.liberada ? pill('Liberada', 'ok', 'check') : pill(MOTIVOS[m.motivo_codigo], 'bad', 'x')}</span></li>`).join('')}</ul>` : vazio('Nenhuma máquina cadastrada.')}
        </article>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Últimas tentativas</h2></div>
          ${o.acessos.length ? `<ul class="list">${o.acessos.map((a) => linhaAcesso(a, { mostrarOperador: false })).join('')}</ul>` : vazio('Nenhuma tentativa registrada.', '', 'history')}
        </article>
      </div>
    </section>`;

    const recarregar = () => vFuncionario(main, { id });
    const formCap = $('[data-cap]', main);
    formCap.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await enviar(formCap, (d) => api('capacitacoes/index.php', {
        metodo: 'POST',
        corpo: { operador_id: Number(id), treinamento_id: d.treinamento_id, concluido_em: d.concluido_em, valido_ate: d.valido_ate },
      }));
      if (!r) return;
      toast(r.mensagem);
      recarregar();
    });
    $$('[data-renovar]', main).forEach((b) => b.addEventListener('click', () => {
      $('select[name="treinamento_id"]', formCap).value = b.dataset.renovar;
      $('input[name="concluido_em"]', formCap).value = hojeISO();
      formCap.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      $('input[name="concluido_em"]', formCap).focus();
    }));
    $$('[data-remover]', main).forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmar({ titulo: 'Remover capacitação?', texto: 'O registro sai do cadastro. Tentativas antigas continuam no histórico.', ok: 'Remover', perigo: true }))) return;
      const r = await executar(b, () => api('capacitacoes/index.php', { metodo: 'POST', query: { id: b.dataset.remover, acao: 'remover' } }));
      if (r) { toast(r.mensagem); recarregar(); }
    }));
    $('[data-senha]', main).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      const ok = await confirmar({
        titulo: o.app ? 'Gerar nova senha?' : 'Criar acesso ao app?',
        texto: o.app ? 'A senha atual deixa de funcionar e o funcionário cria outra no próximo acesso.' : `O login será a matrícula ${o.matricula}, com uma senha provisória.`,
        ok: 'Gerar senha',
      });
      if (!ok) return;
      const r = await executar(b, () => api('operadores/index.php', { metodo: 'POST', query: { id, acao: 'senha' } }));
      if (!r) return;
      await recarregar();
      $('[data-segredo]', main).innerHTML = segredo({ titulo: 'Senha provisória gerada', itens: [['Login', r.dados.login], ['Senha provisória', r.dados.senha_provisoria]], nota: 'Entregue ao funcionário. Ela não aparece de novo.' });
    });
    $('[data-ativo]', main).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (o.ativo && !(await confirmar({ titulo: 'Desativar funcionário?', texto: 'O cartão passa a ser bloqueado e o login no app deixa de funcionar. O histórico é preservado.', ok: 'Desativar', perigo: true }))) return;
      const r = await executar(b, () => api('operadores/index.php', { metodo: 'POST', query: { id, acao: o.ativo ? 'desativar' : 'ativar' } }));
      if (r) { toast(r.mensagem); recarregar(); }
    });
  }

  /* ================= Admin: Máquinas ================= */

  async function vMaquinas(main) {
    const vivo = state.vivo;
    const { dados } = await api('maquinas/index.php');
    if (!vivo()) return;
    main.innerHTML = `<section class="page">
      <div class="page__head">
        <div><h1 class="page__title">Máquinas</h1><p class="page__sub">Status operacional e capacitações exigidas para operar.</p></div>
        <div class="page__actions"><a class="btn btn--yellow" href="#/maquinas/nova">${icon('plus')}Nova máquina</a></div>
      </div>
      ${dados.length ? `<div class="grid grid--3">${dados.map((m) => `<a class="card" href="#/maquinas/${m.id}" style="text-decoration:none;display:grid;gap:10px">
          <div class="inline" style="justify-content:space-between"><span class="code" style="font-size:.95rem">${esc(m.codigo)}</span>${pillMaq(m.status)}</div>
          <div><h2 class="card__title" style="text-transform:none;font-size:1.2rem">${esc(m.nome)}</h2><p class="muted">${esc(m.localizacao || 'Sem localização')}</p></div>
          <div class="inline">${m.exigencias.length ? m.exigencias.map((t) => pill(t.nome, 'soft')).join('') : '<span class="muted">Nenhuma capacitação exigida</span>'}</div>
          <p class="card__note">${plural(m.acessos_hoje, 'tentativa', 'tentativas')} hoje${m.ultimo_acesso ? ' · última ' + esc(quando(m.ultimo_acesso)) : ''}</p>
        </a>`).join('')}</div>` : `<div class="card">${vazio('Nenhuma máquina cadastrada.', 'Cadastre a primeira em "Nova máquina".', 'machine')}</div>`}
    </section>`;
  }

  async function vMaquinaForm(main, { id }) {
    const vivo = state.vivo;
    const editando = !!id;
    const pedidos = [api('treinamentos/index.php')];
    if (editando) pedidos.push(api('maquinas/index.php', { query: { id } }));
    const [{ dados: treinos }, maq] = await Promise.all(pedidos);
    if (!vivo()) return;
    const m = maq ? maq.dados : { codigo: '', nome: '', localizacao: '', status: 'ativa', exigencias: [], acessos: [] };
    const exigidas = new Set(m.exigencias.map((t) => t.id));
    const tons = { ativa: 'var(--green)', manutencao: 'var(--yellow)', bloqueada: 'var(--red)', inativa: 'var(--steel)' };
    main.innerHTML = `<section class="page">
      <div><a class="back" href="#/maquinas">${icon('back')}Máquinas</a>
        <h1 class="page__title">${editando ? esc(m.codigo) + ' · ' + esc(m.nome) : 'Nova máquina'}</h1></div>
      <div class="grid grid--2" style="align-items:start">
        <form class="card form" novalidate>
          <div class="form__row">
            ${campo({ nome: 'codigo', rotulo: 'Código', valor: m.codigo, mono: true, dica: 'Usado pela leitora. Ex.: P-01', attrs: 'required autocapitalize="characters" spellcheck="false"' })}
            ${campo({ nome: 'nome', rotulo: 'Nome', valor: m.nome, attrs: 'required' })}
          </div>
          ${campo({ nome: 'localizacao', rotulo: 'Localização', valor: m.localizacao || '' })}
          <fieldset class="field" data-field="status" style="border:0;padding:0;margin:0">
            <legend class="field__label" style="margin-bottom:6px">Status</legend>
            <div class="checks">${Object.entries(STATUS_MAQ).map(([v, [t]]) => `<label class="chip chip--status" style="--tone:${tons[v]}"><input type="radio" name="status" value="${v}"${m.status === v ? ' checked' : ''}><span>${t}</span></label>`).join('')}</div>
            <span class="field__hint">Fora de "Ativa", a leitora bloqueia mesmo com capacitações válidas.</span>
          </fieldset>
          <fieldset class="field" data-field="exigencias" style="border:0;padding:0;margin:0">
            <legend class="field__label" style="margin-bottom:6px">Capacitações exigidas</legend>
            ${treinos.length ? `<div class="checks">${treinos.map((t) => `<label class="chip"><input type="checkbox" name="exigencias[]" value="${t.id}"${exigidas.has(t.id) ? ' checked' : ''}><span>${esc(t.nome)}</span></label>`).join('')}</div>`
              : `<p class="muted">Nenhum treinamento cadastrado. <a href="#/treinamentos">Cadastre em Treinamentos</a>.</p>`}
          </fieldset>
          <div class="inline">
            <button class="btn btn--yellow" type="submit">${editando ? 'Salvar alterações' : 'Cadastrar máquina'}</button>
            <a class="btn btn--ghost" href="#/maquinas">Cancelar</a>
          </div>
        </form>
        ${editando ? `<article class="card">
            <div class="card__head"><h2 class="card__title">Últimas tentativas</h2></div>
            ${m.acessos.length ? `<ul class="list">${m.acessos.map((a) => linhaAcesso(a)).join('')}</ul>` : vazio('Nenhuma tentativa nesta máquina.', '', 'history')}
          </article>` : ''}
      </div>
    </section>`;
    const form = $('form', main);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await enviar(form, (d) => api('maquinas/index.php', {
        metodo: 'POST',
        query: editando ? { id } : null,
        corpo: { codigo: d.codigo, nome: d.nome, localizacao: d.localizacao, status: d.status, exigencias: (d.exigencias || []).map(Number) },
      }));
      if (!r) return;
      toast(r.mensagem);
      ir('#/maquinas');
    });
  }

  /* ================= Admin: Treinamentos ================= */

  async function vTreinamentos(main) {
    const vivo = state.vivo;
    const { dados } = await api('treinamentos/index.php');
    if (!vivo()) return;
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">Treinamentos</h1><p class="page__sub">Tipos de capacitação e por quanto tempo valem.</p></div></div>
      <div class="grid grid--2" style="align-items:start">
        <form class="card form" novalidate>
          <h2 class="card__title" data-titulo-form>Novo treinamento</h2>
          <input type="hidden" name="id" value="">
          ${campo({ nome: 'nome', rotulo: 'Nome', attrs: 'required' })}
          ${campo({ nome: 'validade_meses', rotulo: 'Validade (meses)', tipo: 'number', valor: '12', attrs: 'min="1" max="120" required inputmode="numeric"' })}
          <label class="field" data-field="descricao"><span class="field__label">Descrição (opcional)</span><textarea class="textarea" name="descricao" maxlength="255"></textarea></label>
          <div class="inline">
            <button class="btn btn--yellow" type="submit">Salvar treinamento</button>
            <button class="btn btn--ghost" type="button" data-novo hidden>Cancelar edição</button>
            <span class="spacer"></span>
            <button class="btn btn--red btn--sm" type="button" data-excluir hidden>${icon('trash')}Excluir</button>
          </div>
        </form>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Cadastrados</h2><span class="card__note">toque para editar</span></div>
          ${dados.length ? `<ul class="list">${dados.map((t) => `<li><a class="row" href="#/treinamentos" data-editar="${t.id}">
              ${icon('book')}
              <span class="row__main"><span class="row__title">${esc(t.nome)}</span>
                <span class="row__meta">Válido por ${plural(t.validade_meses, 'mês', 'meses')} · ${plural(t.maquinas, 'máquina exige', 'máquinas exigem')} · ${plural(t.operadores, 'funcionário', 'funcionários')}</span></span>
              <span class="row__end">${t.vencidas ? pill(plural(t.vencidas, 'vencida', 'vencidas'), 'bad') : ''}${icon('edit')}</span></a></li>`).join('')}</ul>`
            : vazio('Nenhum treinamento cadastrado.', 'Use o formulário ao lado.', 'book')}
        </article>
      </div>
    </section>`;
    const form = $('form', main);
    const porId = Object.fromEntries(dados.map((t) => [t.id, t]));
    const preencher = (t) => {
      limparErros(form);
      form.id.value = t ? t.id : '';
      form.nome.value = t ? t.nome : '';
      form.validade_meses.value = t ? t.validade_meses : 12;
      form.descricao.value = t ? t.descricao || '' : '';
      $('[data-titulo-form]', main).textContent = t ? 'Editar treinamento' : 'Novo treinamento';
      $('[data-novo]', main).hidden = !t;
      $('[data-excluir]', main).hidden = !t;
    };
    $$('[data-editar]', main).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      preencher(porId[a.dataset.editar]);
      form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      form.nome.focus();
    }));
    $('[data-novo]', main).addEventListener('click', () => preencher(null));
    $('[data-excluir]', main).addEventListener('click', async (e) => {
      const b = e.currentTarget;
      if (!(await confirmar({ titulo: 'Excluir treinamento?', texto: 'Só é possível excluir se nenhuma máquina ou funcionário usar este treinamento.', ok: 'Excluir', perigo: true }))) return;
      const r = await executar(b, () => api('treinamentos/index.php', { metodo: 'POST', query: { id: form.id.value, acao: 'excluir' } }));
      if (r) { toast(r.mensagem); vTreinamentos(main); }
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await enviar(form, (d) => api('treinamentos/index.php', {
        metodo: 'POST',
        query: d.id ? { id: d.id } : null,
        corpo: { nome: d.nome, validade_meses: Number(d.validade_meses), descricao: d.descricao },
      }));
      if (!r) return;
      toast(r.mensagem);
      vTreinamentos(main);
    });
  }

  /* ================= Admin: Histórico ================= */

  async function vAcessos(main) {
    const vivo = state.vivo;
    const [{ dados: ops }, { dados: maqs }] = await Promise.all([api('operadores/index.php'), api('maquinas/index.php')]);
    if (!vivo()) return;
    const f = state.filtros.acessos;
    main.innerHTML = `<section class="page">
      <div class="page__head">
        <div><h1 class="page__title">Histórico</h1><p class="page__sub">Toda tentativa de validação, liberada ou bloqueada.</p></div>
        <div class="page__actions"><button class="btn btn--sm" type="button" data-csv>${icon('download')}Exportar CSV</button></div>
      </div>
      <form class="card filters" novalidate>
        ${campo({ nome: 'de', rotulo: 'De', tipo: 'date', valor: f.de || '' })}
        ${campo({ nome: 'ate', rotulo: 'Até', tipo: 'date', valor: f.ate || '' })}
        ${selecao({ nome: 'operador_id', rotulo: 'Funcionário', opcoes: ops.map((o) => [o.id, o.nome]), valor: f.operador_id || '', vaziaTexto: 'Todos' })}
        ${selecao({ nome: 'maquina_id', rotulo: 'Máquina', opcoes: maqs.map((m) => [m.id, `${m.codigo} · ${m.nome}`]), valor: f.maquina_id || '', vaziaTexto: 'Todas' })}
        ${selecao({ nome: 'resultado', rotulo: 'Resultado', opcoes: [['liberado', 'Liberado'], ['bloqueado', 'Bloqueado']], valor: f.resultado || '', vaziaTexto: 'Todos' })}
        ${selecao({ nome: 'origem', rotulo: 'Origem', opcoes: [['dispositivo', 'Leitora RFID'], ['simulador', 'Simulador']], valor: f.origem || '', vaziaTexto: 'Todas' })}
        <div class="inline"><button class="btn btn--yellow" type="submit">${icon('search')}Filtrar</button><button class="btn btn--ghost" type="button" data-limpar>Limpar</button></div>
      </form>
      <div class="card" data-resultado>${esqueleto(5)}</div>
    </section>`;
    const form = $('form', main);
    const area = $('[data-resultado]', main);
    let pagina = 1;
    const consultaAtual = () => Object.assign({}, f, { pagina });
    async function carregar() {
      area.innerHTML = esqueleto(5);
      const { dados: d } = await api('acessos/index.php', { query: consultaAtual() });
      if (!vivo()) return;
      area.innerHTML = `<div class="inline" style="margin-bottom:10px">${pill(plural(d.total, 'tentativa', 'tentativas'), 'ink')}${pill(`${d.liberados} liberadas`, 'ok')}${pill(`${d.bloqueados} bloqueadas`, 'bad')}</div>
        ${d.itens.length ? `<ul class="list">${d.itens.map((a) => linhaAcesso(a)).join('')}</ul>` : vazio('Nada encontrado com estes filtros.', '', 'search')}
        ${d.paginas > 1 ? `<div class="pager"><button class="btn btn--sm" type="button" data-pag="-1"${d.pagina <= 1 ? ' disabled' : ''}>${icon('back')}Anterior</button>
          <span>${d.pagina} de ${d.paginas}</span>
          <button class="btn btn--sm" type="button" data-pag="1"${d.pagina >= d.paginas ? ' disabled' : ''}>Próxima${icon('chevron')}</button></div>` : ''}`;
      listar(area);
      $$('[data-pag]', area).forEach((b) => b.addEventListener('click', () => { pagina += Number(b.dataset.pag); carregar().catch((e) => toast(e.message, 'bad')); }));
    }
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const d = lerForm(form);
      Object.keys(f).forEach((k) => delete f[k]);
      Object.entries(d).forEach(([k, v]) => { if (v) f[k] = v; });
      pagina = 1;
      carregar().catch((err) => toast(err.message, 'bad'));
    });
    $('[data-limpar]', main).addEventListener('click', () => {
      Object.keys(f).forEach((k) => delete f[k]);
      vAcessos(main);
    });
    $('[data-csv]', main).addEventListener('click', (e) => executar(e.currentTarget, async () => {
      const linhas = [['data_hora', 'operador', 'uid_mascarado', 'maquina', 'resultado', 'motivo_codigo', 'origem']];
      for (let p = 1; p <= 40; p++) {
        const { dados: d } = await api('acessos/index.php', { query: Object.assign({}, f, { pagina: p }) });
        d.itens.forEach((a) => linhas.push([a.data_hora, a.operador_nome || '', a.uid, a.maquina_codigo, a.autorizado ? 'liberado' : 'bloqueado', a.motivo_codigo, a.origem]));
        if (p >= d.paginas) break;
      }
      const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
      const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `lockmachine-acessos-${hojeISO()}.csv`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast(`${linhas.length - 1} registros exportados.`);
    }));
    await carregar();
  }

  /* ================= Admin: Simular leitura ================= */

  async function vSimular(main) {
    const vivo = state.vivo;
    const [{ dados: ops }, { dados: maqs }] = await Promise.all([api('operadores/index.php'), api('maquinas/index.php')]);
    if (!vivo()) return;
    const comCartao = ops.filter((o) => o.tem_cartao);
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">Simular leitura</h1><p class="page__sub">Testa a regra real do servidor sem a leitora física.</p></div></div>
      <div class="alert alert--info">${icon('info')}<span>Cada simulação entra no histórico com a origem "simulador". A leitora ESP32 usa a mesma rota e a mesma regra.</span></div>
      <div class="grid grid--2" style="align-items:start">
        <form class="card form" novalidate>
          ${selecao({ nome: 'operador', rotulo: 'Cartão do funcionário', opcoes: comCartao.map((o) => [o.id, `${o.nome} · ${o.uid}${o.ativo ? '' : ' (inativo)'}`]).concat([['outro', 'Outro UID (digitar)']]), vaziaTexto: 'Escolha…' })}
          <div data-outro hidden>${campo({ nome: 'rfid_uid', rotulo: 'UID lido', mono: true, dica: 'Ex.: 04FF19D0AE', attrs: 'spellcheck="false" autocapitalize="characters"' })}</div>
          ${selecao({ nome: 'maquina_codigo', rotulo: 'Máquina', opcoes: maqs.map((m) => [m.codigo, `${m.codigo} · ${m.nome} (${(STATUS_MAQ[m.status] || [m.status])[0].toLowerCase()})`]), vaziaTexto: 'Escolha…' })}
          <button class="btn btn--yellow btn--block" type="submit">${icon('waves')}Aproximar cartão</button>
        </form>
        <article class="card" data-veredito>${vazio('Aguardando leitura.', 'Escolha um cartão e uma máquina.', 'waves')}</article>
      </div>
    </section>`;
    const form = $('form', main);
    const outro = $('[data-outro]', main);
    form.operador.addEventListener('change', () => { outro.hidden = form.operador.value !== 'outro'; });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = lerForm(form);
      if (!d.operador) {
        mostrarErros(form, new ApiError(400, 'DADOS_INVALIDOS', 'Escolha um cartão.', { operador: 'Escolha um cartão ou digite um UID.' }));
        return;
      }
      let uid = d.rfid_uid;
      if (d.operador !== 'outro') {
        const { dados: det } = await api('operadores/index.php', { query: { id: d.operador } });
        uid = det.rfid_uid;
      }
      const r = await enviar(form, () => api('acessos/validar.php', { metodo: 'POST', corpo: { rfid_uid: uid, maquina_codigo: d.maquina_codigo } }));
      if (!r) return;
      const v = r.dados;
      const area = $('[data-veredito]', main);
      area.innerHTML = `<div class="verdict">
        <span class="stamp ${v.autorizado ? 'stamp--ok' : 'stamp--no'}">${v.autorizado ? 'Liberado' : 'Bloqueado'}</span>
        <p><span class="code">${esc(v.motivo_codigo)}</span> ${esc(r.mensagem)}</p>
        <p class="muted">${esc(v.detalhe)}</p>
        <ul class="list" style="width:100%">
          <li class="row">${icon('user')}<span class="row__main"><span class="row__title">${esc(v.operador ? v.operador.nome : 'Cartão não cadastrado')}</span><span class="row__meta">${v.operador ? esc(v.operador.matricula) : 'UID ' + esc(uid)}</span></span></li>
          <li class="row">${icon('machine')}<span class="row__main"><span class="row__title">${esc(v.maquina.codigo)}${v.maquina.nome ? ' · ' + esc(v.maquina.nome) : ''}</span><span class="row__meta">${v.maquina.status ? 'Status: ' + esc((STATUS_MAQ[v.maquina.status] || [v.maquina.status])[0]) : 'Máquina não cadastrada'}</span></span></li>
          ${v.exigencias.map((x) => `<li class="row">${icon('book')}<span class="row__main"><span class="row__title">${esc(x.nome)}</span><span class="row__meta">${x.valido_ate ? 'Válida até ' + esc(dataBR(x.valido_ate)) : 'Não registrada'}</span></span><span class="row__end">${pillSit(x.situacao)}</span></li>`).join('')}
        </ul>
        <p class="card__note">Acesso #${v.acesso_id} registrado ${esc(quando(v.data_hora))} · origem simulador</p>
      </div>`;
      if (anima()) {
        gsap.fromTo($('.stamp', area), { scale: 2.4, rotation: -18, autoAlpha: 0 }, { scale: 1, rotation: -3, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.2)' });
        gsap.from($$('.row', area), { x: 16, autoAlpha: 0, duration: 0.3, stagger: 0.05, delay: 0.2 });
      }
      if (window.innerWidth < 960) area.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
  }

  /* ================= Admin: Leitoras ================= */

  async function vLeitoras(main) {
    const vivo = state.vivo;
    const [{ dados: leitoras }, { dados: maqs }] = await Promise.all([api('dispositivos/index.php'), api('maquinas/index.php')]);
    if (!vivo()) return;
    const urlValidar = new URL('acessos/validar.php', API).href;
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">Leitoras RFID</h1><p class="page__sub">ESP32 + MFRC522 autorizados a pedir validação.</p></div></div>
      <div class="grid grid--2" style="align-items:start">
        <div class="stack">
          <form class="card form" novalidate>
            <h2 class="card__title">Nova leitora</h2>
            ${campo({ nome: 'nome', rotulo: 'Nome', valor: '', dica: 'Ex.: Leitora da prensa', attrs: 'required' })}
            ${selecao({ nome: 'maquina_id', rotulo: 'Instalada na máquina', opcoes: maqs.map((m) => [m.id, `${m.codigo} · ${m.nome}`]), vaziaTexto: 'Nenhuma (a leitora informa o código)' })}
            <button class="btn btn--yellow" type="submit">${icon('plus')}Cadastrar e gerar token</button>
          </form>
          <div data-token></div>
          <div class="card card--flat">
            <h2 class="card__title" style="margin-bottom:8px">No firmware da leitora</h2>
            <p class="muted">Copie a URL e o token para o arquivo <span class="mono">lockmachine_esp32.ino</span> (pasta firmware do projeto).</p>
            <div class="secret__value" style="margin-top:10px;background:var(--ground)"><span>${esc(urlValidar)}</span><button class="btn btn--sm" type="button" data-copiar="${esc(urlValidar)}">${icon('copy')}Copiar</button></div>
          </div>
        </div>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Cadastradas</h2></div>
          ${leitoras.length ? `<ul class="list">${leitoras.map((l) => `<li class="row">
              ${icon('chip')}
              <span class="row__main"><span class="row__title">${esc(l.nome)}</span>
                <span class="row__meta">${l.maquina_codigo ? 'Máquina ' + esc(l.maquina_codigo) : 'Sem máquina fixa'} · token …${esc(l.token_final)} · ${l.ultimo_contato ? 'último contato ' + esc(quando(l.ultimo_contato)) : 'nunca conectou'}</span></span>
              <span class="row__end">${l.ativo ? pill('Ativa', 'ok') : pill('Bloqueada', 'bad')}
                <button class="btn btn--sm" type="button" data-token-novo="${l.id}">Novo token</button>
                <button class="btn btn--sm" type="button" data-alternar="${l.id}" data-ativo="${l.ativo ? 1 : 0}">${l.ativo ? 'Bloquear' : 'Liberar'}</button></span>
            </li>`).join('')}</ul>` : vazio('Nenhuma leitora cadastrada.', 'Cadastre a leitora para gerar o token do firmware.', 'chip')}
        </article>
      </div>
    </section>`;
    const form = $('form', main);
    const mostrarToken = (token) => {
      $('[data-token]', main).innerHTML = segredo({ titulo: 'Token da leitora', itens: [['Token', token]], nota: 'Copie agora e cole no firmware. Por segurança ele não aparece de novo.' });
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await enviar(form, (d) => api('dispositivos/index.php', { metodo: 'POST', corpo: { nome: d.nome, maquina_id: d.maquina_id || null } }));
      if (!r) return;
      toast(r.mensagem);
      await vLeitoras(main);
      mostrarToken(r.dados.token);
    });
    $$('[data-token-novo]', main).forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmar({ titulo: 'Gerar novo token?', texto: 'O token atual para de funcionar. Será preciso atualizar o firmware da leitora.', ok: 'Gerar token' }))) return;
      const r = await executar(b, () => api('dispositivos/index.php', { metodo: 'POST', query: { id: b.dataset.tokenNovo, acao: 'novo_token' } }));
      if (r) { await vLeitoras(main); mostrarToken(r.dados.token); }
    }));
    $$('[data-alternar]', main).forEach((b) => b.addEventListener('click', async () => {
      const r = await executar(b, () => api('dispositivos/index.php', { metodo: 'POST', query: { id: b.dataset.alternar, acao: b.dataset.ativo === '1' ? 'revogar' : 'ativar' } }));
      if (r) { toast(r.mensagem); vLeitoras(main); }
    }));
  }

  /* ================= Admin: Administradores ================= */

  async function vAdmins(main) {
    const vivo = state.vivo;
    const { dados } = await api('usuarios/index.php');
    if (!vivo()) return;
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">Administradores</h1><p class="page__sub">Quem pode cadastrar funcionários, máquinas e treinamentos.</p></div></div>
      <div class="grid grid--2" style="align-items:start">
        <div class="stack">
          <form class="card form" novalidate>
            <h2 class="card__title">Novo administrador</h2>
            ${campo({ nome: 'nome', rotulo: 'Nome', attrs: 'required' })}
            <div class="form__row">
              ${campo({ nome: 'login', rotulo: 'Login', dica: 'Letras minúsculas, números, ponto ou hífen.', attrs: 'required autocapitalize="none" spellcheck="false"' })}
              ${campo({ nome: 'email', rotulo: 'E-mail (opcional)', tipo: 'email', attrs: 'autocapitalize="none"' })}
            </div>
            <button class="btn btn--yellow" type="submit">${icon('plus')}Criar administrador</button>
          </form>
          <div data-segredo></div>
        </div>
        <article class="card">
          <div class="card__head"><h2 class="card__title">Contas</h2></div>
          <ul class="list">${dados.map((u) => `<li class="row">
              ${avatar(u.nome)}
              <span class="row__main"><span class="row__title">${esc(u.nome)}${u.eu ? ' (você)' : ''}</span>
                <span class="row__meta">${esc(u.login)}${u.email ? ' · ' + esc(u.email) : ''} · ${u.ultimo_login ? 'entrou ' + esc(quando(u.ultimo_login)) : 'nunca entrou'}</span></span>
              <span class="row__end">${u.ativo ? pill('Ativo', 'ok') : pill('Inativo', 'soft')}
                ${u.eu ? '' : `<button class="btn btn--sm" type="button" data-senha="${u.id}">${icon('key')}Senha</button>
                <button class="btn btn--sm" type="button" data-alternar="${u.id}" data-ativo="${u.ativo ? 1 : 0}">${u.ativo ? 'Desativar' : 'Reativar'}</button>`}</span>
            </li>`).join('')}</ul>
        </article>
      </div>
    </section>`;
    const form = $('form', main);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const r = await enviar(form, (d) => api('usuarios/index.php', { metodo: 'POST', corpo: { nome: d.nome, login: d.login, email: d.email } }));
      if (!r) return;
      toast(r.mensagem);
      await vAdmins(main);
      $('[data-segredo]', main).innerHTML = segredo({ titulo: 'Conta criada', itens: [['Login', r.dados.login], ['Senha provisória', r.dados.senha_provisoria]], nota: 'Entregue à pessoa. A senha é trocada no primeiro acesso.' });
    });
    $$('[data-senha]', main).forEach((b) => b.addEventListener('click', async () => {
      if (!(await confirmar({ titulo: 'Gerar senha provisória?', texto: 'A senha atual dessa conta deixa de funcionar.', ok: 'Gerar senha' }))) return;
      const r = await executar(b, () => api('usuarios/index.php', { metodo: 'POST', query: { id: b.dataset.senha, acao: 'senha' } }));
      if (r) $('[data-segredo]', main).innerHTML = segredo({ titulo: 'Senha provisória', itens: [['Senha', r.dados.senha_provisoria]], nota: 'Ela não aparece de novo.' });
    }));
    $$('[data-alternar]', main).forEach((b) => b.addEventListener('click', async () => {
      const desativar = b.dataset.ativo === '1';
      if (desativar && !(await confirmar({ titulo: 'Desativar administrador?', texto: 'A pessoa não consegue mais entrar no app.', ok: 'Desativar', perigo: true }))) return;
      const r = await executar(b, () => api('usuarios/index.php', { metodo: 'POST', query: { id: b.dataset.alternar, acao: desativar ? 'desativar' : 'ativar' } }));
      if (r) { toast(r.mensagem); vAdmins(main); }
    }));
  }

  /* ================= Conta (todos) ================= */

  async function vConta(main) {
    const u = state.user;
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">${u.perfil === 'admin' ? 'Minha conta' : 'Conta'}</h1></div></div>
      <div class="grid grid--2" style="align-items:start">
        <article class="card">
          <div class="inline" style="gap:14px">${avatar(u.nome, 'avatar--lg')}<div><p class="card__title" style="text-transform:none;font-size:1.3rem">${esc(u.nome)}</p>
            <p class="muted">${esc(u.login)} · ${u.perfil === 'admin' ? 'Administrador' : 'Funcionário'}</p></div></div>
          <div class="stack" style="margin-top:18px">
            <button class="btn btn--yellow" type="button" data-instalar hidden>${icon('download')}Instalar o app neste aparelho</button>
            <a class="btn" href="${SITE}">${icon('globe')}Abrir o site do LockMachine</a>
            <button class="btn btn--red" type="button" data-sair-conta>${icon('logout')}Sair</button>
          </div>
        </article>
        <form class="card form" novalidate>
          <h2 class="card__title">Trocar senha</h2>
          ${senhaCampo('senha_atual', 'Senha atual', 'current-password')}
          ${senhaCampo('nova_senha', 'Nova senha', 'new-password', 'Pelo menos 8 caracteres, com letras e números.')}
          ${senhaCampo('confirmar', 'Repita a nova senha', 'new-password')}
          <button class="btn btn--yellow" type="submit">Salvar nova senha</button>
        </form>
      </div>
    </section>`;
    $('[data-sair-conta]', main).addEventListener('click', sair);
    const form = $('form', main);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = lerForm(form);
      if (d.nova_senha !== d.confirmar) {
        mostrarErros(form, new ApiError(400, 'DADOS_INVALIDOS', 'As senhas não conferem.', { confirmar: 'Digite a mesma senha nos dois campos.' }));
        return;
      }
      const r = await enviar(form, () => api('auth/senha.php', { metodo: 'POST', corpo: { senha_atual: d.senha_atual, nova_senha: d.nova_senha } }));
      if (!r) return;
      form.reset();
      toast('Senha alterada.');
    });
    mostrarInstalar();
  }

  /* ================= Funcionário ================= */

  async function painelFuncionario() {
    const r = await api('funcionario/painel.php');
    return r.dados;
  }

  async function vInicio(main) {
    const vivo = state.vivo;
    const p = await painelFuncionario();
    if (!vivo()) return;
    const c = p.resumo.capacitacoes;
    const o = p.operador;
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">Olá, ${esc(o.nome.split(' ')[0])}</h1><p class="page__sub">Confira suas capacitações antes de ir para a máquina.</p></div></div>
      <article class="card badge-card">
        <div class="badge-card__band"><span>LockMachine · Crachá</span>${icon('waves')}</div>
        ${avatar(o.nome, 'avatar--lg')}
        <div class="badge-card__info">
          <p class="badge-card__name">${esc(o.nome)}</p>
          <p class="badge-card__meta">${esc(o.matricula)}${o.setor ? ' · ' + esc(o.setor) : ''}</p>
          <p class="badge-card__meta">${o.cartao ? 'Cartão <span class="mono">' + esc(o.cartao) + '</span>' : 'Sem cartão vinculado'}</p>
        </div>
      </article>
      ${!o.ativo ? `<div class="alert">${icon('alert')}<span>Seu cadastro está desativado. Procure o administrador.</span></div>` : ''}
      ${c.vencida ? `<div class="alert">${icon('alert')}<span>Você tem ${plural(c.vencida, 'capacitação vencida', 'capacitações vencidas')}. As máquinas que exigem esse treinamento ficam bloqueadas até a renovação.</span></div>` : ''}
      ${c.vencendo ? `<div class="alert alert--warn">${icon('calendar')}<span>${plural(c.vencendo, 'capacitação vence', 'capacitações vencem')} nos próximos 30 dias. Programe a renovação.</span></div>` : ''}
      <div class="kpis">
        <a class="kpi" href="#/capacitacoes" style="--tone:var(--green);text-decoration:none"><span class="kpi__n" data-contar="${c.valida}">${c.valida}</span><span class="kpi__l">Válidas</span></a>
        <a class="kpi" href="#/capacitacoes" style="--tone:${c.vencendo ? 'var(--yellow)' : 'var(--paper)'};text-decoration:none"><span class="kpi__n" data-contar="${c.vencendo}">${c.vencendo}</span><span class="kpi__l">Vencendo</span></a>
        <a class="kpi" href="#/capacitacoes" style="--tone:${c.vencida ? 'var(--red)' : 'var(--paper)'};text-decoration:none"><span class="kpi__n" data-contar="${c.vencida}">${c.vencida}</span><span class="kpi__l">Vencidas</span></a>
        <a class="kpi" href="#/minhas-maquinas" style="text-decoration:none"><span class="kpi__n">${p.resumo.maquinas_liberadas}<small style="font-size:1rem"> de ${p.resumo.maquinas_total}</small></span><span class="kpi__l">Máquinas liberadas</span></a>
      </div>
      <article class="card">
        <div class="card__head"><h2 class="card__title">Últimas leituras do seu cartão</h2><a class="btn btn--ghost btn--sm" href="#/historico">Ver tudo</a></div>
        ${p.acessos.length ? `<ul class="list">${p.acessos.slice(0, 4).map((a) => linhaAcesso(a, { mostrarOperador: false })).join('')}</ul>` : vazio('Nenhuma leitura ainda.', '', 'history')}
      </article>
    </section>`;
    contar(main);
  }

  async function vCapacitacoes(main) {
    const vivo = state.vivo;
    const p = await painelFuncionario();
    if (!vivo()) return;
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">Capacitações</h1><p class="page__sub">Treinamentos registrados no seu cadastro.</p></div></div>
      ${p.capacitacoes.length ? `<div class="rows-cards">${p.capacitacoes.map((c) => {
        const total = Math.max(1, c.validade_meses * 30.4);
        const pct = Math.max(0, Math.min(100, (c.dias / total) * 100));
        const tom = c.situacao === 'valida' ? 'var(--green)' : c.situacao === 'vencendo' ? 'var(--yellow)' : 'var(--red)';
        return `<article class="row--card">
          <div class="inline" style="justify-content:space-between"><strong style="font-size:1.05rem">${esc(c.nome)}</strong>${pillSit(c.situacao)}</div>
          <p class="row__meta">Concluída em ${esc(dataBR(c.concluido_em))} · válida até ${esc(dataBR(c.valido_ate))} · ${esc(prazo(c.dias))}</p>
          <div class="validity" style="--tone:${tom}" role="img" aria-label="${Math.round(pct)}% da validade restante"><span style="width:${pct}%"></span></div>
        </article>`;
      }).join('')}</div>` : `<div class="card">${vazio('Nenhuma capacitação registrada.', 'O administrador registra os treinamentos concluídos.', 'book')}</div>`}
    </section>`;
    listar(main);
    if (anima()) gsap.from($$('.validity span', main), { width: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out' });
  }

  async function vMinhasMaquinas(main) {
    const vivo = state.vivo;
    const p = await painelFuncionario();
    if (!vivo()) return;
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">Máquinas</h1><p class="page__sub">Onde seu cartão seria liberado hoje.</p></div></div>
      <div class="alert alert--info">${icon('info')}<span>Esta tela só consulta. A liberação de verdade acontece na leitora da máquina, que registra a tentativa.</span></div>
      <div class="grid grid--3">${p.maquinas.map((m) => `<article class="card" style="display:grid;gap:10px;${m.liberada ? '' : 'border-color:var(--red-ink)'}">
          <div class="inline" style="justify-content:space-between"><span class="code">${esc(m.codigo)}</span>${m.liberada ? pill('Liberada para você', 'ok', 'check') : pill('Bloqueada', 'bad', 'lock')}</div>
          <div><h2 class="card__title" style="text-transform:none;font-size:1.15rem">${esc(m.nome)}</h2><p class="muted">${esc(m.localizacao || '')}</p></div>
          ${m.liberada ? '' : `<p style="font-weight:700">${esc(m.detalhe)}</p>`}
          <div class="inline">${m.exigencias.map((x) => `<span class="pill pill--${(SITUACAO[x.situacao] || [])[1] || 'soft'}">${esc(x.nome)}</span>`).join('')}</div>
        </article>`).join('')}</div>
    </section>`;
  }

  async function vHistorico(main) {
    const vivo = state.vivo;
    const p = await painelFuncionario();
    if (!vivo()) return;
    main.innerHTML = `<section class="page">
      <div class="page__head"><div><h1 class="page__title">Histórico</h1><p class="page__sub">As últimas ${p.acessos.length || ''} leituras do seu cartão.</p></div></div>
      <div class="card">${p.acessos.length ? `<ul class="list">${p.acessos.map((a) => linhaAcesso(a, { mostrarOperador: false })).join('')}</ul>` : vazio('Nenhuma leitura registrada.', '', 'history')}</div>
    </section>`;
    listar(main);
  }

  /* ================= Instalação e inicialização ================= */

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    state.install = e;
    mostrarInstalar();
  });
  window.addEventListener('appinstalled', () => { state.install = null; mostrarInstalar(); toast('App instalado.'); });

  function mostrarInstalar() {
    $$('[data-instalar]').forEach((b) => {
      b.hidden = !state.install;
      b.onclick = async () => {
        if (!state.install) return;
        state.install.prompt();
        await state.install.userChoice;
        state.install = null;
        mostrarInstalar();
      };
    });
  }

  function online() { $('#offline').hidden = navigator.onLine; }
  window.addEventListener('online', online);
  window.addEventListener('offline', online);

  async function iniciar() {
    online();
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    try {
      const r = await api('auth/me.php');
      state.user = r.dados;
    } catch (e) {
      state.user = null;
      if (e instanceof ApiError && e.status !== 401) toast(e.message, 'bad');
    }
    window.addEventListener('hashchange', render);
    await render();
    const boot = $('#boot');
    if (anima()) gsap.to(boot, { yPercent: -100, duration: 0.55, ease: 'power3.inOut', onComplete: () => boot.remove() });
    else boot.remove();
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
