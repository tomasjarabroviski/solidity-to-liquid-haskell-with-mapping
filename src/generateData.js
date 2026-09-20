/**
 * @file generateData.js
 * @description Exports functionality to generate Haskell `data` definitions from Solidity state variables and enums.
 */

const { generateEnumType } = require('./gatherState');

/**
 * Generates a Haskell `data` definition for the contract's state using the state variables and enums.
 * 
 * @function generateHaskellData
 * @param {string} contractName - The name of the Solidity contract (used as the Haskell type name).
 * @param {Object} stateInfo - An object containing:
 *   - `variables`: An array of state variables with names and Haskell types.
 *   - `enums`: An array of enum definitions.
 * @returns {string} A string representing the Haskell `data` type definition.
 * 
 * @example
 * // If stateInfo contains:
 * //   variables = [{ name: 'count', type: 'Integer' }, { name: 'owner', type: 'String' }],
 * //   enums = [{ name: 'StateType', members: ['Pending', 'Approved'] }],
 * // and contractName = 'Counter',
 * // the result might be:
 * // "data StateType = Pending | Approved deriving (Show, Eq)\n\ndata CounterState = CounterState {\n  count :: Integer,\n  owner :: String\n}"
 */
function generateHaskellData(contractName, stateInfo) {
  let output = [];

  // Generate enum types first
  if (stateInfo.enums) {
    for (let enumDef of stateInfo.enums) {
      output.push(generateEnumType(enumDef));
    }
    output.push(''); // Add a blank line
  }

  // Generate state data type
  if (stateInfo.variables.length === 0) {
    output.push(`data ${contractName}State = ${contractName}State`);
  } else {
    const lines = stateInfo.variables
      .map((v) => `  ${v.name} :: ${v.type}`)
      .join(',\n');
    contractState = `data ${contractName}State = ${contractName}State {\n${lines}\n}`;
    output.push(`{-@ ${contractState}\n@-} \n`);
    output.push(contractState);
  }

  return output.join('\n');
}

module.exports = {
  generateHaskellData
};
