#!/usr/bin/env python3
"""Build speakers.json, sessions.json and bonuses.json from Airtable.

Run by .github/workflows/publish-page-data.yml, which is triggered by the
"Run workflow" button on the repo's Actions tab (or on a schedule).

Needs one environment variable: AIRTABLE_TOKEN, a personal access token with
data.records:read on the Summit '27 base. It is stored as a repository secret,
never in this file.

NOT written here: schedule.json. That is hand-maintained config - day themes,
live call headings and topics, CTA labels, directory grouping. This script
must never touch it.

Keep in step with:
  - the full-name-slug formula in Presenter RSVP
  - the headshot filenames in images/speakers/
  - slugify() below
All three must produce the same slug for the same person.
"""

import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, timezone, datetime

BASE_ID = "appdsDc03ICCZXKIk"

TABLES = {
    "speakers": "tbl3Rd8YmbRulsT0I",   # Summit Speakers
    "rsvp": "tbl3GUUz1HoTZ8wPR",       # Presenter RSVP
    "topics": "tblECEvjfx8E5DG84",     # Presentation Topics
    "bonuses": "tbljyR77IdURVWOwX",    # Contributor Submission
}

CYCLE = "2027"
REGION = "Asia"

# Michelle and Jedd. Their own live calls are left off their talk lists.
HOSTS = {"recs6qFPPvjw2cINp", "recjZz5yacXn1lxss"}

DAY_FROM_THEME = {"Dream (Day 1)": 1, "Plan (Day 2)": 2, "Go (Day 3)": 3}
ROLE_RANK = {"host": 0, "sponsor": 1, "expert": 2, "speaker": 2}
KIND_RANK = {"single": 0, "compilation": 1, "live_panel": 2}

# How a session's kind is spotted in the Presentation Topic title. These are
# per-summit conventions, not fixed rules - confirm them with Michelle at the
# start of a cycle rather than assuming last year's. Set them here, and nowhere
# else: the renderer reads "kind" out of sessions.json and never re-derives it.
GROUP_MARKERS = ["\U0001F465"]                       # 👥 = multi-speaker session
LIVE_SESSION_PREFIXES = ["live panel:", "live call:"]  # + a marker = that day's Zoom call

# First Class Pass bonuses (Contributor Submission). A bonus is published when
# Product Test Status says it is approved, unless its Category is one of the
# excluded values (Michelle's own bonuses get their own feature on the page).
BONUS_APPROVED = "Approved for First Class Pass"
BONUS_EXCLUDED_CATEGORIES = {"Separate callout on page"}
BONUS_SPONSOR_FIELD = "Sponsor?"   # checkbox; ticked = SPONSOR label
# Bonus images keep the filename of the Product Img attachment in Airtable,
# so whoever uploads them to the repo never has to rename anything.
BONUS_IMAGE_DIR = "images/bonuses"


# --------------------------------------------------------------- fetching --

def fetch_table(token, table_id):
    """Every record in one table, following pagination."""
    records, offset = [], None
    while True:
        params = {"pageSize": "100"}
        if offset:
            params["offset"] = offset
        url = (
            f"https://api.airtable.com/v0/{BASE_ID}/{table_id}"
            f"?{urllib.parse.urlencode(params)}"
        )
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.load(resp)
        except urllib.error.HTTPError as err:
            body = err.read().decode("utf-8", "replace")[:400]
            raise SystemExit(
                f"Airtable returned {err.code} for table {table_id}.\n{body}\n\n"
                "401 or 403 usually means the token is missing, expired, or has no "
                "access to this base. Check the AIRTABLE_TOKEN repository secret."
            )
        records.extend(payload.get("records", []))
        offset = payload.get("offset")
        if not offset:
            return records


# ---------------------------------------------------------------- helpers --

def clean_name(n):
    return re.sub(r"\s*\(host\)\s*$", "", str(n or "").strip(), flags=re.I)


def slugify(name):
    """Strip accents, drop "(host)", remove anything that is not a letter,
    number, space or hyphen, then collapse whitespace to hyphens.
    "Tyke & Tina" -> "tyke-tina"."""
    s = unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode()
    s = re.sub(r"\(host\)", "", s, flags=re.I)
    s = re.sub(r"[^\w\s-]", "", s).strip().lower()
    s = re.sub(r"[\s_]+", "-", s)
    return re.sub(r"-+", "-", s).strip("-")


