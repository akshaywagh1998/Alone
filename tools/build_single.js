#!/usr/bin/env node
// Inlines mcq/index.html + CSS + banks + engine into one self-contained file for hosts
// that take a single page (Lovable public/, claude.ai artifact, email). Usage:
//   node tools/build_single.js [out=dist/ifos-mcq.html]
'use strict';
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'mcq');
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'dist', 'ifos-mcq.html'));
const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');
// A literal "</script" inside inlined JS would close the tag early.
const safe = (js) => js.replace(/<\/script/gi, '<\\/script');

let html = read('index.html')
  .replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, f) => `<style>\n${read(f)}</style>`)
  .replace(/<script src="([^"]+)"><\/script>/g, (_, f) => `<script>\n${safe(read(f))}</script>`);
if (/<script src=|<link rel="stylesheet"/.test(html)) throw new Error('an external reference was not inlined');

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log(`${out} — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
