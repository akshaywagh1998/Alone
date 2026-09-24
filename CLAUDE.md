# Context summary (read this first; skip the long legacy docs)

Goal: IFoS Mains, 22 Nov 2026 — Botany + Agriculture optionals. Targets: optionals 600/800, GK + English 500/600, interview 250/300; overall goal 1250+.

## What is where
- `mcq/` — **main tool**: offline MCQ drill for all 6 papers + interview (4,375 Qs). No build, no deps. Tabs: Today, Practice, Mock, PYQ, Score, Revise, Setup.
  - `mcq/mcq.js` engine: Leitner spaced repetition (boxes 1–6, intervals 1/3/7/14/25/40 d), daily mission (≤60% due reviews + new picked by target gap), practice, timed mock (optional −⅓), score projection, revise/search, export/import.
  - `mcq/banks/*.js` question banks, one per paper: `english` EN, `gk` GK, `botany1` B1, `botany2` B2, `agri1` A1, `agri2` A2, `interview` PT.
  - Progress: `localStorage["ifosmcq_v1"]` in the browser only (backup via Settings → Export).
- `index.html` + `app.js` + `data/ifs_knowledge_base.json` — older "Recall Ladder" app (17 MCQs, cloze, SAQ). Links to `mcq/`.
- `upsc_coaching_portal*.html`, `syllabus_data.json`, `*.txt`, `PORTAL_USAGE_GUIDE.md`, `README_TECHNICAL.md` — legacy CSE-GS portal; not needed for MCQ work.

## PYQ coverage (goal: 10 MCQs per PYQ, CSE + IFoS)
- Registry `mcq/pyq/registry.js`: `[id, marks, text, kind]`, id `EXAM-YEAR-PAPER-Qno` (e.g. `IFoS-2018-B1-Q2a`); kind `v` verbatim, `t` topic-only.
- Link MCQs by adding `pyq: '<id>'` to a bank block (10 rows per block). Files: `mcq/banks/pyq_<exam><year>_<paper>_s<section>.js`; add each to `mcq/index.html` (validator errors if missing).
- Registered 382: CSE 2026 A1/A2 (56, verbatim, from Agri booklets §14) · IFoS 2017+2018 B1/B2/A1/A2 (229, verbatim OCR; 2017 A1 lacks Q8) · IFoS 2025 B1/B2/A1/A2 (97, topic-only from volume "PYQ anchors").
- **Done: all 382 registered PYQs have 10 MCQs each (3,820 PYQ MCQs)** — CSE 2026 A1/A2, IFoS 2025/2018/2017 B1/B2/A1/A2. Files `mcq/banks/pyq_<exam><year>_<paper>[_s1|_s2].js`. Next: register more years (IFoS 2016, 2019–24; CSE optionals) as sources become readable, then add banks.
- Sources: Drive "0X_*_Comprehensive.pdf" volumes (text export ≈ 220k chars; most official-paper pages are scanned images, only 2017–18 extract as text); Drive download cap 10 MB blocks OCR of the 36–40 MB volumes; upsc.gov.in is blocked by this environment's network policy (user can allow it).

## Adding questions
Row format: `['Question', ['correct', 'wrong', 'wrong', 'wrong'], 0, 'Explanation']`. Put the correct option first; options are shuffled on screen.
Statement-code options ("1 only", "Both 1 and 2", "A-2, B-1…") keep their order — vary the answer index for those.
Question ID = hash of stem + options, so editing text resets that question's progress. Topic weight `w` = PYQ weightage 1–3.
Always run `node tools/validate_banks.js` (schema, duplicates, answer range). Mark time-sensitive facts in explanations.

## Run
`python3 -m http.server 3000` → open `/mcq/` (opening `mcq/index.html` straight from disk also works). Vercel config serves `/mcq` (not deployed).

## Hosting (live)
- **https://ifos-mcq-drill.lovable.app** — Lovable project "Forest Service Prep", id `a4b622b4-c5bf-4cc0-bfc4-b69a9580b7dd`, workspace `6K7zDgomriMOnqNyT8Zy`. `/` redirects to `/app.html` (the single-file build).
- Mission mix: new questions are split by paper need (target gap), normalised by bank size (`buildMission` wsum), so big optional banks don't starve GK/EN.
- Update (≈0.4 credits): `node tools/build_single.js` → Lovable `get_file_upload_url` → PUT `dist/ifos-mcq.html` with the returned headers → `send_message`: "copy the attached file byte-for-byte to public/app.html; change nothing else" → `deploy_project`.
- This sandbox cannot reach `*.lovable.app` (proxy 403); check with `get_project` (screenshot) instead.
- Progress is per site: the Lovable URL and a local copy keep separate progress — move it with Settings → Export/Import.

## Log (one line per session)
- 2026-09-24: built `mcq/` app + 555 questions (EN 87, GK 59, B1 105, B2 97, A1 90, A2 69, PT 48) + validator; old app's reset now keeps MCQ progress.
- 2026-09-24: published to Lovable (single-file build via `tools/build_single.js`); ChatGPT hosting not available from this environment.
- 2026-09-24: Vercel fix (`public` key removed from vercel.json; /mcq → /mcq/ redirect) — connector lacks deploy rights, user must merge to main. Added PYQ registry (382) + PYQ tab + validator coverage; CSE 2026 Agri I & II fully covered (560 MCQs).
- 2026-09-24: IFoS 2025 all four optional papers covered (970 MCQs) → 153/382 PYQs, 2,085 Qs total; republished to Lovable.
- 2026-09-24: IFoS 2018 (117 PYQs) + 2017 (112) covered → 382/382 PYQs, 4,375 Qs; fixed mission sampling so GK/EN keep their share; republished to Lovable.
