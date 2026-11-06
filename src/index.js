/**
 * @file index.js
 * @description Entry point of the translator. Exports `solidityToHaskell`,
 *   which parses Solidity source code and emits a single, self-contained
 *   Liquid Haskell module covering every contract found in it.
 */

const parser = require('@solidity-parser/parser');
const { gatherStateDefinitions } = require('./gatherState');
const { gatherFunctionDefinitions } = require('./gatherFunctions');
const { generateHaskellData } = require('./generateData');
const { generateHaskellFunctions, generateCallFunction, REVERT_FUNCTION } = require('./generateFunctions');
const { msgDefinition } = require('./typeMappings');
const { LIQUID_ANNOTATIONS } = require('./liquidConditions');
const { MAP_DEFINITION } = require('./mapDefinitions');
const { translateExpression } = require('./translator');
const { walkAst, isMsgValue } = require('./astUtils');

/**
 * Translates Solidity source code into a Liquid Haskell module.
 *
 * The output is laid out as:
 *   1. Liquid Haskell pragmas and the `module` header (named after the first contract).
 *   2. The shared prelude: `Message`, `Block`, numeric types and `revert`.
 *   3. The Map/MapWithBalance library, only if some contract uses a mapping.
 *   4. For each contract: its `call<Name>` ether-transfer model, its state
 *      record and enums, and one Haskell function per Solidity function.
 *
 * @function solidityToHaskell
 * @param {string} code - Solidity source code.
 * @param {Object} [options]
 * @param {boolean} [options.checkOverflow=false] - Bound uint by 2^256-1 so
 *   overflows are reported, and evaluate conditions with wrapping arithmetic.
 * @returns {string} The generated Haskell code, or '' if the source does not parse.
 *
 * @example
 * const haskell = solidityToHaskell(`
 *   contract Counter {
 *     uint256 public count;
 *     function increment(uint x) public { count = count + x; }
 *   }
 * `);
 */
function solidityToHaskell(code, options = {}) {
  const checkOverflow = !!options.checkOverflow;
  let ast;
  try {
    ast = parser.parse(code);
  } catch (e) {
    console.error('Error parsing Solidity:', e);
    return '';
  }

  const contracts = [];

  // First pass: gather the state and functions of every contract.
  parser.visit(ast, {
    ContractDefinition(node) {
      // Liquid Haskell's spec parser rejects `_` in type constructor names
      // (`Overflow_AddState`), and every generated name is suffixed with this.
      const contractName = (node.name || 'UnnamedContract').replace(/_/g, '');
      const stateInfo = gatherStateDefinitions(node, contractName);
      stateInfo.checkOverflow = checkOverflow;
      const fnInfo = gatherFunctionDefinitions(node, contractName);
      stateInfo.ledgerMappings = findLedgerMappings(fnInfo, stateInfo);

      contracts.push({
        name: contractName,
        stateInfo,
        fnInfo
      });
    }
  });

  // Any contract using a `mapping(KeyType => uint)` state variable needs the
  // embedded Map/MapWithBalance library (BalancedMap, setWB, currentBalance...).
  const usesMappings = contracts.some(
    c => (c.stateInfo.variables || []).some(v => v.isMapping)
  );

  // Shared module header, named after the first contract.
  const haskellOutput = [];
  haskellOutput.push(LIQUID_ANNOTATIONS);
  haskellOutput.push(`module ${contracts[0]?.name || 'Main'} where\n`);
  if (usesMappings) {
    haskellOutput.push('import qualified Data.Set as S');
  }
  haskellOutput.push(msgDefinition(checkOverflow));
  haskellOutput.push(REVERT_FUNCTION);
  if (usesMappings) {
    haskellOutput.push(MAP_DEFINITION);
  }

  // Second pass: generate the data types and functions of every contract.
  for (const contract of contracts) {
    haskellOutput.push(generateCallFunction(contract.name, contract.stateInfo));
    haskellOutput.push(generateHaskellData(contract.name, contract.stateInfo));
    haskellOutput.push('');
    haskellOutput.push(generateHaskellFunctions(contract.name, contract.fnInfo, contract.stateInfo));
    haskellOutput.push('');
  }

  return haskellOutput.join('\n');
}

/**
 * Finds the mappings that account for received ether ("ledgers"), together
 * with the price of one unit:
 *  - `m[k] += msg.value`                                   -> price 1 (wei)
 *  - `require(msg.value == n * PRICE); ... m[k] += n;`     -> price PRICE
 * (PRICE must be a numeric literal or constant). They get the solvency
 * invariant `mBal m * price <= contract balance` (see liquidConditions.js).
 * A mapping credited with different prices gets no invariant.
 *
 * @function findLedgerMappings
 * @param {Object} fnInfo - Output of gatherFunctionDefinitions.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {Array<{name: string, price: string}>}
 */
function findLedgerMappings(fnInfo, stateInfo) {
  const prices = new Map(); // mapping name -> Set of prices
  const literal = e => {
    const code = translateExpression(e, [], stateInfo);
    return /^[0-9]+$/.test(code) ? code : null;
  };

  for (const fn of fnInfo.functions) {
    // Unit prices fixed by `require(msg.value == n * PRICE)`: identifier n -> PRICE.
    const unitPrice = new Map();
    walkAst(fn.body, node => {
      if (node.type !== 'FunctionCall' || node.expression.name !== 'require') return;
      const cond = node.arguments[0];
      if (!cond || cond.type !== 'BinaryOperation' || cond.operator !== '==') return;
      const product = isMsgValue(cond.left) ? cond.right : isMsgValue(cond.right) ? cond.left : null;
      if (!product || product.type !== 'BinaryOperation' || product.operator !== '*') return;
      for (const [units, price] of [[product.left, product.right], [product.right, product.left]]) {
        if (units.type === 'Identifier' && literal(price)) unitPrice.set(units.name, literal(price));
      }
    });

    walkAst(fn.body, node => {
      if (node.type !== 'BinaryOperation' || node.operator !== '+=' ||
          node.left.type !== 'IndexAccess' || node.left.base.type !== 'Identifier') return;
      const mapping = stateInfo.variables.find(v => v.isMapping && v.originalName === node.left.base.name);
      if (!mapping) return;
      const price = isMsgValue(node.right) ? '1'
        : node.right.type === 'Identifier' ? unitPrice.get(node.right.name) : undefined;
      if (!price) return;
      if (!prices.has(mapping.name)) prices.set(mapping.name, new Set());
      prices.get(mapping.name).add(price);
    });
  }

  return [...prices]
    .filter(([, set]) => set.size === 1)
    .map(([name, set]) => ({ name, price: [...set][0] }));
}

module.exports = { solidityToHaskell };
