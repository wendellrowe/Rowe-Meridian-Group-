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
