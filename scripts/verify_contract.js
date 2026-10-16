#!/usr/bin/env node
/**
 * @file verify_contract.js
 * @description Converts one or more .sol files to Liquid Haskell and runs real
 *              verification (same command as server.js), printing SAFE/UNSAFE.
 *
 * Usage: node scripts/verify_contract.js <file.sol> [more.sol ...] [--keep] [--overflow]
 *        --overflow: also check uint overflow (see solidityToHaskell's checkOverflow)
 *        VERBOSE=1 node scripts/verify_contract.js <file.sol>   (prints LH output when not SAFE)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { solidityToHaskell } = require('../src/index');

const CABAL_PROJECT_DIR = path.join(__dirname, '../src/verify');

/**
 * Returns { result, output, hsFile } where result is one of SAFE, UNSAFE,
 * ERROR (generated Haskell doesn't compile), PARSE ERROR or TRANSLATOR CRASH.
 * Unlike the web UI, a compile error is NOT reported as UNSAFE.
 */
function verifyContract(file, { keep = false, checkOverflow = false } = {}) {
  let haskell;
  try {
    haskell = solidityToHaskell(fs.readFileSync(file, 'utf8'), { checkOverflow });
  } catch (error) {
    return { result: 'TRANSLATOR CRASH', output: error.stack };
  }
  if (!haskell) return { result: 'PARSE ERROR', output: '' };

  const moduleName = (haskell.match(/^\s*module\s+([A-Za-z_][A-Za-z0-9_']*)/m) || [])[1] || 'Temp';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lhverify-'));
  const hsFile = path.join(dir, `${moduleName}.hs`);
  fs.writeFileSync(hsFile, haskell);

  let output;
  try {
    output = execSync(`cabal exec -- ghc -fplugin=LiquidHaskell -fno-code "${hsFile}" 2>&1`, {
      cwd: CABAL_PROJECT_DIR, encoding: 'utf8', maxBuffer: 1024 * 1024 * 50,
    });
  } catch (error) {
    output = (error.stdout || error.message || '').toString();
  }

  let result = 'ERROR';
  if (/LIQUID: UNSAFE/.test(output)) result = 'UNSAFE';
  else if (/LIQUID: SAFE/.test(output)) result = 'SAFE';

  // Unsupported statements are translated as no-ops (`st -- TODO ...`) and
  // unsupported expressions as `undefined`, so a SAFE here may be vacuous.
  // A dropped require (e.g. `require(sent)` on a call's result) only allows
  // more executions, so it can't turn an UNSAFE into a SAFE.
  const ignored = haskell.split('\n')
    .filter(l => /-- TODO|-- skipped|\bundefined\b/.test(l) && !/-- skipped require statement/.test(l)).length;
  if (result === 'SAFE' && ignored > 0) result = `SAFE (con ${ignored} sentencias no traducidas)`;

  if (!keep) fs.rmSync(dir, { recursive: true, force: true });
  return { result, output, hsFile: keep ? hsFile : null };
}

module.exports = { verifyContract };

if (require.main === module) {
  const args = process.argv.slice(2);
  const keep = args.includes('--keep');
  const checkOverflow = args.includes('--overflow');
  const files = args.filter(a => !a.startsWith('--'));
  if (files.length === 0) {
    console.error('Usage: node scripts/verify_contract.js <file.sol> [more.sol ...] [--keep] [--overflow]');
    process.exit(1);
  }
  for (const file of files) {
    const { result, output, hsFile } = verifyContract(file, { keep, checkOverflow });
    console.log(`${file}: ${result}`);
    if (result !== 'SAFE' && process.env.VERBOSE) console.log(output);
    if (hsFile) console.log(`  generated: ${hsFile}`);
  }
}
