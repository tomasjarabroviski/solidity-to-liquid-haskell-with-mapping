/**
 * @file gatherState.js
 * @description Collects the state of a Solidity contract (state variables,
 *   enums and numeric constants) and normalizes it into the fields of the
 *   generated Haskell state record.
 */

const { solidityTypeToHaskellType } = require('./typeMappings');
const { lowerFirst } = require('./astUtils');

/**
 * Collects the state variables, enums and numeric constants of a contract.
 *
 * Every generated name is suffixed with the contract name, so that several
 * contracts can live in the same Haskell module. Besides the user's
 * variables, four built-in fields are always added: `msg`, `block`, the
 * contract's ether `balance` and its own `address`.
 *
 * @function gatherStateDefinitions
 * @param {Object} contractNode - An AST node of type 'ContractDefinition'.
 * @param {string} contractName - The (normalized) contract name.
 * @returns {Object} The contract's `stateInfo`, containing:
 *   - `variables`: state variables with normalized names and Haskell types.
 *   - `enums`: enum definitions with their names and members.
 *   - `constants`: a Map from constant name to its NumberLiteral node.
 *   - `nameMap`: a Map from original to normalized state variable names.
 *   - `localVars`, `contractInstances`: filled in during translation.
 *   - `contractName`.
 *
 * @example
 * // For `uint256 public count;` in contract `C`, `variables` contains
 * //   { name: 'countC', type: 'Uint', originalName: 'count',
 * //     isMapping: false, mapKeyType: null, initialValue: null }
 * // after the four built-in fields (msgC, blockC, balanceC, addressC).
 */
function gatherStateDefinitions(contractNode, contractName) {
  const vars = [];
  const enums = [];
  const nameMap = new Map();

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

  // Numeric constants (`uint constant PRICE = 1 ether;`) can't change, so
  // they are inlined as literals instead of being state fields that could
  // hold any value. Keeps arithmetic with them linear for the SMT solver.
  const constants = new Map();

  for (const subNode of contractNode.subNodes) {
    if (subNode.type === 'StateVariableDeclaration') {
      for (const variable of subNode.variables) {
        if (variable.name && variable.isDeclaredConst && variable.expression?.type === 'NumberLiteral') {
          constants.set(variable.name, variable.expression);
          continue;
        }
        if (variable.name) {
          let hsType;
          let isMapping = false;
          let mapKeyType = null;
          if (variable.typeName.type === 'Mapping') {
            // mapping(KeyType => uint) -> BalancedMap KeyType (see mapDefinitions.js).
            // Only mappings to a non-negative number are supported, the most
            // common case in real contracts (balances, allowances, counters...).
            mapKeyType = solidityTypeToHaskellType(variable.typeName.keyType, contractName);
            hsType = `BalancedMap ${mapKeyType}`;
            isMapping = true;
          } else if (variable.typeName.type === 'UserDefinedTypeName') {
            hsType = variable.typeName.namePath + contractName;
          } else {
            hsType = solidityTypeToHaskellType(variable.typeName, contractName);
          }
          let normalizedName = lowerFirst(variable.name + contractName);
          // A user variable named like a built-in field (e.g. `uint balance`)
          // shadows it in Solidity: rename the field so the record has no
          // duplicate, and hide the built-in from identifier lookups.
          const builtin = vars.find(v => v.name === normalizedName);
          if (builtin) {
            normalizedName = lowerFirst(variable.name + '_' + contractName);
            builtin.originalName = '__builtin_' + builtin.originalName;
          }
          nameMap.set(variable.name, normalizedName);
          vars.push({
            name: normalizedName,
            type: hsType,
            originalName: variable.name,
            isMapping,
            mapKeyType,
            initialValue: variable.expression || null
          });
        }
      }
    } else if (subNode.type === 'EnumDefinition') {
      enums.push({
        originalName: subNode.name,
        name: subNode.name + contractName,
        members: subNode.members.map(m => ({ name: m.name + contractName, originalName: m.name }))
      });
    }
  }
  return {
    contractInstances: {},
    constants: constants,
    variables: vars,
    enums: enums,
    nameMap: nameMap,
    localVars: new Set(),
    contractName: contractName
  };
}

/**
 * Generates a Haskell `data` type definition for an enum.
 *
 * @function generateEnumType
 * @param {Object} enumDef - Enum definition, as gathered by gatherStateDefinitions.
 * @returns {string} A Haskell `data` type definition for the enum.
 *
 * @example
 * // For enum `StateType { Pending, Approved }` in contract `C`:
 * // "data StateTypeC = PendingC | ApprovedC deriving (Show, Eq)"
 */
function generateEnumType(enumDef) {
  return `data ${enumDef.name} = ${enumDef.members.map(m => m.name).join(' | ')} deriving (Show, Eq)`;
}

module.exports = {
  gatherStateDefinitions,
  generateEnumType
};
