/* KinoKadri — Samsung Tizen TV. Android TV აპის ასლი (იგივე API: kinokadri.co/wp-json/kk-app/v1).
 * core.js: ენა, საცავი, API, ანგარიში, რჩეულები, გაგრძელება, თარგმანები, ნავიგაცია პულტით, ბარათები. */
'use strict';

var VERSION = (window.KK_CODE && window.KK_CODE.version) || '1.2';
var API = 'https://kinokadri.co/wp-json/kk-app/v1';
var SITE_SEARCH = 'https://kinokadri.co/wp-content/themes/streamvid/kk-search-api.php';
var WATCH_HOSTS = ['https://cdn.kinokadri.co:8444', 'https://srv.kinokadri.co:8444'];
var HERO_MOVIES = 'https://kinokadri.co/wp-content/themes/streamvid/assets/images/kk-hero.jpg';
var HERO_TV = 'https://kinokadri.co/wp-content/themes/streamvid/assets/images/kk-hero-tv.jpg';
var K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27,
  PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413, FF: 417, RW: 412 };

var $ = function (s, r) { return (r || document).querySelector(s); };
var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function decode(s) { var t = document.createElement('textarea'); t.innerHTML = s || ''; return t.value; }
function plain(html) { return decode(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim(); }
function store(k, v) {
  try {
    if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null');
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v));
  } catch (e) { return null; }
}
function fmt(ms) {
  var s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; s %= 60;
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return (h ? h + ':' + p(m) : p(m)) + ':' + p(s);
}
function fmtRating(v) { return (Math.round(v * 10) / 10).toFixed(1); }
function compact(n) { return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'K' : String(n); }

// ------------------------------------------------------------------ ინტერფეისის ენა და მენიუს სტილი (Android-ის UiPrefs)
var Prefs = {
  lang: function () { return store('lang') || 'ka'; },
  setLang: function (l) { store('lang', l); },
  menu: function () { return store('menu') || 'top'; },
  setMenu: function (m) { store('menu', m); }
};
/** T('key', a, b) — Android-ის getString(R.string.key, a, b) */
function T(k) {
  var a = arguments, d = I18N[Prefs.lang()] || I18N.ka;
  var s = d[k] != null ? d[k] : (I18N.ka[k] != null ? I18N.ka[k] : k);
  return s.replace(/\{(\d)\}/g, function (m, n) { return a[n] != null ? a[n] : ''; });
}
function toast(text, ms) {
  var t = $('#toast'); t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, ms || 3000);
}

