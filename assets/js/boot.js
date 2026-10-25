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
  // WebGL decides between the 3D scenes and their flat fallbacks before the first paint.
  try {
    var c = document.createElement('canvas');
    var gl = c.getContext('webgl2') || c.getContext('webgl');
    if (gl) {
      d.classList.add('has-webgl');
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
    }
  } catch (e) {}
  setTimeout(function () {
    if (d.classList.contains('is-loading')) {
      d.classList.add('boot-timeout');
      d.classList.remove('is-loading');
    }
  }, 9000);
})(document.documentElement);
