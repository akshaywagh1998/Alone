#!/usr/bin/env node
// Validates mcq/banks/*.js: schema, answer index, duplicates, option-order hazards.
// Usage: node tools/validate_banks.js [--list-fixed]
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dir = path.join(__dirname, '..', 'mcq', 'banks');
const PAPERS = ['EN', 'GK', 'B1', 'B2', 'A1', 'A2', 'PT'];
// Keep in sync with FIXED and hash() in mcq/mcq.js.
const FIXED = /^(\d( only|,? and \d)|\d, \d|both (\d|a and r)|neither \d|a is (true|false)|[a-d]\s*[-–]\s*\d|(all|none) of the above)/i;
const hash = (s) => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return (x >>> 0).toString(36); };

const ctx = { window: {} };
vm.createContext(ctx);
const registry = path.join(__dirname, '..', 'mcq', 'pyq', 'registry.js');
if (fs.existsSync(registry)) vm.runInContext(fs.readFileSync(registry, 'utf8'), ctx, { filename: 'pyq/registry.js' });
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
}
const banks = ctx.window.IFOS_BANK || [];
const PYQ_TARGET = 10;
const pyqs = new Map((ctx.window.IFOS_PYQ || []).map((r) => [r[0], { r, n: 0 }]));
const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'mcq', 'index.html'), 'utf8');
const errors = [], warns = [], ids = new Map(), perPaper = {}, fixedAns = [0, 0, 0, 0, 0, 0], fixedList = [];
let total = 0;

banks.forEach((b, bi) => {
  const where = `${b.p}/${b.t}`;
  if (!PAPERS.includes(b.p)) errors.push(`bank #${bi}: unknown paper "${b.p}"`);
  if (!b.t || typeof b.t !== 'string') errors.push(`bank #${bi}: missing topic name`);
  if (![1, 2, 3].includes(b.w)) errors.push(`${where}: weight must be 1, 2 or 3`);
  if (!Array.isArray(b.q) || !b.q.length) { errors.push(`${where}: no questions`); return; }
  if (b.pyq !== undefined) {
    if (!pyqs.has(b.pyq)) errors.push(`${where}: unknown PYQ id "${b.pyq}" (add it to mcq/pyq/registry.js)`);
    else if (!b.pyq.includes(`-${b.p}-`)) warns.push(`${where}: PYQ ${b.pyq} belongs to a different paper than ${b.p}`);
    else pyqs.get(b.pyq).n += b.q.length;
  }
  b.q.forEach((r, qi) => {
    const tag = `${where} #${qi + 1}`;
    if (!Array.isArray(r) || r.length < 4) { errors.push(`${tag}: expected [question, options, answer, explanation]`); return; }
    const [q, o, a, e] = r;
    if (typeof q !== 'string' || q.trim().length < 8) errors.push(`${tag}: question text too short`);
    if (!Array.isArray(o) || o.length < 2 || o.length > 6) errors.push(`${tag}: need 2–6 options`);
    else {
      if (o.some((x) => typeof x !== 'string' || !x.trim())) errors.push(`${tag}: empty option`);
      if (new Set(o.map((x) => String(x).trim().toLowerCase())).size !== o.length) errors.push(`${tag}: duplicate options`);
      if (!Number.isInteger(a) || a < 0 || a >= o.length) errors.push(`${tag}: answer index ${a} out of range`);
      const fixed = o.some((x) => FIXED.test(x));
      if (fixed) { fixedAns[a]++; fixedList.push(`${tag} -> ${'ABCDEF'[a]}`); }
      else if (o.some((x) => /\boption \(?[a-d]\)?|^\([a-d]\)|\([a-d]\) (and|or) \([a-d]\)/i.test(x))) warns.push(`${tag}: option refers to position but will be shuffled`);
    }
    if (typeof e !== 'string' || e.trim().length < 10) errors.push(`${tag}: explanation missing/short`);
    const id = `${b.p}-${hash(String(q) + '|' + (Array.isArray(o) ? o.join('|') : ''))}`;
    if (ids.has(id)) errors.push(`${tag}: duplicate of ${ids.get(id)}`); else ids.set(id, tag);
    perPaper[b.p] = (perPaper[b.p] || 0) + 1; total++;
  });
});

console.log(`Banks: ${banks.length} topics, ${total} questions`);
console.log(PAPERS.map((p) => `${p}:${perPaper[p] || 0}`).join('  '));
console.log(`Fixed-order questions: ${fixedList.length} (answer spread A-D: ${fixedAns.slice(0, 4).join('/')})`);
if (pyqs.size) {
  const byPaper = {};
  for (const [id, { n }] of pyqs) { const k = id.split('-').slice(0, 3).join(' '); const g = byPaper[k] || (byPaper[k] = [0, 0, 0]); g[0]++; if (n >= PYQ_TARGET) g[1]++; g[2] += n; }
  const full = [...pyqs.values()].filter((x) => x.n >= PYQ_TARGET).length;
  console.log(`PYQs: ${pyqs.size} registered, ${full} with ${PYQ_TARGET}+ MCQs`);
  Object.keys(byPaper).sort().forEach((k) => { const [t, f, n] = byPaper[k]; console.log(`  ${k.padEnd(16)} ${String(f).padStart(3)}/${t} covered, ${n} MCQs`); });
  for (const [id, { n }] of pyqs) if (n && n < PYQ_TARGET) warns.push(`PYQ ${id}: only ${n} MCQs (target ${PYQ_TARGET})`);
}
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js'))) if (!htmlSrc.includes(`banks/${f}`)) errors.push(`mcq/index.html does not load banks/${f}`);
if (process.argv.includes('--list-fixed')) fixedList.forEach((l) => console.log('  ' + l));
warns.forEach((w) => console.log('WARN  ' + w));
errors.forEach((e) => console.log('ERROR ' + e));
if (errors.length) { console.log(`\n${errors.length} error(s)`); process.exit(1); }
console.log('OK');
