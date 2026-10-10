/**
 * @file index.js
 * @description The main entry point that exports a single function `solidityToHaskell`.
 *              This function parses the Solidity code into an AST, gathers relevant information,
 *              and generates Haskell code for each contract found.
 */

const parser = require('@solidity-parser/parser');
const { gatherStateDefinitions } = require('./gatherState');
const { gatherFunctionDefinitions } = require('./gatherFunctions');
const { generateHaskellData } = require('./generateData');
const { generateHaskellFunctions, REVERT_FUNCTION } = require('./generateFunctions');
const { msgDefinition } = require('./typeMappings');
const { LIQUID_ANNOTATIONS } = require('./liquidConditions');
const { MAP_DEFINITION } = require('./mapDefinitions');
const { translateExpression } = require('./translator');

/**
 * The main function that receives a string of Solidity code, parses the AST,
 * and generates a Haskell module for each contract found.
 * 
 * @function solidityToHaskell
 * @param {string} code - A string containing the Solidity source code to be translated.
 * @param {Object} [options]
 * @param {boolean} [options.checkOverflow=false] - Bound uint by 2^256-1 so
 *   overflows are reported, and evaluate conditions with wrapping arithmetic.
 * @returns {string} A string containing all the generated Haskell code, separated into modules for each contract.
 * 
 * @example
 * const solidityCode = `
 *   contract Counter {
 *     uint256 public count;
 *     function increment(uint x) public {
 *       count = count + x;
 *     }
 *   }
 * `;
 * const haskellResult = solidityToHaskell(solidityCode);
 * console.log(haskellResult);
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

  // Track contracts and their dependencies
  let contracts = [];
  let moduleWritten = false;
  let haskellOutput = [];

  // First pass: Gather all contracts
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

  // Write shared module header once
  if (!moduleWritten) {
    // Determine main module name from first contract
    const mainModule = contracts[0]?.name || 'Main';
    haskellOutput.push(LIQUID_ANNOTATIONS);
    haskellOutput.push(`module ${mainModule} where\n`);
    if (usesMappings) {
      haskellOutput.push('import qualified Data.Set as S');
    }
    haskellOutput.push(msgDefinition(checkOverflow));
    haskellOutput.push(REVERT_FUNCTION);
    if (usesMappings) {
      haskellOutput.push(MAP_DEFINITION);
    }
    moduleWritten = true;
  }
  
  // Generate code for all contracts
  for (const contract of contracts) {
    // Generate data types and functions
    haskellOutput.push(generateCallFunction(contract.name, contract.stateInfo));
    haskellOutput.push(generateHaskellData(contract.name, contract.stateInfo));
    haskellOutput.push('');
    haskellOutput.push(generateHaskellFunctions(contract.name, contract.fnInfo, contract.stateInfo));
    haskellOutput.push('');
  }

  return haskellOutput.join('\n');
}



/**
 * Mappings that account for received ether, with the price of one unit:
 *  - `m[k] += msg.value`                                   -> price 1 (wei)
 *  - `require(msg.value == n * PRICE); ... m[k] += n;`     -> price PRICE
 * (PRICE must be a numeric literal or constant). They get the solvency
 * invariant `mBal m * price <= contract balance` (see liquidConditions.js).
 * A mapping credited with different prices gets no invariant.
 * @returns {Array<{name: string, price: string}>}
 */
function findLedgerMappings(fnInfo, stateInfo) {
  const prices = new Map(); // mapping name -> Set of prices
  const isMsgValue = e => e && e.type === 'MemberAccess' && e.memberName === 'value' && e.expression.name === 'msg';
  const literal = e => {
    const code = translateExpression(e, [], stateInfo);
    return /^[0-9]+$/.test(code) ? code : null;
  };
  const walk = (node, f) => {
    if (!node || typeof node !== 'object') return;
    f(node);
    Object.values(node).forEach(child => Array.isArray(child) ? child.forEach(c => walk(c, f)) : walk(child, f));
  };

  for (const fn of fnInfo.functions) {
    // Unit prices fixed by `require(msg.value == n * PRICE)`: identifier n -> PRICE.
    const unitPrice = new Map();
    walk(fn.body, node => {
      if (node.type !== 'FunctionCall' || node.expression.name !== 'require') return;
      const cond = node.arguments[0];
      if (!cond || cond.type !== 'BinaryOperation' || cond.operator !== '==') return;
      const product = isMsgValue(cond.left) ? cond.right : isMsgValue(cond.right) ? cond.left : null;
      if (!product || product.type !== 'BinaryOperation' || product.operator !== '*') return;
      for (const [units, price] of [[product.left, product.right], [product.right, product.left]]) {
        if (units.type === 'Identifier' && literal(price)) unitPrice.set(units.name, literal(price));
      }
    });

    walk(fn.body, node => {
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

// TODO: move function to separate file
function generateCallFunction(moduleName, stateInfo){
  const filteredNames = stateInfo.variables
  // Todo menos 'balance' queda igual tras la llamada. Incluye los mappings:
  // en la refinación `==` es igualdad lógica (no necesita instancia Eq), y
  // hace falta para que la invariante de solvencia sobreviva a un transfer.
  .filter(variable => variable.name !== 'balance' + moduleName)
  .map(variable => variable.name);

  const equalityConditions = filteredNames
  .map(name => `(${name} ctx' == ${name} ctx)`)
  .join(' && ');


  return `
{-@ call${moduleName} :: ctx:${moduleName}State
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balance${moduleName} ctx}
           -> ctx':{ ${moduleName}State | balance${moduleName} ctx' == balance${moduleName} ctx - amount  && ${equalityConditions}}
@-}
call${moduleName}:: ${moduleName}State -> Address -> Amount -> ${moduleName}State
call${moduleName} ctx _addr amount = ctx { balance${moduleName} = balance${moduleName} ctx - amount }
`
}


module.exports = { solidityToHaskell };
