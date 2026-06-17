#!/usr/bin/env node
'use strict';
// Validate glossary/glossary.json before it ships:
//   - every relatedTerms entry resolves to an existing term or alias
//   - no duplicate term names
//   - no term references itself
// Fails the build (exit 1) with a readable report so a dangling
// cross-reference cannot merge unnoticed.

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'glossary', 'glossary.json');

let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (err) {
  console.error(`Cannot read or parse ${FILE}: ${err.message}`);
  process.exit(1);
}

const terms = Array.isArray(data)
  ? data
  : Array.isArray(data.terms)
    ? data.terms
    : (Object.values(data).find(Array.isArray) || []);

if (terms.length === 0) {
  console.error('No glossary terms found.');
  process.exit(1);
}

const norm = (s) => String(s).trim().toLowerCase();

const canonical = new Map();    // norm(term) -> original term
const validTargets = new Set(); // norm(term) and norm(alias)
const duplicates = [];

for (const t of terms) {
  if (!t || typeof t.term !== 'string') continue;
  const key = norm(t.term);
  if (canonical.has(key)) duplicates.push(t.term);
  else canonical.set(key, t.term);
  validTargets.add(key);
  if (Array.isArray(t.aliases)) {
    for (const a of t.aliases) validTargets.add(norm(a));
  }
}

const dangling = [];
const selfRefs = [];

for (const t of terms) {
  if (!t || !Array.isArray(t.relatedTerms)) continue;
  for (const r of t.relatedTerms) {
    if (norm(r) === norm(t.term)) { selfRefs.push(t.term); continue; }
    if (!validTargets.has(norm(r))) dangling.push(`${t.term} -> ${r}`);
  }
}

let failed = false;

if (dangling.length) {
  failed = true;
  console.error(`\n${dangling.length} dangling relatedTerms reference(s) (no matching term or alias):`);
  for (const d of dangling) console.error(`  ${d}`);
}
if (duplicates.length) {
  failed = true;
  console.error(`\n${duplicates.length} duplicate term name(s): ${duplicates.join(', ')}`);
}
if (selfRefs.length) {
  failed = true;
  console.error(`\n${selfRefs.length} term(s) listing themselves as related: ${selfRefs.join(', ')}`);
}

if (failed) {
  console.error('\nGlossary validation failed.');
  process.exit(1);
}

console.log(`Glossary OK: ${terms.length} terms, all relatedTerms references resolve.`);