// ------------------------------------------------------------------ საიტის სტატიკური სახელების თარგმანი (Android-ის Tr)
var Tr = (function () {
  var G = { 'ანიმაცია': ['Анимация', 'Animation'], 'დეტექტივი': ['Детектив', 'Mystery'], 'დრამა': ['Драма', 'Drama'], 'ეროტიკული': ['Эротика', 'Erotic'],
    'ვესტერნი': ['Вестерн', 'Western'], 'ზღაპრული': ['Сказка', 'Fairy Tale'], 'ისტორიული': ['История', 'History'], 'კომედია': ['Комедия', 'Comedy'],
    'კრიმინალური': ['Криминал', 'Crime'], 'მელოდრამა': ['Мелодрама', 'Melodrama'], 'მისტიური': ['Мистика', 'Mystic'], 'მიუზიკლი': ['Мюзикл', 'Musical'],
    'მულტფილმი': ['Мультфильм', 'Cartoon'], 'მუსიკა': ['Музыка', 'Music'], 'მუსიკალური': ['Музыкальный', 'Music Film'], 'მძაფრსიუჟეტიანი': ['Боевик', 'Action'],
    'მძაფრ-სიუჟეტი': ['Боевик', 'Action'], 'რომანტიკული': ['Романтика', 'Romance'], 'საახალწლო': ['Новогодний', 'New Year'], 'საბავშვო': ['Детский', 'Kids'],
    'სათავგადასავლო': ['Приключения', 'Adventure'], 'საომარი': ['Военный', 'War'], 'საოჯახო': ['Семейный', 'Family'], 'სატელევიზიო ფილმში': ['Телефильм', 'TV Movie'],
    'სატელევიზიო ფილმი': ['Телефильм', 'TV Movie'], 'საშინელება': ['Ужасы', 'Horror'], 'სპორტული': ['Спорт', 'Sport'], 'ტრილერი': ['Триллер', 'Thriller'],
    'ფანტასტიკა': ['Фантастика', 'Sci-Fi'], 'ფენტეზი': ['Фэнтези', 'Fantasy'], 'სერიალები': ['Сериалы', 'TV Shows'], 'ფილმები': ['Фильмы', 'Movies'] };
  var L = { 'ქართული': ['Грузинский', 'Georgian'], 'რუსული': ['Русский', 'Russian'], 'ინგლისური': ['Английский', 'English'], 'უკრაინული': ['Украинский', 'Ukrainian'],
    'ფრანგული': ['Французский', 'French'], 'კორეული': ['Корейский', 'Korean'], 'ესპანური': ['Испанский', 'Spanish'], 'იტალიური': ['Итальянский', 'Italian'],
    'გერმანული': ['Немецкий', 'German'], 'ჩინური': ['Китайский', 'Chinese'], 'იაპონური': ['Японский', 'Japanese'], 'თურქული': ['Турецкий', 'Turkish'],
    'ინდონეზიური': ['Индонезийский', 'Indonesian'], 'ჰინდი': ['Хинди', 'Hindi'], 'უნგრული': ['Венгерский', 'Hungarian'], 'პოლონური': ['Польский', 'Polish'],
    'ტაილანდური': ['Тайский', 'Thai'], 'ურდუ': ['Урду', 'Urdu'], 'ჩეხური': ['Чешский', 'Czech'] };
  var pick = function (map, name) {
    var t = map[String(name || '').trim()], l = Prefs.lang();
    return !t || l === 'ka' ? name : l === 'ru' ? t[0] : t[1];
  };
  return {
    genre: function (n) { return pick(G, n); },
    lang: function (n) { return pick(L, n); },
    option: function (key, label) { return key === 'genre' ? pick(G, label) : key === 'lang' ? pick(L, label) : label; }
  };
})();

// ------------------------------------------------------------------ ანგარიში (kk-app/v1/auth) — ტოკენი ტელევიზორში
var Auth = {
  token: function () { return store('token') || null; },
  set: function (t) { store('token', t || null); Api.clearCache(); }
};

