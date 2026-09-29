/* Rowe Meridian Group — privacy link and evidence line */
(function () {
  "use strict";
  var legal = document.querySelector(".footer-legal");
  if (legal && !legal.querySelector('[href*="privacy"]')) {
    var link = document.createElement("a");
    link.href = "/privacy.html";
    link.textContent = "Privacy";
    legal.insertBefore(link, legal.lastElementChild);
  }
  var note = document.querySelector("[data-status]");
  if (note && note.textContent.indexOf("third parties") !== -1) {
    note.innerHTML = 'Inquiries are delivered directly to the principal. See the <a href="/privacy.html">privacy notice</a>.';
  }
  var attr = document.querySelector(".attribution");
  if (attr && attr.textContent.indexOf("withheld") === -1) {
    attr.textContent = "Selected results from the principal's twenty-five-year operating career in advanced manufacturing, national grocery operations, distribution, and supply chain. Client identities withheld by agreement.";
  }
})();
