#!/usr/bin/env node
/**
 * @file run_benchmarks.js
 * @description Verifies every .sol under benchmarks/ and compares the result
 *              against the expected one. The expected result is read from a
 *              `// Esperado: SAFE|UNSAFE` comment; files under an `original/`
 *              folder without it are SmartBugs ground truth (all vulnerable),
 *              so they are expected UNSAFE.
 *
 *              With --overflow, uint overflow is checked too, and a
 *              `// Esperado con --overflow: SAFE|UNSAFE` comment takes
 *              precedence when present.
 *
 * Usage: node scripts/run_benchmarks.js [dir] [--overflow]
 */

const fs = require('fs');
const path = require('path');
const { verifyContract } = require('./verify_contract');

const args = process.argv.slice(2);
const checkOverflow = args.includes('--overflow');
const root = args.find(a => !a.startsWith('--')) || path.join(__dirname, '../benchmarks');

function listSol(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSol(full);
    return entry.name.endsWith('.sol') ? [full] : [];
  }).sort();
}

let matches = 0;
const files = listSol(root);
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const declared = (checkOverflow && source.match(/\/\/\s*Esperado con --overflow:\s*(SAFE|UNSAFE)/)) ||
    source.match(/\/\/\s*Esperado:\s*(SAFE|UNSAFE)/);
  const expected = declared ? declared[1] : (file.includes(`${path.sep}original${path.sep}`) ? 'UNSAFE' : '?');
  const { result } = verifyContract(file, { checkOverflow });
  const ok = result === expected;
  if (ok) matches++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${path.relative(root, file).padEnd(62)} esperado=${expected.padEnd(6)} obtenido=${result}`);
}
console.log(`\n${matches}/${files.length} coinciden con lo esperado${checkOverflow ? ' (modo --overflow)' : ''}`);