// ------------------------------------------------------------------ API (2 წუთიანი ქეშით, როგორც Android-ზე)
var cache = {};
function headers(extra) {
  var h = Object.assign({ Accept: 'application/json' }, extra || {});
  if (Auth.token()) h['X-KK-Token'] = Auth.token();
  return h;
}
function get(url, raw, noCache) {
  var hit = cache[url];
  if (!noCache && hit && Date.now() - hit.at < 120000) return Promise.resolve(hit.v);
  return fetch(url, { headers: url.indexOf(API) === 0 ? headers() : {} }).then(function (r) {
    if (!r.ok) {
      return r.json().catch(function () { return {}; }).then(function (o) {
        var e = new Error(plain(o.message) || T('server_error', r.status)); e.status = r.status; throw e;
      });
    }
    var pages = +(r.headers.get('X-WP-TotalPages') || 1);
    return (raw ? r.text() : r.json()).then(function (v) {
      if (!raw && Array.isArray(v)) v = { list: v, pages: pages };
      cache[url] = { at: Date.now(), v: v }; return v;
    });
  });
}
function qs(o) {
  var out = [];
  Object.keys(o).forEach(function (k) {
    var v = o[k]; if (v == null || v === '') return;
    (Array.isArray(v) ? v : [v]).forEach(function (x) { out.push(encodeURIComponent(k) + '=' + encodeURIComponent(x)); });
  });
  return out.join('&');
}
var Api = {
  clearCache: function () { cache = {}; },
  items: function (type, o) { return get(API + '/items?' + qs(Object.assign({ type: type, per_page: 20, page: 1, orderby: 'date' }, o || {}))); },
  /** საიტის browse — ფილტრით (Android-ის FilterState.query()) */
  browse: function (base, page, filter) {
    return get(API + '/browse?' + qs(Object.assign({ base: base, page: page || 1 }, Filter.query(filter))));
  },
  filters: function (base, filter) { return get(API + '/filters?' + qs(Object.assign({ base: base }, Filter.query(filter)))).catch(function () { return { groups: [], sort: [] }; }); },
  detail: function (id) { return get(API + '/items/' + id); },
  person: function (id) { return get(API + '/person/' + id); },
  comments: function (id) { return get(API + '/comments/' + id, false, true); },
  terms: function (tax) {
    return get(API + '/terms?taxonomy=' + tax).then(function (v) {
      var a = v.list || Object.keys(v).sort(function (x, y) { return x - y; }).map(function (k) { return v[k]; });
      return a.filter(function (t) { return t && t.count; });
    });
  },
  post: function (path, body) {
    return fetch(API + '/' + path, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify(body || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (o) {
        if (!r.ok) { var e = new Error(plain(o.message) || T('server_error', r.status)); e.status = r.status; throw e; }
        return o;
      });
    });
  },
  stream: function (id) {
    return fetch(API + '/stream/' + id, { headers: headers() }).then(function (r) {
      return r.text().then(function (t) {
        var o = {}; try { o = JSON.parse(t.replace(/[\u0000-\u001f]/g, ' ')); } catch (e) { }
        if (!r.ok) { var er = new Error(r.status === 401 ? T('login_required') : (plain(o.message) || T('play_failed'))); er.status = r.status; throw er; }
        return o;
      });
    });
  },
  login: function (u, p) { return Api.post('auth/login', { username: u, password: p }).then(function (o) { Auth.set(o.token); return o.user; }); },
  me: function () { return get(API + '/auth/me', false, true); },
  logout: function () { var done = function () { Auth.set(null); }; return Api.post('auth/logout', {}).then(done, done); },
  // საიტის სწრაფი ძებნა — ლათინურით აკრეფილი ქართულიც ("ukanaskneli" → უკანასკნელი)
  search: function (q) {
    return get(SITE_SEARCH + '?' + qs({ q: q })).then(function (v) { return v.items || []; }).catch(function () {
      return Promise.all(['movies', 'tv_shows'].map(function (t) { return Api.items(t, { search: q, per_page: 20 }); })).then(function (r) {
        return r[0].list.concat(r[1].list).map(function (it) { return { k: it.type === 'tv_shows' ? 2 : 1, title: decode(it.title), sub: (it.meta || {}).original_title, img: it.poster, _item: it }; });
      });
    });
  },
  // მთავარი გვერდის „დღის სერიალი" და სერიალების ჩანართები — საიტის HTML-იდან (Android-ის homeRefs)
  homeRefs: function () {
    return get('https://kinokadri.co/', true).then(function (html) {
      var daily = null, tabs = [], st = html.indexOf('<div class="kf2"');
      if (st >= 0) {
        var block = html.substr(st, 20000), id = /data-post-id="(\d+)"/.exec(block);
        if (id) {
          var bg = /<img[^>]*data-src="([^"]+)"[^>]*class="kf2-bg kf-pre/.exec(block), yr = /<span class="kf-chip">(\d{4})<\/span>/.exec(block);
          daily = { id: +id[1], bg: bg && /^http/.test(bg[1]) ? bg[1] : null, year: yr ? yr[1] : null };
        }
      }
      var t = html.indexOf('jws-tv_shows-tabs-element');
      if (t >= 0) {
        var nav = html.substr(t, 4000), re = /<a class="[^"]*" href="#" data-id=['"]([^'"]*(?:"[^'>]*)*)['"]>([^<]+)<\/a>/g, m;
        while ((m = re.exec(nav))) {
          var ids = (m[1].match(/\d+/g) || []).map(Number);
          if (ids.length) tabs.push({ label: m[2].trim(), ids: ids });
        }
      }
      return { daily: daily, tabs: tabs };
    });
  },
  // ეპიზოდების მოკლე აღწერები სერიალის გვერდიდან (data-d)
  episodeDescriptions: function (link) {
    return get(link, true).then(function (h) {
      var out = {}, re = /<a class="kz-bar[^"]*"[^>]*>/g, m;
      var attr = function (tag, n) { var x = new RegExp('\\s' + n + '="([^"]*)"').exec(tag); return x ? x[1] : null; };
      while ((m = re.exec(h))) {
        var d = attr(m[0], 'data-d'); if (!d) continue; d = plain(decode(d));
        var href = attr(m[0], 'href'); if (href) out[href] = d;
        var sn = attr(m[0], 'data-s'), n = attr(m[0], 'data-n'); if (sn && n) out[sn + '-' + n] = d;
      }
      return out;
    });
  }
};
function watchUrls(src) {
  var u = src.replace(/\.kkp(\?|$)/i, '.m3u8$1'), re = /^https?:\/\/[a-z0-9-]+\.kinokadri\.co(:\d+)?(?=\/)/i;
  if (!re.test(u)) return [u];
  return WATCH_HOSTS.map(function (h) { return u.replace(re, h); });
}
/** Android-ის FilterState — { values: {key: [..]}, sort: '' } */
var Filter = {
  empty: function () { return { values: {}, sort: '' }; },
  query: function (f) {
    var q = {}; if (!f) return q;
    Object.keys(f.values || {}).sort().forEach(function (k) {
      var vs = f.values[k] || [];
      if (k === 'genre') { if (vs.length) q['genre[]'] = vs.slice(); }
      else if (vs[0]) q[k] = vs[0];
    });
    if (f.sort) q.sortby = f.sort;
    return q;
  },
  isEmpty: function (f) { return !f || Object.keys(f.values || {}).every(function (k) { var v = f.values[k]; return !v || !v.length || (v.length === 1 && v[0] === ''); }); }
};

