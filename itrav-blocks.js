/* ============================================================
   DIY TRIP SUMMIT - SHARED PAGE BLOCK RENDERERS
   One file, loaded by every summit page. Bug fixes happen here.

   Usage on a page (script tag omitted here on purpose - see
   paste-snippets for the exact markup):
     div.itrav-block with data-block="schedule" data-cta="on"

   Blocks available:
     schedule  - day-by-day lineup (registration page + schedule overview)
     directory - speaker directory
     day       - one day's session list (data-day="1|2|3")
     bonuses   - First Class Pass bonuses on the ThriveCart sales pages
                 (data-featured="4" overrides how many get full cards;
                  data-cta-href="#id" overrides where the buttons scroll;
                  data-cta="off" hides the buttons)
     sponsors  - sponsor logo strip, same on every page it is pasted on

   Data attributes:
     data-cta="off"        hides all CTA buttons
     data-fullbleed="off"  day bands stay at content width

   Content sources (served from GitHub Pages; edits appear within ~1 min):
     speakers.json  - the people directory
     sessions.json  - what is presented, by whom, on which day
     schedule.json  - day themes, live calls, CTA config, bonus labels
     bonuses.json   - approved First Class Pass bonuses
     sponsors.json  - sponsors ticked "Logo on site" in Airtable
   ============================================================ */
