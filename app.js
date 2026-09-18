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

  /* Inquiry form — composes a prepared email draft */
  var form = document.querySelector('[data-inquiry]');
  if (form) {
    var status = form.querySelector('[data-status]');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (form.elements.website && form.elements.website.value) return;
      if (!form.reportValidity()) return;

      var data = new FormData(form);
      var name = (data.get('name') || '').toString().trim();
      var org = (data.get('organization') || '').toString().trim();
      var email = (data.get('email') || '').toString().trim();
      var purpose = (data.get('purpose') || 'Inquiry').toString();
      var message = (data.get('message') || '').toString().trim();

      var body = [
        'Name: ' + name,
        org ? 'Organization: ' + org : null,
        'Email: ' + email,
        'Purpose: ' + purpose,
        '',
        message
      ].filter(function (line) { return line !== null; }).join('\n');

      var href = 'mailto:hello@wendellrowe.com'
        + '?subject=' + encodeURIComponent('Rowe Meridian Group — ' + purpose + ' inquiry')
        + '&body=' + encodeURIComponent(body);

      window.location.href = href;
      if (status) status.textContent = 'Draft prepared — your email application should now be open. If nothing happened, write to hello@wendellrowe.com directly.';
    });
  }

  /* Year */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
