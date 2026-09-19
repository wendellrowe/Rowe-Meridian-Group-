/* Rowe Meridian Group℠ — interactions */
(function () {
  'use strict';

  var header = document.querySelector('[data-header]');
  var progress = document.querySelector('[data-progress]');
  var toggle = document.querySelector('[data-menu]');
  var nav = document.getElementById('site-nav');
  var links = Array.prototype.slice.call(nav.querySelectorAll('a'));
  var sections = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  /* Header state + scroll progress */
  function onScroll() {
    var y = window.scrollY || 0;
    if (header) header.classList.toggle('is-scrolled', y > 24);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Mobile menu */
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Reveal on scroll */
  var revealables = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  } else {
    revealables.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Active nav section */
  if ('IntersectionObserver' in window && sections.length) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-current', a.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* Inquiry form — posts to the Worker endpoint, falls back to a mail draft */
  var form = document.querySelector('[data-inquiry]');
  if (form) {
    var status = form.querySelector('[data-status]');
    var submit = form.querySelector('button[type="submit"]');
    var sending = false;

    var say = function (text, state) {
      if (!status) return;
      status.textContent = text;
      status.setAttribute('data-state', state || '');
    };

    var mailDraft = function (payload) {
      var body = [
        'Name: ' + payload.name,
        payload.organization ? 'Organization: ' + payload.organization : null,
        'Email: ' + payload.email,
        'Purpose: ' + payload.purpose,
        '',
        payload.message
      ].filter(function (line) { return line !== null; }).join('\n');

      window.location.href = 'mailto:hello@wendellrowe.com'
        + '?subject=' + encodeURIComponent('Rowe Meridian Group — ' + payload.purpose + ' inquiry')
        + '&body=' + encodeURIComponent(body);
    };

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (sending) return;
      if (form.elements.website && form.elements.website.value) return;
      if (!form.reportValidity()) return;

      var data = new FormData(form);
      var payload = {
        name: (data.get('name') || '').toString().trim(),
        organization: (data.get('organization') || '').toString().trim(),
        email: (data.get('email') || '').toString().trim(),
        purpose: (data.get('purpose') || 'Inquiry').toString(),
        message: (data.get('message') || '').toString().trim(),
        website: ''
      };

      sending = true;
      if (submit) submit.disabled = true;
      say('Sending…', 'pending');

      fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (b) {
            return { ok: res.ok, body: b };
          });
        })
        .then(function (result) {
          if (result.ok && result.body.ok) {
            form.reset();
            say('Received. You will hear back from the principal directly, usually within two business days.', 'ok');
            return;
          }
          if (result.body && result.body.error && String(result.body.error).indexOf('complete the required') === 0) {
            say(result.body.error, 'error');
            return;
          }
          throw new Error('endpoint unavailable');
        })
        .catch(function () {
          say('Opening a prepared draft in your email application instead. If nothing happens, write to hello@wendellrowe.com.', 'error');
          mailDraft(payload);
        })
        .then(function () {
          sending = false;
          if (submit) submit.disabled = false;
        });
    });
  }

  /* Year */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();

