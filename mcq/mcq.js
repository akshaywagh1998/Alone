/* IFoS MCQ Drill — offline engine.
 * Question banks in banks/*.js push {p, t, w, q:[[question, options, answerIndex, explanation], ...]}
 * into window.IFOS_BANK. Progress lives in localStorage under KEY (export/import in Settings). */
(() => {
  'use strict';

  const KEY = 'ifosmcq_v1';
  const DAY = 86400000;
  const PAPERS = {
    EN: { name: 'General English', g: 'EN', max: 300 },
    GK: { name: 'General Knowledge', g: 'GK', max: 300 },
    B1: { name: 'Botany Paper I', g: 'BOT', max: 200 },
    B2: { name: 'Botany Paper II', g: 'BOT', max: 200 },
    A1: { name: 'Agriculture Paper I', g: 'AGR', max: 200 },
    A2: { name: 'Agriculture Paper II', g: 'AGR', max: 200 },
    PT: { name: 'Interview (Personality Test)', g: 'PT', max: 300 },
  };
  const GROUPS = {
    BOT: { name: 'Botany (III + IV)', max: 400 },
    AGR: { name: 'Agriculture (V + VI)', max: 400 },
    GK: { name: 'General Knowledge', max: 300 },
    EN: { name: 'General English', max: 300 },
    PT: { name: 'Personality Test', max: 300 },
  };
  const DEFAULTS = {
    exam: '2026-11-22', daily: 50, goal: 1250, neg: false, spq: 60, theme: '',
    targets: { BOT: 300, AGR: 300, GK: 250, EN: 250, PT: 250 },
  };
  const IV = [0, 1, 3, 7, 14, 25, 40];               // Leitner box -> days to next review
  const MASTERY = [0, 0.15, 0.45, 0.65, 0.8, 0.92, 1]; // Leitner box -> recall confidence
  // Options like "1 and 3 only", "Both A and R ..." must keep their printed order.
  const FIXED = /^(\d( only|,? and \d)|\d, \d|both (\d|a and r)|neither \d|a is (true|false)|[a-d]\s*[-–]\s*\d|(all|none) of the above)/i;

  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => esc(s).replace(/\*([^*\n]+)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
  const pct = (x) => Math.round(x * 100) + '%';
  const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / DAY);
  const dayOf = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) / DAY; };
  const dateOf = (n) => new Date(n * DAY).toISOString().slice(0, 10);
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };
  const L = 'ABCDEFGH';

  /* ---------- PYQ registry (pyq/registry.js): [id, marks, text, kind] ---------- */
  const PYQ = {}, PYQ_LIST = [];
  (window.IFOS_PYQ || []).forEach(([id, m, text, kind]) => {
    const [exam, year, paper, qno] = id.split('-');
    const x = { id, exam, year: +year, paper, qno: qno.replace(/^Q(\d)([a-e])$/, 'Q$1($2)'), m, text, kind, ids: [] };
    PYQ[id] = x; PYQ_LIST.push(x);
  });
  const PYQ_TARGET = 10; // MCQs wanted per PYQ
  const pyqLabel = (x) => `${x.exam} ${x.year} · ${PAPERS[x.paper] ? PAPERS[x.paper].name : x.paper} · ${x.qno}${x.m ? ` · ${x.m} m` : ''}`;

  /* ---------- question bank ---------- */
  const Q = [], BY = {}, TOPICS = [], TOPIC_BY = {};
  (window.IFOS_BANK || []).forEach((b) => {
    if (!PAPERS[b.p]) return;
    const key = b.p + ':' + b.t;
    let topic = TOPIC_BY[key];
    if (!topic) { topic = TOPIC_BY[key] = { key, p: b.p, t: b.t, w: b.w || 2, ids: [] }; TOPICS.push(topic); }
    const pyq = b.pyq && PYQ[b.pyq] ? PYQ[b.pyq] : null;
    b.q.forEach((r) => {
      const id = b.p + '-' + hash(r[0] + '|' + r[1].join('|')); // stem + options: stable while the text is unchanged
      if (BY[id]) return;
      const q = { id, p: b.p, topic, q: r[0], o: r[1], a: r[2], e: r[3] || '', fixed: r[1].some((o) => FIXED.test(o)), pyq };
      Q.push(q); BY[id] = q; topic.ids.push(id);
      if (pyq) pyq.ids.push(id);
    });
  });

  /* ---------- state ---------- */
  let volatile = false;
  function hydrate(raw) {
    const s = raw && typeof raw === 'object' ? raw : {};
    const set = Object.assign({}, DEFAULTS, s.set);
    set.targets = Object.assign({}, DEFAULTS.targets, s.set && s.set.targets);
    return { v: 1, set, q: s.q || {}, days: s.days || {}, mocks: s.mocks || [] };
  }
  function load() { try { return hydrate(JSON.parse(localStorage.getItem(KEY))); } catch (e) { volatile = true; return hydrate(null); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { volatile = true; } }
  let S = load();

  // Record per question: [box, dueDay, seen, right, lastDay, flagged]
  function grade(id, ok) {
    const t = today();
    const r = S.q[id] || (S.q[id] = [0, 0, 0, 0, 0, 0]);
    const sameDay = r[2] > 0 && r[4] === t; // a second correct answer today is not spaced recall
    if (!ok) r[0] = 1; else if (!sameDay) r[0] = r[0] === 0 ? 2 : Math.min(6, r[0] + 1);
    r[1] = t + IV[r[0]];
    r[2]++; if (ok) r[3]++; r[4] = t;
    const d = S.days[t] || (S.days[t] = [0, 0]); d[0]++; if (ok) d[1]++;
    save();
  }
  function toggleFlag(id) {
    const r = S.q[id] || (S.q[id] = [0, 0, 0, 0, 0, 0]);
    r[5] = r[5] ? 0 : 1; save(); return r[5];
  }
  const rec = (id) => S.q[id];
  const isSeen = (id) => !!(S.q[id] && S.q[id][0]);
  const isDue = (id, t = today()) => isSeen(id) && S.q[id][1] <= t;
  const isWeak = (id) => isSeen(id) && S.q[id][0] === 1;
  const isFlag = (id) => !!(S.q[id] && S.q[id][5]);

  function mastery(id, t = today()) {
    const r = S.q[id]; if (!r || !r[0]) return 0;
    const m = MASTERY[r[0]];
    return t > r[1] + IV[r[0]] ? m * 0.8 : m; // long overdue: assume some forgetting
  }
  const topicMastery = (tp) => (tp.ids.length ? tp.ids.reduce((s, id) => s + mastery(id), 0) / tp.ids.length : 0);
  function readiness(p) {
    let w = 0, s = 0;
    TOPICS.forEach((tp) => { if (tp.p === p && tp.ids.length) { w += tp.w; s += tp.w * topicMastery(tp); } });
    return w ? s / w : 0;
  }
  const papersOf = (g) => Object.keys(PAPERS).filter((p) => PAPERS[p].g === g);
  const projected = (g) => papersOf(g).reduce((s, p) => s + readiness(p) * PAPERS[p].max, 0);
  const projectedTotal = () => Object.keys(GROUPS).reduce((s, g) => s + projected(g), 0);
  const targetTotal = () => Object.keys(GROUPS).reduce((s, g) => s + (+S.set.targets[g] || 0), 0);
  const daysLeft = () => dayOf(S.set.exam) - today();
  const doneToday = () => (S.days[today()] || [0, 0])[0];

  function streak() {
    let t = today(), n = 0;
    if (!S.days[t]) t--; // today not started yet does not break the streak
    while (S.days[t] && S.days[t][0] > 0) { n++; t--; }
    return n;
  }

  /* ---------- selection ---------- */
  // Weighted sampling without replacement (Efraimidis–Spirakis).
  function sample(items, k, weight) {
    return items.map((x) => [Math.pow(Math.random(), 1 / Math.max(1e-6, weight(x))), x])
      .sort((a, b) => b[0] - a[0]).slice(0, k).map((e) => e[1]);
  }
  // Papers furthest below their target share get more new questions.
  function paperNeed(p) {
    const g = PAPERS[p].g;
    const share = Math.min(1, (+S.set.targets[g] || 0) / GROUPS[g].max);
    const need = PAPERS[p].max * Math.max(0.05, share - readiness(p));
    return g === 'PT' && daysLeft() > 0 ? need * 0.3 : need; // interview comes months after Mains
  }
  function buildMission(extra) {
    const t = today();
    const n = extra ? S.set.daily : Math.max(0, S.set.daily - doneToday());
    if (!n) return [];
    const need = {}; Object.keys(PAPERS).forEach((p) => { need[p] = paperNeed(p); });
    const unseen = Q.filter((q) => !isSeen(q.id));
    const due = Q.filter((q) => isDue(q.id, t)).sort((a, b) => rec(a.id)[0] - rec(b.id)[0] || rec(a.id)[1] - rec(b.id)[1]);
    const reviews = due.slice(0, unseen.length ? Math.ceil(n * 0.6) : n);
    let picks = reviews.concat(sample(unseen, n - reviews.length, (q) => need[q.p] * q.topic.w));
    if (picks.length < n) {
      const chosen = new Set(picks.map((q) => q.id));
      const rest = Q.filter((q) => !chosen.has(q.id)).sort((a, b) => mastery(a.id) - mastery(b.id));
      picks = picks.concat(rest.slice(0, n - picks.length));
    }
    return shuffle(picks.map((q) => q.id));
  }
  function missionPreview() {
    const t = today(), n = Math.max(0, S.set.daily - doneToday());
    const due = Q.filter((q) => isDue(q.id, t)).length;
    const unseen = Q.filter((q) => !isSeen(q.id)).length;
    const r = Math.min(due, unseen ? Math.ceil(n * 0.6) : n);
    return { n, due, reviews: r, fresh: Math.min(unseen, n - r), unseen };
  }
  function weakestTopic() {
    const scored = TOPICS.filter((t) => t.ids.length).map((t) => [t, (1 - topicMastery(t)) * t.w * paperNeed(t.p)]);
    scored.sort((a, b) => b[1] - a[1]);
    return scored.length ? scored[0][0] : null;
  }
  function pool({ papers, topics, filter }) {
    const t = today();
    return Q.filter((q) => (!papers.length || papers.includes(q.p)) && (!topics.length || topics.includes(q.topic.key)))
      .filter((q) => filter === 'new' ? !isSeen(q.id) : filter === 'due' ? isDue(q.id, t) : filter === 'weak' ? isWeak(q.id)
        : filter === 'flag' ? isFlag(q.id) : true);
  }

  /* ---------- rendering shell ---------- */
  const view = () => $('#view');
  let timer = null;
  function route() { return (location.hash || '#today').slice(1).split('?')[0]; }
  function go(r) { if (location.hash === '#' + r) render(); else location.hash = '#' + r; }
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2400);
  }
  function header() {
    const dl = daysLeft();
    $('#hdrCount').textContent = dl > 0 ? dl + ' days to Mains' : dl === 0 ? 'Mains today' : 'Exam date passed';
    document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.v === route()));
  }
  function render() {
    if (timer && route() !== 'exam') { clearInterval(timer); timer = null; }
    const r = route();
    const fn = { today: viewToday, practice: viewPractice, mock: viewMock, pyq: viewPyq, stats: viewStats, bank: viewBank, settings: viewSettings, quiz: viewQuiz, exam: viewExam }[r] || viewToday;
    view().innerHTML = fn();
    header();
    if (r === 'exam' && M && !M.done) startTimer();
    const f = view().querySelector('[data-focus]'); if (f) f.focus({ preventScroll: true });
  }
  const bar = (v, mark) => `<div class="meter"><span style="width:${Math.min(100, v * 100).toFixed(1)}%"></span>${mark != null ? `<i style="left:${Math.min(100, mark * 100).toFixed(1)}%"></i>` : ''}</div>`;
  const chip = (q) => `<span class="chip">${esc(q.p)} · ${esc(q.topic.t)}</span>`;
  const pyqRef = (q) => q.pyq ? `<div class="pyqref"><b>PYQ</b> ${esc(pyqLabel(q.pyq))}${q.pyq.kind === 't' ? ' (topic)' : ''}<br>${fmt(q.pyq.text)}</div>` : '';

  /* ---------- Today ---------- */
  function viewToday() {
    const mp = missionPreview(), dl = daysLeft(), tot = projectedTotal(), goal = +S.set.goal || 0;
    const firstPass = Math.max(1, dl - 10);
    const perDay = Math.ceil(mp.unseen / firstPass);
    const done = doneToday(), wt = weakestTopic();
    const rows = Object.keys(GROUPS).map((g) => {
      const pr = projected(g), tg = +S.set.targets[g] || 0, mx = GROUPS[g].max;
      return `<div class="grow"><div class="gl"><b>${esc(GROUPS[g].name)}</b><span>${Math.round(pr)} / ${tg} target</span></div>${bar(pr / mx, tg / mx)}</div>`;
    }).join('');
    return `
      <section class="hero card">
        <div class="hero-num"><span class="big">${Math.round(tot)}</span><span class="of">/ 1700 projected</span></div>
        <div class="hero-sub">Goal <b>${goal}+</b> · targets add up to <b>${targetTotal()}</b> · ${dl > 0 ? `<b>${dl}</b> days left` : 'exam day reached'} · 🔥 ${streak()}-day streak</div>
        ${bar(tot / 1700, goal / 1700)}
        <p class="note">Projection = how much of this bank you have mastered with spaced recall, scaled to each paper's marks. It measures knowledge only — answer-writing practice converts it into marks.</p>
      </section>
      <section class="card">
        <h2>Today's mission</h2>
        ${mp.n ? `<p><b>${mp.n}</b> questions left today: <b>${mp.reviews}</b> spaced reviews (${mp.due} due) + <b>${mp.fresh}</b> new, weighted toward your biggest target gaps.</p>
          <button class="btn primary" data-act="mission" data-focus>Start mission ▶</button>`
        : `<p>✅ Daily goal of ${S.set.daily} done (${done} answered today).</p><button class="btn primary" data-act="mission-extra" data-focus>Another ${S.set.daily} ▶</button>`}
        <div class="progress-line">${bar(Math.min(1, done / S.set.daily))}<span>${done}/${S.set.daily} today</span></div>
        <p class="note">Pace: ${mp.unseen} of ${Q.length} questions still unseen → about <b>${perDay}</b> new per day finishes the first pass 10 days before the exam, leaving those days for revision.</p>
      </section>
      <section class="card">
        <h2>Target gap</h2>
        ${rows}
        <p class="note">Bar = projected; tick = your target. Set targets in Settings.</p>
      </section>
      <section class="card quick">
        <h2>Quick drills</h2>
        <div class="btns">
          ${wt ? `<button class="btn" data-act="topic" data-k="${esc(wt.key)}">🎯 Weakest: ${esc(wt.p)} · ${esc(wt.t)}</button>` : ''}
          <button class="btn" data-act="quick" data-f="due">🔁 All due reviews (${mp.due})</button>
          <button class="btn" data-act="quick" data-f="weak">❌ Recent mistakes (${Q.filter((q) => isWeak(q.id)).length})</button>
          <button class="btn" data-act="quick" data-f="flag">🚩 Flagged (${Q.filter((q) => isFlag(q.id)).length})</button>
          <button class="btn" data-act="go" data-r="mock">⏱ Timed mock</button>
        </div>
      </section>
      ${volatile ? '<p class="warn">Browser storage is blocked here, so progress will be lost on reload. Use Settings → Export after each session.</p>' : ''}`;
  }

  /* ---------- Practice ---------- */
  const P = { papers: [], topics: [], filter: 'all', count: 20 };
  function viewPractice() {
    const pc = Object.keys(PAPERS).map((p) => {
      const n = Q.filter((q) => q.p === p).length;
      return `<button class="pill ${P.papers.includes(p) ? 'on' : ''}" data-act="p-paper" data-p="${p}">${esc(PAPERS[p].name)} <small>${n}</small></button>`;
    }).join('');
    const tps = TOPICS.filter((t) => t.ids.length && (!P.papers.length || P.papers.includes(t.p))).map((t) => {
      const seen = t.ids.filter(isSeen).length;
      return `<label class="topic"><input type="checkbox" data-act="p-topic" value="${esc(t.key)}" ${P.topics.includes(t.key) ? 'checked' : ''}>
        <span class="tn">${esc(t.p)} · ${esc(t.t)}</span><span class="tm">${seen}/${t.ids.length} seen · ${pct(topicMastery(t))}</span></label>`;
    }).join('');
    const filters = [['all', 'All'], ['new', 'Unseen'], ['due', 'Due'], ['weak', 'Mistakes'], ['flag', 'Flagged']]
      .map(([k, l]) => `<button class="pill ${P.filter === k ? 'on' : ''}" data-act="p-filter" data-f="${k}">${l}</button>`).join('');
    const counts = [10, 20, 30, 50, 0].map((c) => `<button class="pill ${P.count === c ? 'on' : ''}" data-act="p-count" data-c="${c}">${c || 'All'}</button>`).join('');
    const avail = pool(P).length;
    return `
      <section class="card">
        <h2>Practice</h2>
        <p class="note">Instant feedback after each answer. Wrong answers come back once at the end of the set and again tomorrow.</p>
        <h3>Papers <small>(none selected = all)</small></h3><div class="pills">${pc}</div>
        <h3>Show</h3><div class="pills">${filters}</div>
        <h3>How many</h3><div class="pills">${counts}</div>
        <button class="btn primary" data-act="p-start" ${avail ? '' : 'disabled'}>Start ${P.count ? Math.min(P.count, avail) : avail} questions ▶</button>
        <span class="note"> ${avail} match</span>
      </section>
      <section class="card">
        <h3>Topics <small>(none ticked = all) · ${P.topics.length ? `<a href="#" data-act="p-clear">clear</a>` : ''}</small></h3>
        <div class="topics">${tps || '<p class="note">No topics.</p>'}</div>
      </section>`;
  }

  /* ---------- Quiz runner (practice / mission) ---------- */
  let R = null;
  function startRun(title, ids, ret) {
    if (!ids.length) { toast('No questions match that selection.'); return; }
    R = { title, ids: ids.slice(), retry: {}, i: 0, ans: {}, perm: {}, start: Date.now(), ret: ret || 'today', requeued: new Set() };
    go('quiz');
  }
  function permFor(q, i, store) {
    if (!store[i]) { const idx = q.o.map((_, k) => k); store[i] = q.fixed ? idx : shuffle(idx); }
    return store[i];
  }
  function viewQuiz() {
    if (!R) return viewToday();
    if (R.i >= R.ids.length) return viewSummary();
    const q = BY[R.ids[R.i]], perm = permFor(q, R.i, R.perm), a = R.ans[R.i];
    const opts = perm.map((orig, k) => {
      let cls = '';
      if (a) cls = orig === q.a ? 'ok' : orig === a.pick ? 'bad' : 'dim';
      return `<button class="opt ${cls}" data-act="pick" data-k="${k}" ${a ? 'disabled' : ''}><span class="k">${L[k]}</span><span>${fmt(q.o[orig])}</span></button>`;
    }).join('');
    const first = Object.keys(R.ans).filter((i) => !R.retry[i]);
    const right = first.filter((i) => R.ans[i].ok).length;
    return `
      <section class="card quiz">
        <div class="qhead"><span>${esc(R.title)} · ${R.i + 1}/${R.ids.length}${R.retry[R.i] ? ' · <b>retry</b>' : ''}</span>
          <span>${right}/${first.length} ✓</span></div>
        ${bar(R.i / R.ids.length)}
        <div class="qmeta">${chip(q)}<button class="icon flag ${isFlag(q.id) ? 'on' : ''}" data-act="flag" title="Flag for revision (F)">🚩</button></div>
        <div class="qtext">${fmt(q.q)}</div>
        <div class="opts">${opts}</div>
        ${a ? `<div class="expl ${a.ok ? 'ok' : 'bad'}"><b>${a.ok ? '✓ Correct' : '✗ Answer: ' + L[perm.indexOf(q.a)]}</b> ${fmt(q.e)}</div>${pyqRef(q)}
          <div class="row"><button class="btn primary" data-act="next" data-focus>${R.i + 1 < R.ids.length ? 'Next ▶' : 'Finish'}</button>
          <button class="btn ghost" data-act="end">End set</button></div>`
        : `<div class="row"><span class="note">Keys: 1–4 or A–D to answer · Enter for next · F to flag</span><button class="btn ghost" data-act="end">End set</button></div>`}
      </section>`;
  }
  function pick(k) {
    if (!R || R.ans[R.i]) return;
    const q = BY[R.ids[R.i]], orig = R.perm[R.i][k];
    if (orig == null) return;
    const ok = orig === q.a;
    R.ans[R.i] = { pick: orig, ok };
    if (!R.retry[R.i]) {
      grade(q.id, ok);
      if (!ok && !R.requeued.has(q.id)) { R.requeued.add(q.id); R.retry[R.ids.length] = true; R.ids.push(q.id); }
    }
    render();
  }
  function viewSummary() {
    const first = Object.keys(R.ans).filter((i) => !R.retry[i]);
    const right = first.filter((i) => R.ans[i].ok).length;
    const secs = Math.round((Date.now() - R.start) / 1000);
    const wrong = [...new Set(first.filter((i) => !R.ans[i].ok).map((i) => R.ids[i]))];
    const list = wrong.map((id) => { const q = BY[id]; return `<li>${chip(q)}<div>${fmt(q.q)}</div><div class="ans">✓ ${fmt(q.o[q.a])}</div><div class="note">${fmt(q.e)}</div></li>`; }).join('');
    return `
      <section class="card">
        <h2>Set complete</h2>
        <div class="hero-num"><span class="big">${first.length ? pct(right / first.length) : '—'}</span><span class="of">${right}/${first.length} first-try correct · ${Math.floor(secs / 60)}m ${secs % 60}s</span></div>
        <p class="note">Projected Mains total is now <b>${Math.round(projectedTotal())}</b>. Missed questions are due again tomorrow.</p>
        <div class="row">${wrong.length ? `<button class="btn primary" data-act="retry-wrong">Retry ${wrong.length} missed</button>` : ''}
          <button class="btn" data-act="go" data-r="${R.ret}">Done</button></div>
      </section>
      ${wrong.length ? `<section class="card"><h2>Revise these</h2><ol class="rev">${list}</ol></section>` : ''}`;
  }

  /* ---------- Mock exam ---------- */
  const MK = { paper: 'ALL', n: 50, neg: null };
  let M = null;
  function viewMock() {
    const neg = MK.neg == null ? S.set.neg : MK.neg;
    const ps = [['ALL', 'All Mains papers (mixed)'], ...Object.keys(PAPERS).map((p) => [p, PAPERS[p].name])]
      .map(([k, l]) => `<button class="pill ${MK.paper === k ? 'on' : ''}" data-act="m-paper" data-p="${k}">${esc(l)}</button>`).join('');
    const ns = [25, 50, 100].map((n) => `<button class="pill ${MK.n === n ? 'on' : ''}" data-act="m-n" data-n="${n}">${n}</button>`).join('');
    const hist = S.mocks.slice(-10).reverse().map((m) => `<tr><td>${dateOf(m.d)}</td><td>${esc(m.p)}</td><td>${m.sc.toFixed(1)}/${m.n}</td><td>${m.c + m.w ? pct(m.c / (m.c + m.w)) : '—'}</td><td>${Math.round(m.secs / 60)}m</td></tr>`).join('');
    return `
      <section class="card">
        <h2>Timed mock</h2>
        <p class="note">No feedback until you submit — trains exam-hall recall under time pressure. ${S.set.spq}s per question (change in Settings).</p>
        <h3>Paper</h3><div class="pills">${ps}</div>
        <h3>Questions</h3><div class="pills">${ns}</div>
        <label class="check"><input type="checkbox" data-act="m-neg" ${neg ? 'checked' : ''}> Negative marking (−⅓ per wrong answer)</label>
        <button class="btn primary" data-act="m-start" data-focus>Start mock ▶</button>
      </section>
      ${hist ? `<section class="card"><h2>Recent mocks</h2><div class="tablewrap"><table><thead><tr><th>Date</th><th>Paper</th><th>Score</th><th>Accuracy</th><th>Time</th></tr></thead><tbody>${hist}</tbody></table></div></section>` : ''}`;
  }
  function startMock() {
    const neg = MK.neg == null ? S.set.neg : MK.neg;
    let ids;
    if (MK.paper === 'ALL') {
      // written papers only, in proportion to their marks, topped up at random
      const written = Object.keys(PAPERS).filter((p) => p !== 'PT');
      const tot = written.reduce((s, p) => s + PAPERS[p].max, 0);
      ids = [];
      written.forEach((p) => { ids = ids.concat(shuffle(Q.filter((q) => q.p === p)).slice(0, Math.round(MK.n * PAPERS[p].max / tot)).map((q) => q.id)); });
      const have = new Set(ids);
      ids = ids.concat(shuffle(Q.filter((q) => q.p !== 'PT' && !have.has(q.id))).slice(0, Math.max(0, MK.n - ids.length)).map((q) => q.id)).slice(0, MK.n);
    } else {
      ids = sample(Q.filter((q) => q.p === MK.paper), MK.n, (q) => q.topic.w).map((q) => q.id);
    }
    if (!ids.length) { toast('No questions for that paper yet.'); return; }
    ids = shuffle(ids);
    M = { ids, perm: {}, pick: {}, mark: {}, i: 0, neg, label: MK.paper === 'ALL' ? 'Mixed' : MK.paper, start: Date.now(), end: Date.now() + ids.length * S.set.spq * 1000, done: false };
    go('exam');
  }
  function startTimer() {
    clearInterval(timer);
    const tick = () => {
      const el = $('#timer'); if (!M || M.done) { clearInterval(timer); timer = null; return; }
      const left = Math.max(0, Math.round((M.end - Date.now()) / 1000));
      if (el) { el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; el.classList.toggle('low', left < 60); }
      if (!left) submitMock(true);
    };
    tick(); timer = setInterval(tick, 1000);
  }
  function viewExam() {
    if (!M) return viewMock();
    if (M.done) return viewMockResult();
    const q = BY[M.ids[M.i]], perm = permFor(q, M.i, M.perm), p = M.pick[M.i];
    const opts = perm.map((orig, k) => `<button class="opt ${p === orig ? 'sel' : ''}" data-act="m-pick" data-k="${k}"><span class="k">${L[k]}</span><span>${fmt(q.o[orig])}</span></button>`).join('');
    const pal = M.ids.map((_, i) => `<button class="cell ${M.pick[i] != null ? 'done' : ''} ${M.mark[i] ? 'mk' : ''} ${i === M.i ? 'cur' : ''}" data-act="m-go" data-i="${i}">${i + 1}</button>`).join('');
    const answered = Object.keys(M.pick).length;
    return `
      <section class="card quiz">
        <div class="qhead"><span>Mock · ${M.i + 1}/${M.ids.length} · ${answered} answered</span><span class="timer" id="timer">--:--</span></div>
        <div class="qmeta">${chip(q)}<button class="icon flag ${M.mark[M.i] ? 'on' : ''}" data-act="m-mark" title="Mark for review (M)">🔖</button></div>
        <div class="qtext">${fmt(q.q)}</div>
        <div class="opts">${opts}</div>
        <div class="row"><button class="btn" data-act="m-prev" ${M.i ? '' : 'disabled'}>◀ Prev</button>
          <button class="btn primary" data-act="m-next" data-focus>${M.i + 1 < M.ids.length ? 'Next ▶' : 'Review palette'}</button>
          <button class="btn ghost" data-act="m-clear">Clear</button>
          <button class="btn danger" data-act="m-submit">Submit</button></div>
        <details class="palette" ${M.i + 1 === M.ids.length ? 'open' : ''}><summary>Question palette</summary><div class="cells">${pal}</div></details>
      </section>`;
  }
  function submitMock(auto) {
    if (!M || M.done) return;
    if (!auto && !confirm(`Submit now? ${M.ids.length - Object.keys(M.pick).length} unanswered.`)) return;
    let c = 0, w = 0;
    M.ids.forEach((id, i) => {
      if (M.pick[i] == null) return;
      const ok = M.pick[i] === BY[id].a; ok ? c++ : w++; grade(id, ok);
    });
    const u = M.ids.length - c - w;
    M.done = true;
    M.res = { d: today(), p: M.label, n: M.ids.length, c, w, u, sc: c - (M.neg ? w / 3 : 0), secs: Math.round((Math.min(Date.now(), M.end) - M.start) / 1000) };
    S.mocks.push(M.res); if (S.mocks.length > 50) S.mocks.shift(); save();
    if (auto) toast('Time up — mock submitted.');
    render();
  }
  function viewMockResult() {
    const r = M.res, byT = {};
    M.ids.forEach((id, i) => {
      const q = BY[id], k = q.topic.key, e = byT[k] || (byT[k] = { t: q.topic, n: 0, c: 0 });
      e.n++; if (M.pick[i] === q.a) e.c++;
    });
    const rows = Object.values(byT).sort((a, b) => a.c / a.n - b.c / b.n).map((e) => `<tr><td>${esc(e.t.p)} · ${esc(e.t.t)}</td><td>${e.c}/${e.n}</td><td>${pct(e.c / e.n)}</td></tr>`).join('');
    const miss = M.ids.map((id, i) => [BY[id], M.pick[i]]).filter(([q, p]) => p !== q.a).map(([q, p]) =>
      `<li>${chip(q)}<div>${fmt(q.q)}</div>${p != null ? `<div class="yours">✗ You: ${fmt(q.o[p])}</div>` : '<div class="yours">— Not answered</div>'}<div class="ans">✓ ${fmt(q.o[q.a])}</div><div class="note">${fmt(q.e)}</div></li>`).join('');
    return `
      <section class="card">
        <h2>Mock result</h2>
        <div class="hero-num"><span class="big">${r.sc.toFixed(1)}</span><span class="of">/ ${r.n}${M.neg ? ' (−⅓ negative)' : ''}</span></div>
        <p>${r.c} correct · ${r.w} wrong · ${r.u} unanswered · accuracy ${r.c + r.w ? pct(r.c / (r.c + r.w)) : '—'} · ${Math.floor(r.secs / 60)}m ${r.secs % 60}s</p>
        <div class="row">${miss ? '<button class="btn primary" data-act="m-retry">Practise missed ▶</button>' : ''}<button class="btn" data-act="m-new">New mock</button></div>
      </section>
      <section class="card"><h2>By topic (weakest first)</h2><div class="tablewrap"><table><thead><tr><th>Topic</th><th>Score</th><th>%</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      ${miss ? `<section class="card"><h2>Review</h2><ol class="rev">${miss}</ol></section>` : ''}`;
  }

  /* ---------- Stats ---------- */
  function activitySvg() {
    const t = today(), days = Array.from({ length: 14 }, (_, i) => t - 13 + i);
    const vals = days.map((d) => S.days[d] || [0, 0]), max = Math.max(10, ...vals.map((v) => v[0]));
    const W = 560, H = 140, pad = 22, bw = (W - pad) / 14;
    const bars = days.map((d, i) => {
      const [n, c] = vals[i], h = (n / max) * (H - pad - 8), x = pad + i * bw + 3, y = H - pad - h;
      return `<g><title>${dateOf(d)}: ${n} answered, ${c} correct${n ? ' (' + pct(c / n) + ')' : ''}</title>
        <rect class="hit" x="${x - 3}" y="0" width="${bw}" height="${H - pad}"></rect>
        ${n ? `<rect class="b" x="${x}" y="${y}" width="${bw - 6}" height="${h}" rx="4"></rect>` : ''}
        <text x="${x + (bw - 6) / 2}" y="${H - 6}" text-anchor="middle">${dateOf(d).slice(8)}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Questions answered per day, last 14 days">
      <line class="ax" x1="${pad}" x2="${W}" y1="${H - pad}" y2="${H - pad}"></line>
      <text x="0" y="12" class="lbl">${max}</text>${bars}</svg>`;
  }
  function viewStats() {
    const groups = Object.keys(GROUPS).map((g) => {
      const pr = projected(g), tg = +S.set.targets[g] || 0, mx = GROUPS[g].max;
      const ps = papersOf(g).map((p) => {
        const ids = Q.filter((q) => q.p === p).map((q) => q.id), seen = ids.filter(isSeen).length;
        const rr = ids.reduce((s, id) => { const r = rec(id); return r ? [s[0] + r[2], s[1] + r[3]] : s; }, [0, 0]);
        return `<div class="sub">${esc(PAPERS[p].name)}: readiness ${pct(readiness(p))} · seen ${seen}/${ids.length} · accuracy ${rr[0] ? pct(rr[1] / rr[0]) : '—'}</div>`;
      }).join('');
      return `<div class="grow"><div class="gl"><b>${esc(GROUPS[g].name)}</b><span>${Math.round(pr)} / ${mx} · target ${tg} ${pr >= tg ? '✅' : `(gap ${Math.round(tg - pr)})`}</span></div>${bar(pr / mx, tg / mx)}${ps}</div>`;
    }).join('');
    const tops = TOPICS.filter((t) => t.ids.length).map((t) => {
      const seen = t.ids.filter(isSeen).length;
      const rr = t.ids.reduce((s, id) => { const r = rec(id); return r ? [s[0] + r[2], s[1] + r[3]] : s; }, [0, 0]);
      return { t, m: topicMastery(t), seen, acc: rr[0] ? rr[1] / rr[0] : null };
    }).sort((a, b) => a.m - b.m || b.t.w - a.t.w);
    const trows = tops.map((x) => `<tr><td><a href="#" data-act="topic" data-k="${esc(x.t.key)}">${esc(x.t.p)} · ${esc(x.t.t)}</a></td><td>${'★'.repeat(x.t.w)}</td><td>${x.seen}/${x.t.ids.length}</td><td>${x.acc == null ? '—' : pct(x.acc)}</td><td>${pct(x.m)}</td></tr>`).join('');
    const tot = projectedTotal();
    return `
      <section class="card">
        <h2>Projected score</h2>
        <div class="hero-num"><span class="big">${Math.round(tot)}</span><span class="of">/ 1700 · goal ${S.set.goal}+ · targets ${targetTotal()}</span></div>
        ${groups}
      </section>
      <section class="card"><h2>Last 14 days</h2>${activitySvg()}<p class="note">Questions answered per day (hover a bar for accuracy).</p></section>
      <section class="card"><h2>Topics — weakest first</h2><p class="note">Mastery rises only when you get a question right again on later days (spaced recall). ★ = PYQ weightage. Tap a topic to drill it.</p>
        <div class="tablewrap"><table><thead><tr><th>Topic</th><th>PYQ</th><th>Seen</th><th>Accuracy</th><th>Mastery</th></tr></thead><tbody>${trows}</tbody></table></div></section>`;
  }

  /* ---------- PYQ coverage ---------- */
  const PQ = { exam: '', paper: '', only: false };
  function viewPyq() {
    const covered = PYQ_LIST.filter((x) => x.ids.length >= PYQ_TARGET).length;
    const linked = PYQ_LIST.reduce((s, x) => s + x.ids.length, 0);
    const list = PYQ_LIST.filter((x) => (!PQ.exam || x.exam === PQ.exam) && (!PQ.paper || x.paper === PQ.paper) && (!PQ.only || x.ids.length));
    const groups = {};
    list.forEach((x) => { const k = `${x.exam} ${x.year} ${x.paper}`; (groups[k] = groups[k] || []).push(x); });
    const order = Object.keys(groups).sort((a, b) => { const [ea, ya, pa] = a.split(' '), [eb, yb, pb] = b.split(' '); return yb - ya || ea.localeCompare(eb) * -1 || pa.localeCompare(pb); });
    const body = order.map((k, gi) => {
      const xs = groups[k], ids = xs.flatMap((x) => x.ids), done = xs.filter((x) => x.ids.length >= PYQ_TARGET).length;
      const [exam, year, paper] = k.split(' ');
      const rows = xs.map((x) => {
        const m = x.ids.length ? x.ids.reduce((s, id) => s + mastery(id), 0) / x.ids.length : 0;
        return `<li><div class="pyqhead"><b>${esc(x.qno)}</b>${x.m ? ` <span class="note">${x.m} m</span>` : ''}${x.kind === 't' ? ' <span class="chip">topic</span>' : ''}
          <span class="pyqcount ${x.ids.length >= PYQ_TARGET ? 'full' : ''}">${x.ids.length ? `${x.ids.length} MCQs · ${pct(m)}` : 'no MCQs yet'}</span></div>
          <div>${fmt(x.text)}</div>${x.ids.length ? `<button class="btn" data-act="pyq-drill" data-id="${esc(x.id)}">Drill ▶</button>` : ''}</li>`;
      }).join('');
      return `<details class="card pyqgroup" ${gi < 2 ? 'open' : ''}><summary><b>${esc(exam)} ${esc(year)} · ${esc(PAPERS[paper] ? PAPERS[paper].name : paper)}</b>
        <span class="note">${xs.length} PYQs · ${done} with ${PYQ_TARGET}+ MCQs</span></summary>
        ${ids.length ? `<button class="btn primary" data-act="pyq-paper" data-k="${esc(k)}">Drill all ${ids.length} MCQs of this paper ▶</button>` : ''}
        <ol class="rev">${rows}</ol></details>`;
    }).join('');
    const exams = [['', 'Both exams'], ['IFoS', 'IFoS'], ['CSE', 'CSE']].map(([v, l]) => `<button class="pill ${PQ.exam === v ? 'on' : ''}" data-act="pq-exam" data-v="${v}">${l}</button>`).join('');
    const papers = [['', 'All'], ['B1', 'Botany I'], ['B2', 'Botany II'], ['A1', 'Agri I'], ['A2', 'Agri II']].map(([v, l]) => `<button class="pill ${PQ.paper === v ? 'on' : ''}" data-act="pq-paper" data-v="${v}">${l}</button>`).join('');
    return `
      <section class="card">
        <h2>PYQ coverage</h2>
        <div class="hero-num"><span class="big">${covered}</span><span class="of">/ ${PYQ_LIST.length} registered PYQs have ${PYQ_TARGET}+ MCQs · ${linked} linked MCQs</span></div>
        ${bar(PYQ_LIST.length ? covered / PYQ_LIST.length : 0)}
        <p class="note">Each PYQ gets ${PYQ_TARGET} MCQs on the facts its answer needs. After answering a linked MCQ you see the PYQ, so recall turns into an answer outline. "topic" = the question's subject is known but not its exact wording.</p>
        <h3>Exam</h3><div class="pills">${exams}</div>
        <h3>Paper</h3><div class="pills">${papers}</div>
        <label class="check"><input type="checkbox" data-act="pq-only" ${PQ.only ? 'checked' : ''}> Only PYQs that already have MCQs</label>
      </section>
      ${body || '<p class="card note">No PYQs match.</p>'}`;
  }

  /* ---------- Revise (browse bank) ---------- */
  const B = { q: '', paper: '', show: 'all', limit: 40 };
  function viewBank() {
    const needle = B.q.trim().toLowerCase();
    const list = Q.filter((q) => (!B.paper || q.p === B.paper)
      && (B.show === 'all' || (B.show === 'weak' && isWeak(q.id)) || (B.show === 'flag' && isFlag(q.id)) || (B.show === 'new' && !isSeen(q.id)))
      && (!needle || (q.q + ' ' + q.o.join(' ') + ' ' + q.e + ' ' + q.topic.t + (q.pyq ? ' ' + pyqLabel(q.pyq) + ' ' + q.pyq.text : '')).toLowerCase().includes(needle)));
    const items = list.slice(0, B.limit).map((q) => `<li>${chip(q)}<button class="icon flag ${isFlag(q.id) ? 'on' : ''}" data-act="b-flag" data-id="${q.id}">🚩</button>
      <div>${fmt(q.q)}</div><div class="ans">✓ ${fmt(q.o[q.a])}</div><div class="note">${fmt(q.e)}</div>${pyqRef(q)}</li>`).join('');
    const ps = `<option value="">All papers</option>` + Object.keys(PAPERS).map((p) => `<option value="${p}" ${B.paper === p ? 'selected' : ''}>${esc(PAPERS[p].name)}</option>`).join('');
    const sh = [['all', 'All'], ['weak', 'Mistakes'], ['flag', 'Flagged'], ['new', 'Unseen']].map(([k, l]) => `<option value="${k}" ${B.show === k ? 'selected' : ''}>${l}</option>`).join('');
    return `
      <section class="card">
        <h2>Revise</h2>
        <p class="note">Read-through mode: every question with its answer and the one-line fact to remember. Search any term (e.g. "Vavilov", "CAMPA", "idiom").</p>
        <div class="filters"><input type="search" id="bq" placeholder="Search ${Q.length} questions…" value="${esc(B.q)}">
          <select id="bp">${ps}</select><select id="bs">${sh}</select></div>
        <p class="note">${list.length} match</p>
        <ol class="rev">${items}</ol>
        ${list.length > B.limit ? '<button class="btn" data-act="b-more">Show more</button>' : ''}
      </section>`;
  }

  /* ---------- Settings ---------- */
  function viewSettings() {
    const tg = Object.keys(GROUPS).map((g) => `<label>${esc(GROUPS[g].name)} <small>/ ${GROUPS[g].max}</small><input type="number" min="0" max="${GROUPS[g].max}" data-t="${g}" value="${S.set.targets[g]}"></label>`).join('');
    return `
      <section class="card">
        <h2>Settings</h2>
        <div class="form">
          <label>Exam date<input type="date" id="sExam" value="${esc(S.set.exam)}"></label>
          <label>Daily question goal<input type="number" id="sDaily" min="5" max="500" value="${S.set.daily}"></label>
          <label>Overall goal (marks)<input type="number" id="sGoal" min="0" max="1700" value="${S.set.goal}"></label>
          <label>Mock seconds per question<input type="number" id="sSpq" min="15" max="300" value="${S.set.spq}"></label>
        </div>
        <label class="check"><input type="checkbox" id="sNeg" ${S.set.neg ? 'checked' : ''}> Negative marking in mocks by default</label>
        <h3>Targets per paper group</h3><div class="form">${tg}</div>
        <button class="btn primary" data-act="s-save">Save settings</button>
      </section>
      <section class="card">
        <h2>Backup</h2>
        <p class="note">Progress is stored only in this browser. Export regularly, and import on another device to continue.</p>
        <div class="row"><button class="btn" data-act="s-export">⬇ Export progress</button>
          <label class="btn">⬆ Import<input type="file" id="sImport" accept="application/json" hidden></label>
          <button class="btn danger" data-act="s-reset">Reset all progress</button></div>
      </section>
      <section class="card"><h2>About the bank</h2><p class="note">${Q.length} questions · ${TOPICS.length} topics · ${Object.keys(PAPERS).map((p) => `${p} ${Q.filter((q) => q.p === p).length}`).join(' · ')}. Add questions in <code>mcq/banks/*.js</code>, then run <code>node tools/validate_banks.js</code>.</p></section>`;
  }

  /* ---------- events ---------- */
  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]'); if (!el) return;
    const act = el.dataset.act;
    if (el.tagName === 'A') ev.preventDefault();
    switch (act) {
      case 'go': go(el.dataset.r); break;
      case 'mission': startRun("Today's mission", buildMission(false), 'today'); break;
      case 'mission-extra': startRun('Extra round', buildMission(true), 'today'); break;
      case 'topic': { const tp = TOPIC_BY[el.dataset.k]; if (tp) startRun(tp.t, shuffle(tp.ids.slice()).sort((a, b) => mastery(a) - mastery(b)).slice(0, 20), 'stats'); break; }
      case 'quick': startRun({ due: 'Due reviews', weak: 'Mistakes', flag: 'Flagged' }[el.dataset.f], shuffle(pool({ papers: [], topics: [], filter: el.dataset.f }).map((q) => q.id)), 'today'); break;
      case 'p-paper': { const p = el.dataset.p, i = P.papers.indexOf(p); i < 0 ? P.papers.push(p) : P.papers.splice(i, 1); P.topics = P.topics.filter((k) => !P.papers.length || P.papers.includes(TOPIC_BY[k].p)); render(); break; }
      case 'p-topic': { const k = el.value, i = P.topics.indexOf(k); el.checked ? i < 0 && P.topics.push(k) : i >= 0 && P.topics.splice(i, 1); render(); break; }
      case 'p-clear': P.topics = []; render(); break;
      case 'p-filter': P.filter = el.dataset.f; render(); break;
      case 'p-count': P.count = +el.dataset.c; render(); break;
      case 'p-start': { const ids = shuffle(pool(P).map((q) => q.id)); startRun('Practice', P.count ? ids.slice(0, P.count) : ids, 'practice'); break; }
      case 'pick': pick(+el.dataset.k); break;
      case 'next': if (R) { R.i++; render(); window.scrollTo(0, 0); } break;
      case 'end': if (R) { R.ids = R.ids.slice(0, R.i + (R.ans[R.i] ? 1 : 0)); R.i = R.ids.length; render(); } break;
      case 'retry-wrong': { const first = Object.keys(R.ans).filter((i) => !R.retry[i]); const ids = [...new Set(first.filter((i) => !R.ans[i].ok).map((i) => R.ids[i]))]; startRun('Retry missed', shuffle(ids), R.ret); break; }
      case 'flag': if (R) { toggleFlag(R.ids[R.i]); render(); } break;
      case 'm-paper': MK.paper = el.dataset.p; render(); break;
      case 'm-n': MK.n = +el.dataset.n; render(); break;
      case 'm-neg': MK.neg = el.checked; break;
      case 'm-start': startMock(); break;
      case 'm-pick': { const o = M.perm[M.i][+el.dataset.k]; M.pick[M.i] = o; render(); break; }
      case 'm-clear': delete M.pick[M.i]; render(); break;
      case 'm-mark': M.mark[M.i] = !M.mark[M.i]; render(); break;
      case 'm-prev': if (M.i) { M.i--; render(); } break;
      case 'm-next': if (M.i + 1 < M.ids.length) { M.i++; render(); } else { const d = $('.palette'); if (d) d.open = true; } break;
      case 'm-go': M.i = +el.dataset.i; render(); break;
      case 'm-submit': submitMock(false); break;
      case 'm-retry': startRun('Mock mistakes', shuffle(M.ids.filter((id, i) => M.pick[i] !== BY[id].a)), 'mock'); break;
      case 'm-new': M = null; go('mock'); break;
      case 'pq-exam': PQ.exam = el.dataset.v; render(); break;
      case 'pq-paper': PQ.paper = el.dataset.v; render(); break;
      case 'pq-only': PQ.only = el.checked; render(); break;
      case 'pyq-drill': { const x = PYQ[el.dataset.id]; if (x) startRun(`${x.exam} ${x.year} ${x.paper} ${x.qno}`, shuffle(x.ids.slice()), 'pyq'); break; }
      case 'pyq-paper': { const [exam, year, paper] = el.dataset.k.split(' '); startRun(`${exam} ${year} ${paper} PYQs`, shuffle(PYQ_LIST.filter((x) => x.exam === exam && x.year === +year && x.paper === paper).flatMap((x) => x.ids)), 'pyq'); break; }
      case 'b-flag': toggleFlag(el.dataset.id); el.classList.toggle('on'); break;
      case 'b-more': B.limit += 40; render(); break;
      case 's-save': saveSettings(); break;
      case 's-export': exportState(); break;
      case 's-reset': if (confirm('Erase all progress, mocks and flags? Export first if unsure.')) { S = hydrate({ set: S.set }); save(); toast('Progress reset.'); render(); } break;
    }
  });
  document.addEventListener('input', (ev) => {
    if (ev.target.id === 'bq') { B.q = ev.target.value; B.limit = 40; const pos = ev.target.selectionStart; render(); const i = $('#bq'); i.focus(); i.setSelectionRange(pos, pos); }
  });
  document.addEventListener('change', (ev) => {
    const id = ev.target.id;
    if (id === 'bp') { B.paper = ev.target.value; B.limit = 40; render(); }
    if (id === 'bs') { B.show = ev.target.value; B.limit = 40; render(); }
    if (id === 'sImport' && ev.target.files[0]) importState(ev.target.files[0]);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.target.matches('input, select, textarea') || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const r = route(), k = ev.key.toLowerCase();
    const idx = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k);
    if (r === 'quiz' && R && R.i < R.ids.length) {
      if (!R.ans[R.i] && idx >= 0) { ev.preventDefault(); pick(idx); }
      else if (R.ans[R.i] && (k === 'enter' || k === 'arrowright' || k === 'n')) { ev.preventDefault(); R.i++; render(); window.scrollTo(0, 0); }
      else if (k === 'f') { toggleFlag(R.ids[R.i]); render(); }
    } else if (r === 'exam' && M && !M.done) {
      if (idx >= 0 && M.perm[M.i] && M.perm[M.i][idx] != null) { M.pick[M.i] = M.perm[M.i][idx]; render(); }
      else if (k === 'arrowright' || k === 'enter') { ev.preventDefault(); if (M.i + 1 < M.ids.length) { M.i++; render(); } }
      else if (k === 'arrowleft' && M.i) { M.i--; render(); }
      else if (k === 'm') { M.mark[M.i] = !M.mark[M.i]; render(); }
    }
  });

  function saveSettings() {
    const v = (id) => $(id).value;
    const exam = v('#sExam');
    if (/^\d{4}-\d{2}-\d{2}$/.test(exam)) S.set.exam = exam;
    S.set.daily = Math.max(5, Math.min(500, +v('#sDaily') || DEFAULTS.daily));
    S.set.goal = Math.max(0, Math.min(1700, +v('#sGoal') || 0));
    S.set.spq = Math.max(15, Math.min(300, +v('#sSpq') || DEFAULTS.spq));
    S.set.neg = $('#sNeg').checked;
    document.querySelectorAll('[data-t]').forEach((i) => { S.set.targets[i.dataset.t] = Math.max(0, Math.min(GROUPS[i.dataset.t].max, +i.value || 0)); });
    save(); toast('Settings saved.'); render();
  }
  function exportState() {
    const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `ifos-mcq-progress-${dateOf(today())}.json`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importState(file) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const raw = JSON.parse(fr.result);
        if (!raw || typeof raw.q !== 'object') throw new Error('not a progress file');
        S = hydrate(raw); save(); toast('Progress imported.'); render();
      } catch (e) { toast('Import failed: ' + e.message); }
    };
    fr.readAsText(file);
  }

  /* ---------- theme & boot ---------- */
  function applyTheme() { if (S.set.theme) document.documentElement.dataset.theme = S.set.theme; else delete document.documentElement.dataset.theme; }
  $('#themeBtn').addEventListener('click', () => {
    const dark = S.set.theme ? S.set.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    S.set.theme = dark ? 'light' : 'dark'; save(); applyTheme();
  });
  window.addEventListener('hashchange', render);
  applyTheme();
  render();
  window.IFOS_APP = { Q, TOPICS, PYQ: PYQ_LIST, state: () => S, projectedTotal, readiness, buildMission }; // for console/tests
})();
