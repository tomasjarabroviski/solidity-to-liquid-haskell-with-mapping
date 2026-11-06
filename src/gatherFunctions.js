/**
 * @file gatherFunctions.js
 * @description Collects the function definitions of a Solidity contract
 *   (name, parameters, body and mutability) and normalizes their names
 *   into valid Haskell identifiers.
 */

const { solidityTypeToHaskellType } = require('./typeMappings');
const { lowerFirst } = require('./astUtils');

// Valid Solidity identifiers that are reserved words in Haskell.
const HASKELL_KEYWORDS = new Set(['case', 'class', 'data', 'default', 'deriving', 'do', 'else', 'foreign',
  'if', 'import', 'in', 'infix', 'infixl', 'infixr', 'instance', 'let', 'module', 'newtype', 'of',
  'then', 'type', 'where']);

/**
 * Creates a parameter name that is a valid Haskell identifier and does not
 * clash with a state variable (case-insensitively) or a Haskell keyword;
 * clashing names are prefixed with `_input_`.
 *
 * @function createUniqueParamName
 * @param {string} baseName - The Solidity parameter name.
 * @param {Array<Object>} stateVars - State variables (with their normalized `name`).
 * @returns {string} The Haskell parameter name.
 */
function createUniqueParamName(baseName, stateVars) {
  const normalized = lowerFirst(baseName);
  if (HASKELL_KEYWORDS.has(normalized) ||
      stateVars.some(v => v.name.toLowerCase() === normalized.toLowerCase())) {
    return `_input_${baseName}`;
  }
  return normalized;
}

/**
 * Collects and normalizes the function definitions of a contract.
 *
 * @function gatherFunctionDefinitions
 * @param {Object} contractNode - An AST node of type 'ContractDefinition'.
 * @param {string} [contractName=''] - Contract name (suffix of user-defined types).
 * @returns {Object} An object containing:
 *   - `functions`: the normalized function definitions.
 *   - `nameMap`: a Map from original to normalized function names.
 *
 * @example
 * // For `function increment(uint256 x) public { count += x; }` it returns:
 * // {
 * //   functions: [{
 * //     name: 'increment',
 * //     originalName: 'increment',
 * //     params: [{ name: 'x', type: 'Uint', originalName: 'x' }],
 * //     body: [...],          // AST nodes of the body statements
 * //     hasBody: true,
 * //     isView: false, isPure: false, isPayable: false,
 * //     returnType: null
 * //   }],
 * //   nameMap: new Map([['increment', 'increment']])
 * // }
 */
function gatherFunctionDefinitions(contractNode, contractName = '') {
  const fns = [];
  const nameMap = new Map();

  for (const subNode of contractNode.subNodes) {
    if (subNode.type === 'FunctionDefinition') {
      // Pre-0.5 contracts declare the constructor as a function named like
      // the contract (`function Token(...)`); the parser flags it as such.
      // `receive()` / `fallback()` (and the unnamed 0.4 `function()`) have no
      // name either, but they are ordinary entry points, not constructors.
      const originalName = subNode.isConstructor ? 'constructor'
        : subNode.isReceiveEther ? 'receive'
        : subNode.isFallback ? 'fallback'
        : (subNode.name || 'constructor');
      // `constant` is the pre-0.5 spelling of `view`.
      const isView = subNode.stateMutability === 'view' || subNode.stateMutability === 'constant';
      const normalizedName = lowerFirst(originalName);

      // Only view/pure functions return a value; the others return the new state.
      const returnType = subNode.returnParameters?.[0]?.typeName;
      const hasReturnType = returnType && (isView || subNode.stateMutability === 'pure');

      nameMap.set(originalName, normalizedName);

      const paramInfos = subNode.parameters.map((param, idx) => {
        const hsType = solidityTypeToHaskellType(param.typeName, contractName);
        const paramName = param.name || `arg${idx}`;
        return {
          name: paramName,
          type: hsType,
          originalName: param.name
        };
      });

      fns.push({
        name: normalizedName,
        originalName: originalName,
        params: paramInfos,
        body: subNode.body ? subNode.body.statements : [],
        // Interface/abstract functions have no body; `receive() external payable {}` has an empty one.
        hasBody: !!subNode.body,
        isView,
        isPure: subNode.stateMutability === 'pure',
        isPayable: subNode.stateMutability === 'payable',
        returnType: hasReturnType ? solidityTypeToHaskellType(returnType, contractName) : null
      });
    }
  }
  return { functions: fns, nameMap };
}

module.exports = {
  gatherFunctionDefinitions,
  createUniqueParamName
};
