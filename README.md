# 🌿 IFS Quizmaster — Active Recall AI Employee

> **An adaptable, test-first AI Employee engineered for cracking the Indian Forest Service (IFS) Mains Examination with Botany and Agriculture Optionals.**

Built around the **Recall Ladder** methodology and the **AI Employee Architecture**: Test first, teach through feedback, escalate difficulty dynamically, and automate long-term retention.

---

## 📝 MCQ Drill (`/mcq`) — all six Mains papers + interview

**Live: https://ifos-mcq-drill.lovable.app** — an offline, spaced-recall MCQ app (source in [`mcq/`](mcq/)) covering General English, General Knowledge, Botany I & II, Agriculture I & II and the Personality Test (555 questions, each with a one-line explanation).

- **Today**: a daily mission of due reviews plus new questions, weighted toward the papers furthest below your targets. Also shows a countdown to 22 Nov 2026 and the pace needed to finish the bank.
- **Practice** by paper, topic or filter (unseen, due, mistakes, flagged). **Mock**: timed, no feedback until you submit, optional −⅓ negative marking.
- **Score**: projected marks per paper group against your targets (default 300 / 300 / 250 / 250 / 250, goal 1250+), plus topic mastery sorted weakest first.
- **Revise**: search the whole bank as read-through notes. **Settings**: targets, daily goal, exam date, progress export and import.

Run `python3 -m http.server 3000` and open `http://localhost:3000/mcq/`. `node tools/build_single.js` makes a one-file copy (`dist/ifos-mcq.html`) for hosting or offline use. To add questions, edit `mcq/banks/*.js`, then run `node tools/validate_banks.js`.

> The projection measures how much of the bank you have retained through spaced recall. Mains answers are descriptive, so pair this with timed answer writing.

---

## 🎯 Architecture: The "AI Employee" Philosophy

An AI Employee is not an ad-hoc chatbot prompt. It is a persistent, goal-oriented digital coworker configured with:
1. **Specific Role & Standard Operating Procedures (SOPs):**
   - Strictly enforces the 4-level Recall Ladder.
   - Never dumps lectures by default (notes come only as 5-minute minimum viable primers).
   - Enforces the **70% Mastery Rule** (blocks premature descriptive essay practice if recognition accuracy is under 70%).
2. **Dynamic Adaptability:**
   - **Exam Target & Pacing:** Custom countdown to IFS Mains (e.g., 3-month sprint, 5-month standard, or 12-month full cycle).
   - **Daily Session Lengths:** 20-min rapid sprint, 45-min standard ladder, or 60-min deep dive.
   - **Preparation Level Calibration:** Adapts feedback for Beginner, Intermediate, and Advanced aspirants.
   - **AI Backend Flexibility:** Runs 100% offline with the built-in IFS Heuristic Knowledge Engine, OR connects directly to custom LLM providers (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, Google Gemini, or Groq Llama 3.3).
   - **Custom Topic Ingestion:** Aspirants can type or paste custom syllabus notes to generate full 4-stage active recall ladders instantly.
3. **Spaced Repetition & Context-Switching Memory:**
   - Simulates Anki's SM-2 spaced repetition algorithm.
   - Tracks missed items in an active **Review Queue** with daily due alerts.
   - **Interleaved Review:** Randomly mixes Botany and Agriculture cards to train rapid cognitive switching demanded in the real UPSC/IFS examination hall.
   - **Anki Deck Exporter:** One-click copy or `.txt` download formatted with Cloze deletions (`{{c1::term}}`) and basic cards.

---

## 🪜 The Core Methodology: The Recall Ladder

Every topic is conquered across four escalating levels of cognitive retrieval:

