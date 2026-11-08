/* screens.js — Android-ის აქტივობების ასლები: მთავარი, კატალოგი (ფილტრით), კატეგორიები, რჩეულები,
 * ფილმის/სერიალის გვერდი, მსახიობი, ძებნა, პარამეტრები, პროფილი. */
'use strict';

// ================================================================== მთავარი (MainActivity.loadHome + HomeAdapter)
function topCard(d, big) {
  var seasons = (d.seasons || []).filter(function (s) { return s.episodes && s.episodes.length; });
  var last = seasons[seasons.length - 1], eps = last ? last.episodes.length : (d.children || []).length;
  var sc = seasons.length || +(d.meta || {}).tv_shows_seasons || 0;
  var sub = [sc ? T('seasons_count', sc) : '', eps ? T('episodes_n', eps) : ''].filter(Boolean).join(' · ');
  return '<a class="f tcard' + (big ? ' big' : '') + '" data-id="' + d.id + '" data-type="tv_shows">' + pic(d.landscape || d.backdrop || d.poster) +
    '<div class="tc-text"><div class="tc-t">' + esc(decode(d.title)) + '</div>' + (sub ? '<div class="tc-s">' + esc(sub) + '</div>' : '') + '</div></a>';
}
Screens.home = {
  render: function () {
    var me = this, opt = function (pr, d) { return pr.catch(function () { return d; }); };
    return Promise.all([
      Api.browse('movies', 1), opt(Api.browse('movies', 2), { items: [] }), opt(Api.browse('tv_shows', 1), { items: [] }),
      opt(Api.browse('movies', 1, { values: {}, sort: 'views' }), { items: [] }), opt(Api.terms('movies_cat'), []), opt(Api.homeRefs(), { daily: null, tabs: [] })
    ]).then(function (r) {
      var seen = {}, newest = (r[0].items || []).concat(r[1].items || []).filter(function (it) { if (seen[it.id]) return false; seen[it.id] = 1; return true; });
      var heroes = newest.slice(0, 5), refs = r[5], genres = r[4].slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 8);
      me.topId = heroes[0] && heroes[0].id; me.loadedAt = Date.now();
      view.innerHTML = '<div class="scroll"><div class="inner home">' +
        '<div class="hero"><div class="bg"></div><div class="info"></div><div class="dots-nav">' + heroes.map(function () { return '<i></i>'; }).join('') + '</div></div>' +
        rowHtml(T('new_movies'), newest.slice(5), false, 'm') +
        (refs.tabs.length ? '<section class="row tops" data-row="tops"><div class="sec-title row-head"><h2>' + esc(T('nav_shows')) + '</h2><div class="tabs seg">' +
          refs.tabs.map(function (t, k) { return '<a class="f tab' + (k ? '' : ' on') + '" data-tab="' + k + '">' + esc(t.label) + '</a>'; }).join('') +
          '</div></div><div class="tops-grid" id="tops"></div></section>' : rowHtml(T('nav_shows'), r[2].items, true, 's')) +
        '<section class="row" id="daily" hidden></section>' +
        rowHtml(T('popular'), r[3].items, false, 'p') +
        genres.map(function (g, k) { return '<section class="row" data-genre="' + g.id + '" data-name="' + esc(g.name) + '" data-wide="' + (k % 2 ? '' : '1') + '" hidden></section>'; }).join('') +
        '</div></div>';
      bindCards(view);

      // სლაიდერი (item_hero)
      var i = 0, hero = $('.hero', view);
      var paint = function () {
        var it = heroes[i]; if (!it) return; var c = it.card || {};
        $('.bg', hero).innerHTML = pic(it.landscape || it.backdrop);
        var orig = (it.meta || {}).original_title, g = ((it.terms || {}).movies_cat || []).slice(0, 3).map(function (t) { return Tr.genre(t.name); });
        $('.info', hero).innerHTML = (orig && orig !== it.title ? '<div class="orig">' + esc(decode(orig)) + '</div>' : '') + '<h1>' + esc(decode(it.title)) + '</h1>' +
          metaLine(c.imdb, c.tmdb, [c.year].concat(g)) +
          '<div class="btns"><a class="f btn primary" id="h-play" data-fk="h-play">' + PLAY_SVG + esc(T('watch')) + '</a><a class="f btn" id="h-more" data-fk="h-more">' + esc(T('details_more')) + '</a></div>';
        $$('.dots-nav i', hero).forEach(function (d, k) { d.classList.toggle('on', k === i); });
        $('#h-play').onclick = function () { Player.start({ id: it.id, title: decode(it.title) }); };
        $('#h-more').onclick = function () { openItem(it.id, it.type); };
      };
      if (heroes.length) paint();
      me.timer = setInterval(function () {
        if (!heroes.length || (Nav.cur && Nav.cur.closest('.hero'))) return;
        i = (i + 1) % heroes.length; paint();
      }, 9000);
      me.heroNext = function (d) { i = (i + d + heroes.length) % heroes.length; paint(); Nav.focus(d < 0 ? $('#h-play') : $('#h-more')); };

      // სერიალები: დღის / კვირის / თვის (item_top_shows) — ჩანართზე ფოკუსი ცვლის
      var tcache = {}, tcur = -1;
      me.showTab = function (k) {
        if (k === tcur || !refs.tabs[k]) return; tcur = k;
        $$('.tops .tab', view).forEach(function (t) { t.classList.toggle('on', +t.dataset.tab === k); });
        var box = $('#tops', view); if (!box) return;
        var fill = function (list) {
          if (tcur !== k) return;
          box.innerHTML = list.length ? topCard(list[0], true) + '<div class="tops-small">' + list.slice(1, 7).map(function (d) { return topCard(d); }).join('') + '</div>' : '';
          bindCards(box);
        };
        if (tcache[k]) { fill(tcache[k]); return; }
        box.innerHTML = '<div class="tcard big skel"></div><div class="tops-small">' + new Array(7).join('<div class="tcard skel"></div>') + '</div>';
        Promise.all(refs.tabs[k].ids.slice(0, 7).map(function (id) { return Api.detail(id).catch(function () { return null; }); })).then(function (l) {
          tcache[k] = l.filter(Boolean); fill(tcache[k]);
        });
      };
      $$('.tops .tab', view).forEach(function (t) { t.onclick = function () { me.showTab(+t.dataset.tab); }; });
      if (refs.tabs.length) me.showTab(0);

      // დღის სერიალი (item_daily)
      if (refs.daily) Api.detail(refs.daily.id).then(function (d) {
        var box = $('#daily', view); if (!box) return;
        var info = d.info || {}, orig = (d.meta || {}).original_title;
        var seasons = (d.seasons || []).filter(function (s) { return s.episodes && s.episodes.length; });
        var si = seasons.length - 1, list = si >= 0 ? seasons[si].episodes : (d.children || []);
        var desc = plain(d.content || d.excerpt);
        box.innerHTML = '<div class="daily"><div class="daily-bg">' + pic(refs.daily.bg || d.landscape || d.backdrop) + '</div><div class="daily-body">' +
          '<a class="f daily-poster" data-anchor="1">' + pic(d.poster) + '<span class="daily-tag">' + esc(T('daily_show')) + '</span></a><div class="daily-info">' +
          metaLine(info.imdb, info.tmdb, [info.year || refs.daily.year]) +
          '<div class="daily-title">' + esc(decode(d.title)) + '</div>' + (orig && orig !== d.title ? '<div class="orig">' + esc(decode(orig)) + '</div>' : '') +
          (desc ? '<div class="desc">' + esc(desc) + '</div>' : '') +
          '<div class="btns">' + (list.length ? '<a class="f btn primary" id="dl-watch">' + PLAY_SVG + esc(T('watch')) + '</a>' : '') +
          '<a class="f btn sq" id="dl-fav">' + HEART + '</a></div></div></div>' +
          (list.length ? '<div class="daily-eps-t">' + esc(T('last_episodes', si + 1)) + '</div><div class="daily-eps">' + list.slice(-4).map(function (e, k) {
            return epCard(e, list.length - Math.min(4, list.length) + k, d.landscape);
          }).join('') + '</div>' : '') + '</div>';
        box.hidden = false;
        var play = function (ep) { playEpisode(d, ep, list); };
        $('.daily-poster', box).onclick = function () { openItem(d.id, 'tv_shows'); };
        if ($('#dl-watch')) $('#dl-watch').onclick = function () { play(list[list.length - 1]); };
        var paintFav = function () { $('#dl-fav').classList.toggle('fav', Favs.has(d.id)); };
        paintFav();
        $('#dl-fav').onclick = function () { var on = Favs.toggle(d); paintFav(); toast(T(on ? 'fav_added' : 'fav_removed')); };
        $$('.daily-eps .ep', box).forEach(function (el) { el.onclick = function () { play(list.find(function (x) { return x.id === +el.dataset.ep; })); }; });
      }).catch(function () { });

      // ჟანრების რიგები — მონაცვლეობით განიერი და პოსტერი
      $$('[data-genre]', view).forEach(function (sec) {
        Api.browse('movies', 1, { values: { genre: [sec.dataset.genre] }, sort: '' }).then(function (g) {
          if (!g.items || !g.items.length || !document.contains(sec)) return;
          var tmp = document.createElement('div'); tmp.innerHTML = rowHtml(Tr.genre(sec.dataset.name), g.items, !!sec.dataset.wide, 'g' + sec.dataset.genre);
          var row = tmp.firstChild; sec.parentNode.replaceChild(row, sec); bindCards(row);
        }).catch(function () { });
      });
    });
  },
  first: function () { return $('#h-play'); },
  leave: function () { clearInterval(this.timer); },
  onFocus: function (el) { if (el.closest('.tops') && el.dataset.tab != null) this.showTab(+el.dataset.tab); },
  key: function (k) {
    if (Nav.cur && Nav.cur.id === 'h-play' && k === K.LEFT && Menu.style() !== 'side') { this.heroNext(-1); return true; }
    if (Nav.cur && Nav.cur.id === 'h-more' && k === K.RIGHT) { this.heroNext(1); return true; }
  },
  // 3 წუთში ერთხელ — საიტზე ახალი ფილმი თუ დაემატა, მთავარი თავიდან (Android-ის checkNew)
  checkNew: function () {
    var me = this;
    if (!Nav.cur || !Nav.cur.closest('.hero,#top,#rail')) return;
    Api.clearCache();
    Api.browse('movies', 1).then(function (r) {
      var top = r.items && r.items[0] && r.items[0].id;
      if (top && top !== me.topId && Screen.cur && Screen.cur.name === 'home') Screen.show('home', {});
    }).catch(function () { });
  }
};
function playEpisode(d, ep, list) {
  if (!ep) return;
  var i = Math.max(0, list.findIndex(function (x) { return x.id === ep.id; }));
  Resume.setLastEpisode(d.id, ep.id);
  Player.start({ id: ep.id, title: decode(d.title) + ' — ' + decode(ep.title), index: i, showId: d.id,
    list: list.map(function (x) { return { id: x.id, title: decode(d.title) + ' — ' + decode(x.title) }; }) });
}

