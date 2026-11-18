/* boot.js — Samsung-ის აპის ჩამტვირთავი და GitHub-იდან განახლება.
 * Samsung ტელევიზორზე აპს სხვა აპის დაყენება არ შეუძლია, ამიტომ განახლდება კოდი (css + js):
 *   1) GitHub-ზე tizen/version.json — თუ ვერსია უფრო ახალია, ფაილები ჩამოიტვირთება და ტელევიზორში ინახება;
 *   2) შენახული ვერსია ჩაირთვება; ინტერნეტის გარეშე — ბოლოს ჩამოტვირთული ან აპში ჩაშენებული.
 * ეს ფაილი თავად არ განახლდება — მას მხოლოდ აპის თავიდან დაყენება ცვლის. */
(function () {
  'use strict';
  var BUNDLED = '1.5';
  // მაღაზიის (Samsung Apps) ვერსია: მხოლოდ შემოწმებული, აპში ჩაშენებული კოდი — GitHub-იდან განახლების გარეშე
  var STORE = true;
  var REMOTE = 'https://raw.githubusercontent.com/repackfile/kinokadri-tv/main/tizen/';
  var FILES = { css: ['css/app.css'], js: ['js/i18n.js', 'js/core.js', 'js/screens.js', 'js/player.js', 'js/main.js'] };
  var KEY = 'kk_code';

  function newer(a, b) {
    var x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
    for (var i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
    return false;
  }
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function timeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }
  function text(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); }); }

  /** GitHub-ზე ახალი ვერსიის შემოწმება; ახალს ჩამოტვირთავს და ინახავს. აბრუნებს ვერსიას ან null-ს. */
  function fetchUpdate(current, ms) {
    return timeout(text(REMOTE + 'version.json?t=' + Date.now()), ms || 5000).then(function (t) {
      var v = JSON.parse(t);
      if (!v.version || !newer(v.version, current)) return null;
      var list = (v.css || FILES.css).concat(v.js || FILES.js);
      return Promise.all(list.map(function (f) { return text(REMOTE + f + '?v=' + encodeURIComponent(v.version)); })).then(function (bodies) {
        var css = [], js = [];
        list.forEach(function (f, i) { (/\.css$/.test(f) ? css : js).push(bodies[i]); });
        try { localStorage.setItem(KEY, JSON.stringify({ version: v.version, notes: v.notes || '', css: css, js: js })); } catch (e) { return null; }
        return v;
      });
    });
  }

  function runInline(code) {
    code.css.forEach(function (c) { var s = document.createElement('style'); s.textContent = c; document.head.appendChild(s); });
    code.js.forEach(function (c) { var s = document.createElement('script'); s.textContent = c; document.body.appendChild(s); });
  }
  function runBundled() {
    FILES.css.forEach(function (f) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = f; document.head.appendChild(l); });
    var i = 0;
    (function next() {
      if (i >= FILES.js.length) return;
      var s = document.createElement('script'); s.src = FILES.js[i++]; s.onload = next; s.onerror = next; document.body.appendChild(s);
    })();
  }
  function start() {
    var c = read();
    if (c && newer(c.version, BUNDLED)) { window.KK_CODE = { version: c.version, notes: c.notes, source: 'github' }; runInline(c); }
    else { if (c) try { localStorage.removeItem(KEY); } catch (e) { } window.KK_CODE = { version: BUNDLED, source: 'bundled' }; runBundled(); }
  }

  // აპიდან (პარამეტრები → „განახლების შემოწმება") და გაშვებისას
  window.KKUpdate = {
    bundled: BUNDLED,
    check: function () { return fetchUpdate((window.KK_CODE || {}).version || BUNDLED, 15000); },
    reload: function () { location.reload(); }
  };

  if (STORE) { window.KK_CODE = { version: BUNDLED, source: 'store' }; runBundled(); return; }

  // კომპიუტერზე ტესტისას (localhost) — ყოველთვის ადგილობრივი ფაილები, GitHub-ის გარეშე
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') { window.KK_CODE = { version: BUNDLED + '-dev', source: 'local' }; runBundled(); return; }

  // გაშვებისას: ახალ ვერსიას 3 წამამდე ველოდებით, მერე ვრთავთ, რაც გვაქვს (შემდეგ ჯერზე ახალი ჩაირთვება)
  var cur = read(), have = cur && newer(cur.version, BUNDLED) ? cur.version : BUNDLED, started = false;
  var go = function () { if (!started) { started = true; start(); } };
  var got = false;
  fetchUpdate(have, 3000).then(function (v) { got = true; go(); return v; }, go);
  setTimeout(go, 3500);
  // ჩართვისას ქსელი შეიძლება ჯერ მზად არ იყოს — 10 წამში და შემდეგ ყოველ 6 საათში ფონურად ვამოწმებთ
  // (ჩამოტვირთული ვერსია შემდეგ ჩართვაზე ჩაირთვება)
  var later = function () { var c = read(); fetchUpdate(c && newer(c.version, have) ? c.version : have, 20000).catch(function () { }); };
  setTimeout(function () { if (!got) later(); }, 10000);
  setInterval(later, 6 * 3600 * 1000);
})();
