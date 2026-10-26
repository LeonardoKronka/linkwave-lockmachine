/* LinkWave — roda antes de tudo (no <head>): liga a tela de abertura. */
(function (d) {
  d.classList.add('js', 'is-loading');
  // Vindo de outra página do site: a marca já chega montada, sem repetir a construção.
  try {
    if (sessionStorage.getItem('lw:transicao') === '1') {
      d.classList.add('is-continuing');
      sessionStorage.removeItem('lw:transicao');
    }
  } catch (e) { /* navegação privada sem sessionStorage */ }
  // Se os scripts não carregarem, a abertura sai sozinha e o site aparece.
  // (O WebGL fica com as cenas: um contexto de teste aqui travava a abertura por ~50 ms.)
  setTimeout(function () {
    if (d.classList.contains('is-loading')) {
      d.classList.add('boot-timeout');
      d.classList.remove('is-loading');
    }
  }, 9000);
})(document.documentElement);