// ================================================================== კატალოგი (CatalogController) — თავი, დალაგება, ფილტრის ზოლი
function sortName(v, label) { return v === '' ? T('sort_new') : v === 'views' ? T('sort_popular') : v === 'imdb' ? 'IMDb' : v === 'tmdb' ? 'TMDB' : label; }
function groupTitle(g) {
  if (g.key === 'genre') return T('f_genre');
  if (g.key === 'lang') return T('audio');
  if (g.key === 'quality') return T('quality');
  if (g.kind === 'range' && /^year/.test((g.range[0] || {}).name || '')) return T('f_year');
  return g.title;
}
function fmtNum(v, step) { return step < 1 ? (+v).toFixed(1) : String(Math.round(v)); }
Screens.catalog = {
  render: function (p) {
    var me = this;
    me.base = p.base || 'movies'; me.title = p.title || T(me.base === 'tv_shows' ? 'nav_shows' : 'nav_movies');
    me.filter = p.filter || (p.genre ? { values: { genre: [String(p.genre)] }, sort: '' } : Filter.empty());
    me.pending = JSON.parse(JSON.stringify(me.filter)); me.pendingBase = me.base;
    me.page = 0; me.pages = 1; me.busy = false; me.total = 0;
    return Promise.all([Api.browse(me.base, 1, me.filter), Api.filters(me.base, me.filter)]).then(function (r) {
      me.groups = (r[1].groups || []).filter(function (g) { return g.key !== 'kk_type'; });
      me.typeGroup = (r[1].groups || []).find(function (g) { return g.key === 'kk_type'; });
      me.sorts = (r[1].sort && r[1].sort.length ? r[1].sort : [{ value: '' }, { value: 'views' }, { value: 'imdb' }, { value: 'tmdb' }]);
      me.pages = r[0].pages || 1; me.page = 1; me.total = r[0].total || 0;
      var wide = me.base === 'tv_shows', items = r[0].items || [];
      view.innerHTML = '<div class="scroll"><div class="inner cat">' + me.header() +
        '<div class="grid' + (wide ? ' wide' : '') + '" id="grid">' + items.map(function (it) { return cardHtml(it, wide); }).join('') + '</div>' +
        (items.length ? '' : emptyView(T('nothing_found'), T('try_other_filter'))) + '</div></div>';
      bindCards(view); me.bindHeader();
    });
  },
  typeOptions: function () {
    var o = this.typeGroup && this.typeGroup.options.filter(function (x) { return x.value !== 'all'; });
    if (!o || !o.length) o = [{ value: 'movies', count: null }, { value: 'tv_shows', count: null }];
    return o.map(function (x) { return { value: x.value, label: T(x.value === 'tv_shows' ? 'type_shows' : 'type_movies'), count: x.count }; });
  },
  summary: function (g) {
    var sel = this.pending.values;
    if (g.kind === 'range') {
      var from = (sel[g.range[0].name] || [])[0], to = g.range[1] && (sel[g.range[1].name] || [])[0];
      if (from == null && to == null) return null;
      var st = g.range[0].step;
      return (from != null ? from : fmtNum(g.range[0].min, st)) + '–' + (to != null ? to : fmtNum(g.range[g.range.length - 1].max, st));
    }
    var vs = (sel[g.key] || []).filter(Boolean), labels = g.options.filter(function (o) { return vs.indexOf(o.value) >= 0; }).map(function (o) { return Tr.option(g.key, o.label); });
    return !labels.length ? null : labels.length === 1 ? labels[0] : labels[0] + ' +' + (labels.length - 1);
  },
  header: function () {
    var me = this, t = me.typeOptions().find(function (o) { return o.value === me.base; }), typeCount = t && t.count || 0;
    var shown = (Filter.isEmpty(me.filter) && typeCount) || me.total <= 0 ? typeCount : me.total;
    var hero = me.base === 'tv_shows' ? HERO_TV : HERO_MOVIES;
    return '<div class="cat-head" data-anchor="1"><div class="cat-bg' + (me.base === 'tv_shows' ? ' tv' : '') + '">' + pic(hero) + '</div>' +
      '<div class="cat-top"><div><h1>' + esc(me.title) + '</h1><div class="cat-count">' + (shown > 0 ? esc(T(me.base === 'tv_shows' ? 'count_shows' : 'count_movies', shown)) : '') + '</div></div>' +
      '<div class="tabs seg" id="cat-sorts">' + me.sorts.map(function (s) {
        return '<a class="f tab' + (s.value === (me.filter.sort || '') ? ' on' : '') + '" data-sort="' + esc(s.value) + '" data-fk="so' + esc(s.value) + '">' + esc(sortName(s.value, s.label)) + '</a>';
      }).join('') + '</div></div>' +
      (me.groups.length ? '<div class="fbar" id="fbar"><a class="f fitem on" data-g="type" data-fk="fg-type">' + esc((me.typeOptions().find(function (o) { return o.value === me.pendingBase; }) || {}).label || T('type_movies')) + '<i>▾</i></a>' +
        me.groups.map(function (g) { var s = me.summary(g); return '<a class="f fitem' + (s ? ' on' : '') + '" data-g="' + esc(g.key) + '" data-fk="fg-' + esc(g.key) + '">' + esc(s || groupTitle(g)) + '<i>▾</i></a>'; }).join('') +
        '<a class="f fgo" id="fgo" data-fk="fgo">' + esc(T('search_go')) + '</a></div>' : '') + '</div>';
  },
  refreshHeader: function () {
    var fk = Nav.cur && Nav.cur.dataset.fk, head = $('.cat-head', view); if (!head) return;
    var tmp = document.createElement('div'); tmp.innerHTML = this.header();
    head.parentNode.replaceChild(tmp.firstChild, head); this.bindHeader();
    var el = fk && $('[data-fk="' + fk + '"]', view); if (el) Nav.focus(el, true);
  },
  bindHeader: function () {
    var me = this;
    $$('#cat-sorts .tab', view).forEach(function (t) { t.onclick = function () { me.pending.sort = t.dataset.sort; me.apply(); }; });
    $$('#fbar .fitem', view).forEach(function (it) {
      it.onclick = function () {
        if (it.dataset.g === 'type') {
          var opts = me.typeOptions();
          choose(T('filter'), opts.map(function (o) { return o.label; }), opts.findIndex(function (o) { return o.value === me.pendingBase; }), function (i) { me.pendingBase = opts[i].value; me.refreshHeader(); });
          return;
        }
        var g = me.groups.find(function (x) { return x.key === it.dataset.g; }); if (!g) return;
        if (g.kind === 'range') { me.openRange(g); return; }
        var labels = g.options.map(function (o) { return o.value === '' ? T('all') : Tr.option(g.key, o.label) + (o.count != null ? '  (' + o.count + ')' : ''); });
        var cur = me.pending.values[g.key] || [];
        if (g.kind === 'multi') {
          choose(groupTitle(g), labels, g.options.map(function (o, i) { return cur.indexOf(o.value) >= 0 ? i : -1; }).filter(function (i) { return i >= 0; }), function (sel) {
            me.pending.values[g.key] = sel.map(function (i) { return g.options[i].value; }).filter(Boolean); me.refreshHeader();
          }, true);
        } else {
          choose(groupTitle(g), labels, Math.max(0, g.options.findIndex(function (o) { return o.value === (cur[0] || ''); })), function (i) {
            var v = g.options[i].value; me.pending.values[g.key] = v ? [v] : []; me.refreshHeader();
          });
        }
      };
    });
    if ($('#fgo')) $('#fgo').onclick = function () { me.apply(); };
  },
  // „დან – მდე": ◀ ▶ ცვლის (დაჭერილზე ჩქარდება), ▲ ▼ — შორის, OK — დახურვა
  openRange: function (g) {
    var me = this, st = g.range[0].step || 1, min = g.range[0].min, max = g.range[g.range.length - 1].max;
    var lo = +((me.pending.values[g.range[0].name] || [])[0] || min), hi = +(((g.range[1] && me.pending.values[g.range[1].name]) || [])[0] || max);
    var d = $('#dialog'), prev = Nav.cur;
    $('#dlg-title').textContent = groupTitle(g);
    $('#dlg-list').innerHTML = '<a class="f rrow" data-r="lo"><span>' + esc(T('from')) + '</span><b>‹</b><em id="rr-lo"></em><b>›</b></a>' +
      '<a class="f rrow" data-r="hi"><span>' + esc(T('to')) + '</span><b>‹</b><em id="rr-hi"></em><b>›</b></a><div class="rr-hint">' + esc(T('range_hint')) + '</div>';
    var paint = function () { $('#rr-lo').textContent = fmtNum(lo, st); $('#rr-hi').textContent = fmtNum(hi, st); };
    var save = function () {
      var r0 = g.range[0].name, r1 = g.range[1] && g.range[1].name;
      me.pending.values[r0] = lo > min ? [fmtNum(lo, st)] : [];
      if (r1) me.pending.values[r1] = hi < max ? [fmtNum(hi, st)] : [];
    };
    paint(); d.hidden = false;
    choose.close = function () { save(); d.hidden = true; me.refreshHeader(); if (prev && document.contains(prev)) Nav.focus(prev, true); };
    choose.range = function (k, rep) {
      var which = Nav.cur && Nav.cur.dataset.r; if (!which) return false;
      var stepN = st * (rep > 20 ? 10 : rep > 6 ? 3 : 1), dlt = k === K.LEFT ? -stepN : stepN;
      if (which === 'lo') { lo = Math.min(max, Math.max(min, Math.round((lo + dlt) / st) * st)); if (hi < lo) hi = lo; }
      else { hi = Math.min(max, Math.max(min, Math.round((hi + dlt) / st) * st)); if (lo > hi) lo = hi; }
      paint(); return true;
    };
    $$('.rrow', d).forEach(function (r) { r.onclick = function () { choose.close(); }; });
    Nav.focus($('.rrow', d));
  },
  apply: function () {
    var me = this, f = JSON.parse(JSON.stringify(me.pending));
    if (me.pendingBase !== me.base) delete f.values.genre;
    var title = me.pendingBase !== me.base ? T(me.pendingBase === 'tv_shows' ? 'type_shows' : 'type_movies') : me.params.title;
    Screen.show('catalog', Object.assign({}, me.params, { base: me.pendingBase, title: title, filter: f, genre: null }), 'fgo');
  },
  first: function () { return $('#grid .card', view) || $('#fgo', view) || $('#cat-sorts .tab', view); },
  onFocus: function (el) {
    var me = this, cards = $$('#grid .card', view);
    if (!el.closest('#grid') || me.busy || me.page >= me.pages || cards.indexOf(el) < cards.length - 14) return;
    me.busy = true;
    Api.browse(me.base, me.page + 1, me.filter).then(function (n) {
      me.page++; var g = $('#grid', view); if (!g) return;
      g.insertAdjacentHTML('beforeend', (n.items || []).map(function (it) { return cardHtml(it, me.base === 'tv_shows'); }).join(''));
      bindCards(g); me.busy = false;
    }).catch(function () { me.busy = false; });
  }
};