// ------------------------------------------------------------------ რჩეულები და გაგრძელება
var Favs = {
  all: function () { return store('favs') || []; },
  has: function (id) { return Favs.all().some(function (x) { return x.id === id; }); },
  toggle: function (it) {
    var a = Favs.all(), i = a.findIndex(function (x) { return x.id === it.id; });
    if (i >= 0) a.splice(i, 1);
    else a.unshift({ id: it.id, type: it.type, title: it.title, poster: it.poster, landscape: it.landscape, backdrop: it.backdrop, card: it.card,
      meta: { original_title: (it.meta || {}).original_title } });
    store('favs', a); return i < 0;
  }
};
var Resume = {
  get: function (id) { return (store('resume') || {})[id] || 0; },
  set: function (id, ms, dur) {
    var r = store('resume') || {};
    if (ms < 30000 || (dur && ms > dur - 90000)) delete r[id]; else r[id] = ms;
    store('resume', r);
  },
  lastEpisode: function (showId) { return store('lastep_' + showId); },
  setLastEpisode: function (showId, epId) { store('lastep_' + showId, epId); }
};

// ------------------------------------------------------------------ ბარათები (Android-ის card_poster / card_tv / card_episode / card_person)
var PLAY_SVG = '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z"/></svg>';
var HEART = '<svg viewBox="0 0 24 24"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
var PERSON_SVG = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';
var TV_SVG = '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8"/></svg>';
// სურათი <img>-ით და Referer-ის გარეშე — საიტი სხვა მისამართიდან მოთხოვნილ სურათს ბლოკავს
// ჯერ პატარა ზომა (საიტის WordPress-ის ასლი: პოსტერი 200×300, განიერი 300×169 — ~17KB), მერე სრული რბილად ჩნდება
function smallVariant(url) {
  var m = /^(.*\/wp-content\/uploads\/.+?)(-(\d+)x(\d+))?(\.(?:jpe?g|png|webp))(\?.*)?$/i.exec(url || '');
  if (!m) return null;
  var w = +m[3] || 0, h = +m[4] || 0, size = h > w ? '-200x300' : '-300x169';
  if (m[2] === size || (w && w <= 300)) return null;
  return m[1] + size + m[5] + (m[6] || '');
}
function pic(url, cls) {
  if (!url) return '';
  var lo = smallVariant(url), c = 'pic' + (cls ? ' ' + cls : '');
  return (lo ? '<img class="' + c + ' lo" referrerpolicy="no-referrer" src="' + esc(lo) + '" onerror="this.remove()">' : '') +
    '<img class="' + c + ' hi" referrerpolicy="no-referrer" src="' + esc(url) + '" onload="this.classList.add(\'ok\')" onerror="this.remove()">';
}
function langTags(card) {
  if (!card) return [];
  if (card.tags && card.tags.length) return card.tags;
  var out = [], m = { 'ქართ': 'GEO', 'ინგლ': 'ENG', 'რუს': 'RUS', 'უკრ': 'UKR' };
  String(card.lang || '').split(',').forEach(function (l) { l = l.trim(); Object.keys(m).forEach(function (k) { if (l.indexOf(k) === 0) out.push(m[k]); }); });
  return out;
}
function ratingBadge(v, label, cls) { return v ? '<span class="rate ' + (cls || label.toLowerCase()) + '"><b>' + label + '</b>' + fmtRating(+v) + '</span>' : ''; }
function rates(imdb, tmdb) { return ratingBadge(imdb, 'IMDb', 'imdb') + ratingBadge(tmdb, 'TMDB', 'tmdb'); }
function metaLine(imdb, tmdb, bits) {
  return '<div class="meta">' + rates(imdb, tmdb) + (bits || []).filter(Boolean).map(function (b, k) { return (k ? '<span class="dot">·</span>' : '') + '<span>' + esc(b) + '</span>'; }).join('') + '</div>';
}
function cardHtml(it, wide) {
  var c = it.card || {}, meta = it.meta || {}, isShow = it.type === 'tv_shows';
  var img = wide ? (c.image || it.landscape || it.backdrop || it.poster) : (it.poster || it.backdrop);
  var orig = meta.original_title && meta.original_title !== it.title ? meta.original_title : (it.sub || '');
  var tags = langTags(c).slice(0, 4).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('');
  if (wide) {
    return '<a class="f card wide" data-id="' + it.id + '" data-type="' + esc(it.type) + '"><div class="img">' + pic(img) +
      (tags ? '<div class="langs top">' + tags + '</div>' : '') + '<span class="play">' + PLAY_SVG + '</span>' +
      (c.episode ? '<span class="epi">' + esc(c.episode) + '</span>' : '') + (c.year ? '<span class="yr bot">' + esc(c.year) + '</span>' : '') + '</div>' +
      '<div class="t">' + esc(decode(it.title)) + '</div>' + (orig ? '<div class="o">' + esc(decode(orig)) + '</div>' : '') + '</a>';
  }
  return '<a class="f card" data-id="' + it.id + '" data-type="' + esc(it.type) + '"><div class="img">' + pic(img) +
    (c.imdb ? '<div class="badge"><span class="i">IMDb</span><span>' + fmtRating(+c.imdb) + '</span></div>' : '') +
    (isShow ? '<span class="show-ic">' + TV_SVG + '</span>' : (c.year ? '<span class="yr">' + esc(c.year) + '</span>' : '')) +
    (tags ? '<div class="langs">' + tags + '</div>' : '') + '</div>' +
    '<div class="t">' + esc(decode(it.title)) + '</div>' + (orig ? '<div class="o">' + esc(decode(orig)) + '</div>' : '') + '</a>';
}
function epNum(e, i) { var n = String((e.meta || {}).episodes_number || '').replace('EP', '').trim(); return n || String(i + 1); }
function epCard(e, i, fallback) {
  var r = Resume.get(e.id);
  return '<a class="f ep" data-ep="' + e.id + '"><div class="img">' + pic(e.landscape || e.poster || e.backdrop || fallback) +
    '<span class="play">' + PLAY_SVG + '</span>' + (r ? '<div class="prog" style="width:45%"></div>' : '') + '</div>' +
    '<div class="n">' + esc(T('episode_n', epNum(e, i))) + '</div><div class="t">' + esc(decode(e.title)) + '</div></a>';
}
function personCard(p) {
  return '<a class="f person" data-person="' + p.id + '"><div class="ph">' + (p.photo ? pic(p.photo) : PERSON_SVG) + '</div>' +
    '<div class="t">' + esc(p.name) + '</div>' + (p.role ? '<div class="o">' + esc(p.role) + '</div>' : '') + '</a>';
}
function sectionTitle(text, extra) { return '<div class="sec-title"><h2>' + esc(text) + '</h2>' + (extra ? '<span class="sec-extra">' + esc(extra) + '</span>' : '') + '</div>'; }
function rowHtml(title, items, wide, key) {
  if (!items || !items.length) return '';
  return '<section class="row" data-row="' + esc(key || title) + '">' + sectionTitle(title) + '<div class="strip">' +
    items.map(function (it) { return cardHtml(it, wide); }).join('') + '</div></section>';
}
function loading() { return '<div class="loading"><div class="dots"><i></i><i></i><i></i></div></div>'; }

