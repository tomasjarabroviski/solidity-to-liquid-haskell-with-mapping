/**
 * @file gatherFunctions.js
 * @description Provides functionality to gather and normalize Solidity function definitions from a ContractDefinition AST node.
 */

const { solidityTypeToHaskellType } = require('./typeMappings');

/**
 * Normalizes an identifier by converting its first character to lowercase.
 * 
 * @function normalizeIdentifier
 * @param {string} name - The identifier to normalize.
 * @returns {string} The normalized identifier.
 */
function normalizeIdentifier(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Creates a unique parameter name by checking against existing state variable names.
 * 
 * @function createUniqueParamName
 * @param {string} baseName - The base name of the parameter.
 * @param {Array<Object>} stateVars - An array of state variables with their names.
 * @returns {string} A unique parameter name.
 */
function createUniqueParamName(baseName, stateVars) {
  const normalized = normalizeIdentifier(baseName);
  if (stateVars.some(v => v.name.toLowerCase() === normalized.toLowerCase())) {
    return `_input_${baseName}`;
  }
  return normalized;
}

/**
 * Collects and normalizes function definitions from a Solidity ContractDefinition AST node.
 * 
 * @function gatherFunctionDefinitions
 * @param {Object} contractNode - An AST node of type 'ContractDefinition'.
 * @returns {Object} An object containing:
 *   - `functions`: An array of normalized function definitions with parameters and body.
 *   - `nameMap`: A mapping of original to normalized function names.
 * 
 * @example
 * // For a Solidity function:
 * //   function increment(uint256 x) public { count += x; }
 * // it could return:
 * // {
 * //   functions: [
 * //     {
 * //       name: 'increment',
 * //       originalName: 'increment',
 * //       params: [{ name: 'x', type: 'Integer', originalName: 'x' }],
 * //       body: [...] // AST nodes for the function body
 * //     }
 * //   ],
 * //   nameMap: new Map([['increment', 'increment']])
 * // }
 */
function gatherFunctionDefinitions(contractNode, contractName='') {
  let fns = [];
  let nameMap = new Map();

  for (let subNode of contractNode.subNodes) {
    if (subNode.type === 'FunctionDefinition') {
      const originalName = subNode.name || 'constructor';
      const normalizedName = normalizeIdentifier(originalName);

      // Add return type information
      const returnType = subNode.returnParameters?.[0]?.typeName;
      const hasReturnType = returnType && (subNode.stateMutability === 'view' || subNode.stateMutability === 'pure');
      
      nameMap.set(originalName, normalizedName);

      let paramInfos = subNode.parameters.map((param, idx) => {
        let hsType = solidityTypeToHaskellType(param.typeName, contractName); 
        let paramName = param.name || `arg${idx}`;
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
        isView: subNode.stateMutability === 'view',
        isPure: subNode.stateMutability === 'pure',
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
