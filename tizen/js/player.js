/* player.js — Android-ის PlayerActivity Samsung-ის AVPlay-ზე: ხარისხი · გახმოვანება · სუბტიტრები · სიჩქარე ·
 * შემდეგი ეპიზოდი · გაგრძელება · გადახვევის კადრები · თრეილერი · შესვლის მოთხოვნა. */
'use strict';

var SEEK_MS = 10000, SEEK_LONG_MS = 30000, RESUME_MIN_MS = 30000;
var SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
var LANG_CODES = { ka: 'ქართული', ge: 'ქართული', geo: 'ქართული', georgian: 'ქართული', ru: 'რუსული', rus: 'რუსული', russian: 'რუსული',
  en: 'ინგლისური', eng: 'ინგლისური', english: 'ინგლისური', uk: 'უკრაინული', ukr: 'უკრაინული', tr: 'თურქული', tur: 'თურქული',
  fr: 'ფრანგული', fre: 'ფრანგული', fra: 'ფრანგული', de: 'გერმანული', ger: 'გერმანული', deu: 'გერმანული', es: 'ესპანური', spa: 'ესპანური',
  it: 'იტალიური', ita: 'იტალიური', ko: 'კორეული', kor: 'კორეული', ja: 'იაპონური', jpn: 'იაპონური', hi: 'ჰინდი', hin: 'ჰინდი' };
function qualityName(w, h) { return w >= 3000 || h >= 2000 ? '4K' : w >= 1900 ? '1080p' : w >= 1270 ? '720p' : w >= 840 ? '480p' : h ? h + 'p' : ''; }

