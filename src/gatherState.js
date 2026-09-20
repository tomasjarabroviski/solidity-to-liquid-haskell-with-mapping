/**
 * @file gatherState.js
 * @description Provides functionality to gather and normalize Solidity state variables from a ContractDefinition AST node.
 */

const { solidityTypeToHaskellType } = require('./typeMappings');

/**
 * Collects state variable definitions and enum declarations from a Solidity ContractDefinition AST node.
 * 
 * @function gatherStateDefinitions
 * @param {Object} contractNode - An AST node of type 'ContractDefinition'.
 * @returns {Object} An object containing:
 *   - `variables`: An array of state variables with normalized names and Haskell types.
 *   - `enums`: An array of enum definitions with their names and members.
 *   - `nameMap`: A mapping of original to normalized state variable names.
 * 
 * @example
 * // For a Solidity state variable:
 * //   uint256 public count;
 * // it could return:
 * // {
 * //   variables: [{ name: 'count', type: 'Integer', originalName: 'count' }],
 * //   enums: [],
 * //   nameMap: new Map([['count', 'count']])
 * // }
 */
function gatherStateDefinitions(contractNode, contractName) {
  let vars = [];
  let enums = [];
  let nameMap = new Map(); // Track original to normalized names

  vars.push({
    name: 'msg' + contractName,
    type: 'Message',
    originalName: 'msg'
  });

  vars.push({
    name: 'block' + contractName,
    type: 'Block',
    originalName: 'block'
  });

  vars.push({
    name: 'balance' + contractName,
    type: 'Amount',
    originalName: 'balance'
  });

  vars.push({
    name: 'address' + contractName,
    type: 'Address',
    originalName: 'address'
  });

  for (let subNode of contractNode.subNodes) {
    if (subNode.type === 'StateVariableDeclaration') {
      for (let variable of subNode.variables) {
        if (variable.name) {
          let hsType;
          let isMapping = false;
          let mapKeyType = null;
          if (variable.typeName.type === 'Mapping') {
            // mapping(KeyType => uint) -> BalancedMap KeyType (ver mapDefinitions.js).
            // Solo se soporta mapeo a un tipo numerico no negativo (el caso mas
            // comun en contratos reales: balances, allowances, contadores, etc.).
            mapKeyType = solidityTypeToHaskellType(variable.typeName.keyType, contractName);
            hsType = `BalancedMap ${mapKeyType}`;
            isMapping = true;
          }
          else if (variable.typeName.type === 'UserDefinedTypeName') {
            hsType = variable.typeName.namePath + contractName;
            }
          else{
            hsType = solidityTypeToHaskellType(variable.typeName, contractName);
          }
          let normalizedName = normalizeVariableName(variable.name + contractName);
          nameMap.set(variable.name, normalizedName);
          vars.push({ 
            name: normalizedName, 
            type: hsType,
            originalName: variable.name,
            isMapping,
            mapKeyType
          });
        }
      }
    } else if (subNode.type === 'EnumDefinition') {
      enums.push({
        originalName: subNode.name,
        name: subNode.name + contractName,
        members: subNode.members.map(m => ({name: m.name + contractName, originalName: m.name}))
      });
    }
  }
  return {
    contractInstances: {},
    variables: vars, 
    enums: enums,
    nameMap: nameMap,
    localVars: new Set(), // Track local variables
    contractName: contractName
  };
}

/**
 * Normalizes a state variable name by converting its first character to lowercase.
 * 
 * @function normalizeVariableName
 * @param {string} name - The state variable name to normalize.
 * @returns {string} The normalized name.
 */
function normalizeVariableName(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Generates a Haskell `data` type definition for an enum.
 * 
 * @function generateEnumType
 * @param {Object} enumDef - An object representing the enum definition with `name` and `members`.
 * @returns {string} A Haskell `data` type definition for the enum.
 * 
 * @example
 * // For an enum definition:
 * //   { name: 'StateType', members: ['Pending', 'Approved', 'Rejected'] }
 * // it could return:
 * // "data StateType = Pending | Approved | Rejected deriving (Show, Eq)"
 */
function generateEnumType(enumDef) {
  return `data ${enumDef.name} = ${enumDef.members.map(m => m.name).join(' | ')} deriving (Show, Eq)`;
}

module.exports = {
  gatherStateDefinitions,
  generateEnumType,
  normalizeVariableName
};