// ------------------------------------------------------------------ ნავიგაცია პულტით (სივრცითი ფოკუსი; ფოკუსი = .focus კლასი)
var view = $('#view');
var Nav = {
  cur: null,
  scope: function () {
    if (!$('#dialog').hidden) return $('#dialog');
    if (!$('#player').hidden) return $('#player');
    return document.body;
  },
  list: function () {
    var sc = Nav.scope();
    return $$('.f', sc).filter(function (e) {
      if (sc === document.body && e.closest('#player,#dialog')) return false;
      if (e.hidden || e.closest('[hidden]')) return false;
      return e.offsetParent !== null || e.closest('#top,#rail');
    });
  },
  focus: function (el, noScroll) {
    if (!el) return;
    if (Nav.cur && Nav.cur !== el) { Nav.cur.classList.remove('focus'); }
    Nav.cur = el; el.classList.add('focus');
    var strip = el.closest('.strip, .seasons, .chips-line');
    if (strip) strip.dataset.last = Array.prototype.indexOf.call(strip.children, el);
    Menu.onFocus(el);
    if (!noScroll) Nav.reveal(el);
    if (Screen.cur && Screen.cur.onFocus) Screen.cur.onFocus(el);
  },
  reveal: function (el) {
    var strip = el.closest('.strip');
    if (strip) {
      var cx = +strip.dataset.x || 0, pad = 64, w = strip.parentNode.clientWidth || 1920;
      var left = el.offsetLeft - cx, right = left + el.offsetWidth;
      if (right > w - pad) cx += right - (w - pad);
      if (left < pad) cx -= pad - left;
      cx = Math.max(0, Math.min(cx, Math.max(0, strip.scrollWidth - w)));
      if (el === strip.children[0]) cx = 0;
      strip.dataset.x = cx; strip.style.transform = 'translateX(' + (-cx) + 'px)';
    }
    var inner = el.closest('.inner');
    if (inner && !el.closest('#top,#rail')) {
      var top = 0, n = el.closest('[data-anchor], .row, .grid > *, .hero, .d-head') || el;
      for (var p = n; p && p !== inner; p = p.offsetParent) top += p.offsetTop;
      // ეკრანზე უკვე სრულად ჩანს გვერდის თავიდან — არ გადაისქროლოს (Android-ის requestChildRectangleOnScreen)
      var fitsAtTop = top + n.offsetHeight <= 1080 - 40;
      var y = fitsAtTop || n.classList.contains('hero') || n.classList.contains('d-head') ? 0 : Math.max(0, top - Menu.topInset() - 30);
      y = Math.min(y, Math.max(0, inner.scrollHeight - 1080 + 60));
      inner.style.transform = 'translateY(' + (-y) + 'px)';
      Menu.scrolled(y > 40);
    } else if (el.closest('#top')) {
      Menu.scrolled(false);
    }
  },
  move: function (dir) {
    var cur = Nav.cur && document.contains(Nav.cur) && (Nav.cur.offsetParent !== null || Nav.cur.closest('#top,#rail')) ? Nav.cur : null;
    var all = Nav.list();
    if (!cur) { Nav.focus(Screen.cur && Screen.cur.first ? Screen.cur.first() : all[0]); return; }
    // ერთ ზოლში ◀ ▶ — მეზობელი
    var line = cur.closest('.strip, .seasons, .chips-line, .p-pills, #p-center, .btns, .tabs, .tabs-line, #nav, .cf-stars, .fbar');
    if (line && (dir === K.LEFT || dir === K.RIGHT)) {
      var sib = dir === K.LEFT ? cur.previousElementSibling : cur.nextElementSibling;
      while (sib && (!sib.classList.contains('f') || sib.hidden)) sib = dir === K.LEFT ? sib.previousElementSibling : sib.nextElementSibling;
      if (sib) { Nav.focus(sib); return; }
      if (line.classList.contains('strip') || line.classList.contains('seasons') || line.classList.contains('chips-line')) {
        if (dir === K.LEFT && Menu.style() === 'side') { Menu.enterRail(); }
        return;
      }
    }
    // გვერდითა მენიუ: მარცხნივ კიდიდან — მენიუში, მენიუდან მარჯვნივ — გვერდზე
    if (cur.closest('#rail')) {
      if (dir === K.RIGHT) { Menu.leaveRail(); return; }
      if (dir === K.LEFT) return;
    }
    var a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2, best = null, bs = 1e9;
    var vertical = dir === K.UP || dir === K.DOWN, cands = [];
    all.forEach(function (e) {
      if (e === cur) return;
      if (e.closest('#rail') && !cur.closest('#rail')) return;
      if (!e.closest('#rail') && cur.closest('#rail')) return;
      var b = e.getBoundingClientRect(); if (!b.width) return;
      var bx = b.left + b.width / 2, by = b.top + b.height / 2, d, off;
      if (dir === K.RIGHT) { if (b.left < a.right - 4) return; d = b.left - a.right; off = Math.abs(by - ay); }
      else if (dir === K.LEFT) { if (b.right > a.left + 4) return; d = a.left - b.right; off = Math.abs(by - ay); }
      else if (dir === K.DOWN) { if (b.top < a.bottom - 4) return; d = b.top - a.bottom; }
      else { if (b.bottom > a.top + 4) return; d = a.top - b.bottom; }
      // ზემოთ/ქვემოთ: ჰორიზონტალურად გადაფარვისას მანძილი 0, თორემ კიდეებს შორის
      if (vertical) off = b.right < a.left ? a.left - b.right : b.left > a.right ? b.left - a.right : 0;
      var top = dir === K.UP && !cur.closest('#top') && e.closest('#top');
      cands.push({ e: e, d: Math.max(0, d), off: off, top: top });
    });
    if (vertical) {
      // Android-ივით: ჯერ უახლოესი რიგი (ჩანართი შუაშია თუ კიდეზე — აღარ გამოტოვდება), მერე მასში უახლოესი
      var pool = cands.filter(function (c) { return !c.top; });
      if (!pool.length) pool = cands;
      var dmin = Math.min.apply(null, pool.map(function (c) { return c.d; }).concat([1e9]));
      pool.filter(function (c) { return c.d <= dmin + 40; }).forEach(function (c) { if (c.off < bs) { bs = c.off; best = c.e; } });
    } else {
      cands.forEach(function (c) { var s = c.d + c.off * 3; if (s < bs) { bs = s; best = c.e; } });
    }
    if (!best) {
      if (dir === K.LEFT && Menu.style() === 'side' && !cur.closest('#rail,#player,#dialog')) Menu.enterRail();
      return;
    }
    var bline = best.closest('.strip, .seasons, .chips-line');
    if (bline && bline !== cur.closest('.strip, .seasons, .chips-line') && (dir === K.UP || dir === K.DOWN)) {
      var i = +bline.dataset.last;
      if (!isNaN(i) && bline.children[i] && bline.children[i].classList.contains('f')) best = bline.children[i];
      else if ($('.f.on', bline)) best = $('.f.on', bline); // სეზონები — არჩეული სეზონი
      else {
        best = Array.prototype.filter.call(bline.children, function (c) { var r = c.getBoundingClientRect(); return c.classList.contains('f') && r.left >= 0 && r.right <= 1920; })
          .sort(function (x, y) { return Math.abs(x.getBoundingClientRect().left - a.left) - Math.abs(y.getBoundingClientRect().left - a.left); })[0] || best;
      }
    }
    Nav.focus(best);
  }
};