// ================================================================== კატეგორიები (GenresActivity) — ფოტოებით
Screens.genres = {
  render: function (p) {
    var tv = !!p.tv, tax = tv ? 'tv_shows_cat' : 'movies_cat', pre = tv ? 't' : 'm';
    return Api.terms(tax).then(function (terms) {
      var tiles = [{ id: 'all', name: T(tv ? 'all_shows' : 'all_movies') }].concat(terms.slice().sort(function (a, b) { return b.count - a.count; }));
      view.innerHTML = '<div class="scroll"><div class="inner pad"><div class="page-head"><div class="sec-title"><h2 class="big">' + esc(T('genres_title')) + '</h2></div><div class="tabs seg">' +
        '<a class="f tab' + (tv ? '' : ' on') + '" data-tv="" data-fk="g0">' + esc(T('type_movies')) + '</a><a class="f tab' + (tv ? ' on' : '') + '" data-tv="1" data-fk="g1">' + esc(T('type_shows')) + '</a></div></div>' +
        '<div class="grid genres">' + tiles.map(function (t) {
          return '<a class="f genre" data-term="' + t.id + '" data-name="' + esc(t.name) + '"><img class="pic" src="img/cat/cat_' + pre + '_' + t.id + '.jpg" onerror="this.remove()"><div>' +
            esc(t.id === 'all' ? t.name : Tr.genre(t.name)) + (t.count ? '<small>' + esc(T(tv ? 'count_shows' : 'count_movies', t.count)) + '</small>' : '') + '</div></a>';
        }).join('') + '</div></div></div>';
      $$('.tab', view).forEach(function (t) { t.onclick = function () { Screen.show('genres', { tv: !!t.dataset.tv }, t.dataset.fk); }; });
      $$('.genre', view).forEach(function (g) {
        g.onclick = function () {
          var base = tv ? 'tv_shows' : 'movies';
          if (g.dataset.term === 'all') Screen.open('catalog', { base: base });
          else Screen.open('catalog', { base: base, title: Tr.genre(g.dataset.name), genre: g.dataset.term });
        };
      });
    });
  },
  first: function () { return $('.genre', view); },
  onFocus: function (el) { if (el.dataset.tv != null && !el.classList.contains('on')) el.click(); }
};