```
[LEVEL 4] ELABORATE ➔ Full Mains Descriptive Practice (15M, Diagram Checklist, 6-Dimension Rubric)
    ▲
[LEVEL 3] EXPLAIN   ➔ Short Answer Questions (2-8M, 30-100 words, Scoring Keywords Check)
    ▲
[LEVEL 2] RECALL    ➔ Cloze Deletions (Exact binomials/enzymes) & 3D Flashcards (AGAIN/HARD/GOOD/EASY)
    ▲
[LEVEL 1] RECOGNIZE ➔ MCQs One at a Time (Plausible distractors, Rationale, Active Recall Memory Hooks)
```

---

## 💻 Supported Commands

Type any of the following commands in the prompt bar:

| Command | Action |
|---|---|
| `Session: [topic]` | Launches the full Recall Ladder (Primer ➔ MCQ ➔ Cloze ➔ Flash ➔ SAQ ➔ Mains) |
| `Quiz: [topic], [n]` | Runs an MCQ recognition sprint |
| `Cloze: [topic]` | Drills fill-in-the-blank cards on Latin names, numbers, and enzymes |
| `Flash: [topic]` | Launches 3D flashcards with Anki rating intervals |
| `SAQ: [topic]` | Short answer drill with NLP keyword detection & gap analysis |
| `Mains: [topic]` | 15-mark UPSC IFS question with timer, diagram guidelines & model answer |
| `Link: [topic]` | Synthesizes Botany physiological concepts with Agriculture agronomic practices |
| `Mnemonic: [topic]` | High-yield memory anchors for complex pathways and classifications |
| `Review` | Clears today's due cards in the Spaced Repetition deck |
| `Report` | Opens the telemetry dashboard showing mastery, accuracy, and weak topics |
| `Plan` | Generates a time-table based on your months left and daily study hours |
| `Anki export: [topic]`| Formats cards for direct import into Anki desktop/mobile |

---

## 📚 Knowledge Base Coverage

### Botany
- **Paper I:** Microbiology (TMV, Viruses), Plant Pathology (*Xanthomonas citri*, *Puccinia graminis*, *Ustilago tritici*), Cryptogams & Pteridophyte Stelar Evolution, Phanerogams & Gymnosperms, Plant Anatomy & Anomalous Secondary Growth (*Dracaena*, *Boerhavia*, *Bignonia*), Embryology & Endosperm Types, Genetics & Cell Biology.
- **Paper II:** Plant Physiology (C3 vs C4 vs CAM Photosynthesis, Photorespiration), Phytohormones & Stress Physiology (Auxin, Cytokinin, ABA, Ethylene), Plant Ecology & Forest Types of India, Economic Botany, Biotechnology.

### Agriculture
- **Paper I:** Soil Science, Cation Exchange Capacity (CEC), Problem Soils (Saline/Sodic/Acid), Integrated Nutrient Management (INM), Cropping Systems & Dryland Farming, Integrated Weed Management (IWM) & Herbicide Resistance (*Phalaris minor*), Irrigation & Water Use Efficiency, Farm Economics & Policy.
- **Paper II:** Plant Breeding & Heterosis, Seed Technology & Classes (Breeder, Foundation, Certified), Tetrazolium Viability Testing, Seed Dormancy & Harrington's Laws, Integrated Pest Management (IPM), Biological Control (*Trichogramma*, *Chrysoperla*, HaNPV), Economic Injury Levels (EIL/ETL), Horticulture & Post-Harvest.

---

## 🚀 Getting Started

### Local Testing
```bash
# Clone the repository
git clone https://github.com/akshaywagh1998/Alone.git
cd Alone

# Start a local HTTP server
python3 -m http.server 3000 --bind 0.0.0.0
# Open your browser at http://localhost:3000
```

### Vercel Deployment
The repository is pre-configured with `vercel.json`:
1. Push to GitHub.
2. Import project in Vercel.
3. Automatically deploys as a static, blazing-fast web application.

---

## 🛡️ Privacy & Local Persistence
- All study telemetry, review decks, accuracy metrics, and custom API keys are preserved securely in your browser's `localStorage`.
- You can backup your state at any time via **Mastery Dashboard ➔ Backup State (.json)**.
