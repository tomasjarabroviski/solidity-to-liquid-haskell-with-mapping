const { solidityToHaskell } = require('./index.js');

// const solidityCode = `
// contract Foo {
//     uint256 public x;
//     bool isReady;

//     function bar(uint y, bool flip) public {
//         x = x + y;
//         isReady = flip;
//     }

//     function reset() external {
//         x = 0;
//         isReady = false;
//     }
// }
// const solidityCode = `
// contract Counter {
//     uint256 public count;
//     uint256 public another_count;
//     function increment() public { if (true) {count++;} }
// }
// `;
const fs = require('fs');
const path = require('path');

const contractName = 'test8_if';

const CONTRACTS_DIR = path.join(__dirname, '../test_contracts');
const contractFile = path.join(CONTRACTS_DIR, `${contractName}.sol`);
const solidityCode = fs.readFileSync(contractFile, 'utf8');
const haskellCode = solidityToHaskell(solidityCode);

console.log('===== GENERATED HASKELL CODE =====\n');
console.log(haskellCode);
