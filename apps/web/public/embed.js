/* Bracket embed loader.
 *
 * <div data-bracket-embed="my-tournament-slug" data-tab="standings" data-theme="dark" data-show-tabs="1"></div>
 * <script async src="https://YOUR_BRACKET_HOST/embed.js"></script>
 *
 * Creates an <iframe> for every [data-bracket-embed] element and auto-resizes
 * it from `bracket:resize` postMessage events sent by the embedded page.
 */
(function () {
  if (window.__bracketEmbedLoaded) return;
  window.__bracketEmbedLoaded = true;

  var scriptEl = document.currentScript;
  var origin = '';
  try {
    origin = new URL(scriptEl && scriptEl.src ? scriptEl.src : window.location.href).origin;
  } catch (e) {
    origin = window.location.origin;
  }

  var frames = {};

  function mount(el) {
    if (el.getAttribute('data-bracket-mounted')) return;
    el.setAttribute('data-bracket-mounted', '1');
    var slug = el.getAttribute('data-bracket-embed');
    if (!slug) return;
    var params = [];
    var map = { tab: 'data-tab', theme: 'data-theme', lang: 'data-lang', autoRefresh: 'data-auto-refresh' };
    Object.keys(map).forEach(function (k) {
      var v = el.getAttribute(map[k]);
      if (v) params.push(k + '=' + encodeURIComponent(v));
    });
    if (el.getAttribute('data-hide-header') === '1') params.push('hideHeader=1');
    if (el.getAttribute('data-show-tabs') === '1') params.push('showTabs=1');
    var iframe = document.createElement('iframe');
    iframe.src = origin + '/embed/' + encodeURIComponent(slug) + (params.length ? '?' + params.join('&') : '');
    iframe.style.width = el.getAttribute('data-width') || '100%';
    iframe.style.height = (el.getAttribute('data-height') || '600') + 'px';
    iframe.style.border = '0';
    iframe.style.borderRadius = '12px';
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('allowtransparency', 'true');
    iframe.setAttribute('title', 'Bracket tournament ' + slug);
    el.appendChild(iframe);
    frames[slug] = frames[slug] || [];
    frames[slug].push(iframe);
  }

  function mountAll() {
    var els = document.querySelectorAll('[data-bracket-embed]');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || d.type !== 'bracket:resize' || typeof d.height !== 'number') return;
    var list = d.slug && frames[d.slug] ? frames[d.slug] : [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].contentWindow === ev.source) list[i].style.height = Math.max(120, d.height + 8) + 'px';
    }
    // Also resize plain <iframe> embeds (not created by this script)
    var all = document.getElementsByTagName('iframe');
    for (var j = 0; j < all.length; j++) {
      if (all[j].contentWindow === ev.source && all[j].getAttribute('data-bracket-autosize') !== '0') {
        all[j].style.height = Math.max(120, d.height + 8) + 'px';
      }
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
  window.BracketEmbed = { mount: mountAll };
})();