def clean_title(t):
    t = re.sub(r"^[^\w(]+", "", str(t or ""))              # leading emoji / marker
    t = re.sub(r"\s*\(Destination Experts\)\s*$", "", t)   # group suffix
    return re.sub(r"\s+", " ", t).strip()


def session_kind(raw_title):
    """A marker in the title decides this, never the number of speakers -
    counting breaks on co-presented sessions. Markers are configured above."""
    raw = str(raw_title or "")
    clean = clean_title(raw).lower()
    marked = any(m in raw for m in GROUP_MARKERS)
    if not marked:
        return "single"
    if any(clean.startswith(p) for p in LIVE_SESSION_PREFIXES):
        return "live_panel"
    return "compilation"


def role_of(record_id, types):
    if record_id in HOSTS:
        return "host"
    if "Sponsor speaker" in types:
        return "sponsor"
    if "Destination clip" in types:
        return "expert"
    return "speaker"


def normalize_url(raw):
    """(url, notes). Adds a missing scheme, upgrades http, lowercases the host,
    leaves the path alone because @handles are case sensitive. Never guesses at
    a spelling - suspicious values are reported, not corrected."""
    notes, u = [], str(raw or "").strip()
    if not u:
        return "", notes
    m = re.search(r"https?://\S+", u, flags=re.I)
    if m:
        if m.group(0) != u:
            notes.append("URL extracted from surrounding text")
        u = m.group(0)
    else:
        u = u.split(",")[0].strip()
        notes.append("added https:// (no scheme submitted)")
        u = "https://" + u
    parts = urllib.parse.urlsplit(u)
    scheme = parts.scheme.lower()
    if scheme == "http":
        scheme = "https"
        notes.append("http upgraded to https")
    host = parts.netloc.lower()
    if host != parts.netloc:
        notes.append("host lowercased")
    return urllib.parse.urlunsplit((scheme, host, parts.path, parts.query, parts.fragment)), notes


def f(record, name, default=""):
    """One field out of a REST API record."""
    return record.get("fields", {}).get(name, default)


# ------------------------------------------------------------------ build --

def build(speaker_rows, rsvp_rows, topic_rows):
    """Pure transform, so it can be tested without touching the network."""
    link_report = []

    # RSVP keyed by the Summit Speakers record it links to. RSVP wins for brand
    # and link, because that is what the speaker submitted about themselves.
    rsvp_by_speaker = {}
    for r in rsvp_rows:
        for linked_id in f(r, "Full Name", []) or []:
            rsvp_by_speaker[linked_id] = r

    speakers, by_id = [], {}
    for row in speaker_rows:
        if not f(row, "Confirmed '27?", False):
            continue

        raw_name = f(row, "Name")
        name = clean_name(raw_name)
        types = f(row, "Speaker Type", []) or []
        rsvp = rsvp_by_speaker.get(row["id"])

        brand = (f(rsvp, "Brand") if rsvp else "").strip() or str(f(row, "Brand")).strip()
        raw_link = (f(rsvp, "Link") if rsvp else "").strip() or str(f(row, "Website")).strip()
        url, notes = normalize_url(raw_link)
        if notes:
            link_report.append({"who": name, "raw": raw_link, "url": url, "notes": notes})

        rec = {
            "slug": slugify(name),
            "name": name,
            "brand": brand,
            "role": role_of(row["id"], types),
            "country": str(f(row, "Topic to pitch")).strip() if "Destination clip" in types else "",
            "link": url,
            "photo": "",
            "bio": (f(rsvp, "Bio") if rsvp else "").strip(),
            "has_rsvp": rsvp is not None,
            "has_headshot": bool(rsvp and (f(rsvp, "Headshot", []) or [])),
            "airtable_id": row["id"],
            "talk_titles": [],
        }
        by_id[row["id"]] = rec
        speakers.append(rec)

    sessions = []
    for row in topic_rows:
        raw_title = f(row, "Presentation Topic")
        day = DAY_FROM_THEME.get(str(f(row, "Theme")))
        if not day:
            continue                                  # no theme yet, no day to place it on
        cast = [by_id[s] for s in (f(row, "Speaker", []) or []) if s in by_id]
        if not cast:
            continue                                  # unclaimed topic

        page_url = ""
        raw_page = str(f(row, "Squarespace Page")).strip()
        if raw_page:
            page_url, page_notes = normalize_url(raw_page)
            if page_notes:
                link_report.append({
                    "who": clean_title(raw_title), "raw": raw_page,
                    "url": page_url, "notes": page_notes,
                })

        ord_raw = f(row, "Display Order for Schedule", None)
        try:
            display_order = int(ord_raw) if ord_raw not in (None, "") else None
        except (TypeError, ValueError):
            display_order = None

        sessions.append({
            "id": row["id"],
            "title": clean_title(raw_title),
            "day": day,
            "kind": session_kind(raw_title),
            "sort_rank": min(ROLE_RANK[p["role"]] for p in cast),
            "display_order": display_order,
            "page_url": page_url,
            "speakers": [p["slug"] for p in cast],
        })

    sessions.sort(key=lambda s: (
        s["day"],
        s["display_order"] if s["display_order"] is not None else 9999,
        KIND_RANK[s["kind"]],
        s["sort_rank"],
        s["title"],
    ))

    # Talk titles on the directory card: a host's own live call is left off,
    # and any other panelist shows "Expert Panelist" rather than the panel
    # title, because a panel has no individual topic.
    by_slug = {p["slug"]: p for p in speakers}
    for s in sessions:
        for slug in s["speakers"]:
            p = by_slug.get(slug)
            if not p:
                continue
            if s["kind"] == "live_panel":
                if p["role"] == "host":
                    continue
                label = "Expert Panelist"
            else:
                label = s["title"]
            if label not in p["talk_titles"]:
                p["talk_titles"].append(label)

    speakers.sort(key=lambda p: p["name"].lower())
    return speakers, sessions, link_report


