#!/usr/bin/env node

/**
 * @file compile-all.js
 * @description Iterates over all .sol contracts in `test_contracts`,
 *              generates Haskell code, and tries to compile each
 *              generated .hs file using `ghc`.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { solidityToHaskell } = require('../src/index');

const CONTRACTS_DIR = path.join(__dirname, '../test_contracts');

const OUTPUT_DIR = path.join(__dirname, '/tmp/');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}

const files = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith('.sol'));

let allPassed = true;

for (const file of files) {
  const fullPath = path.join(CONTRACTS_DIR, file);
  const solidityCode = fs.readFileSync(fullPath, 'utf8');

  console.log(`\n--- Processing ${file} ---`);

  const haskellCode = solidityToHaskell(solidityCode);

  const baseName = path.basename(file, '.sol');
  const hsFileName = `${baseName}.hs`;
  const hsFilePath = path.join(OUTPUT_DIR, hsFileName);

  fs.writeFileSync(hsFilePath, haskellCode, 'utf8');

  console.log(`Compiling ${hsFileName}...`);
  try {
    execSync(`ghc -fno-code ${hsFilePath}`, {
      stdio: 'inherit'
    });
    console.log(`SUCCESS: ${hsFileName} compiled successfully!`);
  } catch (error) {
    allPassed = false;
    console.error(`ERROR: Failed to compile ${hsFileName}.`);
    console.error(error.stdout?.toString() || error.message);
  }
}

if (allPassed) {
  console.log('\n✅ All contracts compiled successfully!');
} else {
  console.error('\n❌ Some contracts failed to compile. See errors above.');
  process.exit(1);
}
