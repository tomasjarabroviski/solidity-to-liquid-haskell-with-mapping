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
const {MSG_DEFINITION} = require('./typeMappings');
const { LIQUID_ANNOTATIONS } = require('./liquidConditions');
const { MAP_DEFINITION } = require('./mapDefinitions');

/**
 * The main function that receives a string of Solidity code, parses the AST,
 * and generates a Haskell module for each contract found.
 * 
 * @function solidityToHaskell
 * @param {string} code - A string containing the Solidity source code to be translated.
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
function solidityToHaskell(code) {
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
      const contractName = node.name || 'UnnamedContract';
      const stateInfo = gatherStateDefinitions(node, contractName);
      const fnInfo = gatherFunctionDefinitions(node, contractName);

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
    haskellOutput.push(MSG_DEFINITION);
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



// TODO: move function to separate file
function generateCallFunction(moduleName, stateInfo){
  const filteredNames = stateInfo.variables
  // BalancedMap no deriva Eq, así que se excluye de esta condición de
  // igualdad estructural igual que 'balance' (además, comparar mappings
  // grandes con == no aportaría demasiado en esta postcondición).
  .filter(variable => variable.originalName !== 'balance' && !variable.isMapping)
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
