# Context summary (read this first; skip the long legacy docs)

Goal: IFoS Mains, 22 Nov 2026 — Botany + Agriculture optionals. Targets: optionals 600/800, GK + English 500/600, interview 250/300; overall goal 1250+.

## What is where
- `mcq/` — **main tool**: offline MCQ drill for all 6 papers + interview. No build, no deps.
  - `mcq/mcq.js` engine: Leitner spaced repetition (boxes 1–6, intervals 1/3/7/14/25/40 d), daily mission (≤60% due reviews + new picked by target gap), practice, timed mock (optional −⅓), score projection, revise/search, export/import.
  - `mcq/banks/*.js` question banks, one per paper: `english` EN, `gk` GK, `botany1` B1, `botany2` B2, `agri1` A1, `agri2` A2, `interview` PT.
  - Progress: `localStorage["ifosmcq_v1"]` in the browser only (backup via Settings → Export).
- `index.html` + `app.js` + `data/ifs_knowledge_base.json` — older "Recall Ladder" app (17 MCQs, cloze, SAQ). Links to `mcq/`.
- `upsc_coaching_portal*.html`, `syllabus_data.json`, `*.txt`, `PORTAL_USAGE_GUIDE.md`, `README_TECHNICAL.md` — legacy CSE-GS portal; not needed for MCQ work.

## Adding questions
Row format: `['Question', ['correct', 'wrong', 'wrong', 'wrong'], 0, 'Explanation']`. Put the correct option first; options are shuffled on screen.
Statement-code options ("1 only", "Both 1 and 2", "A-2, B-1…") keep their order — vary the answer index for those.
Question ID = hash of stem + options, so editing text resets that question's progress. Topic weight `w` = PYQ weightage 1–3.
Always run `node tools/validate_banks.js` (schema, duplicates, answer range). Mark time-sensitive facts in explanations.

## Run
`python3 -m http.server 3000` → open `/mcq/` (opening `mcq/index.html` straight from disk also works). Vercel config serves `/mcq` (not deployed).

## Hosting (live)
- **https://ifos-mcq-drill.lovable.app** — Lovable project "Forest Service Prep", id `a4b622b4-c5bf-4cc0-bfc4-b69a9580b7dd`, workspace `6K7zDgomriMOnqNyT8Zy`. `/` redirects to `/app.html` (the single-file build).
- Update (≈0.4 credits): `node tools/build_single.js` → Lovable `get_file_upload_url` → PUT `dist/ifos-mcq.html` with the returned headers → `send_message`: "copy the attached file byte-for-byte to public/app.html; change nothing else" → `deploy_project`.
- This sandbox cannot reach `*.lovable.app` (proxy 403); check with `get_project` (screenshot) instead.
- Progress is per site: the Lovable URL and a local copy keep separate progress — move it with Settings → Export/Import.

## Log (one line per session)
- 2026-09-24: built `mcq/` app + 555 questions (EN 87, GK 59, B1 105, B2 97, A1 90, A2 69, PT 48) + validator; old app's reset now keeps MCQ progress.
- 2026-09-24: published to Lovable (single-file build via `tools/build_single.js`); ChatGPT hosting not available from this environment.
