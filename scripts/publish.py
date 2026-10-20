#!/usr/bin/env python3
"""Build speakers.json and sessions.json from Airtable.

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
}

CYCLE = "2027"
REGION = "Asia"

# Michelle and Jedd. Their own live calls are left off their talk lists.
HOSTS = {"recs6qFPPvjw2cINp", "recjZz5yacXn1lxss"}

DAY_FROM_THEME = {"Dream (Day 1)": 1, "Plan (Day 2)": 2, "Go (Day 3)": 3}
ROLE_RANK = {"host": 0, "sponsor": 1, "expert": 2, "speaker": 2}
KIND_RANK = {"single": 0, "compilation": 1, "live_panel": 2}

GROUP_MARKER = "\U0001F465"  # the 👥 that marks a multi-speaker session


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
    """The 👥 marker decides this, never the number of speakers - counting
    breaks on co-presented sessions like Slow Travel."""
    raw = str(raw_title or "")
    clean = clean_title(raw).lower()
    if GROUP_MARKER in raw and re.match(r"^live (panel|call):", clean):
        return "live_panel"
    if GROUP_MARKER in raw:
        return "compilation"
    return "single"


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


# ---------------------------------------------------------------- reports --

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
            "display_order": "Display Order for Schedule from Airtable. This is the real on-page order.",
            "page_url": "Squarespace Page from Airtable. Day-page rows link here as soon as it is filled.",
            "sort_rank": "0 host, 1 sponsor, 2 everyone else. Only a tiebreaker when display_order is blank.",
        },
        "sessions": sessions,
    })

    summary = report(speakers, sessions, link_report)
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