# ---------------------------------------------------------------- bonuses --

_ESCAPABLE = r"\\`*_{}\[\]()#+\-.!~>|"


def _inline(text):
    """Escape HTML, then apply the few inline marks Airtable rich text uses.
    Links keep their text but lose the href: an outbound link on a checkout
    page sends buyers away before they pay."""
    held = []

    def hold(m):
        held.append(m.group(1))
        return f"\x00{len(held) - 1}\x00"

    t = re.sub(r"\\([" + _ESCAPABLE + r"])", hold, text)
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"(?<!\w)_(?!\s)(.+?)(?<!\s)_(?!\w)", r"<em>\1</em>", t)
    t = re.sub(r"\x00(\d+)\x00", lambda m: held[int(m.group(1))]
               .replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"), t)
    return t


def rich_to_html(md):
    """Airtable rich text (markdown) -> a small, safe HTML subset:
    p, ul/ol/li, strong, em. Each line is its own paragraph, because that is
    how contributors' line breaks read in Airtable. A line starting with a
    dash is a bullet even when Airtable escaped it as "\\-"."""
    out, items, kind = [], [], None

    def flush():
        nonlocal items, kind
        if items:
            out.append(f"<{kind}>" + "".join(f"<li>{i}</li>" for i in items) + f"</{kind}>")
        items, kind = [], None

    for raw in str(md or "").replace("\r", "").split("\n"):
        line = raw.replace("\u00a0", " ").strip()
        if not line:
            flush()
            continue
        bullet = re.match(r"^(?:\\?[-*\u2022])\s+(.*)$", line)
        number = re.match(r"^\d+[.)]\s+(.*)$", line)
        if bullet or number:
            want = "ul" if bullet else "ol"
            if kind and kind != want:
                flush()
            kind = want
            items.append(_inline((bullet or number).group(1).strip()))
            continue
        flush()
        line = re.sub(r"^#+\s+", "", line)
        out.append(f"<p>{_inline(line)}</p>")
    flush()
    return "".join(out)


def build_bonuses(rows):
    """Approved, non-excluded Contributor Submission records, in Display
    ranking order (blank sinks to the bottom). Pure, so it can be tested."""
    bonuses, issues = [], {"no_title": [], "no_category": [], "no_brand": [],
                           "no_rank": [], "no_description": [], "no_image": [],
                           "shared_image": []}
    by_image = {}
    for r in rows:
        status = f(r, "Product Test Status") or ""
        if status != BONUS_APPROVED:
            continue
        category = str(f(r, "Category") or "").strip()
        if category in BONUS_EXCLUDED_CATEGORIES:
            continue
        title = str(f(r, "Product") or "").strip()
        if not title:
            issues["no_title"].append(r["id"])
            continue
        brand = str(f(r, "Brand") or "").strip()
        rank = f(r, "Display ranking", None)
        try:
            rank = int(rank) if rank not in (None, "") else None
        except (TypeError, ValueError):
            rank = None
        description = rich_to_html(f(r, "Product description"))

        attachments = f(r, "Product Img", []) or []
        image = str(attachments[0].get("filename", "")).strip() if attachments else ""
        if image:
            by_image.setdefault(image, []).append(title)
        else:
            issues["no_image"].append(title)

        if not category:
            issues["no_category"].append(title)
        if not brand:
            issues["no_brand"].append(title)
        if rank is None:
            issues["no_rank"].append(title)
        if not description:
            issues["no_description"].append(title)

        bonuses.append({
            "title": title,
            "image": image,
            "brand": brand,
            "category": category,
            "sponsor": bool(f(r, BONUS_SPONSOR_FIELD, False)),
            "rank": rank,
            "description_html": description,
            "airtable_id": r["id"],
        })

    # Two bonuses whose attachments share a filename (Canva's "1.png") would
    # both show whichever file is in the repo. Report it; rename in Airtable.
    issues["shared_image"] = [f"`{img}` ({' / '.join(t)})" for img, t in by_image.items() if len(t) > 1]

    bonuses.sort(key=lambda b: (b["rank"] if b["rank"] is not None else 99999, b["title"].lower()))
    return bonuses, issues


# ---------------------------------------------------------------- reports --

IMAGE_DIR = "images/speakers"


def headshot_audit(speakers):
    """Cross-check the repo's headshots against the current slugs.

    Renaming a speaker in Airtable changes their slug, which orphans their
    image: no error, the card just quietly loses its face. So report both
    directions - speakers with no file, and files matching nobody - and when
    the counts line up, say so, because that pairing is almost always a
    rename rather than two unrelated problems.
    """
    if not os.path.isdir(IMAGE_DIR):
        return None

    files = sorted(f for f in os.listdir(IMAGE_DIR) if not f.startswith("."))
    stems = {}
    wrong_type = []
    for f in files:
        stem, ext = os.path.splitext(f)
        if ext.lower() != ".jpg":
            wrong_type.append(f)
            continue
        stems.setdefault(stem, f)

    slugs = {p["slug"] for p in speakers}
    missing = [p["name"] for p in speakers if p["slug"] not in stems]
    # -2, -3 suffixes are extra submissions from scenario 4, not orphans
    orphans = [f for stem, f in sorted(stems.items())
               if stem not in slugs and not re.search(r"-\d+$", stem)]
    extras = [f for stem, f in sorted(stems.items()) if re.search(r"-\d+$", stem)]

    return {
        "missing": missing,
        "orphans": orphans,
        "wrong_type": wrong_type,
        "extras": extras,
        "likely_rename": bool(missing and orphans),
    }


def report(speakers, sessions, link_report):
    def names(rows, key):
        return ", ".join(r[key] for r in rows) or "none"

    buckets = [
        ("No Display Order", [s for s in sessions if s["display_order"] is None], "title"),
        ("No Squarespace Page", [s for s in sessions if not s["page_url"]], "title"),
        ("No RSVP yet", [p for p in speakers if not p["has_rsvp"]], "name"),
        ("No bio", [p for p in speakers if not p["bio"]], "name"),
        ("No headshot in RSVP", [p for p in speakers if not p["has_headshot"]], "name"),
        ("Expert with no country",
         [p for p in speakers if p["role"] == "expert" and not p["country"]], "name"),
        ("No link at all", [p for p in speakers if not p["link"]], "name"),
    ]

    lines = [
        "## Built from Airtable", "",
        f"**{len(speakers)} speakers**, **{len(sessions)} sessions** — "
        + " · ".join(f"Day {d}: {sum(1 for s in sessions if s['day'] == d)}" for d in (1, 2, 3)),
        "", "### Worth a look", "",
    ]
    for label, rows, key in buckets:
        lines.append(f"- {label} ({len(rows)}): {names(rows, key)}")

    shots = headshot_audit(speakers)
    if shots:
        lines += ["", "### Headshots in the repo", ""]
        lines.append(f"- No image file (`{IMAGE_DIR}/<slug>.jpg`) ({len(shots['missing'])}): "
                     + (", ".join(shots["missing"]) or "none"))
        lines.append(f"- Image files matching nobody ({len(shots['orphans'])}): "
                     + (", ".join(shots["orphans"]) or "none"))
        if shots["wrong_type"]:
            lines.append(f"- Wrong file type, will never load ({len(shots['wrong_type'])}): "
                         + ", ".join(shots["wrong_type"]) + " — the renderer only loads `.jpg`")
        if shots["extras"]:
            lines.append(f"- Spare submissions ({len(shots['extras'])}): "
                         + ", ".join(shots["extras"]) + " — harmless, ignored by the page")
        if shots["likely_rename"]:
            lines += [
                "",
                "> **Someone was probably renamed in Airtable.** A speaker with no image "
                "plus an image matching nobody is usually the same person. Check whether "
                "one of the files above is one of the people above, and if so rename the "
                "file to `<new-slug>.jpg`. Until then that card shows initials.",
            ]

    lines += ["", f"### Links adjusted automatically ({len(link_report)})", ""]
    if link_report:
        lines += [f"- **{r['who']}**: `{r['raw']}` → `{r['url']}` ({'; '.join(r['notes'])})"
                  for r in link_report]
    else:
        lines.append("none")
    lines += [
        "",
        "_Adjustments are applied to the published JSON but NOT written back to "
        "Airtable. Fix anything wrong at the source so it stops recurring._",
    ]
    return "\n".join(lines)


def bonus_image_audit(bonuses):
    """Which Product Img files are not in images/bonuses/ yet, and which
    files there no bonus uses. Names must match exactly, capitals included."""
    files = set(x for x in os.listdir(BONUS_IMAGE_DIR) if not x.startswith(".")) \
        if os.path.isdir(BONUS_IMAGE_DIR) else set()
    wanted = {b["image"] for b in bonuses if b["image"]}
    missing = [f"`{b['image']}` ({b['title']})" for b in bonuses if b["image"] and b["image"] not in files]
    orphans = sorted(f"`{x}`" for x in files - wanted)
    return missing, orphans


def bonus_report(bonuses, issues):
    def j(rows):
        return ", ".join(rows) or "none"

    by_cat = {}
    for b in bonuses:
        by_cat[b["category"] or "(no category)"] = by_cat.get(b["category"] or "(no category)", 0) + 1
    lines = [
        "", "## First Class Pass bonuses", "",
        f"**{len(bonuses)} bonuses published** — "
        + (" · ".join(f"{k}: {v}" for k, v in by_cat.items()) or "none yet")
        + f" · Sponsor label: {sum(1 for b in bonuses if b['sponsor'])}",
        "",
        f"_Only records with Product Test Status = {BONUS_APPROVED} are published. "
        "Excluded categories: " + ", ".join(sorted(BONUS_EXCLUDED_CATEGORIES)) + "._",
        "", "### Worth a look", "",
        f"- Approved but no Product name, skipped ({len(issues['no_title'])}): {j(issues['no_title'])}",
        f"- No Category, shown in a section at the end ({len(issues['no_category'])}): {j(issues['no_category'])}",
        f"- No Display ranking, sinks to the bottom ({len(issues['no_rank'])}): {j(issues['no_rank'])}",
        f"- No Brand ({len(issues['no_brand'])}): {j(issues['no_brand'])}",
        f"- No description ({len(issues['no_description'])}): {j(issues['no_description'])}",
        f"- No Product Img in Airtable, shows a name tile ({len(issues['no_image'])}): {j(issues['no_image'])}",
        f"- **Two bonuses share an image filename** — rename one attachment in Airtable before uploading "
        f"({len(issues['shared_image'])}): {j(issues['shared_image'])}",
    ]
    missing, orphans = bonus_image_audit(bonuses)
    lines += ["", "### Bonus images in the repo", "",
              f"- Waiting to be uploaded to `{BONUS_IMAGE_DIR}/` — these show a name tile until then "
              f"({len(missing)}): {j(missing)}",
              f"- Files no bonus uses ({len(orphans)}): {j(orphans)}"]
    if missing and orphans:
        lines += ["", "> **A file name may not match exactly.** Names are case sensitive and must "
                  "match the Airtable attachment, spaces included. Compare the two lists above."]
    return "\n".join(lines)


# ------------------------------------------------------------------- main --

def main():
    token = os.environ.get("AIRTABLE_TOKEN", "").strip()
    if not token:
        raise SystemExit(
            "AIRTABLE_TOKEN is not set. Add it as a repository secret named "
            "AIRTABLE_TOKEN (Settings -> Secrets and variables -> Actions)."
        )

    rows = {k: fetch_table(token, tid) for k, tid in TABLES.items()}
    speakers, sessions, link_report = build(rows["speakers"], rows["rsvp"], rows["topics"])
    bonuses, bonus_issues = build_bonuses(rows["bonuses"])

    if not speakers:
        raise SystemExit(
            "No confirmed speakers came back from Airtable. Refusing to publish an "
            "empty file over the live one. Check that Confirmed '27? is still ticked."
        )

    today = date.today().isoformat()
    generated = "Generated from Airtable by .github/workflows/publish-page-data.yml - do not hand edit, it will be overwritten"

    write_json("speakers.json", {
        "updated": today, "cycle": CYCLE, "region": REGION,
        "_generated_by": generated,
        "_field_notes": {
            "source": "brand and link come from Presenter RSVP when the speaker has submitted one, else Summit Speakers",
            "role": "host | sponsor | expert | speaker - drives directory ordering and the expert label",
            "country": "Destination experts only, from Topic to pitch. Renders as '[country] Expert'.",
            "photo": "Always empty. The renderer looks for images/speakers/{slug}.jpg and falls back to initials.",
            "talk_titles": "Hosts' live calls are omitted; other live-panel speakers show 'Expert Panelist'.",
            "has_headshot": "Whether Presenter RSVP holds an attachment - not whether the repo has the image.",
            "day": "Not stored here - day lives on the session in sessions.json.",
        },
        "speakers": speakers,
    })

    write_json("sessions.json", {
        "updated": today, "cycle": CYCLE,
        "_generated_by": generated,
        "_field_notes": {
            "day": "1, 2 or 3, from the Theme field.",
            "kind": "single | compilation (multi-expert, own sub-section) | live_panel (that day's Zoom call).",
            "display_order": "From 'Display Order for Schedule' in Presentation Topics. Maintained by hand in Airtable and it is the ONLY thing to edit to reorder a day. Blank sinks to the bottom.",
            "detection": "kind comes from the 👥 marker plus a 'Live panel:'/'Live call:' title prefix, never from speaker count - counting breaks on co-presented sessions.",
            "page_url": "Squarespace Page from Airtable. Day-page rows link here as soon as it is filled.",
            "sort_rank": "0 host, 1 sponsor, 2 everyone else. Only a tiebreaker when display_order is blank.",
        },
        "sessions": sessions,
    })

    write_json("bonuses.json", {
        "updated": today, "cycle": CYCLE,
        "_generated_by": generated,
        "_field_notes": {
            "source": f"Contributor Submission records with Product Test Status = {BONUS_APPROVED}, minus the excluded categories.",
            "rank": "Display ranking. Lowest numbers are featured first; blank sinks to the bottom.",
            "category": "Matched against schedule.json -> bonuses.categories for the section headings and order.",
            "sponsor": f"The '{BONUS_SPONSOR_FIELD}' checkbox. Ticked shows a SPONSOR label.",
            "image": f"Filename of the first Product Img attachment. The renderer loads {BONUS_IMAGE_DIR}/<image> and shows a name tile when it is missing.",
            "description_html": "Converted from the rich text field. Links keep their text but not the URL, so buyers are not sent off the checkout page.",
        },
        "bonuses": bonuses,
    })

    summary = report(speakers, sessions, link_report) + "\n" + bonus_report(bonuses, bonus_issues)
    print(summary)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(summary + "\n")


def write_json(path, payload):
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write("\n")


if __name__ == "__main__":
    main()