// ------------------------------------------------------------------ ეკრანები და ისტორია
var Screens = {};
var Screen = {
  stack: [], cur: null,
  open: function (name, params) {
    if (Screen.cur) Screen.stack.push({ name: Screen.cur.name, params: Screen.cur.params, focusKey: focusKey(Nav.cur) });
    Screen.show(name, params);
  },
  show: function (name, params, focusAfter) {
    if (Screen.cur && Screen.cur.leave) Screen.cur.leave();
    var s = Object.assign({ name: name, params: params || {} }, Screens[name]);
    Screen.cur = s;
    Menu.mark(name, params || {});
    Menu.scrolled(false);
    view.innerHTML = loading();
    Nav.cur = null;
    Promise.resolve(s.render(s.params)).then(function () {
      if (Screen.cur !== s) return;
      var el = focusAfter && $('[data-fk="' + focusAfter + '"]', view);
      // ბარათი შეიძლება მოგვიანებით ჩაიტვირთოს (სერიალების ბლოკი, ჟანრები) — მაშინ bindCards დააბრუნებს მასზე
      Screen.pendingFk = el ? null : focusAfter;
      Nav.focus(el || (s.first ? s.first() : Nav.list().filter(function (e) { return !e.closest('#top,#rail'); })[0]));
    }).catch(function (e) { if (Screen.cur === s) errorView(e.message, function () { Screen.show(name, params); }); });
  },
  back: function () {
    var prev = Screen.stack.pop();
    if (!prev) { exitApp(); return; }
    Screen.show(prev.name, prev.params, prev.focusKey);
  },
  root: function (name, params) { Screen.stack = []; Screen.show(name, params || {}); }
};
function focusKey(el) {
  if (!el) return null;
  if (!el.dataset.fk) el.dataset.fk = el.dataset.id ? 'id' + el.dataset.id : el.dataset.ep ? 'ep' + el.dataset.ep : el.dataset.person ? 'p' + el.dataset.person : el.id || '';
  return el.dataset.fk || null;
}
function errorView(msg, retry, action) {
  view.innerHTML = '<div class="status"><div class="st-t">' + esc(T('load_failed')) + '</div><div class="st-s">' + esc(msg || '') + '</div>' +
    '<div class="btns"><a class="f btn primary" id="retry">' + esc(action ? action.label : T('retry')) + '</a></div></div>';
  $('#retry').onclick = action ? action.run : retry; Nav.focus($('#retry'));
}
function emptyView(title, sub) { return '<div class="status"><div class="st-t">' + esc(title) + '</div><div class="st-s">' + esc(sub || '') + '</div></div>'; }
function exitApp() { try { tizen.application.getCurrentApplication().exit(); } catch (e) { } }
function openItem(id, type) { Screen.open('detail', { id: +id, type: type }); }
function bindCards(root) {
  $$('.card[data-id], .tcard[data-id]', root).forEach(function (c) { if (!c.onclick) c.onclick = function () { openItem(c.dataset.id, c.dataset.type); }; });
  $$('[data-person]', root).forEach(function (el) { if (!el.onclick) el.onclick = function () { Screen.open('person', { id: +el.dataset.person }); }; });
  var fk = Screen.pendingFk;
  if (fk && root !== view && /^id\d+$/.test(fk)) {
    var target = $('[data-id="' + fk.slice(2) + '"]', root);
    if (target && Nav.cur && Nav.cur.closest('.hero')) { Screen.pendingFk = null; target.dataset.fk = fk; Nav.focus(target); }
  }
}

