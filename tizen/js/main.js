/* main.js — მენიუები (ზედა / გვერდითა, Android-ის MainActivity), პულტი და გაშვება. */
'use strict';

var DESTS = [
  { id: 'search', icon: 'search', label: 'nav_search', go: function () { Screen.open('search', {}); } },
  { id: 'home', icon: 'home', label: 'nav_home', go: function () { Api.clearCache(); Screen.root('home'); } },
  { id: 'movies', icon: 'film', label: 'nav_movies', go: function () { Screen.root('catalog', { base: 'movies' }); } },
  { id: 'tv_shows', icon: 'tv', label: 'nav_shows', go: function () { Screen.root('catalog', { base: 'tv_shows' }); } },
  { id: 'genres', icon: 'category', label: 'nav_genres', go: function () { Screen.open('genres', {}); } },
  { id: 'favs', icon: 'heart', label: 'nav_favorites', go: function () { Screen.root('favs'); } },
  { id: 'settings', icon: 'gear', label: 'nav_settings', go: function () { Screen.open('settings', {}); } },
  { id: 'profile', icon: 'profile', label: 'nav_profile', go: function () { Screen.open('profile', {}); } }
];
function icon(name) { return '<i class="ic" style="--i:url(../img/ic/' + name + '.svg)"></i>'; }

var Menu = {
  railOpen: false,
  style: function () { return Prefs.menu(); },
  topInset: function () { return Menu.style() === 'top' && !document.body.classList.contains('no-menu') ? 138 : 0; },
  build: function () {
    var side = Menu.style() === 'side';
    document.body.classList.toggle('side', side);
    $('#top').hidden = side; $('#rail').hidden = !side;
    var dest = function (id) { return DESTS.find(function (d) { return d.id === id; }); };
    $('#nav').innerHTML = ['home', 'movies', 'tv_shows', 'genres', 'favs'].map(function (id) {
      return '<a class="f nav" data-go="' + id + '">' + esc(T(dest(id).label)) + '</a>';
    }).join('');
    $('#top-icons').innerHTML = ['search', 'settings', 'profile'].map(function (id) {
      return '<a class="f nav icon" data-go="' + id + '" title="' + esc(T(dest(id).label)) + '">' + icon(dest(id).icon) + '</a>';
    }).join('');
    $('#rail-items').innerHTML = DESTS.map(function (d) {
      return '<a class="f ritem" data-go="' + d.id + '">' + icon(d.icon) + '<span>' + esc(T(d.label)) + '</span></a>' + (d.id === 'genres' ? '<div class="rsep"></div>' : '');
    }).join('');
    $$('[data-go]').forEach(function (n) {
      n.onclick = function () { var d = dest(n.dataset.go); if (Menu.railOpen) Menu.setRail(false); d.go(); };
    });
    if (Screen.cur) Menu.mark(Screen.cur.name, Screen.cur.params);
  },
  mark: function (name, params) {
    // Android-ზე მენიუ მხოლოდ მთავარ აქტივობაშია: მთავარი, ფილმები, სერიალები, რჩეულები
    var withMenu = name === 'home' || name === 'favs' || (name === 'catalog' && !Screen.stack.length);
    document.body.classList.toggle('no-menu', !withMenu);
    if (!withMenu && Menu.railOpen) Menu.setRail(false);
    var id = name === 'catalog' && !params.genre ? params.base || 'movies' : name;
    $$('[data-go]').forEach(function (n) { n.classList.toggle('on', n.dataset.go === id); });
  },
  scrolled: function (down) { if (Menu.style() === 'top') $('#top').classList.toggle('hide', down && !(Nav.cur && Nav.cur.closest('#top'))); },
  hideAll: function (h) { document.body.classList.toggle('in-player', h); },
  onFocus: function (el) {
    var inRail = !!el.closest('#rail');
    if (inRail !== Menu.railOpen && Menu.style() === 'side') Menu.setRail(inRail);
    if (el.closest('#top')) $('#top').classList.remove('hide');
  },
  setRail: function (open) {
    Menu.railOpen = open;
    $('#rail').classList.toggle('open', open);
    $('#rail-scrim').hidden = !open;
  },
  enterRail: function () {
    var on = $('#rail .ritem.on') || $('#rail .ritem[data-go="home"]');
    Menu.lastPage = Nav.cur;
    Nav.focus(on);
  },
  leaveRail: function () {
    Menu.setRail(false);
    var back = Menu.lastPage && document.contains(Menu.lastPage) ? Menu.lastPage : (Screen.cur && Screen.cur.first ? Screen.cur.first() : null);
    Nav.focus(back || Nav.list().filter(function (e) { return !e.closest('#rail'); })[0]);
  },
  focusMenu: function () {
    if (Menu.style() === 'side') { Menu.enterRail(); return; }
    Nav.focus($('#top .nav.on') || $('#top .nav'));
  }
};

// ------------------------------------------------------------------ პულტი
var repeat = { k: 0, n: 0, t: 0 };
document.addEventListener('keydown', function (e) {
  var k = e.keyCode, now = Date.now();
  repeat.n = repeat.k === k && now - repeat.t < 250 ? repeat.n + 1 : 0; repeat.k = k; repeat.t = now;
  var ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
    if (k === K.BACK || k === 65385 || k === K.ESC || (k === K.UP && ae.tagName === 'INPUT') || k === K.DOWN) { ae.blur(); e.preventDefault(); if (k === K.DOWN || k === K.UP) Nav.move(k); }
    return;
  }
  e.preventDefault();
  if (!$('#dialog').hidden) {
    if (k === K.BACK || k === K.ESC) { choose.close(); return; }
    if ((k === K.LEFT || k === K.RIGHT) && choose.range && choose.range(k, repeat.n)) return;
    if (k === K.ENTER) { if (Nav.cur) Nav.cur.click(); return; }
    Nav.move(k); return;
  }
  if (!$('#player').hidden) { Player.key(k, repeat.n); return; }
  if (Screen.cur && Screen.cur.key && Screen.cur.key(k)) return;
  if (k === K.BACK || k === K.ESC) {
    if (Menu.railOpen) { Menu.leaveRail(); return; }
    // ქვემოთ ჩასულ მთავარ გვერდზე „უკან" — ჯერ მენიუზე, მერე გასვლა
    if (!Screen.stack.length && Nav.cur && !Nav.cur.closest('#top,#rail')) { Menu.focusMenu(); return; }
    Screen.back(); return;
  }
  if (k === K.ENTER) { if (Nav.cur) Nav.cur.click(); return; }
  if (k >= 37 && k <= 40) Nav.move(k);
});

// ------------------------------------------------------------------ გაშვება
(function init() {
  try {
    ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'].forEach(function (k) {
      try { tizen.tvinputdevice.registerKey(k); } catch (e) { }
    });
  } catch (e) { }
  document.documentElement.lang = Prefs.lang();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && !$('#player').hidden && Player.playing) Player.toggle();
  });
  $('#rail-scrim').onclick = function () { Menu.leaveRail(); };
  Menu.build();
  Screen.root('home');
  // მთავარი 3 წუთში ერთხელ ამოწმებს, დაემატა თუ არა ახალი ფილმი (Android-ის checkNew)
  setInterval(function () { if (Screen.cur && Screen.cur.name === 'home' && $('#player').hidden) Screen.cur.checkNew(); }, 180000);
})();
