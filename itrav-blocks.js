/* ============================================================
   DIY TRIP SUMMIT — SHARED PAGE BLOCK RENDERERS
   One file, loaded by every summit page. Bug fixes happen here.

   Usage on a page:
     <div class="itrav-block" data-block="schedule" data-cta="on"></div>
     <script src="https://cdn.jsdelivr.net/gh/mcmeeshi/diy-summit-assets@main/itrav-blocks.js" defer>

   Blocks available:
     schedule  - day-by-day lineup (registration page + schedule overview)

   Content sources (fetched with no-store, so edits are instant):
     speakers.json, schedule.json
   ============================================================ */
(function () {
  "use strict";

  var BASE = "https://raw.githubusercontent.com/mcmeeshi/diy-summit-assets/main/";
  var CSS_ID = "itrav-blocks-css";

  /* ---------- styles (injected once per page) ---------- */
  var CSS = [
    ".itrav-block{font-family:inherit;max-width:1000px;margin:0 auto;}",
    ".itrav-block *{box-sizing:border-box;}",

    ".itrav-day{margin:0 0 56px;}",
    ".itrav-day:last-child{margin-bottom:0;}",
    ".itrav-day-band{background:#657a9d;border-radius:0;padding:26px 24px;margin:0 0 28px;}",
    ".itrav-fullbleed .itrav-day-band{width:100vw;margin-left:calc(50% - 50vw);}",
    ".itrav-day-band-inner{max-width:1000px;margin:0 auto;}",
    ".itrav-day-band h3{font-family:inherit;margin:0 0 8px;font-size:25px;font-weight:700;color:#fff;line-height:1.2;letter-spacing:.5px;}",
    ".itrav-day-band h3 em{font-style:normal;color:#F2C181;}",
    ".itrav-day-band p{font-family:inherit;margin:0;font-size:16px;line-height:1.55;color:#fff;opacity:.95;}",

    ".itrav-sub{margin:34px 0 18px;}",
    ".itrav-sub h4{font-family:inherit;margin:0 0 6px;font-size:20px;font-weight:700;color:#657a9d;line-height:1.3;}",
    ".itrav-sub p{font-family:inherit;margin:0;font-size:15px;line-height:1.55;color:#555;}",

    ".itrav-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:30px 20px;}",
    ".itrav-card{text-align:center;}",
    ".itrav-photo,.itrav-initials{width:100px;height:100px;border-radius:50%;margin:0 auto 12px;display:block;border:3px solid #657a9d;}",
    ".itrav-photo{object-fit:cover;object-position:center top;}",
    ".itrav-initials{background:#657a9d;color:#fff;font-family:inherit;font-size:30px;font-weight:700;line-height:94px;letter-spacing:1px;}",
    ".itrav-card-name{font-family:inherit;font-size:17px;font-weight:700;color:#1a1a1a;margin:0 0 2px;line-height:1.3;}",
    ".itrav-card-brand{font-family:inherit;font-size:13px;color:#888;margin:0 0 8px;line-height:1.3;}",
    ".itrav-card-session{font-family:inherit;font-size:14px;color:#444;margin:0;line-height:1.45;}",
    ".itrav-card-session.itrav-tba{color:#999;font-style:italic;}",

    ".itrav-live{background:#f6f5f3;border-left:5px solid #F2C181;border-radius:6px;padding:22px 24px;margin:34px 0 0;}",
    ".itrav-live h4{font-family:inherit;margin:0 0 8px;font-size:19px;font-weight:700;color:#657a9d;line-height:1.3;}",
    ".itrav-live .itrav-live-topic{font-family:inherit;margin:0 0 4px;font-size:17px;font-weight:600;color:#1a1a1a;line-height:1.4;}",
    ".itrav-live .itrav-live-time{font-family:inherit;margin:0 0 8px;font-size:15px;color:#444;}",
    ".itrav-live .itrav-live-note{font-family:inherit;margin:0;font-size:14px;color:#666;font-style:italic;}",
    ".itrav-live .itrav-tba{color:#999;font-style:italic;font-weight:400;}",

    ".itrav-cta-wrap{text-align:center;margin:28px 0 0;}",
    ".itrav-cta{display:inline-block;font-family:inherit;background:#657a9d;color:#fff !important;",
    "font-size:16px;font-weight:700;letter-spacing:.8px;padding:16px 38px;border-radius:3px;",
    "text-transform:uppercase;",
    "text-decoration:none !important;line-height:1.2;transition:opacity .15s ease;}",
    ".itrav-cta:hover{opacity:.88;color:#fff !important;}",
    '.itrav-cta::after{content:" \\2192";margin-left:2px;}',

    ".itrav-empty{font-family:inherit;font-size:15px;color:#999;font-style:italic;text-align:center;margin:0;padding:14px 0;}",

    "@media (max-width:640px){",
    ".itrav-grid{grid-template-columns:repeat(auto-fill,minmax(135px,1fr));gap:26px 14px;}",
    ".itrav-photo,.itrav-initials{width:84px;height:84px;}",
    ".itrav-initials{font-size:25px;line-height:78px;}",
    ".itrav-day-band{padding:18px 20px;}",
    ".itrav-day-band h3{font-size:21px;}",
    ".itrav-day-band p{font-size:15px;}",
    ".itrav-sub h4{font-size:18px;}",
    ".itrav-card-name{font-size:15px;}",
    ".itrav-card-session{font-size:13px;}",
    ".itrav-live{padding:18px 18px;}",
    ".itrav-cta{padding:15px 24px;font-size:15px;width:100%;max-width:340px;}",
    ".itrav-day-band{padding:22px 20px;}",
    "}"
  ].join("");

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement("style");
    s.id = CSS_ID;
    s.appendChild(document.createTextNode(CSS));
    document.head.appendChild(s);
  }

  /* ---------- helpers ---------- */
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function initials(name) {
    var skip = { and: 1, "&": 1, the: 1, of: 1 };
    var words = String(name || "").split(/[\s&]+/).filter(function (w) {
      return w && !skip[w.toLowerCase()];
    });
    return words.slice(0, 2).map(function (w) {
      return w.charAt(0).toUpperCase();
    }).join("");
  }

  function avatar(s) {
    if (s.photo) {
      return '<img class="itrav-photo" src="' + BASE + esc(s.photo) +
             '" alt="' + esc(s.name) + '" loading="lazy">';
    }
    return '<div class="itrav-initials" aria-hidden="true">' + esc(initials(s.name)) + "</div>";
  }

  /* Label under a card. Experts show their country, everyone else the session. */
  function cardLabel(s, tba) {
    if (s.role === "expert") return { text: s.country || tba, tba: !s.country };
    return { text: s.session || tba, tba: !s.session };
  }

  function card(s, tba) {
    var label = cardLabel(s, tba);
    return '<div class="itrav-card">' +
             avatar(s) +
             '<p class="itrav-card-name">' + esc(s.name) + "</p>" +
             (s.brand ? '<p class="itrav-card-brand">' + esc(s.brand) + "</p>" : "") +
             '<p class="itrav-card-session' + (label.tba ? " itrav-tba" : "") + '">' +
               esc(label.text) +
             "</p>" +
           "</div>";
  }

  function ctaButton(cta, on) {
    if (!on || !cta || !cta.label) return "";
    var href = cta.href || "#";
    return '<div class="itrav-cta-wrap"><a class="itrav-cta" href="' + esc(href) + '">' +
             esc(cta.label) + "</a></div>";
  }

  /* ---------- block: schedule ---------- */
  function renderSchedule(el, data) {
    var speakers = (data.speakers && data.speakers.speakers) || [];
    var sched = data.schedule || {};
    var days = sched.days || [];
    var cta = sched.cta || {};
    var ph = sched.placeholders || {};
    var ctaOn = el.getAttribute("data-cta") !== "off";
    if (el.getAttribute("data-fullbleed") !== "off") el.className += " itrav-fullbleed";
    var html = "";

    days.forEach(function (day) {
      var onDay = speakers.filter(function (s) { return Number(s.day) === Number(day.n); });
      var presenters = onDay.filter(function (s) { return s.role !== "expert"; });
      var experts = onDay.filter(function (s) { return s.role === "expert"; });

      html += '<div class="itrav-day">';

      /* day banner */
      html += '<div class="itrav-day-band"><div class="itrav-day-band-inner">' +
                "<h3>DAY " + esc(day.n) + ": <em>" + esc(day.theme) + "</em></h3>" +
                (day.blurb ? "<p>" + esc(day.blurb) + "</p>" : "") +
              "</div></div>";

      /* presenters */
      html += presenters.length
        ? '<div class="itrav-grid">' +
            presenters.map(function (s) { return card(s, ph.topic_tba || ""); }).join("") +
          "</div>"
        : '<p class="itrav-empty">' + esc(ph.speakers_tba || "") + "</p>";

      if (day.cta_after_speakers) html += ctaButton(cta, ctaOn);

      /* combined destination-expert session */
      if (day.expert_session) {
        html += '<div class="itrav-sub">' +
                  "<h4>Day " + esc(day.n) + ": " + esc(day.expert_session.title) + "</h4>" +
                  (day.expert_session.intro
                    ? "<p>" + esc(day.expert_session.intro) + "</p>" : "") +
                "</div>";
        html += experts.length
          ? '<div class="itrav-grid">' +
              experts.map(function (s) { return card(s, ph.topic_tba || ""); }).join("") +
            "</div>"
          : '<p class="itrav-empty">' + esc(ph.speakers_tba || "") + "</p>";
      }

      /* live Zoom session */
      if (day.live_call) {
        var lc = day.live_call;
        html += '<div class="itrav-live">' +
                  "<h4>Day " + esc(day.n) + ": " + esc(lc.heading) + "</h4>" +
                  '<p class="itrav-live-topic' + (lc.topic ? "" : " itrav-tba") + '">' +
                    esc(lc.topic || ph.topic_tba || "") + "</p>" +
                  '<p class="itrav-live-time' + (lc.time ? "" : " itrav-tba") + '">' +
                    esc(lc.time || ph.time_tba || "") + "</p>" +
                  (lc.note ? '<p class="itrav-live-note">' + esc(lc.note) + "</p>" : "") +
                "</div>";
        if (lc.cta_after) html += ctaButton(cta, ctaOn);
      }

      html += "</div>";
    });

    if (html) el.innerHTML = html;
  }

  var RENDERERS = { schedule: renderSchedule };

  /* ---------- boot ---------- */
  function getJSON(file) {
    return fetch(BASE + file, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error(file + ": HTTP " + r.status);
      return r.json();
    });
  }

  function boot() {
    var blocks = [].slice.call(document.querySelectorAll(".itrav-block[data-block]"));
    if (!blocks.length) return;
    injectCSS();

    Promise.all([getJSON("speakers.json"), getJSON("schedule.json")])
      .then(function (res) {
        var data = { speakers: res[0], schedule: res[1] };
        blocks.forEach(function (el) {
          var fn = RENDERERS[el.getAttribute("data-block")];
          if (!fn) return;
          try { fn(el, data); }
          catch (e) { console.error("itrav-blocks render failed:", e); }
        });
      })
      .catch(function (err) {
        /* Static skeleton inside the div stays visible. */
        console.warn("itrav-blocks: live data unavailable.", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