// ================================================================== რჩეულები
Screens.favs = {
  render: function () {
    var a = Favs.all();
    view.innerHTML = '<div class="scroll"><div class="inner cat"><div class="cat-head plain" data-anchor="1"><div class="cat-top"><div><h1>' + esc(T('nav_favorites')) + '</h1></div></div></div>' +
      (a.length ? '<div class="grid" id="grid">' + a.map(function (it) { return cardHtml(it); }).join('') + '</div>' : emptyView(T('nav_favorites'), T('favorites_empty'))) + '</div></div>';
    bindCards(view);
  },
  first: function () { return $('#grid .card', view); }
};

// ================================================================== ფილმის / სერიალის გვერდი (DetailsActivity)
Screens.detail = {
  render: function (p) {
    var me = this;
    return Api.detail(p.id).then(function (d) {
      me.d = d;
      var isShow = d.type === 'tv_shows', info = d.info || {}, meta = d.meta || {}, card = d.card || {};
      var orig = meta.original_title && meta.original_title !== d.title ? meta.original_title : '';
      var genres = (d.terms || {}).movies_cat || (d.terms || {}).tv_shows_cat || [];
      var seasons = (d.seasons || []).filter(function (s) { return s.episodes && s.episodes.length; });
      var desc = plain(d.content || d.excerpt);
      var people = d.people || [], directors = people.filter(function (x) { return x.group === 'crew'; }), actors = people.filter(function (x) { return x.group !== 'crew'; });
      var trailer = (d.trailers || [])[0] || card.trailer;
      var sc = +meta.tv_shows_seasons || seasons.length;
      view.innerHTML = '<div class="scroll"><div class="inner detail">' +
        '<div class="d-head"><div class="bg">' + pic(d.landscape || d.backdrop || d.poster) + '</div><div class="d-info">' +
        (orig ? '<div class="orig">' + esc(decode(orig)) + '</div>' : '') + '<h1>' + esc(decode(d.title)) + '</h1>' +
        metaLine(info.imdb || card.imdb, info.tmdb || card.tmdb, [info.year || card.year, info.runtime || card.runtime, isShow && sc ? T('seasons_count', sc) : '', meta.views ? '👁 ' + meta.views : '']) +
        (langTags(card).length ? '<div class="d-tags">' + langTags(card).map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        (genres.length ? '<div class="chips">' + genres.map(function (g) { return '<span>' + esc(Tr.genre(g.name)) + '</span>'; }).join('') + '</div>' : '') +
        '</div></div>' +
        '<div class="d-actions btns" data-anchor="1"><a class="f btn primary" id="d-play" data-fk="d-play">' + PLAY_SVG + '<span id="d-play-t"></span></a>' +
        '<a class="f btn" id="d-restart" data-fk="d-restart" hidden>' + esc(T('from_start')) + '</a>' +
        (trailer ? '<a class="f btn" id="d-trailer" data-fk="d-trailer"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.5v5l4-2.5z"/></svg>' + esc(T('trailer')) + '</a>' : '') +
        '<a class="f btn sq" id="d-fav" data-fk="d-fav">' + HEART + '</a></div>' +
        (desc ? '<div class="d-desc" id="d-desc">' + esc(desc) + '</div><a class="f more-btn" id="d-more" data-fk="d-more" hidden>' + esc(T('more')) + '</a>' : '') +
        (seasons.length ? '<div class="tabs-line" id="show-tabs" data-anchor="1"></div><div class="divider"></div><div id="show-body"></div>' : '') +
        (directors.length ? '<div data-anchor="1">' + sectionTitle(T(directors.length > 1 ? 'directors' : 'director')) + '<div class="dirs">' + directors.map(function (x) {
          return '<a class="f dir" data-person="' + x.id + '"><div class="ph">' + (x.photo ? pic(x.photo) : PERSON_SVG) + '</div><div><div class="dn">' + esc(x.name) + '</div><div class="dr">' + esc(T('role_director')) + '</div><div class="dl">' + esc(T('bio_more')) + '</div></div></a>';
        }).join('') + '</div></div>' : '') +
        (actors.length ? '<section class="row" data-row="cast">' + sectionTitle(T('cast')) + '<div class="strip">' + actors.map(personCard).join('') + '</div></section>' : '') +
        (!seasons.length && (d.children || []).length ? '<section class="row" data-row="kids">' + sectionTitle(T('episodes')) + '<div class="strip" id="kids">' + d.children.map(function (e, i) { return epCard(e, i, d.landscape); }).join('') + '</div></section>' : '') +
        ((d.related || []).length ? '<section class="row" data-row="rel">' + sectionTitle(T(isShow ? 'similar_shows' : 'similar_movies')) + '<div class="strip">' + d.related.map(function (it) { return cardHtml(it, isShow); }).join('') + '</div></section>' : '') +
        '<div id="comments" data-anchor="1"></div></div></div>';
      bindCards(view);

      var dd = $('#d-desc'), more = $('#d-more');
      if (dd) setTimeout(function () {
        if (dd.scrollHeight > dd.clientHeight + 4) more.hidden = false;
        more.onclick = function () { var open = dd.classList.toggle('open'); more.textContent = T(open ? 'less' : 'more'); };
      }, 60);
      var bindEps = function (root, list) { $$('.ep', root).forEach(function (el) { el.onclick = function () { playEpisode(d, list.find(function (x) { return x.id === +el.dataset.ep; }), list); }; }); };
      if ($('#kids')) bindEps($('#kids'), d.children);

      var all = seasons.reduce(function (a, s) { return a.concat(s.episodes); }, []);
      if (!all.length) all = d.children || [];
      me.repaint = function () {
        var t = $('#d-play-t'); if (!t) return;
        if (isShow) {
          var lastId = Resume.lastEpisode(d.id), last = all.find(function (e) { return e.id === lastId; }), target = last || all[0];
          $('#d-play').hidden = !target;
          t.textContent = last ? (T('continue_at', '').trim() + ' · ' + T('episode_n', epNum(last, all.indexOf(last)))) : T('first_episode');
          $('#d-play').onclick = function () {
            var list = (seasons.find(function (s) { return s.episodes.some(function (e) { return e.id === target.id; }); }) || {}).episodes || all;
            playEpisode(d, target, list);
          };
        } else {
          var pos = Resume.get(d.id);
          t.textContent = pos > 30000 ? T('continue_at', fmt(pos)) : T('watch');
          $('#d-restart').hidden = !(pos > 30000);
          $('#d-play').onclick = function () { Player.start({ id: d.id, title: decode(d.title) }); };
          $('#d-restart').onclick = function () { Resume.set(d.id, 0); Player.start({ id: d.id, title: decode(d.title), resume: 0 }); };
        }
      };
      me.repaint();
      if ($('#d-trailer')) $('#d-trailer').onclick = function () { Player.start({ direct: trailer, title: decode(d.title) + ' — ' + T('trailer') }); };
      var paintFav = function () { $('#d-fav').classList.toggle('fav', Favs.has(d.id)); };
      paintFav();
      $('#d-fav').onclick = function () { var on = Favs.toggle(d); paintFav(); toast(T(on ? 'fav_added' : 'fav_removed')); };

      if (seasons.length) me.showTabs(d, seasons, bindEps);
      Comments.load(d, false);
    });
  },
  // „ეპიზოდები | შეფასებები" (საიტის სერიალის გვერდივით)
  showTabs: function (d, seasons, bindEps) {
    var me = this, epDesc = {};
    if (d.link) Api.episodeDescriptions(d.link).then(function (m) { epDesc = m; if (me.refreshCard) me.refreshCard(); }).catch(function () { });
    var hasRatings = seasons.some(function (s) { return s.episodes.some(function (e) { return +(e.meta || {}).kk_ep_imdb; }); });
    var names = [T('tab_episodes')].concat(hasRatings ? [T('tab_ratings')] : []);
    $('#show-tabs').innerHTML = names.map(function (t, k) { return '<a class="f tline" data-t="' + k + '" data-fk="st' + k + '">' + esc(t) + '</a>'; }).join('');
    var lastId = Resume.lastEpisode(d.id);
    var season = Math.max(0, seasons.findIndex(function (s) { return s.episodes.some(function (e) { return e.id === lastId; }); }));
    var ratingSeason = season, curTab = -1, body = $('#show-body');
    var seasonName = function (s, i) { var n = /season\s*(\d+)/i.exec(s.name); return n ? T('season_n', n[1]) : (s.name || T('season_n', i + 1)); };
    var showEpisodes = function () {
      body.innerHTML = '<div class="chips-line" data-anchor="1">' + seasons.map(function (s, i) { return '<a class="f chip' + (i === season ? ' on' : '') + '" data-s="' + i + '">' + esc(seasonName(s, i)) + '</a>'; }).join('') +
        '</div><section class="row" data-row="eps"><div class="strip" id="eps"></div></section>';
      var fill = function () {
        var strip = $('#eps', body), s = seasons[season];
        strip.dataset.x = 0; strip.style.transform = ''; delete strip.dataset.last;
        strip.innerHTML = s.episodes.map(function (e, i) { return epCard(e, i, s.thumbnail || d.landscape); }).join('');
        bindEps(strip, s.episodes);
      };
      $$('.chip', body).forEach(function (c) { c.onclick = function () { season = +c.dataset.s; $$('.chip', body).forEach(function (x) { x.classList.toggle('on', x === c); }); fill(); }; });
      fill();
    };
    var showRatings = function () {
      var rating = function (e) { return +(e.meta || {}).kk_ep_imdb || null; };
      body.innerHTML = '<div class="er" data-anchor="1"><div class="er-head"><div class="sec-title yellow"><h2>' + esc(T('ep_ratings')) + '</h2></div><div class="tabs seg" id="er-seasons">' +
        seasons.map(function (s, i) { return '<a class="f tab" data-rs="' + i + '">S' + (i + 1) + '</a>'; }).join('') + '</div></div>' +
        '<div class="er-sum" id="er-sum"></div><section class="er-row" data-row="bars"><div class="strip er-bars" id="er-bars"></div></section><div class="er-card" id="er-card"></div></div>';
      if (seasons.length < 2) $('#er-seasons').hidden = true;
      var card = function (e, i) {
        var s = seasons[ratingSeason], num = epNum(e, i), m = e.meta || {};
        var dsc = epDesc[e.link || ''] || epDesc[(ratingSeason + 1) + '-' + num] || '';
        $('#er-card').innerHTML = '<div class="ec-img">' + pic(e.poster || e.backdrop || s.thumbnail || d.landscape) + '</div><div class="ec-main">' +
          '<div class="ec-se">' + esc(T('season_ep', ratingSeason + 1, num)) + '</div><div class="ec-t">' + esc(decode(e.title)) + '</div><div class="ec-rts">' +
          ratingBadge(rating(e), 'IMDb', 'imdb') + (rating(e) && +m.kk_ep_imdb_votes ? '<span class="ec-v">(' + compact(+m.kk_ep_imdb_votes) + ')</span>' : '') +
          ratingBadge(+m.kk_ep_tmdb, 'TMDB', 'tmdb') + '</div></div>' +
          (dsc ? '<div class="ec-div"></div><div class="ec-desc">' + esc(dsc) + '<div class="ec-go">' + esc(T('watch_arrow')) + '</div></div>' : '');
        me.refreshCard = function () { card(e, i); };
      };
      var fill = function () {
        $$('#er-seasons .tab').forEach(function (t) { t.classList.toggle('on', +t.dataset.rs === ratingSeason); });
        var eps = seasons[ratingSeason].episodes, rs = eps.map(rating), valid = rs.filter(Boolean);
        var votes = eps.reduce(function (a, e) { return a + (+(e.meta || {}).kk_ep_imdb_votes || 0); }, 0);
        $('#er-sum').textContent = valid.length ? T('ep_ratings_sum', eps.length, fmtRating(valid.reduce(function (a, b) { return a + b; }, 0) / valid.length), compact(votes)) : T('episodes_n', eps.length);
        var lo = valid.length ? Math.min.apply(null, valid) : 0, hi = valid.length ? Math.max.apply(null, valid) : 10;
        var bars = $('#er-bars'); bars.dataset.x = 0; bars.style.transform = ''; delete bars.dataset.last;
        bars.innerHTML = eps.map(function (e, i) {
          var r = rs[i], f = r == null ? 0 : hi > lo ? (r - lo) / (hi - lo) : 1;
          return '<a class="f bar" data-i="' + i + '"><span class="col" style="height:' + Math.round(64 + 134 * f) + 'px">' + (r ? fmtRating(r) : '–') + '</span><span class="be">E' + esc(epNum(e, i)) + '</span></a>';
        }).join('');
        var best = 0; rs.forEach(function (r, i) { if ((r || -1) > (rs[best] || -1)) best = i; });
        $$('.bar', bars).forEach(function (b) {
          var i = +b.dataset.i;
          b.onclick = function () { playEpisode(d, eps[i], eps); };
          b.onfocusbar = function () { $$('.bar', bars).forEach(function (x) { x.classList.toggle('sel', x === b); }); card(eps[i], i); };
        });
        if (eps.length) { bars.children[best].classList.add('sel'); card(eps[best], best); bars.dataset.last = best; }
      };
      $$('#er-seasons .tab').forEach(function (t) { t.onclick = function () { ratingSeason = +t.dataset.rs; fill(); }; });
      fill();
    };
    me.showTab = function (k) {
      if (k === curTab) return; curTab = k;
      $$('#show-tabs .tline').forEach(function (t) { t.classList.toggle('on', +t.dataset.t === k); });
      me.refreshCard = null;
      if (k === 0) showEpisodes(); else showRatings();
    };
    $$('#show-tabs .tline').forEach(function (t) { t.onclick = function () { me.showTab(+t.dataset.t); }; });
    me.showTab(0);
  },
  first: function () { return $('#d-play:not([hidden])') || $('#d-fav'); },
  onFocus: function (el) {
    if (el.classList.contains('tline') && this.showTab) this.showTab(+el.dataset.t);
    if (el.dataset.rs != null && !el.classList.contains('on')) el.click();
    if (el.onfocusbar) el.onfocusbar();
  },
  resume: function () { if (this.repaint) this.repaint(); }
};

// კომენტარები — საიტის იგივე, ზემოთ დაწერის ფორმით (შესულ მომხმარებელს სახელი არ სჭირდება)
var Comments = {
  rating: 0,
  load: function (d, focusForm) {
    var box = $('#comments'); if (!box) return;
    Api.comments(d.id).then(function (pg) {
      if (!document.contains(box)) return;
      var extra = (pg.total || 0) + (pg.average ? '   ★ ' + fmtRating(pg.average) : ''), logged = !!Auth.token();
      box.innerHTML = sectionTitle(T('comments'), extra) +
        '<div class="cform"><a class="f field" id="cf-text-f"><textarea id="cf-text" rows="3" placeholder="' + esc(T('comment_placeholder', decode(d.title))) + '"></textarea></a>' +
        (logged ? '' : '<a class="f field" id="cf-name-f"><input id="cf-name" type="text" placeholder="' + esc(T('your_name')) + '" value="' + esc(store('cname') || '') + '"></a>') +
        '<div class="cf-row"><span class="cf-l">' + esc(T('rating_label')) + '</span><div class="cf-stars">' + [1, 2, 3, 4, 5].map(function (n) { return '<a class="f star" data-n="' + n + '">☆</a>'; }).join('') +
        '</div><a class="f btn primary" id="cf-send">' + esc(T('send')) + '</a></div><div class="cf-msg" id="cf-msg">' + esc(T('comment_hint')) + '</div></div>' +
        ((pg.items || []).length ? pg.items.slice(0, 10).map(function (c) {
          return '<div class="comment"><div class="c-av">' + (c.avatar ? pic(c.avatar) : PERSON_SVG) + '</div><div class="c-main"><div class="c-head"><b>' + esc(c.author) + '</b>' +
            (c.rating ? '<span class="c-stars">' + new Array(c.rating + 1).join('★') + new Array(6 - c.rating).join('☆') + '</span>' : '') + '<span class="c-date">' + esc(String(c.date || '').slice(0, 10)) + '</span></div>' +
            '<div class="c-text">' + esc(plain(c.content)) + '</div></div></div>';
        }).join('') : '<div class="no-c">' + esc(T('no_comments')) + '</div>');
      var paint = function () { $$('.cf-stars .star', box).forEach(function (s) { var on = +s.dataset.n <= Comments.rating; s.textContent = on ? '★' : '☆'; s.classList.toggle('on', on); }); };
      $$('.cf-stars .star', box).forEach(function (s) { s.onclick = function () { var n = +s.dataset.n; Comments.rating = Comments.rating === n ? 0 : n; paint(); }; });
      paint();
      $$('.cform .field', box).forEach(function (f) { f.onclick = function () { $('textarea,input', f).focus(); }; });
      $('#cf-send').onclick = function () {
        var text = $('#cf-text').value.trim(), name = $('#cf-name') ? $('#cf-name').value.trim() : '', msg = $('#cf-msg'), send = $('#cf-send');
        if (!text || (!logged && !name)) { msg.textContent = T('comment_need'); msg.className = 'cf-msg err'; return; }
        send.textContent = T('sending');
        Api.post('comments/' + d.id, { content: text, author: name, rating: Comments.rating }).then(function (o) {
          if (!o.comment && o.message) throw new Error(plain(o.message) || T('comment_failed'));
          store('cname', name); Comments.rating = 0;
          toast(T(o.pending ? 'comment_pending' : 'comment_added'), 4000);
          Comments.load(d, true);
        }).catch(function (e) { send.textContent = T('send'); msg.textContent = e.message || T('comment_need'); msg.className = 'cf-msg err'; });
      };
      if (focusForm) Nav.focus($('#cf-send'));
    }).catch(function () { });
  }
};

// ================================================================== მსახიობი / რეჟისორი (PersonActivity)
Screens.person = {
  render: function (p) {
    return Api.person(p.id).then(function (x) {
      var credits = x.credits || [], bio = plain(x.bio);
      view.innerHTML = '<div class="scroll"><div class="inner pad person-page"><div class="pp-head" data-anchor="1"><div class="pp-ph">' + (x.photo ? pic(x.photo) : PERSON_SVG) + '</div><div class="pp-main">' +
        '<h1>' + esc(x.name) + '</h1>' + ((x.info || []).length ? sectionTitle(T('personal_info')) + '<div class="pp-info">' + x.info.map(function (f) {
          var v = f.value === 'male' ? T('gender_male') : f.value === 'female' ? T('gender_female') : f.value;
          return '<div><span>' + esc(f.label) + '</span>' + esc(v) + '</div>';
        }).join('') + '</div>' : '') +
        (bio ? sectionTitle(T('biography')) + '<div class="d-desc" id="pp-bio">' + esc(bio) + '</div><a class="f more-btn" id="pp-more" hidden>' + esc(T('more')) + '</a>' : '') + '</div></div>' +
        '<div data-anchor="1">' + sectionTitle(T('filmography'), credits.length ? String(credits.length) : '') + '</div>' +
        (credits.length ? '<div class="grid" id="grid">' + credits.map(function (it) { return cardHtml(it); }).join('') + '</div>' : '<div class="no-c">' + esc(T('no_films')) + '</div>') + '</div></div>';
      bindCards(view);
      var b = $('#pp-bio'), more = $('#pp-more');
      if (b) setTimeout(function () {
        if (b.scrollHeight > b.clientHeight + 4) more.hidden = false;
        more.onclick = function () { var o = b.classList.toggle('open'); more.textContent = T(o ? 'less' : 'more'); };
      }, 60);
    });
  },
  first: function () { return $('#grid .card', view) || $('#pp-more:not([hidden])'); }
};

// ================================================================== ძებნა — საიტის ძებნის იდენტური
Screens.search = {
  render: function (p) {
    view.innerHTML = '<div class="scroll"><div class="inner pad"><a class="f search-box" id="s-box" data-fk="s-box" data-anchor="1"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>' +
      '<input id="s-in" type="text" autocomplete="off" placeholder="' + esc(T('search_ph')) + '"></a><div id="s-res">' + emptyView(T('nav_search'), T('search_tip')) + '</div></div></div>';
    var input = $('#s-in'), box = $('#s-box'), timer, seq = 0;
    if (p.q) input.value = p.q;
    box.onclick = function () { input.focus(); };
    var run = function () {
      var q = input.value.trim(); Screen.cur.params.q = q;
      if (q.length < 2) return;
      var my = ++seq; $('#s-res').innerHTML = '<div class="loading inline"><div class="dots"><i></i><i></i><i></i></div></div>';
      Api.search(q).then(function (items) {
        if (my !== seq) return;
        if (!items.length) { $('#s-res').innerHTML = emptyView(T('nothing_found'), T('try_other_word')); return; }
        $('#s-res').innerHTML = '<div class="grid" id="grid">' + items.map(function (h, k) {
          return cardHtml({ id: 's' + k, type: h.k === 2 ? 'tv_shows' : 'movies', title: h.title, sub: h.sub, poster: h.img, card: { imdb: h.imdb, year: h.yr, tags: h.langs } });
        }).join('') + '</div>';
        $$('#s-res .card').forEach(function (c, k) { c.onclick = function () { resolveHit(items[k]); }; });
      }).catch(function (e) { if (my === seq) $('#s-res').innerHTML = emptyView(T('load_failed'), e.message); });
    };
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 600); });
    input.addEventListener('keydown', function (e) {
      if (e.keyCode === K.ENTER || e.keyCode === 65376) { e.preventDefault(); input.blur(); run(); var c = $('#s-res .card'); if (c) Nav.focus(c); }
      if (e.keyCode === K.DOWN) { input.blur(); var c2 = $('#s-res .card'); if (c2) Nav.focus(c2); }
    });
    if (p.q) run();
  },
  first: function () { return $('#s-box'); }
};
// ძებნის შედეგს ID არ აქვს — აპის API-ში ქართული სათაურით ვპოულობთ და ბმულით ვადარებთ
function resolveHit(h) {
  if (h._item) { openItem(h._item.id, h._item.type); return; }
  var type = h.k === 2 ? 'tv_shows' : 'movies', norm = function (u) { try { u = decodeURIComponent(u); } catch (e) { } return String(u).replace(/\/$/, '').toLowerCase(); };
  Api.items(type, { search: h.title, per_page: 10 }).then(function (r) {
    var it = r.list.find(function (x) { return norm(x.link || '') === norm(h.url); }) || r.list.find(function (x) { return decode(x.title) === h.title; }) || r.list[0];
    if (it) openItem(it.id, it.type); else toast(T('nothing_found'));
  }).catch(function () { toast(T('load_failed')); });
}

