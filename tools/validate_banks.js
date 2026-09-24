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
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
  vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f });
}
const banks = ctx.window.IFOS_BANK || [];
const errors = [], warns = [], ids = new Map(), perPaper = {}, fixedAns = [0, 0, 0, 0, 0, 0], fixedList = [];
let total = 0;

banks.forEach((b, bi) => {
  const where = `${b.p}/${b.t}`;
  if (!PAPERS.includes(b.p)) errors.push(`bank #${bi}: unknown paper "${b.p}"`);
  if (!b.t || typeof b.t !== 'string') errors.push(`bank #${bi}: missing topic name`);
  if (![1, 2, 3].includes(b.w)) errors.push(`${where}: weight must be 1, 2 or 3`);
  if (!Array.isArray(b.q) || !b.q.length) { errors.push(`${where}: no questions`); return; }
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
if (process.argv.includes('--list-fixed')) fixedList.forEach((l) => console.log('  ' + l));
warns.forEach((w) => console.log('WARN  ' + w));
errors.forEach((e) => console.log('ERROR ' + e));
if (errors.length) { console.log(`\n${errors.length} error(s)`); process.exit(1); }
console.log('OK');
