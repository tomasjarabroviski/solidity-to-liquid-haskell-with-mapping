#!/usr/bin/env node
/**
 * @file run_contract.js
 * @description Prints a contract from test_contracts/ and its generated
 *   Haskell (no compilation or verification).
 *
 * Usage: node scripts/run_contract.js <contract-name>   (without .sol)
 */

const fs = require('fs');
const path = require('path');
const { solidityToHaskell } = require('../src/index');

const contractName = process.argv[2];

if (!contractName) {
  console.error('Please provide a contract name');
  console.error('Usage: node scripts/run_contract.js <contract-name>');
  process.exit(1);
}

const CONTRACTS_DIR = path.join(__dirname, '../test_contracts');
const contractFile = path.join(CONTRACTS_DIR, `${contractName}.sol`);

try {
  const solidityCode = fs.readFileSync(contractFile, 'utf8');
  const haskellCode = solidityToHaskell(solidityCode);

  console.log('=== Solidity Source ===');
  console.log(solidityCode);
  console.log('\n=== Generated Haskell ===\n');
  console.log(haskellCode);
} catch (error) {
  if (error.code === 'ENOENT') {
    console.error(`Contract ${contractName}.sol not found in test_contracts/`);
  } else {
    console.error('Error:', error.message);
  }
  process.exit(1);
}
