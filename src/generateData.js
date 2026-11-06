/**
 * @file generateData.js
 * @description Generates the Haskell `data` definitions of a contract: its
 *   enums and its state record.
 */

const { generateEnumType } = require('./gatherState');

/**
 * Generates the enum types and the state record of a contract. The record
 * is emitted twice: as a Liquid Haskell `data` spec (so its fields'
 * refinements, such as `Uint`, are enforced) and as the plain Haskell type.
 *
 * @function generateHaskellData
 * @param {string} contractName - Contract name (the record is `<Name>State`).
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {string} The Haskell definitions.
 *
 * @example
 * // For contract `Counter` with `uint count`:
 * // {-@ data CounterState = CounterState {
 * //   msgCounter :: Message,
 * //   ...
 * //   countCounter :: Uint
 * // }
 * // @-}
 * // data CounterState = CounterState { ...same fields... }
 */
function generateHaskellData(contractName, stateInfo) {
  const output = [];

  if (stateInfo.enums) {
    for (const enumDef of stateInfo.enums) {
      output.push(generateEnumType(enumDef));
    }
    output.push('');
  }

  if (stateInfo.variables.length === 0) {
    output.push(`data ${contractName}State = ${contractName}State`);
  } else {
    const lines = stateInfo.variables
      .map((v) => `  ${v.name} :: ${v.type}`)
      .join(',\n');
    const contractState = `data ${contractName}State = ${contractName}State {\n${lines}\n}`;
    output.push(`{-@ ${contractState}\n@-} \n`);
    output.push(contractState);
  }

  return output.join('\n');
}

module.exports = {
  generateHaskellData
};