/* Rowe Meridian Group℠ — soundtrack player */
(function () {
  'use strict';

  var player = document.querySelector('[data-sound-player]');
  var audio = document.getElementById('site-soundtrack');
  var toggle = document.querySelector('[data-sound-toggle]');
  var status = document.querySelector('[data-sound-status]');

  if (!player || !(audio instanceof HTMLAudioElement) || !toggle || !status) return;

  var expand = document.querySelector('[data-sound-expand]');
  var seek = document.querySelector('[data-sound-seek]');
  var volume = document.querySelector('[data-sound-volume]');
  var mute = document.querySelector('[data-sound-mute]');
  var current = document.querySelector('[data-sound-current]');
  var duration = document.querySelector('[data-sound-duration]');
  var ring = document.querySelector('[data-sound-ring]');
  var wave = document.querySelector('[data-sound-wave]');

  var CIRC = 2 * Math.PI * 46;
  if (ring) {
    ring.style.strokeDasharray = String(CIRC);
    ring.style.strokeDashoffset = String(CIRC);
  }

  /* Restore volume from the visitor's last state in this tab */
  var stored = Number(sessionStorage.getItem('rmg-volume'));
  audio.volume = isFinite(stored) && stored > 0 ? stored : 0.22;
  if (volume) volume.value = String(Math.round(audio.volume * 100));

  function formatTime(value) {
    if (!isFinite(value)) return '0:00';
    var m = Math.floor(value / 60);
    var s = Math.floor(value % 60);
    return m + ':' + (s < 10 ? '0' + s : String(s));
  }

  var COPY = {
    ready: 'Play soundscape',
    playing: 'Now playing',
    paused: 'Paused',
    error: 'Tap to retry'
  };

  function setState(state, label, pressed) {
    player.dataset.state = state;
    status.textContent = COPY[state] || 'Soundscape';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-pressed', String(!!pressed));
  }

  /* Web Audio graph drives the waveform bars */
  var audioCtx = null;
  var analyser = null;
  var freqData = null;

  function setupGraph() {
    if (audioCtx || !(wave instanceof HTMLCanvasElement)) return;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
    var source = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.78;
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
  }

  function paintWave(timeStamp) {
    if (!(wave instanceof HTMLCanvasElement)) return;
    var ctx = wave.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = wave.clientWidth || 268;
    var height = wave.clientHeight || 36;
    if (wave.width !== Math.floor(width * dpr) || wave.height !== Math.floor(height * dpr)) {
      wave.width = Math.floor(width * dpr);
      wave.height = Math.floor(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var bars = 40;
    var gap = 2;
    var barWidth = Math.max(1.6, (width - gap * (bars - 1)) / bars);
    if (analyser && freqData && !audio.paused) analyser.getByteFrequencyData(freqData);

    for (var i = 0; i < bars; i += 1) {
      var sample = freqData ? freqData[Math.floor(i * (freqData.length / bars))] / 255 : 0;
      var idle = 0.14 + 0.1 * Math.sin(i * 0.42 + timeStamp / 640);
      var amp = audio.paused ? idle : Math.max(0.08, sample);
      var barHeight = Math.max(3, amp * height);
      ctx.fillStyle = 'rgba(198, 167, 94, ' + (0.25 + amp * 0.75) + ')';
      ctx.fillRect(i * (barWidth + gap), (height - barHeight) / 2, barWidth, barHeight);
    }
  }

  function setRangeFill(input, value, max) {
    if (!input) return;
    input.style.setProperty('--fill', (value / max) * 100 + '%');
  }

  function syncTransport(timeStamp) {
    var total = audio.duration || 0;
    var at = audio.currentTime || 0;

    if (current) current.textContent = formatTime(at);
    if (duration) duration.textContent = formatTime(total);

    if (seek && document.activeElement !== seek) {
      seek.value = total ? String(Math.round((at / total) * 1000)) : '0';
      setRangeFill(seek, Number(seek.value), 1000);
    }
    if (volume) setRangeFill(volume, Number(volume.value), 100);
    if (ring) ring.style.strokeDashoffset = String(CIRC * (1 - (total ? at / total : 0)));

    paintWave(timeStamp);
    requestAnimationFrame(syncTransport);
  }
  requestAnimationFrame(syncTransport);

  function play() {
    setupGraph();
    if (audioCtx && audioCtx.resume) audioCtx.resume();
    var attempt = audio.play();
    if (!attempt || !attempt.then) {
      sessionStorage.setItem('rmg-soundtrack', 'on');
      setState('playing', 'Pause website soundtrack', true);
      return;
    }
    attempt.then(function () {
      sessionStorage.setItem('rmg-soundtrack', 'on');
      setState('playing', 'Pause website soundtrack', true);
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Frames of History',
          artist: 'Rowe Meridian Group℠',
          album: 'Rowe Meridian Group℠'
        });
        navigator.mediaSession.playbackState = 'playing';
      }
    })['catch'](function () {
      sessionStorage.setItem('rmg-soundtrack', 'off');
      setState('error', 'Play website soundtrack');
    });
  }

  function pause(resumeLabel) {
    audio.pause();
    sessionStorage.setItem('rmg-soundtrack', 'off');
    setState('paused', 'Play website soundtrack');
    if (resumeLabel) status.textContent = 'Resume sound';
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  }

  toggle.addEventListener('click', function () {
    if (audio.paused) play();
    else pause();
  });

  if (expand) {
    expand.addEventListener('click', function (event) {
      event.preventDefault();
      var open = player.dataset.open === 'true';
      player.dataset.open = String(!open);
      expand.setAttribute('aria-expanded', String(!open));
      expand.setAttribute('aria-label', open ? 'Open soundtrack details' : 'Close soundtrack details');
    });
  }

  /* Tap outside closes the panel on touch devices */
  document.addEventListener('pointerdown', function (event) {
    if (player.dataset.open !== 'true') return;
    if (event.target instanceof Node && player.contains(event.target)) return;
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    player.dataset.open = 'false';
    if (expand) expand.setAttribute('aria-expanded', 'false');
  });

  if (seek) {
    seek.addEventListener('input', function () {
      if (!audio.duration) return;
      audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
      setRangeFill(seek, Number(seek.value), 1000);
    });
  }

  if (volume) {
    volume.addEventListener('input', function () {
      audio.volume = Number(volume.value) / 100;
      audio.muted = audio.volume === 0;
      sessionStorage.setItem('rmg-volume', String(audio.volume));
      if (mute) mute.setAttribute('aria-pressed', String(audio.muted));
      setRangeFill(volume, Number(volume.value), 100);
    });
  }

  if (mute) {
    mute.addEventListener('click', function () {
      audio.muted = !audio.muted;
      mute.setAttribute('aria-pressed', String(audio.muted));
      mute.setAttribute('aria-label', audio.muted ? 'Unmute soundtrack' : 'Mute soundtrack');
    });
  }

  audio.addEventListener('loadedmetadata', function () {
    if (duration) duration.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('error', function () {
    audio.pause();
    setState('error', 'Soundtrack unavailable');
    status.textContent = 'Unavailable';
  });

  /* Never keep playing in a backgrounded tab */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden || audio.paused) return;
    pause(true);
  });

  if ('mediaSession' in navigator && navigator.mediaSession.setActionHandler) {
    navigator.mediaSession.setActionHandler('play', function () { play(); });
    navigator.mediaSession.setActionHandler('pause', function () { pause(); });
  }

  var wants = sessionStorage.getItem('rmg-soundtrack') === 'on';
  setState('ready', wants ? 'Resume website soundtrack' : 'Play website soundtrack');
  if (wants) status.textContent = 'Resume sound';
})();
