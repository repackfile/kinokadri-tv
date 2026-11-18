/* avshim.js — webOS თავსებადობა Tizen-ის აპისთვის.
 * 1) webapis.avplay-ის თავსებადი shim hls.js + HTML5 <video>-ზე (player.js უცვლელად მუშაობს);
 * 2) tizen.application...exit() → window.close() (core.js-ის exitApp უცვლელად);
 * 3) webOS-ის „უკან" ღილაკი (461) → Tizen-ის კოდი (10009), ფაილების შეცვლის გარეშე. */
(function () {
  'use strict';
  if (window.webapis && window.webapis.avplay) return; // ნამდვილ Samsung-ზე არაფერი

  var video = document.getElementById('av');

  // ---- helpers -------------------------------------------------------------
  function lvlBand(l) { return l && (l.bitrate || l.bandwidth) || 0; }

  function makeAvplay(v) {
    var hls = null, L = {}, pinnedBw = 0, ready = false, bound = [], textBound = [];
    var subtitleOn = true, curSubTrack = -1;

    function on(ev, fn) { v.addEventListener(ev, fn); bound.push([ev, fn]); }
    function clearBound() { bound.forEach(function (b) { v.removeEventListener(b[0], b[1]); }); bound = []; }

    // app-ის #p-subtext რენდერს თვითონ აკეთებს: texttrack-ს ვმალავთ და cue-ს ტექსტს ვაწვდით onsubtitlechange-ს
    function bindTextTracks() {
      textBound.forEach(function (b) { b[0].removeEventListener('cuechange', b[1]); });
      textBound = [];
      var tt = v.textTracks || [];
      for (var i = 0; i < tt.length; i++) {
        (function (track) {
          track.mode = 'hidden';
          var fn = function () {
            if (!L.onsubtitlechange) return;
            var c = track.activeCues && track.activeCues.length ? track.activeCues[0] : null;
            L.onsubtitlechange(0, c ? (c.text || '') : '');
          };
          track.addEventListener('cuechange', fn);
          textBound.push([track, fn]);
        })(tt[i]);
      }
    }

    function wireVideo() {
      on('waiting', function () { if (L.onbufferingstart) L.onbufferingstart(); });
      on('playing', function () { if (L.onbufferingcomplete) L.onbufferingcomplete(); });
      on('canplay', function () { if (L.onbufferingcomplete) L.onbufferingcomplete(); });
      on('timeupdate', function () { if (L.oncurrentplaytime) L.oncurrentplaytime(Math.round(v.currentTime * 1000)); });
      on('ended', function () { if (L.onstreamcompleted) L.onstreamcompleted(); });
      on('error', function () { if (L.onerror) L.onerror((v.error && v.error.message) || 'media error'); });
    }

    function teardown() {
      clearBound();
      textBound.forEach(function (b) { b[0].removeEventListener('cuechange', b[1]); }); textBound = [];
      if (hls) { try { hls.destroy(); } catch (e) { } hls = null; }
      try { v.pause(); } catch (e) { }
      try { v.removeAttribute('src'); v.load(); } catch (e) { }
      ready = false;
    }

    return {
      // --- სასიცოცხლო ციკლი ---
      open: function (url) { this._url = url; pinnedBw = 0; curSubTrack = -1; subtitleOn = true; },
      setDisplayRect: function () { /* CSS აკეთებს */ },
      stop: function () { teardown(); },
      close: function () { teardown(); },

      setListener: function (o) { L = o || {}; },

      setStreamingProperty: function (key, val) {
        if (key === 'ADAPTIVE_INFO' && val) {
          var m = /STARTBITRATE=(\d+)/.exec(val) || /BITRATES=(\d+)/.exec(val);
          if (m) pinnedBw = +m[1];
        }
      },

      prepareAsync: function (ok, err) {
        var url = this._url, done = false;
        var finish = function () { if (done) return; done = true; ready = true; bindTextTracks(); ok && ok(); };
        var fail = function (e) { if (done) return; done = true; err && err(e || 'prepare failed'); };
        wireVideo();
        var isM3u8 = /\.m3u8(\?|$)/i.test(url);

        if (window.Hls && window.Hls.isSupported() && isM3u8) {
          hls = new window.Hls({
            enableWorker: true, lowLatencyMode: false,
            capLevelToPlayerSize: true,          // სუსტ SoC-ზე 4K-ს არ ვხსნით 1080 ზედაპირზე
            backBufferLength: 30,                 // ნაკლები მეხსიერება
            maxBufferLength: 20, maxMaxBufferLength: 60,
            maxBufferSize: 30 * 1000 * 1000,
            manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 4, fragLoadingMaxRetry: 6
          });
          hls.on(window.Hls.Events.MANIFEST_PARSED, function () {
            if (pinnedBw && hls.levels && hls.levels.length) {
              var best = -1, diff = Infinity;
              hls.levels.forEach(function (l, i) { var d = Math.abs(lvlBand(l) - pinnedBw); if (d < diff) { diff = d; best = i; } });
              if (best >= 0) { hls.currentLevel = best; hls.autoLevelCapping = best; }
            } else { hls.currentLevel = -1; hls.autoLevelCapping = -1; }
          });
          hls.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, bindTextTracks);
          hls.on(window.Hls.Events.ERROR, function (_e, data) {
            if (data && data.fatal) {
              if (data.type === window.Hls.ErrorTypes.NETWORK_ERROR) { try { hls.startLoad(); return; } catch (e) { } }
              if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR) { try { hls.recoverMediaError(); return; } catch (e) { } }
              fail((data.details || data.type) + '');
            }
          });
          hls.loadSource(url);
          hls.attachMedia(v);
          v.addEventListener('loadedmetadata', finish, { once: true });
        } else {
          // native (webOS ბევრ HLS-ს თვითონ უკრავს, ან პირდაპირი mp4)
          v.src = url;
          v.addEventListener('loadedmetadata', finish, { once: true });
          v.addEventListener('error', function () { fail((v.error && v.error.message) || 'load error'); }, { once: true });
          try { v.load(); } catch (e) { }
        }
      },

      getDuration: function () { return (v.duration && isFinite(v.duration)) ? Math.round(v.duration * 1000) : 0; },
      play: function () { var p = v.play(); if (p && p.catch) p.catch(function () { }); },
      pause: function () { v.pause(); },
      seekTo: function (ms, ok, err) {
        try {
          var h = function () { v.removeEventListener('seeked', h); ok && ok(); };
          v.addEventListener('seeked', h);
          v.currentTime = Math.max(0, ms / 1000);
        } catch (e) { err && err(e); }
      },
      setSpeed: function (r) { try { v.playbackRate = r; } catch (e) { throw e; } },

      // --- ტრეკები ---
      getTotalTrackInfo: function () {
        var out = [];
        if (hls) {
          (hls.audioTracks || []).forEach(function (t, i) {
            out.push({ index: i, type: 'AUDIO', extra_info: JSON.stringify({ language: t.lang || t.name || '' }) });
          });
          (hls.subtitleTracks || []).forEach(function (t, i) {
            out.push({ index: i, type: 'TEXT', extra_info: JSON.stringify({ track_lang: t.lang || t.name || '', language: t.lang || '' }) });
          });
        } else if (v.audioTracks) {
          for (var i = 0; i < v.audioTracks.length; i++) {
            var a = v.audioTracks[i];
            out.push({ index: i, type: 'AUDIO', extra_info: JSON.stringify({ language: a.language || a.label || '' }) });
          }
        }
        return out;
      },
      setSelectTrack: function (type, index) {
        if (hls) {
          if (type === 'AUDIO') hls.audioTrack = index;
          else if (type === 'TEXT') { hls.subtitleTrack = index; curSubTrack = index; subtitleOn = true; hls.subtitleDisplay = false; bindTextTracks(); }
        } else if (type === 'AUDIO' && v.audioTracks) {
          for (var i = 0; i < v.audioTracks.length; i++) v.audioTracks[i].enabled = (i === index);
        }
      },
      setSilentSubtitle: function (silent) {
        subtitleOn = !silent;
        if (hls) { hls.subtitleDisplay = false; if (silent) hls.subtitleTrack = -1; else if (curSubTrack >= 0) hls.subtitleTrack = curSubTrack; }
        var tt = v.textTracks || [];
        for (var i = 0; i < tt.length; i++) tt[i].mode = 'hidden';
        if (silent && L.onsubtitlechange) L.onsubtitlechange(0, '');
      },

      getCurrentStreamInfo: function () {
        var w = 0, h = 0;
        if (hls && hls.currentLevel >= 0 && hls.levels[hls.currentLevel]) { w = hls.levels[hls.currentLevel].width; h = hls.levels[hls.currentLevel].height; }
        else { w = v.videoWidth; h = v.videoHeight; }
        return [{ type: 'VIDEO', extra_info: JSON.stringify({ Width: w || 0, Height: h || 0 }) }];
      }
    };
  }

  window.webapis = { avplay: makeAvplay(video) };

  // ---- 2) tizen shim: აპიდან გასვლა (core.js exitApp) ----------------------
  if (!window.tizen) {
    window.tizen = {
      application: { getCurrentApplication: function () { return { exit: function () { try { window.close(); } catch (e) { } } }; } },
      tvinputdevice: { registerKey: function () { } }
    };
  }

  // ---- 3) webOS „უკან" (461) → Tizen BACK (10009), capture phase ----------
  window.addEventListener('keydown', function (e) {
    if (e.keyCode === 461 || e.keyCode === 8 /* webOS remote back / backspace */) {
      e.stopImmediatePropagation(); e.preventDefault();
      var ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
      try { Object.defineProperty(ev, 'keyCode', { get: function () { return 10009; } }); } catch (x) { }
      try { Object.defineProperty(ev, 'which', { get: function () { return 10009; } }); } catch (x) { }
      (e.target || document).dispatchEvent(ev);
    }
  }, true);
})();