var Player = {
  av: null, o: null, urls: [], ui: 0, dur: 0, pos: 0, seekTo: null, playing: false,
  audio: [], subs: [], variants: [], muxedLang: null, thumbs: null, rate: 1, quality: null, curAudio: null, curSub: -1, userAudio: false,

  start: function (o) {
    var P = Player;
    P.o = o; P.dur = 0; P.pos = 0; P.audio = []; P.subs = []; P.variants = []; P.muxedLang = null; P.thumbs = null;
    P.curAudio = null; P.curSub = -1; P.userAudio = false; P.quality = null; P.rate = 1; P.seekTo = null;
    try { P.av = webapis.avplay; } catch (e) { P.av = null; }
    $('#player').hidden = false; document.body.classList.add('playing');
    view.style.visibility = 'hidden'; Menu.hideAll(true);
    $('#p-title').textContent = o.title || '';
    $('#p-next').hidden = !P.hasNext();
    $('#p-error').hidden = true; $('#p-subtext').hidden = true; $('#p-thumb').hidden = true;
    $('#p-quality').hidden = !!o.direct; $('#p-audio').hidden = true; $('#p-subs').hidden = true; $('#p-next-t').textContent = T('next_episode');
    $('#p-speed').textContent = '1x'; $('#p-quality-t').textContent = T('auto');
    P.paintTime(); P.busy(true); P.show(); Nav.focus($('#p-play'), true);
    if (!P.av) { P.error(T('player_unavailable')); return; }
    if (o.direct) { P.urls = [o.direct]; P.ui = 0; P.open(0); return; }
    Api.stream(o.id).then(function (s) {
      P.urls = (s.sources || []).filter(function (x) { return x.type !== 'dash'; }).reduce(function (a, x) { return a.concat(watchUrls(x.url)); }, []);
      if (!P.urls.length) throw new Error(T('video_not_found'));
      P.ui = 0; P.open(o.resume != null ? o.resume : Resume.get(o.id), true);
    }).catch(function (e) {
      if (e.status === 401) P.error(T('login_required'), T('login'), function () { P.close(true); Screen.open('profile', {}); });
      else P.error(e.message, T('retry'), function () { P.start(o); });
    });
  },
  open: function (from, announce) {
    var P = Player, av = P.av, url = P.urls[P.ui];
    try { av.stop(); av.close(); } catch (e) { }
    if (!P.o.direct && url.indexOf('.m3u8') > 0) { P.loadThumbs(url); P.readMaster(url); }
    try {
      av.open(url);
      av.setDisplayRect(0, 0, 1920, 1080);
      av.setListener({
        onbufferingstart: function () { P.busy(true); },
        onbufferingcomplete: function () { P.busy(false); },
        oncurrentplaytime: function (ms) { P.pos = ms; if (P.seekTo == null) P.paintTime(); },
        onstreamcompleted: function () { if (!P.o.direct) Resume.set(P.o.id, 0); if (P.hasNext()) P.next(); else P.close(); },
        onsubtitlechange: function (dur, text) { var s = $('#p-subtext'); s.textContent = plain(text); s.hidden = !text; },
        onerror: function (err) { P.fail(err); }
      });
      if (P.quality) av.setStreamingProperty('ADAPTIVE_INFO', 'BITRATES=' + P.quality.bw + '~' + P.quality.bw + '|STARTBITRATE=' + P.quality.bw);
    } catch (e) { P.fail(e.message); return; }
    av.prepareAsync(function () {
      P.dur = av.getDuration() || 0;
      P.readTracks();
      var go = function () {
        try { av.play(); } catch (e) { }
        P.playing = true; P.icon(); P.busy(false); P.poke();
        if (P.rate !== 1) P.setRate(P.rate, true);
        clearInterval(P.saveTimer);
        if (!P.o.direct) P.saveTimer = setInterval(function () { Resume.set(P.o.id, P.pos, P.dur); }, 10000);
      };
      if (from && from > RESUME_MIN_MS && (!P.dur || from < P.dur - 90000)) {
        av.seekTo(from, go, go);
        if (announce) P.flash(T('resumed_from', fmt(from)));
      } else go();
    }, function (e) { P.fail(e); });
  },
  fail: function (e) {
    var P = Player;
    if (P.ui + 1 < P.urls.length) { P.ui++; P.open(P.pos); return; }
    P.error((e && (e.name || e.message)) || String(e || T('play_failed')), T('retry'), function () { P.ui = 0; P.open(P.pos); });
  },
  error: function (text, action, run) {
    var P = Player; P.busy(false);
    $('#p-error-t').textContent = T('play_failed'); $('#p-error-s').textContent = text || '';
    var b = $('#p-error-a'); b.hidden = !action; b.textContent = action || ''; b.onclick = run || null;
    $('#p-error').hidden = false; $('#player').classList.remove('idle');
    Nav.focus(action ? b : $('#p-play'), true);
  },
  close: function (silent) {
    var P = Player;
    clearInterval(P.saveTimer); clearTimeout(P.hideTimer);
    if (P.o && !P.o.direct && P.pos) Resume.set(P.o.id, P.pos, P.dur);
    try { P.av.stop(); P.av.close(); } catch (e) { }
    P.playing = false;
    $('#player').hidden = true; document.body.classList.remove('playing'); view.style.visibility = ''; Menu.hideAll(false);
    if (silent) return;
    if (Screen.cur && Screen.cur.resume) Screen.cur.resume();
    if (Screen.cur && Screen.cur.name === 'detail') Screen.show('detail', Screen.cur.params, focusKey(Nav.cur) || 'd-play');
    else if (Nav.cur && document.contains(Nav.cur)) Nav.focus(Nav.cur, true);
    else Nav.focus(Nav.list()[0]);
  },
  hasNext: function () { var o = Player.o; return !!(o && o.list && o.index + 1 < o.list.length); },
  next: function () {
    var P = Player, o = P.o; if (!P.hasNext()) return;
    var e = o.list[o.index + 1];
    clearInterval(P.saveTimer);
    if (P.pos) Resume.set(o.id, P.pos, P.dur);
    if (o.showId) Resume.setLastEpisode(o.showId, e.id);
    P.start({ id: e.id, title: e.title, list: o.list, index: o.index + 1, showId: o.showId });
  },
  toggle: function () {
    var P = Player; if (!P.av || !$('#p-error').hidden) return;
    try { if (P.playing) P.av.pause(); else P.av.play(); P.playing = !P.playing; } catch (e) { }
    P.icon(); P.show();
  },
  // საიტის HNP ფლეერის ▷ / ⏸
  icon: function () { $('#p-icon').innerHTML = Player.playing ? '<path d="M8.5 5.5v13M15.5 5.5v13"/>' : '<path d="M7 4.5v15l12-7.5z"/>'; },
  busy: function (b) { $('#p-dots').hidden = !b; $('#player').classList.toggle('busy', b); },
  show: function () { $('#player').classList.remove('idle'); Player.poke(); },
  poke: function () {
    clearTimeout(Player.hideTimer);
    Player.hideTimer = setTimeout(function () {
      if (Player.playing && $('#dialog').hidden && $('#p-error').hidden) { $('#player').classList.add('idle'); $('#p-thumb').hidden = true; }
    }, 4000);
  },
  visible: function () { return !$('#player').classList.contains('idle'); },
  flash: function (t) { var n = $('#p-notice'); n.textContent = t; n.hidden = false; setTimeout(function () { if (n.textContent === t) n.hidden = true; }, 5000); },
  paintTime: function () {
    var P = Player, t = P.seekTo != null ? P.seekTo : P.pos, d = P.dur || 0, f = d ? Math.min(1, t / d) : 0;
    $('#p-pos').textContent = fmt(t); $('#p-left').textContent = '-' + fmt(Math.max(0, d - t));
    $('#p-played').style.width = (f * 100) + '%'; $('#p-knob').style.left = (f * 100) + '%';
  },
  // ◀ ▶ — 10 წამი (დაჭერილზე ჩქარდება); გადახვევა 0.7 წამის შემდეგ, ამასობაში კადრი ჩანს
  seek: function (delta) {
    var P = Player; if (!P.dur) return;
    var base = P.seekTo != null ? P.seekTo : P.pos;
    P.seekTo = Math.max(0, Math.min(P.dur - 2000, base + delta));
    P.paintTime(); P.thumb(P.seekTo); P.show();
    clearTimeout(P.seekTimer);
    P.seekTimer = setTimeout(function () {
      var to = P.seekTo; P.busy(true);
      var done = function () { P.pos = to; P.seekTo = null; P.busy(false); };
      try { P.av.seekTo(to, done, function () { P.seekTo = null; P.busy(false); }); } catch (e) { P.seekTo = null; }
      setTimeout(function () { $('#p-thumb').hidden = true; }, 1200);
    }, 700);
  },
  // ---- გადახვევის კადრები: ფილმის საქაღალდის thumbs/thumbs.vtt (საიტის ფლეერივით)
  loadThumbs: function (url) {
    var P = Player, base = url.split('?')[0].replace(/[^\/]*$/, '') + 'thumbs/';
    if (P.thumbs && P.thumbs.base === base) return;
    fetch(base + 'thumbs.vtt').then(function (r) { return r.ok ? r.text() : ''; }).then(function (txt) {
      var re = /(\d+):(\d+):([\d.]+)\s*-->\s*(\d+):(\d+):([\d.]+)\s*\n(\S+?)#xywh=(\d+),(\d+),(\d+),(\d+)/g, m, cues = [];
      while ((m = re.exec(txt.replace(/\r/g, '')))) cues.push({ e: (+m[4] * 3600 + +m[5] * 60 + +m[6]) * 1000, url: base + m[7], x: +m[8], y: +m[9], w: +m[10], h: +m[11] });
      P.thumbs = cues.length ? { base: base, cues: cues, sizes: {} } : null;
    }).catch(function () { });
  },
  thumb: function (t) {
    var P = Player, th = P.thumbs; if (!th) return;
    var c = th.cues.find(function (q) { return t < q.e; }) || th.cues[th.cues.length - 1];
    var img = $('#p-thumb-img'), scale = 358 / c.w;
    var apply = function (sz) {
      img.style.backgroundImage = 'url("' + c.url + '")';
      img.style.backgroundSize = (sz.w * scale) + 'px ' + (sz.h * scale) + 'px';
      img.style.backgroundPosition = (-c.x * scale) + 'px ' + (-c.y * scale) + 'px';
    };
    if (th.sizes[c.url]) apply(th.sizes[c.url]);
    else { var im = new Image(); im.onload = function () { th.sizes[c.url] = { w: im.naturalWidth, h: im.naturalHeight }; apply(th.sizes[c.url]); }; im.src = c.url; }
    $('#p-thumb-time').textContent = fmt(t);
    var box = $('#p-thumb'); box.hidden = false;
    var bar = $('#p-bar').getBoundingClientRect(), x = bar.left - 64 + bar.width * (t / P.dur) - 186;
    box.style.left = Math.max(0, Math.min(1792 - 372, x)) + 'px';
  },
  // ---- master playlist: ხარისხები და ვიდეოში ჩაშენებული ხმის ენა (ExoPlayer/AVPlay მას „und"-ად აჩვენებს)
  readMaster: function (url) {
    var P = Player;
    fetch(url).then(function (r) { return r.text(); }).then(function (txt) {
      var lines = txt.split(/\r?\n/).map(function (l) { return l.trim(); });
      var attr = function (l, n) { var m = new RegExp(n + '="?([^",]*)"?').exec(l); return m ? m[1] : null; };
      var variants = [], uris = [];
      lines.forEach(function (l, i) {
        if (l.indexOf('#EXT-X-STREAM-INF:') !== 0) return;
        var res = (attr(l, 'RESOLUTION') || '').split('x'), bw = +attr(l, 'BANDWIDTH') || 0, uri = lines[i + 1] || '';
        uris.push(uri);
        var name = qualityName(+res[0] || 0, +res[1] || 0);
        if (name && !variants.some(function (v) { return v.name === name; })) variants.push({ name: name, bw: bw, h: +res[1] || 0 });
      });
      P.variants = variants.sort(function (a, b) { return b.h - a.h; });
      $('#p-quality').hidden = P.variants.length < 2;
      var audio = lines.filter(function (l) { return l.indexOf('#EXT-X-MEDIA:') === 0 && l.indexOf('TYPE=AUDIO') > 0; });
      var mux = audio.find(function (l) { return uris.indexOf(attr(l, 'URI')) >= 0; }) || audio.find(function (l) { return !attr(l, 'URI'); });
      P.muxedLang = mux ? (attr(mux, 'LANGUAGE') || attr(mux, 'NAME')) : null;
      P.readTracks();
    }).catch(function () { });
  },
  langName: function (code, label) {
    var c = String(code || '').toLowerCase().split('-')[0];
    if (!c || c === 'und') c = String(Player.muxedLang || '').toLowerCase();
    var ka = LANG_CODES[c];
    return ka ? Tr.lang(ka) : (label || code || T('unknown'));
  },
  readTracks: function () {
    var P = Player, audio = [], subs = [];
    try {
      P.av.getTotalTrackInfo().forEach(function (t) {
        var info = {}; try { info = JSON.parse(t.extra_info || '{}'); } catch (e) { }
        if (t.type === 'AUDIO') audio.push({ index: t.index, lang: info.language || '' });
        if (t.type === 'TEXT') subs.push({ index: t.index, lang: info.track_lang || info.language || '' });
      });
    } catch (e) { }
    P.audio = audio.map(function (a) { return { index: a.index, name: P.langName(a.lang) }; })
      .filter(function (a, i, arr) { return arr.findIndex(function (b) { return b.name === a.name; }) === i; });
    P.subs = subs.map(function (s) { return { index: s.index, name: P.langName(s.lang) }; });
    // ქართული პირველი (Android-ის setPreferredAudioLanguages + ჩაშენებული ხმა)
    if (!P.userAudio && P.audio.length) {
      var ka = P.audio.find(function (a) { return a.name === Tr.lang('ქართული'); });
      if (ka && P.curAudio !== ka.index) { try { P.av.setSelectTrack('AUDIO', ka.index); P.curAudio = ka.index; } catch (e) { } }
      else if (P.curAudio == null) P.curAudio = P.audio[0].index;
    }
    var cur = P.audio.find(function (a) { return a.index === P.curAudio; });
    $('#p-audio').hidden = !P.audio.length; $('#p-audio-t').textContent = cur ? cur.name : T('audio');
    $('#p-subs').hidden = !P.subs.length;
    var cs = P.subs.find(function (s) { return s.index === P.curSub; });
    $('#p-subs-t').textContent = cs ? cs.name : T('subtitles');
    P.paintQuality();
  },
  paintQuality: function () {
    var P = Player, playing = '';
    try { var vi = P.av.getCurrentStreamInfo().find(function (t) { return t.type === 'VIDEO'; }); if (vi) { var x = JSON.parse(vi.extra_info || '{}'); playing = qualityName(+x.Width || 0, +x.Height || 0); } } catch (e) { }
    $('#p-quality-t').textContent = P.quality ? P.quality.name : T('auto') + (playing ? ' · ' + playing : '');
  },
  chooseQuality: function () {
    var P = Player; if (!P.variants.length) return;
    var opts = [T('auto')].concat(P.variants.map(function (v) { return v.name; }));
    var cur = P.quality ? 1 + P.variants.findIndex(function (v) { return v.name === P.quality.name; }) : 0;
    choose(T('quality'), opts, cur, function (i) {
      var q = i ? P.variants[i - 1] : null;
      if ((q && P.quality && q.name === P.quality.name) || (!q && !P.quality)) return;
      P.quality = q; var at = P.pos; P.busy(true); P.open(at); P.paintQuality();
    });
  },
  chooseAudio: function () {
    var P = Player; P.readTracks(); if (!P.audio.length) return;
    choose(T('audio'), P.audio.map(function (a) { return a.name; }), Math.max(0, P.audio.findIndex(function (a) { return a.index === P.curAudio; })), function (i) {
      var a = P.audio[i]; P.userAudio = true;
      try { P.av.setSelectTrack('AUDIO', a.index); P.curAudio = a.index; $('#p-audio-t').textContent = a.name; } catch (e) { toast(T('not_changed')); }
    });
  },
  chooseSubs: function () {
    var P = Player; if (!P.subs.length) return;
    var opts = [T('off')].concat(P.subs.map(function (s) { return s.name; }));
    var cur = P.curSub < 0 ? 0 : 1 + P.subs.findIndex(function (s) { return s.index === P.curSub; });
    choose(T('subtitles'), opts, cur, function (i) {
      try {
        if (!i) { P.av.setSilentSubtitle(true); P.curSub = -1; $('#p-subtext').hidden = true; $('#p-subs-t').textContent = T('subtitles'); return; }
        var s = P.subs[i - 1]; P.av.setSelectTrack('TEXT', s.index); P.av.setSilentSubtitle(false); P.curSub = s.index; $('#p-subs-t').textContent = s.name;
      } catch (e) { toast(T('not_changed')); }
    });
  },
  setRate: function (r, quiet) {
    var P = Player;
    try { P.av.setSpeed(r); P.rate = r; } catch (e) {
      if (r % 1 === 0) { try { P.av.setSpeed(Math.round(r)); P.rate = r; } catch (e2) { if (!quiet) toast(T('not_supported')); return; } }
      else { if (!quiet) toast(T('not_supported')); return; }
    }
    $('#p-speed').textContent = (r === 1 ? '1' : String(r)) + 'x';
  },
  chooseSpeed: function () {
    var P = Player;
    choose(T('speed'), SPEEDS.map(function (s) { return s === 1 ? T('normal_speed') : s + 'x'; }), SPEEDS.indexOf(P.rate), function (i) { P.setRate(SPEEDS[i]); });
  },
  key: function (k, rep) {
    var P = Player, shown = P.visible(), cur = Nav.cur;
    if (k === K.PLAYPAUSE) { P.toggle(); return; }
    if (k === K.PLAY) { if (!P.playing) P.toggle(); return; }
    if (k === K.PAUSE) { if (P.playing) P.toggle(); return; }
    if (k === K.FF) { P.seek(SEEK_LONG_MS); return; }
    if (k === K.RW) { P.seek(-SEEK_LONG_MS); return; }
    if (k === K.STOP) { P.close(); return; }
    if (k === K.BACK || k === K.ESC) {
      if (shown && P.playing && $('#p-error').hidden) { $('#player').classList.add('idle'); $('#p-thumb').hidden = true; return; }
      P.close(); return;
    }
    if (!shown) {
      P.show();
      var boost = rep > 20 ? 6 : rep > 8 ? 3 : 1;
      if (k === K.LEFT || k === K.RIGHT) { P.seek((k === K.LEFT ? -SEEK_MS : SEEK_MS) * boost); Nav.focus($('#p-bar'), true); return; }
      if (k === K.ENTER) { P.toggle(); Nav.focus($('#p-play'), true); return; }
      Nav.focus($('#p-play'), true); return;
    }
    P.poke();
    if (cur && cur.id === 'p-bar' && (k === K.LEFT || k === K.RIGHT)) {
      var b2 = rep > 20 ? 6 : rep > 8 ? 3 : 1;
      P.seek((k === K.LEFT ? -SEEK_MS : SEEK_MS) * b2); return;
    }
    if (k === K.ENTER && cur && cur.id === 'p-bar') { P.toggle(); return; }
    if (k === K.ENTER && cur) { cur.click(); return; }
    Nav.move(k);
  }
};
$('#p-play').onclick = function () { Player.toggle(); };
$('#p-rew').onclick = function () { Player.seek(-SEEK_MS); };
$('#p-ffw').onclick = function () { Player.seek(SEEK_MS); };
$('#p-quality').onclick = function () { Player.chooseQuality(); };
$('#p-audio').onclick = function () { Player.chooseAudio(); };
$('#p-subs').onclick = function () { Player.chooseSubs(); };
$('#p-speed-p').onclick = function () { Player.chooseSpeed(); };
$('#p-next').onclick = function () { Player.next(); };