// ================================================================== პარამეტრები (SettingsActivity)
function stylePreview(style) {
  var b = function (c, w, h, l, t) { return '<i style="background:' + c + ';width:' + (w < 0 ? '100%' : w * 1.6 + 'px') + ';height:' + h * 1.6 + 'px;left:' + l * 1.6 + 'px;top:' + t * 1.6 + 'px"></i>'; };
  var out = '', brand = '#7B61FF', card = '#364050', i;
  if (style === 'top') {
    out += b('#2A2F66', -1, 92, 0, 0) + b(brand, 14, 12, 10, 8);
    for (i = 0; i < 4; i++) out += b('rgba(255,255,255,.6)', 22, 4, 34 + i * 30, 14);
    out += b(brand, 40, 10, 12, 66);
    for (i = 0; i < 6; i++) out += b(card, 38, 50, 12 + i * 48, 104);
  } else {
    out += b('#0D1036', 34, 160, 0, 0) + b(brand, 16, 16, 9, 8);
    for (i = 0; i < 6; i++) out += b('rgba(255,255,255,.6)', 12, 8, 11, 36 + i * 18);
    out += b('#2A2F66', 264, 92, 34, 0) + b(brand, 40, 10, 46, 66);
    for (i = 0; i < 5; i++) out += b(card, 38, 50, 46 + i * 48, 104);
  }
  return out;
}
Screens.settings = {
  render: function () {
    var cur = Prefs.menu(), lang = Prefs.lang();
    view.innerHTML = '<div class="scroll"><div class="inner pad settings"><h1 class="st-title">' + esc(T('settings_title')) + '</h1>' +
      '<div class="st-label">' + esc(T('menu_style')) + '</div><div class="st-opts">' + ['top', 'side'].map(function (s) {
        return '<a class="f st-opt' + (s === cur ? ' on' : '') + '" data-style="' + s + '" data-fk="ms-' + s + '"><div class="st-prev">' + stylePreview(s) + '</div>' +
          '<div class="st-ot"><b>' + esc(T(s === 'top' ? 'menu_top' : 'menu_side')) + '</b><span class="st-check">' + esc(T('selected')) + '</span></div>' +
          '<div class="st-od">' + esc(T(s === 'top' ? 'menu_top_desc' : 'menu_side_desc')) + '</div></a>';
      }).join('') + '</div>' +
      '<div class="st-label">' + esc(T('language')) + '</div><div class="tabs seg st-langs">' + ['ka', 'ru', 'en'].map(function (l) {
        return '<a class="f tab' + (l === lang ? ' on' : '') + '" data-lang="' + l + '">' + esc(T('lang_' + l)) + '</a>';
      }).join('') + '</div><div class="st-note">' + esc(T('lang_note')) + '</div>' +
      '<div class="st-label">' + esc(T('update_title')) + '</div><div class="st-upd"><a class="f btn primary" id="upd-btn" data-fk="upd">' + esc(T('update_check')) + '</a>' +
      '<div><div class="st-ver">' + esc(T('version_tizen', VERSION)) + '</div><div class="st-note" id="upd-status"></div></div></div></div></div>';
    // განახლება GitHub-იდან (boot.js): შემოწმება → ჩამოტვირთვა → „განახლება" ღილაკი თავიდან რთავს აპს
    var found = null;
    $('#upd-btn').onclick = function () {
      var st = $('#upd-status'), btn = $('#upd-btn');
      if (found) { window.KKUpdate.reload(); return; }
      if (!window.KKUpdate) { st.textContent = T('update_failed'); return; }
      st.textContent = T('update_checking');
      window.KKUpdate.check().then(function (v) {
        if (!v) { st.textContent = T('update_latest'); return; }
        found = v;
        st.textContent = T('update_available', v.version) + (v.notes ? ' — ' + v.notes : '');
        btn.textContent = T('update_install') + ' · ' + v.version;
      }).catch(function () { st.textContent = T('update_failed'); });
    };
    $$('.st-opt', view).forEach(function (o) {
      o.onclick = function () {
        if (Prefs.menu() === o.dataset.style) return;
        Prefs.setMenu(o.dataset.style); Menu.build(); Screen.show('settings', {}, 'ms-' + o.dataset.style);
      };
    });
    $$('.st-langs .tab', view).forEach(function (t) {
      t.onclick = function () {
        if (t.dataset.lang === Prefs.lang()) return;
        Prefs.setLang(t.dataset.lang); Menu.build(); Screen.root('home');
      };
    });
  },
  first: function () { return $('.st-opt.on', view); }
};