(function () {
  "use strict";

  /* GitHub Pages, not raw.githubusercontent. Pages serves .js with a real
     JavaScript content type and invalidates within about a minute of a push.
     raw.githubusercontent holds its own ~5 minute edge cache that no-store
     does not bypass, so JSON edits used to lag. Serves the images too. */
  var BASE = "https://mcmeeshi.github.io/diy-summit-assets/";
  var CSS_ID = "itrav-blocks-css";

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
    ".itrav-day-band p{font-family:inherit;margin:0;font-size:16px;line-height:1.55;color:#fff;}",

    ".itrav-sub{margin:38px 0 18px;}",
    ".itrav-sub h4{font-family:inherit;margin:0 0 6px;font-size:20px;font-weight:700;color:#657a9d;line-height:1.3;}",
    ".itrav-sub p{font-family:inherit;margin:0;font-size:15px;line-height:1.55;color:#555;}",

    ".itrav-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:26px 12px;}",
    ".itrav-card{text-align:center;}",
    ".itrav-photo,.itrav-initials{width:100px;height:100px;border-radius:50%;margin:0 auto 12px;display:block;border:3px solid #657a9d;}",
    ".itrav-photo{object-fit:cover;object-position:center top;}",
    ".itrav-initials{background:#657a9d;color:#fff;font-family:inherit;font-size:30px;font-weight:700;line-height:94px;letter-spacing:1px;}",
    ".itrav-card-name{font-family:inherit;font-size:16px;font-weight:700;color:#657a9d;margin:0 0 2px;line-height:1.3;}",
    ".itrav-card-brand{font-family:inherit;font-size:13px;color:#888;margin:0 0 7px;line-height:1.3;}",
    ".itrav-card-session{font-family:inherit;font-size:18px;font-weight:600;color:#1a1a1a;margin:0;line-height:1.35;}",
    ".itrav-card-session.itrav-tba{color:#999;font-style:italic;}",

    ".itrav-live{background:#f6f5f3;border-left:5px solid #D4E17D;border-radius:4px;padding:22px 24px;margin:38px 0 0;display:flex;gap:28px;align-items:center;justify-content:space-between;}",
    ".itrav-live-main{flex:1 1 auto;min-width:0;}",
    ".itrav-live-panel{flex:0 0 auto;display:flex;gap:16px;}",
    ".itrav-panelist{width:86px;text-align:center;}",
    ".itrav-live-panel .itrav-photo,.itrav-live-panel .itrav-initials{width:66px;height:66px;margin:0 auto 7px;border-width:2px;}",
    ".itrav-live-panel .itrav-initials{font-size:21px;line-height:62px;}",
    ".itrav-panelist-name{font-family:inherit;font-size:12px;font-weight:600;color:#444;margin:0;line-height:1.3;}",
    ".itrav-live h4{font-family:inherit;margin:0 0 8px;font-size:19px;font-weight:700;color:#657a9d;line-height:1.3;}",
    ".itrav-live .itrav-live-topic{font-family:inherit;margin:0 0 4px;font-size:17px;font-weight:600;color:#1a1a1a;line-height:1.4;}",
    ".itrav-live .itrav-live-time{font-family:inherit;margin:0 0 8px;font-size:15px;color:#444;}",
    ".itrav-live .itrav-live-with{font-family:inherit;margin:0 0 8px;font-size:15px;color:#444;}",
    ".itrav-live .itrav-live-with strong{font-weight:600;}",
    ".itrav-live .itrav-live-note{font-family:inherit;margin:0;font-size:14px;color:#666;font-style:italic;}",
    ".itrav-live .itrav-tba{color:#999;font-style:italic;font-weight:400;}",

    ".itrav-cta-wrap{text-align:center;margin:30px 0 0;}",

    /* sponsor logos: centred rows of five, so a short last row stays balanced */
    ".itrav-sp{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;row-gap:30px;}",
    ".itrav-sp-item{flex:0 0 20%;height:150px;padding:8px 18px;display:flex;align-items:center;justify-content:center;text-decoration:none;}",
    "a.itrav-sp-item:hover{opacity:.8;}",
    "a.itrav-sp-item:focus-visible{outline:2px solid #657a9d;outline-offset:2px;}",
    ".itrav-sp-logo{display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;}",
    ".itrav-sp-name{font-family:inherit;font-size:18px;font-weight:700;color:#657a9d;text-align:center;line-height:1.3;}",
    ".itrav-cta{display:inline-block;font-family:inherit;background:#F2C181;color:#1A1A1A !important;",
    "font-size:16px;font-weight:700;letter-spacing:.8px;padding:16px 38px;border-radius:6px;",
    "text-transform:uppercase;text-decoration:none !important;line-height:1.2;",
    "transition:opacity .15s ease;cursor:pointer;}",
    ".itrav-cta:hover{opacity:.88;color:#1A1A1A !important;}",
    '.itrav-cta::after{content:" \\2192";margin-left:2px;}',

    ".itrav-empty{font-family:inherit;font-size:15px;color:#999;font-style:italic;text-align:center;margin:0;padding:14px 0;}",

    "@media (max-width:640px){",
    ".itrav-photo,.itrav-initials{width:84px;height:84px;}",
    ".itrav-initials{font-size:25px;line-height:78px;}",
    ".itrav-day-band{padding:22px 20px;}",
    ".itrav-day-band h3{font-size:21px;}",
    ".itrav-day-band p{font-size:15px;}",
    ".itrav-sub h4{font-size:18px;}",
    ".itrav-card-name{font-size:14px;}",
    ".itrav-card-session{font-size:16px;}",
    ".itrav-live{padding:18px;flex-direction:column;align-items:flex-start;gap:18px;}",
    ".itrav-live-panel{gap:12px;flex-wrap:wrap;}",
    ".itrav-panelist{width:74px;}",
    ".itrav-live-panel .itrav-photo,.itrav-live-panel .itrav-initials{width:58px;height:58px;}",
    ".itrav-live-panel .itrav-initials{font-size:18px;line-height:54px;}",
    ".itrav-cta{padding:15px 24px;font-size:15px;width:100%;max-width:340px;}",
    "}",

    "@media (max-width:900px){.itrav-grid{grid-template-columns:repeat(4,1fr);}}",
    "@media (max-width:700px){.itrav-grid{grid-template-columns:repeat(3,1fr);gap:24px 12px;}",
    ".itrav-photo,.itrav-initials{width:92px;height:92px;}",
    ".itrav-initials{font-size:27px;line-height:86px;}}",

    /* ---- speaker directory ---- */
    ".itrav-dir{display:grid;grid-template-columns:repeat(3,1fr);gap:34px 24px;}",
    ".itrav-dir-card{text-align:center;}",
    ".itrav-dir .itrav-photo,.itrav-dir .itrav-initials{width:150px;height:150px;}",
    ".itrav-dir .itrav-initials{font-size:44px;line-height:144px;}",
    ".itrav-dir-name{font-family:inherit;font-size:19px;font-weight:700;color:#1a1a1a;margin:0 0 3px;line-height:1.3;}",
    ".itrav-dir-session{font-family:inherit;font-size:16px;font-weight:600;color:#657a9d;margin:0 0 4px;line-height:1.4;}",
    ".itrav-dir-brand{font-family:inherit;font-size:15px;color:#777;margin:0;line-height:1.4;}",
    ".itrav-dir-link{font-family:inherit;color:#657a9d;text-decoration:underline;}",
    ".itrav-dir-link:hover{color:#4e6180;}",
    ".itrav-acc{margin:12px 0 0;text-align:left;}",
    ".itrav-acc-btn{font-family:inherit;width:100%;background:#f6f5f3;border:0;border-left:4px solid #D4E17D;",
    "padding:10px 14px;font-size:14px;font-weight:600;color:#1a1a1a;cursor:pointer;text-align:left;border-radius:3px;}",
    ".itrav-acc-btn:hover{background:#efeeeb;}",
    ".itrav-acc-btn::after{content:\" +\";float:right;color:#657a9d;font-weight:700;}",
    ".itrav-acc.open .itrav-acc-btn::after{content:\" \\2212\";}",
    ".itrav-acc-body{display:none;padding:12px 14px 2px;font-family:inherit;font-size:14.5px;line-height:1.6;color:#444;}",
    ".itrav-acc.open .itrav-acc-body{display:block;}",

    /* ---- day page ---- */
    ".itrav-sessions{margin:0;}",
    ".itrav-row{display:flex;gap:22px;align-items:center;padding:22px 0;border-bottom:1px solid #e9e7e4;}",
    ".itrav-row:last-child{border-bottom:0;}",
    ".itrav-row .itrav-photo,.itrav-row .itrav-initials{width:76px;height:76px;margin:0;flex:0 0 auto;}",
    ".itrav-row .itrav-initials{font-size:23px;line-height:70px;}",
    ".itrav-row-main{flex:1 1 auto;min-width:0;}",
    ".itrav-row-title{font-family:inherit;font-size:19px;font-weight:700;color:#1a1a1a;margin:0 0 3px;line-height:1.35;}",
    ".itrav-row-by{font-family:inherit;font-size:15px;color:#666;margin:0;line-height:1.4;}",
    ".itrav-row-by strong{color:#444;font-weight:600;}",
    ".itrav-watch{flex:0 0 auto;display:inline-block;font-family:inherit;background:#F2C181;color:#1A1A1A !important;",
    "font-size:14px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;padding:12px 26px;border-radius:6px;",
    "text-decoration:none !important;line-height:1.2;}",
    ".itrav-watch:hover{opacity:.88;color:#1A1A1A !important;}",
    ".itrav-watch.itrav-soon{background:#ece9e4;color:#8a8a8a !important;pointer-events:none;}",

    "@media (max-width:900px){.itrav-dir{grid-template-columns:repeat(2,1fr);}}",
    "@media (max-width:560px){.itrav-dir{grid-template-columns:1fr;gap:30px;}",
    ".itrav-dir .itrav-photo,.itrav-dir .itrav-initials{width:130px;height:130px;}",
    ".itrav-dir .itrav-initials{font-size:38px;line-height:124px;}",
    ".itrav-row{flex-wrap:wrap;gap:14px;}",
    ".itrav-row-main{flex:1 1 60%;}",
    ".itrav-watch{width:100%;text-align:center;padding:13px 20px;}}",

    "@media (max-width:480px){.itrav-grid{grid-template-columns:repeat(2,1fr);gap:24px 10px;}",
    ".itrav-photo,.itrav-initials{width:84px;height:84px;}",
    ".itrav-initials{font-size:25px;line-height:78px;}}",

    /* ---- First Class Pass bonuses (ThriveCart pages) ----
       ThriveCart styles bare elements, so every property that matters is
       set explicitly here rather than inherited. */
    ".itrav-bn{max-width:1000px;margin:0 auto;text-align:left;color:#1a1a1a;}",
    /* Montserrat on the sales pages. !important because ThriveCart's own
       element styles (Inter) out-rank a plain class rule. */
    ".itrav-bn,.itrav-bn *{font-family:\"Montserrat\",\"Helvetica Neue\",Arial,sans-serif !important;}",
    ".itrav-bn-feat{display:grid;gap:22px;margin:0 0 44px;}",
    ".itrav-bn-card>.itrav-bn-img,.itrav-bn-card>.itrav-bn-ph{grid-area:img;}",
    ".itrav-bn-card>.itrav-bn-head{grid-area:head;min-width:0;}",
    ".itrav-bn-card>.itrav-bn-desc{grid-area:desc;min-width:0;}",
    ".itrav-bn-body[hidden]{display:none !important;}",
    ".itrav-bn-cta-wrap{text-align:center;margin:0 0 44px;}",
    "a.itrav-bn-cta{display:inline-block;background:#F3C180;color:#fff !important;",
    "font-size:18px;font-weight:700;padding:16px 34px;border-radius:4.5px;text-decoration:none !important;",
    "line-height:1.25;letter-spacing:normal;text-transform:none;border:0;box-shadow:none;transition:opacity .15s ease;}",
    "a.itrav-bn-cta:hover{opacity:.88;color:#fff !important;}",
    "a.itrav-bn-cta:focus-visible{outline:2px solid #657a9d;outline-offset:3px;}",
    ".itrav-bn-card{display:grid;grid-template-columns:160px minmax(0,1fr);grid-template-areas:\"img head\" \"img desc\";",
    "column-gap:28px;row-gap:0;align-items:start;",
    "background:#f6f5f3;border-radius:8px;padding:26px;}",
    ".itrav-bn-img,.itrav-bn-ph{display:block;width:100%;max-width:100%;aspect-ratio:1/1;border-radius:4px;margin:0;}",
    ".itrav-bn-img{object-fit:cover;background:#fff;box-shadow:0 4px 12px rgba(26,26,26,.12);}",
    ".itrav-bn-ph{background:linear-gradient(160deg,#657a9d,#4e6180);color:#fff;",
    "display:flex;flex-direction:column;justify-content:space-between;padding:10%;overflow:hidden;font-size:15px;}",
    ".itrav-bn-ph-brand{font-size:.62em;letter-spacing:.06em;text-transform:uppercase;opacity:.9;line-height:1.3;}",
    ".itrav-bn-ph-title{font-weight:700;line-height:1.2;display:-webkit-box;-webkit-box-orient:vertical;",
    "-webkit-line-clamp:6;overflow:hidden;}",
    ".itrav-bn-row .itrav-bn-ph span{display:none;}",
    ".itrav-bn-title{font-size:21px;font-weight:700;color:#1a1a1a;margin:0 0 6px;line-height:1.3;text-transform:none;letter-spacing:normal;}",
    ".itrav-bn-by{font-size:14px;color:#777;margin:0 0 12px;line-height:1.4;}",
    ".itrav-bn-sponsor{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1.2px;",
    "text-transform:uppercase;color:#657a9d;border:1.5px solid #657a9d;border-radius:3px;padding:3px 6px 2px;",
    "margin-left:8px;vertical-align:middle;line-height:1.2;}",
    ".itrav-bn-desc{font-size:16px;line-height:1.6;color:#444;}",
    ".itrav-bn-desc p{font-size:16px;line-height:1.6;color:#444;margin:0 0 10px;}",
    ".itrav-bn-desc ul,.itrav-bn-desc ol{margin:0 0 10px;padding:0 0 0 22px;}",
    ".itrav-bn-desc ul{list-style:disc outside;}",
    ".itrav-bn-desc ol{list-style:decimal outside;}",
    ".itrav-bn-desc li{font-size:16px;line-height:1.55;color:#444;margin:0 0 4px;padding:0;}",
    ".itrav-bn-desc strong{color:#1a1a1a;font-weight:700;}",
    ".itrav-bn-cat{margin:0 0 40px;}",
    ".itrav-bn-cat:last-child{margin-bottom:0;}",
    ".itrav-bn-cat-h{font-size:20px;font-weight:700;color:#1a1a1a;margin:0 0 4px;padding:0 0 8px;",
    "border-bottom:2px solid #1a1a1a;line-height:1.3;text-transform:none;letter-spacing:normal;}",
    ".itrav-bn-row{border-bottom:1px solid #e9e7e4;}",
    ".itrav-bn-top{display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:16px;align-items:center;padding:14px 0;}",
    ".itrav-bn-row .itrav-bn-img{box-shadow:0 2px 6px rgba(26,26,26,.12);}",
    ".itrav-bn-row .itrav-bn-title{font-size:17px;font-weight:600;margin:0 0 3px;}",
    ".itrav-bn-row .itrav-bn-by{margin:0;}",
    "button.itrav-bn-more{-webkit-appearance:none;appearance:none;font-size:15px;font-weight:600;",
    "color:#657a9d;background:none;border:0;box-shadow:none;padding:8px 0 8px 8px;margin:0;width:auto;min-height:0;",
    "cursor:pointer;white-space:nowrap;text-transform:none;letter-spacing:normal;line-height:1.3;}",
    "button.itrav-bn-more:hover{color:#4e6180;background:none;}",
    "button.itrav-bn-more:focus-visible{outline:2px solid #657a9d;outline-offset:2px;border-radius:3px;}",
    "button.itrav-bn-more::after{content:\" \\25BE\";display:inline-block;transition:transform .2s ease;}",
    "button.itrav-bn-more[aria-expanded=\"true\"]::after{transform:rotate(180deg);}",
    ".itrav-bn-body{padding:0 0 18px 80px;}",
    "@media (max-width:640px){",
    ".itrav-bn-card{grid-template-columns:88px minmax(0,1fr);grid-template-areas:\"img head\" \"desc desc\";",
    "column-gap:16px;row-gap:14px;padding:18px;align-items:center;}",
    ".itrav-bn-card .itrav-bn-ph{font-size:9px;}",
    ".itrav-bn-title{font-size:18px;}",
    ".itrav-bn-top{grid-template-columns:48px minmax(0,1fr);gap:12px;}",
    ".itrav-bn-row .itrav-bn-title{font-size:16px;}",
    "button.itrav-bn-more{grid-column:2;justify-self:start;padding:2px 0;}",
    ".itrav-bn-body{padding:0 0 16px;}",
    "a.itrav-bn-cta{display:block;font-size:17px;padding:15px 20px;}",
    ".itrav-bn-cta-wrap{margin:0 0 36px;}",
    "}",
    "@media (prefers-reduced-motion:reduce){button.itrav-bn-more::after{transition:none;}}",
    "@media (max-width:900px){.itrav-sp-item{flex-basis:33.333%;height:130px;}}",
    "@media (max-width:480px){.itrav-sp-item{flex-basis:50%;height:105px;padding:6px 12px;}}",
  ].join("");

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement("style");
    s.id = CSS_ID;
    s.appendChild(document.createTextNode(CSS));
    document.head.appendChild(s);
  }

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
    return words.slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("");
  }

  /* A speaker's photo is either an explicit repo path, or - if none is set -
     images/speakers/<slug>.jpg by convention. Dropping a correctly named file
     into the repo is therefore the whole job; no JSON edit needed. If the file
     is missing the image errors and photoFallback() swaps in the initials. */
  function avatar(s) {
    var path = s.photo || (s.slug ? "images/speakers/" + s.slug + ".jpg" : "");
    if (!path) {
      return '<div class="itrav-initials" aria-hidden="true">' + esc(initials(s.name)) + "</div>";
    }
    return '<img class="itrav-photo" src="' + BASE + esc(path) + '" alt="' + esc(s.name) +
           '" loading="lazy" data-initials="' + esc(initials(s.name)) + '">';
  }

  /* Image load errors do not bubble, but they do capture - so one listener on
     the block catches every missing headshot or bonus image without any
     inline handler. */
  function photoFallback(el) {
    el.addEventListener("error", function (ev) {
      var img = ev.target;
      if (!img || img.tagName !== "IMG") return;
      var div;
      if (img.classList.contains("itrav-photo")) {
        div = document.createElement("div");
        div.className = "itrav-initials";
        div.setAttribute("aria-hidden", "true");
        div.textContent = img.getAttribute("data-initials") || "";
      } else if (img.classList.contains("itrav-sp-logo")) {
        div = document.createElement("span");
        div.className = "itrav-sp-name";
        div.textContent = img.getAttribute("alt") || "";
      } else if (img.classList.contains("itrav-bn-img")) {
        var wrap = document.createElement("div");
        wrap.innerHTML = bonusTile(img.getAttribute("data-title"), img.getAttribute("data-brand"));
        div = wrap.firstChild;
      } else {
        return;
      }
      if (img.parentNode) img.parentNode.replaceChild(div, img);
    }, true);
  }

  /* Stand-in for a bonus image that is not in the repo yet: the product
     name on a blue tile, so the page still looks finished. */
  function bonusTile(title, brand) {
    return '<div class="itrav-bn-ph" aria-hidden="true">' +
             '<span class="itrav-bn-ph-brand">' + esc(brand || "") + "</span>" +
             '<span class="itrav-bn-ph-title">' + esc(title || "") + "</span></div>";
  }

  /* label = the talk title, or the country for a destination expert */
  function card(s, label, tba) {
    var text = label || tba || "";
    var isTba = !label;
    return '<div class="itrav-card">' +
             avatar(s) +
             '<p class="itrav-card-name">' + esc(s.name) + "</p>" +
             (s.brand ? '<p class="itrav-card-brand">' + esc(s.brand) + "</p>" : "") +
             '<p class="itrav-card-session' + (isTba ? " itrav-tba" : "") + '">' + esc(text) + "</p>" +
           "</div>";
  }

  function ctaButton(cta, on, labelOverride) {
    if (!on || !cta) return "";
    var label = labelOverride || cta.label;
    if (!label) return "";
    var toggle = cta.formkit_uid
      ? ' data-formkit-toggle="' + esc(cta.formkit_uid) + '"'
      : "";
    return '<div class="itrav-cta-wrap"><a class="itrav-cta" href="' +
             esc(cta.href || "#") + '"' + toggle + ">" + esc(label) + "</a></div>";
  }

  function renderSchedule(el, data) {
    var people = {};
    ((data.speakers && data.speakers.speakers) || []).forEach(function (s) {
      people[s.slug] = s;
    });
    var sessions = (data.sessions && data.sessions.sessions) || [];
    var sched = data.schedule || {};
    var days = sched.days || [];
    var cta = sched.cta || {};
    var ph = sched.placeholders || {};
    var intro = sched.compilation_intro || "";
    var ctaOn = el.getAttribute("data-cta") !== "off";
    var html = "";

    function lookup(slugs) {
      return (slugs || []).map(function (sl) { return people[sl]; }).filter(Boolean);
    }

    function panelFaces(panels, lc) {
      var people_ = [];
      panels.forEach(function (p) {
        lookup(p.speakers).forEach(function (sp) { people_.push(sp); });
      });
      if (!people_.length && lc && lc.panelists) people_ = lookup(lc.panelists);
      if (!people_.length) return "";
      return '<div class="itrav-live-panel">' +
        people_.map(function (sp) {
          return '<div class="itrav-panelist">' + avatar(sp) +
                 '<p class="itrav-panelist-name">' + esc(sp.name) + "</p></div>";
        }).join("") + "</div>";
    }

    days.forEach(function (day) {
      var mine = sessions.filter(function (s) { return Number(s.day) === Number(day.n); });
      var singles = mine.filter(function (s) { return s.kind === "single"; });
      var comps = mine.filter(function (s) { return s.kind === "compilation"; });
      var panels = mine.filter(function (s) { return s.kind === "live_panel"; });

      html += '<div class="itrav-day">';
      html += '<div class="itrav-day-band"><div class="itrav-day-band-inner">' +
                "<h3>DAY " + esc(day.n) + ": <em>" + esc(day.theme) + "</em></h3>" +
                (day.blurb ? "<p>" + esc(day.blurb) + "</p>" : "") +
              "</div></div>";

      /* One card per presenter. Compilation sessions contribute their
         NON-expert presenters here (the hosts who front the session); the
         destination experts stay in the sub-section below. */
      var entries = [];
      singles.forEach(function (sess) {
        lookup(sess.speakers).forEach(function (p) {
          entries.push({ person: p, title: sess.title, rank: sess.sort_rank, ord: sess.display_order });
        });
      });
      comps.forEach(function (sess) {
        lookup(sess.speakers).forEach(function (p) {
          if (p.role !== "expert") {
            entries.push({ person: p, title: sess.title, rank: sess.sort_rank, ord: sess.display_order });
          }
        });
      });
      /* Display Order from Airtable wins. Blank falls back to the old
         hosts-then-sponsors-then-alphabetical rule. */
      entries.sort(function (a, b) {
        var oa = a.ord == null ? 9999 : a.ord, ob = b.ord == null ? 9999 : b.ord;
        if (oa !== ob) return oa - ob;
        var ra = a.rank == null ? 2 : a.rank, rb = b.rank == null ? 2 : b.rank;
        if (ra !== rb) return ra - rb;
        return a.title.localeCompare(b.title);
      });
      html += entries.length
        ? '<div class="itrav-grid">' +
            entries.map(function (e) { return card(e.person, e.title, ph.topic_tba); }).join("") +
          "</div>"
        : '<p class="itrav-empty">' + esc(ph.speakers_tba || "") + "</p>";

      if (day.cta_after_speakers) html += ctaButton(cta, ctaOn);

      /* multi-speaker compilation sessions get their own sub-section */
      comps.forEach(function (sess) {
        html += '<div class="itrav-sub">' +
                  "<h4>Day " + esc(day.n) + ": " + esc(sess.title) + "</h4>" +
                  (intro ? "<p>" + esc(intro) + "</p>" : "") +
                "</div>";
        var experts = lookup(sess.speakers).filter(function (p) { return p.role === "expert"; });
        html += experts.length
          ? '<div class="itrav-grid">' +
              experts.map(function (p) { return card(p, p.country, ph.topic_tba); }).join("") +
            "</div>"
          : '<p class="itrav-empty">' + esc(ph.speakers_tba || "") + "</p>";
      });

      /* live Zoom session */
      if (day.live_call) {
        var lc = day.live_call;
        html += '<div class="itrav-live"><div class="itrav-live-main">' +
                  "<h4>Day " + esc(day.n) + ": " + esc(lc.heading) + "</h4>" +
                  '<p class="itrav-live-topic' + (lc.topic ? "" : " itrav-tba") + '">' +
                    esc(lc.topic || ph.topic_tba || "") + "</p>" +
                  '<p class="itrav-live-time' + (lc.time ? "" : " itrav-tba") + '">' +
                    esc(lc.time || ph.time_tba || "") + "</p>" +
                  (lc.note ? '<p class="itrav-live-note">' + esc(lc.note) + "</p>" : "") +
                "</div>" + panelFaces(panels, lc) + "</div>";
        if (lc.cta_after) html += ctaButton(cta, ctaOn, cta.label_live);
      }

      html += "</div>";
    });

    if (html) el.innerHTML = html;
  }


  /* ---------- block: directory ---------- */
  function renderDirectory(el, data) {
    var speakers = (data.speakers && data.speakers.speakers) || [];
    var cfg = (data.schedule && data.schedule.directory) || {};
    var expertLabel = cfg.expert_label || "{country} Expert";
    var bioLabel = cfg.bio_label || "Get to know {name}";
    var groups = cfg.groups || [
      { roles: ["host"], label: "Your Hosts" },
      { roles: ["sponsor"], label: "Our Sponsors" },
      { roles: ["speaker", "expert"], label: "Your Speakers" }
    ];
    /* One continuous grid - no headings, no dividing rules. The groups
       config still sets the ORDER (hosts, then sponsors, then the rest);
       inside each group it stays alphabetical. Anyone whose role is not
       covered by a group goes last so nobody silently disappears. */
    var ordered = [];
    var placed = {};
    groups.forEach(function (g) {
      var mine = speakers.filter(function (s) {
        return g.roles.indexOf(s.role) > -1 && !placed[s.slug];
      });
      mine.sort(function (a, b) { return a.name.localeCompare(b.name); });
      mine.forEach(function (s) { placed[s.slug] = true; ordered.push(s); });
    });
    var leftovers = speakers.filter(function (s) { return !placed[s.slug]; });
    leftovers.sort(function (a, b) { return a.name.localeCompare(b.name); });
    ordered = ordered.concat(leftovers);

    var html = ordered.length
      ? '<div class="itrav-dir">' + ordered.map(dirCard).join("") + "</div>"
      : "";

    function dirCard(s) {
      var line = s.role === "expert" && s.country
        ? expertLabel.replace("{country}", s.country)
        : (s.talk_titles && s.talk_titles.length ? s.talk_titles.join(" &middot; ") : "");
      var brandHtml = "";
      if (s.brand) {
        brandHtml = s.link
          ? '<p class="itrav-dir-brand"><a class="itrav-dir-link" href="' + esc(s.link) +
            '" target="_blank" rel="noopener">' + esc(s.brand) + "</a></p>"
          : '<p class="itrav-dir-brand">' + esc(s.brand) + "</p>";
      }
      return '<div class="itrav-dir-card">' +
               avatar(s) +
               '<p class="itrav-dir-name">' + esc(s.name) + "</p>" +
               (line ? '<p class="itrav-dir-session">' + line + "</p>" : "") +
               brandHtml +
               (s.bio
                 ? '<div class="itrav-acc"><button type="button" class="itrav-acc-btn">' +
                     esc(bioLabel.replace("{name}", s.name.split(" ")[0])) +
                   '</button><div class="itrav-acc-body">' + esc(s.bio) + "</div></div>"
                 : "") +
             "</div>";
    }

    if (html) {
      el.innerHTML = html;
      el.addEventListener("click", function (ev) {
        var btn = ev.target.closest && ev.target.closest(".itrav-acc-btn");
        if (!btn) return;
        btn.parentNode.classList.toggle("open");
      });
    }
  }

  /* ---------- block: day ---------- */
  function renderDay(el, data) {
    var people = {};
    ((data.speakers && data.speakers.speakers) || []).forEach(function (s) { people[s.slug] = s; });
    var sessions = (data.sessions && data.sessions.sessions) || [];
    var sched = data.schedule || {};
    var cfg = sched.day_page || {};
    var dayNum = Number(el.getAttribute("data-day"));
    if (!dayNum) { console.warn("itrav-blocks: day block needs data-day"); return; }
    var showPhotos = el.getAttribute("data-photos") !== "off";


    var mine = sessions.filter(function (s) {
      return Number(s.day) === dayNum && s.kind !== "live_panel";
    }).sort(function (a, b) {
      var oa = a.display_order == null ? 9999 : a.display_order;
      var ob = b.display_order == null ? 9999 : b.display_order;
      return oa - ob;
    });
    if (!mine.length) {
      el.innerHTML = '<p class="itrav-empty">' +
        esc((sched.placeholders || {}).speakers_tba || "Sessions announced soon") + "</p>";
      return;
    }

    el.innerHTML = '<div class="itrav-sessions">' + mine.map(function (sess) {
      var cast = (sess.speakers || []).map(function (sl) { return people[sl]; }).filter(Boolean);
      var names = cast.map(function (p) { return p.name; });
      var joined = names.length <= 1 ? (names[0] || "")
        : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
      /* Individual presentation rows are NOT time-gated. The button says
         Watch and links as soon as Airtable has a Squarespace Page, so the
         team can click through and test every link before launch. Access is
         controlled by the session page being inactive in Squarespace, which
         redirects to the expired/upgrade page. The time gate lives on the
         day-level button instead. */
      var btn = sess.page_url
        ? '<a class="itrav-watch" href="' + esc(sess.page_url) + '">' +
            esc(cfg.watch_label || "Watch") + "</a>"
        : '<span class="itrav-watch itrav-soon">' +
            esc(cfg.soon_label || "Coming soon") + "</span>";
      return '<div class="itrav-row">' +
               (showPhotos && cast.length ? avatar(cast[0]) : "") +
               '<div class="itrav-row-main">' +
                 '<p class="itrav-row-title">' + esc(sess.title) + "</p>" +
                 (joined ? '<p class="itrav-row-by">with <strong>' + esc(joined) + "</strong></p>" : "") +
               "</div>" + btn +
             "</div>";
    }).join("") + "</div>";
  }

  /* ---------- block: bonuses ----------
     Top-ranked bonuses get full cards; the rest sit in category lists with
     the description one tap away. Every contributor's title, brand and
     image stays visible without a click. Order is Display ranking from
     Airtable; category order and headings come from schedule.json. */
  /* Loads Montserrat once per page, unless the page already has it. */
  function loadMontserrat() {
    if (document.getElementById("itrav-montserrat")) return;
    var links = document.querySelectorAll('link[href*="fonts.googleapis.com"]');
    for (var i = 0; i < links.length; i++) {
      if (/family=Montserrat[^&]*wght@[^&]*400[^&]*600[^&]*700/.test(links[i].href)) return;
    }
    var l = document.createElement("link");
    l.id = "itrav-montserrat";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap";
    document.head.appendChild(l);
  }

  function renderBonuses(el, data) {
    var list = (data.bonuses && data.bonuses.bonuses) || [];
    if (!list.length) return;
    loadMontserrat();
    var cfg = (data.schedule && data.schedule.bonuses) || {};
    var cats = cfg.categories || [];
    var n = parseInt(el.getAttribute("data-featured"), 10);
    if (isNaN(n)) n = cfg.featured_count == null ? 4 : cfg.featured_count;
    var uid = "itrav-bn-" + Math.random().toString(36).slice(2, 8) + "-";
    var readMore = cfg.read_more || "Read more";
    var showLess = cfg.show_less || "Show less";

    var cta = cfg.cta || {};
    var ctaOn = el.getAttribute("data-cta") !== "off" && (cta.labels || []).length;
    var ctaHref = el.getAttribute("data-cta-href") || cta.href || "#checkout";
    var ctaCount = 0;

    function img(b) {
      if (!b.image) return bonusTile(b.title, b.brand);
      return '<img class="itrav-bn-img" src="' + BASE + "images/bonuses/" + encodeURIComponent(b.image) +
             '" alt="' + esc(b.title) + '" loading="lazy" data-title="' + esc(b.title) +
             '" data-brand="' + esc(b.brand) + '">';
    }
    /* Labels take turns in the order schedule.json lists them. */
    function ctaButton() {
      if (!ctaOn) return "";
      var label = cta.labels[ctaCount++ % cta.labels.length];
      return '<div class="itrav-bn-cta-wrap"><a class="itrav-bn-cta" href="' + esc(ctaHref) + '">' +
             esc(label) + "</a></div>";
    }
    function by(b) {
      return '<p class="itrav-bn-by">' + (b.brand ? esc(cfg.by_label || "by") + " " + esc(b.brand) : "") +
             (b.sponsor ? '<span class="itrav-bn-sponsor">' + esc(cfg.sponsor_label || "Sponsor") + "</span>" : "") +
             "</p>";
    }

    var featured = list.slice(0, Math.max(0, n));
    var rest = list.slice(featured.length);
    var html = "";

    if (featured.length) {
      html += '<div class="itrav-bn-feat">' + featured.map(function (b) {
        return '<div class="itrav-bn-card">' + img(b) +
                 '<div class="itrav-bn-head"><h3 class="itrav-bn-title">' + esc(b.title) + "</h3>" + by(b) + "</div>" +
                 '<div class="itrav-bn-desc">' + (b.description_html || "") + "</div>" +
               "</div>";
      }).join("") + "</div>";
    }

    /* Sections in the configured order, then anything whose category is
       not configured, so nobody silently disappears. */
    var sections = cats.map(function (c) { return { label: c.label, items: [], value: c.value }; });
    var other = { label: cfg.other_label || "More bonuses", items: [] };
    rest.forEach(function (b) {
      var hit = null;
      sections.forEach(function (sec) { if (sec.value === b.category) hit = sec; });
      (hit || other).items.push(b);
    });
    sections.push(other);

    /* A button after the featured cards and between category sections -
       not after the last one, where the page's own content takes over. */
    var filled = sections.filter(function (sec) { return sec.items.length; });
    if (featured.length && filled.length) html += ctaButton();

    var i = 0;
    filled.forEach(function (sec, k) {
      if (k > 0) html += ctaButton();
      html += '<div class="itrav-bn-cat"><h3 class="itrav-bn-cat-h">' + esc(sec.label) + "</h3>" +
        sec.items.map(function (b) {
          var id = uid + (i++);
          var hasDesc = !!b.description_html;
          return '<div class="itrav-bn-row"><div class="itrav-bn-top">' + img(b) +
                   '<div><p class="itrav-bn-title">' + esc(b.title) + "</p>" + by(b) + "</div>" +
                   (hasDesc ? '<button type="button" class="itrav-bn-more" aria-expanded="false" aria-controls="' +
                     id + '">' + esc(readMore) + "</button>" : "") +
                 "</div>" +
                 (hasDesc ? '<div class="itrav-bn-body itrav-bn-desc" id="' + id + '" hidden>' +
                   b.description_html + "</div>" : "") +
               "</div>";
        }).join("") + "</div>";
    });

    el.innerHTML = '<div class="itrav-bn">' + html + "</div>";
    fitHeight(el);
    el.addEventListener("click", function (ev) {
      var go = ev.target.closest && ev.target.closest(".itrav-bn-cta");
      if (go) {
        var href = go.getAttribute("href") || "";
        var target = href.charAt(0) === "#" ? document.getElementById(href.slice(1)) : null;
        if (target) {
          ev.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (href.charAt(0) === "#") {
          console.warn("itrav-blocks: no element with id '" + href.slice(1) + "' for the bonus buttons to scroll to");
        }
        return;
      }
      var btn = ev.target.closest && ev.target.closest(".itrav-bn-more");
      if (!btn) return;
      var open = btn.getAttribute("aria-expanded") === "true";
      var body = document.getElementById(btn.getAttribute("aria-controls"));
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      btn.textContent = open ? readMore : showLess;
      if (body) body.hidden = open;
      if (el._itravFit) el._itravFit();
    });
  }

  /* Sponsor logos. Who shows, in what order and where each links all come
     from Airtable via sponsors.json, so one edit updates every page. The
     logo is images/sponsors/<slug>.png by convention - uploading a correctly
     named file is the whole job. A missing file shows the name as text. */
  function renderSponsors(el, data) {
    var list = (data.sponsors && data.sponsors.sponsors) || [];
    if (!list.length) return;
    el.innerHTML = '<div class="itrav-sp">' + list.map(function (s) {
      var img = '<img class="itrav-sp-logo" src="' + BASE + "images/sponsors/" + esc(s.slug) +
                '.png" alt="' + esc(s.name) + '" loading="lazy">';
      return s.link
        ? '<a class="itrav-sp-item" href="' + esc(s.link) + '" target="_blank" rel="sponsored noopener">' + img + "</a>"
        : '<div class="itrav-sp-item">' + img + "</div>";
    }).join("") + "</div>";
  }

  /* Page builders put an HTML element in a box the editor sizes by hand,
     which clips the block whenever bonuses are added or Read more opens.
     So the block sizes its own container, in whichever form it finds:
       - inside a frame: set the frame to the content height, and let any
         wrapper that was exactly the frame's size grow with it;
       - on the page itself: let any ancestor that is clipping it grow.
     It re-fits on every size change (images loading, Read more, resizing)
     and logs which case applied, for debugging in the browser console. */
  function fitHeight(el) {
    var frame = null;
    try { frame = window.frameElement; } catch (e) { frame = null; }
    var mode = frame ? "frame" : (window.self !== window.top ? "foreign-frame" : "page");
    if (mode === "foreign-frame") {
      console.warn("itrav-blocks: inside a frame this page cannot resize; set the box height by hand");
      return;
    }
    console.log("itrav-blocks: fitting bonus block height (" + mode + ")");

    function unclip(node) {
      node.style.setProperty("height", "auto", "important");
      node.style.setProperty("max-height", "none", "important");
      node.style.setProperty("overflow-y", "visible", "important");
    }

    function fitFrame() {
      if (!el.offsetHeight) return;          // not laid out yet; never collapse the frame
      var doc = document.documentElement;
      var bottom = el.getBoundingClientRect().bottom + (window.pageYOffset || doc.scrollTop || 0);
      var want = Math.ceil(bottom + 16);
      var before = frame.getBoundingClientRect().height;
      if (Math.abs(before - want) < 2) return;
      frame.style.setProperty("height", want + "px", "important");
      frame.style.setProperty("max-height", "none", "important");
      var p = frame.parentElement;
      for (var i = 0; p && i < 6 && p.tagName !== "BODY"; i++, p = p.parentElement) {
        if (p.getBoundingClientRect().height > before + 4) break;   // a real section, not the box
        unclip(p);
      }
    }

    function fitPage() {
      var p = el.parentElement;
      for (var i = 0; p && i < 10 && p.tagName !== "BODY" && p.tagName !== "HTML"; i++, p = p.parentElement) {
        if (p.scrollHeight > p.clientHeight + 2) unclip(p);
      }
    }

    var fit = mode === "frame" ? fitFrame : fitPage;
    var queued = false;
    el._itravFit = function () {
      if (queued) return;
      queued = true;
      (window.requestAnimationFrame || setTimeout)(function () { queued = false; fit(); });
    };
    el._itravFit();
    el.addEventListener("load", el._itravFit, true);    // each image as it arrives
    if (window.ResizeObserver) new ResizeObserver(el._itravFit).observe(el);
    window.addEventListener("resize", el._itravFit);
    setTimeout(el._itravFit, 1500);
  }

  /* Which JSON files each block needs - a page only fetches what its own
     blocks use, so a ThriveCart sales page never loads the speaker data. */
  var RENDERERS = {
    schedule: { fn: renderSchedule, files: ["speakers", "sessions", "schedule"] },
    directory: { fn: renderDirectory, files: ["speakers", "schedule"] },
    day: { fn: renderDay, files: ["speakers", "sessions", "schedule"] },
    bonuses: { fn: renderBonuses, files: ["bonuses", "schedule"] },
    sponsors: { fn: renderSponsors, files: ["sponsors"] }
  };

  /* One request per file per page, however many times boot() runs. */
  var cache = {};
  function getJSON(file) {
    if (!cache[file]) {
      cache[file] = fetch(BASE + file, { cache: "no-store" }).then(function (r) {
        if (!r.ok) throw new Error(file + ": HTTP " + r.status);
        return r.json();
      });
    }
    return cache[file];
  }

  /* ThriveCart's HTML element deletes any <script> on save, so on those
     pages the loader lives in the product's Tracking code field and the
     element holds only <div id="itrav-bonuses"></div> - an id survives
     ThriveCart's save where a class or data attribute might not. */
  var ID_BLOCKS = { "itrav-bonuses": "bonuses" };

  function blockType(el) {
    return el.getAttribute("data-block") || ID_BLOCKS[el.id] || "";
  }

  function findBlocks() {
    var sel = ".itrav-block[data-block]";
    Object.keys(ID_BLOCKS).forEach(function (id) { sel += ",#" + id; });
    return [].slice.call(document.querySelectorAll(sel)).filter(function (el) {
      return RENDERERS[blockType(el)] && !el.getAttribute("data-itrav-done");
    });
  }

  function boot() {
    /* data-itrav-done stops a block rendering twice if the loader ends up on
       a page more than once. */
    var blocks = findBlocks();
    if (!blocks.length) return;
    blocks.forEach(function (el) { el.setAttribute("data-itrav-done", "1"); });
    injectCSS();

    var need = [];
    blocks.forEach(function (el) {
      RENDERERS[blockType(el)].files.forEach(function (f) {
        if (need.indexOf(f) === -1) need.push(f);
      });
    });

    Promise.all(need.map(function (f) { return getJSON(f + ".json"); }))
      .then(function (res) {
        var data = {};
        need.forEach(function (f, i) { data[f] = res[i]; });
        blocks.forEach(function (el) {
          var r = RENDERERS[blockType(el)];
          if (el.getAttribute("data-fullbleed") !== "off") el.className += " itrav-fullbleed";
          photoFallback(el);
          try { r.fn(el, data); }
          catch (e) { console.error("itrav-blocks render failed:", e); }
        });
      })
      .catch(function (err) {
        console.warn("itrav-blocks: live data unavailable, static fallback retained.", err);
      });
  }

  /* Page builders (ThriveCart included) may draw their content after the
     page has loaded, so keep looking for new blocks for a minute. */
  function watch() {
    if (!window.MutationObserver || !document.body) return;
    var pending = false;
    var obs = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () { pending = false; boot(); }, 50);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { obs.disconnect(); }, 60000);
  }

  function start() { boot(); watch(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