// ------------------------------------------------------------------ დიალოგი (არჩევა — რადიო ან მონიშვნა)
function choose(title, opts, cur, done, multi) {
  var d = $('#dialog'), sel = multi ? (cur || []).slice() : cur;
  $('#dlg-title').textContent = title;
  $('#dlg-list').innerHTML = opts.map(function (o, i) {
    var on = multi ? sel.indexOf(i) >= 0 : i === sel;
    return '<a class="f opt' + (multi ? ' multi' : '') + (on ? ' on' : '') + '" data-i="' + i + '">' + esc(o) + '</a>';
  }).join('') + (multi ? '<a class="f btn primary dlg-ok" id="dlg-ok">' + esc(T('apply')) + '</a>' : '');
  var prev = Nav.cur;
  d.hidden = false;
  choose.close = function () { d.hidden = true; if (prev && document.contains(prev)) Nav.focus(prev, true); };
  $$('.opt', d).forEach(function (o) {
    o.onclick = function () {
      var i = +o.dataset.i;
      if (!multi) { choose.close(); done(i); return; }
      var k = sel.indexOf(i); if (k >= 0) sel.splice(k, 1); else sel.push(i);
      o.classList.toggle('on', k < 0);
    };
  });
  if (multi) $('#dlg-ok').onclick = function () { choose.close(); done(sel); };
  Nav.focus($$('.opt', d)[Math.max(0, multi ? 0 : cur)] || $$('.opt', d)[0]);
}