// ================================================================== პროფილი (ProfileActivity)
Screens.profile = {
  render: function () {
    var me = this;
    var showLogin = function (err) {
      view.innerHTML = '<div class="scroll"><div class="inner pad profile"><div class="pf-box"><div class="pf-logo"><img src="img/logo.png"></div>' +
        '<h1>' + esc(T('login_title')) + '</h1><div class="pf-hint">' + esc(T('login_hint')) + '</div>' +
        '<a class="f field" id="pf-u-f"><input id="pf-u" type="text" autocomplete="off" placeholder="' + esc(T('username')) + '"></a>' +
        '<a class="f field" id="pf-p-f"><input id="pf-p" type="password" placeholder="' + esc(T('password')) + '"></a>' +
        '<div class="pf-err" id="pf-err"' + (err ? '' : ' hidden') + '>' + esc(err || '') + '</div>' +
        '<a class="f btn primary pf-btn" id="pf-login">' + esc(T('login')) + '</a></div></div></div>';
      $$('.field', view).forEach(function (f) { f.onclick = function () { $('input', f).focus(); }; });
      $('#pf-p').addEventListener('keydown', function (e) { if (e.keyCode === K.ENTER || e.keyCode === 65376) { e.preventDefault(); $('#pf-p').blur(); $('#pf-login').click(); } });
      $('#pf-login').onclick = function () {
        var u = $('#pf-u').value.trim(), pw = $('#pf-p').value;
        if (!u || !pw) return;
        $('#pf-err').hidden = true;
        Api.login(u, pw).then(function (user) { showUser(user); Nav.focus($('#pf-logout')); }).catch(function (e) {
          $('#pf-err').textContent = e.status === 401 ? T('bad_login') : e.message; $('#pf-err').hidden = false;
        });
      };
    };
    var showUser = function (u) {
      view.innerHTML = '<div class="scroll"><div class="inner pad profile"><div class="pf-box"><div class="pf-av">' + (u.avatar ? pic(u.avatar) : PERSON_SVG) + '</div>' +
        '<div class="pf-name">' + esc(u.display_name || '') + '</div><a class="f btn pf-btn" id="pf-logout">' + esc(T('logout')) + '</a></div></div></div>';
      $('#pf-logout').onclick = function () { Api.logout().then(function () { showLogin(); Nav.focus($('#pf-u-f')); }); };
    };
    if (!Auth.token()) { showLogin(); return; }
    return Api.me().then(showUser).catch(function (e) { if (e.status === 401) Auth.set(null); showLogin(); });
  },
  first: function () { return $('#pf-logout') || $('#pf-u-f'); }
};
