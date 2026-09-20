#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { solidityToHaskell } = require('../src/index');

const contractName = process.argv[2];

if (!contractName) {
    console.error('Please provide a contract name');
    console.error('Usage: node show-contract.js <contract-name>');
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