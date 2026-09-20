/**
 * @file generateFunctions.js
 * @description Exports functionality to generate Haskell function signatures and bodies
 * from collected Solidity function definitions.
 */

const { translateStatements, translateExpression } = require('./translator');
const { createUniqueParamName } = require('./gatherFunctions');
const { generateLiquidAnnotation } = require('./liquidConditions');
const { normalizeVariableName } = require('./gatherState');
/**
 * Generates Haskell function definitions (type signatures and partially translated bodies)
 * based on Solidity function definitions and state variables.
 * 
 * @function generateHaskellFunctions
 * @param {string} contractName - The name of the Solidity contract (used as a Haskell state type suffix).
 * @param {Object} fnInfo - An object containing:
 *   - `functions`: An array of functions with parameters, names, and bodies.
 * @param {Object} stateInfo - An object containing:
 *   - `variables`: An array of state variables.
 *   - `enums`: An array of enum definitions.
 * @returns {string} The Haskell function definitions as a single concatenated string.
 * 
 * @example
 * // If fnInfo includes a function named "increment" with one parameter:
 * // increment :: CounterState -> Integer -> CounterState
 * // increment st x = st { count = count st + x }
 */
function generateHaskellFunctions(contractName, fnInfo, stateInfo) {
  let lines = [];

  for (let fn of fnInfo.functions) {
    const uniqueParams = fn.params.map(p => ({
      originalName: p.name,
      name: createUniqueParamName(p.name, stateInfo.variables), 
      type: p.type
    }));
    
    const paramTypes = uniqueParams.map(p => p.type).join(' -> ');
    let typeSig;

    if (fn.name === 'constructor') {
      typeSig = `${fn.name+stateInfo.contractName} :: Message -> Block -> ${paramTypes}`
        + (paramTypes ? ' -> ' : '') 
        + `${contractName}State`;
    } else if (fn.isView || fn.isPure) {
      // View/Pure function: state -> parameters -> return type
      typeSig = `${fn.name} :: ${contractName}State` 
        + (uniqueParams.length ? ` -> ${paramTypes}` : '')
        + ` -> ${fn.returnType || 'UnknownType'}`;
    } else {
      // State-modifying function: state -> parameters -> state
      typeSig = `${fn.name} :: ${contractName}State` 
        + (uniqueParams.length ? ` -> ${paramTypes}` : '')
        + ` -> ${contractName}State`;
    }
    
    const paramNames = uniqueParams.map(p => p.name).join(' ');

    lines.push(generateLiquidAnnotation(contractName, fn, uniqueParams, stateInfo));
    
    let impl;
    if (fn.body && fn.body.length > 0) {
      if (fn.name === 'constructor') {
        const assignments = getConstructorAssignments(fn.body, uniqueParams, stateInfo);
        impl = `${fn.name+stateInfo.contractName} msgctx block ${paramNames} = ${contractName}State
            { ${assignments}
            }`;
      } else if (fn.isView || fn.isPure) {
          // Handle view/pure function return statement with proper indentation
          const body = translateStatements(fn.body, uniqueParams, stateInfo, 1, true);
          impl = `${fn.name} st${uniqueParams.length ? ' ' + paramNames : ''} = \n  ${body}`;
      } else {
        impl = `${fn.name} st${uniqueParams.length ? ' ' + paramNames : ''} = ${translateStatements(fn.body, uniqueParams, stateInfo)}`;
      }
    }

    lines.push(typeSig);
    lines.push(impl);
    lines.push('');
  }

  return lines.join('\n');
}


function getConstructorAssignments(body, uniqueParams, stateInfo) {
  const assignments = [];

  // Standard assignments
  assignments.push(`msg${stateInfo.contractName} = msgctx`);
  assignments.push(`block${stateInfo.contractName} = block`);
  assignments.push(`balance${stateInfo.contractName} = 0`);
  //generate random number for address.
  assignments.push(`address${stateInfo.contractName} = fromString "${stateInfo.contractName}"`);

  // Mapping-type state vars (mapping(KeyType => uint) -> BalancedMap KeyType)
  // start out empty, mirroring Solidity's implicit default-initialization of
  // mappings (there is no literal mapping syntax to assign in the constructor
  // body, so this default is always correct for the common case).
  const mappingVars = (stateInfo.variables || []).filter(v => v.isMapping);
  for (const mappingVar of mappingVars) {
    assignments.push(`${mappingVar.name} = empWB`);
  }

  // Process constructor body
  body.forEach(stmt => {
    if (stmt.type === 'ExpressionStatement' && stmt.expression.type !== 'FunctionCall') {
      // Per-key mapping writes inside a constructor (e.g. `balances[msg.sender] = v;`)
      // aren't supported yet -- the mapping keeps its empWB default above.
      if (stmt.expression.left && stmt.expression.left.type === 'IndexAccess') {
        return;
      }
      const leftVar = stmt.expression.left.name;
      if (stmt.expression.right.type === 'MemberAccess' && 
          (stmt.expression.right.memberName === 'sender' || stmt.expression.right.memberName === 'value')) {
            const stateVar = stateInfo.variables.find(v => v.originalName === leftVar);
            if (stateVar) {
              assignments.push(`${stateVar.name} = ${stmt.expression.right.memberName} msgctx`);
            }
            else{
              assignments.push(`${normalizeVariableName(leftVar)} = ${stmt.expression.right.memberName} msgctx`);
    
            }
      }
      else if (stmt.expression.right.type === 'MemberAccess'){
        const memberName = stmt.expression.right.memberName;
        const stateVar = stateInfo.variables.find(v => v.originalName === leftVar);
        const selectedEnum = stateInfo.enums.find(e => e.originalName === stmt.expression.right.expression.name);
        if (selectedEnum) {
          const member = selectedEnum.members.find(m => m.originalName === memberName);
          if (stateVar) {
            assignments.push(`${stateVar.name} = ${member.name}`);
          }
          else{
            assignments.push(`${normalizeVariableName(leftVar)} = ${member.name}`);
  
          }
        }
      }
      else if (stmt.expression.right.type === 'FunctionCall' && stmt.expression.right.expression.name === 'payable' ) {
        const stateVar = stateInfo.variables.find(v => v.originalName === leftVar);
        let param = translateExpression(stmt.expression.right.arguments[0], uniqueParams, stateInfo);
        // remove the word "st" of param if it exists:
        if (param.match(/\(msg[a-zA-Z]+\s+st\)/)) {
          param = param.replace(/\(msg[a-zA-Z]+\s+st\)/, "msgctx");
        }
        if (stateVar) {
          assignments.push(`${stateVar.name} = ${param}`);
        }
        else{
          assignments.push(`${normalizeVariableName(leftVar)} = ${param}`);
  
        }
      }
      else if (stmt.expression.right.type === 'FunctionCall' && 
              stmt.expression.right.expression.name === 'address') {
          const stateVar = stateInfo.variables.find(v => v.originalName === leftVar);
          let param;
          if (stmt.expression.right.arguments[0]?.name === 'this') {
            param = `fromString "${stateInfo.contractName}"`;
          }
          else if (stmt.expression.right.arguments[0]?.type === 'NumberLiteral') {
            param = stmt.expression.right.arguments[0].number
          }
          
          if (stateVar) {
            assignments.push(`${stateVar.name} = ${param}`);
          } else {
            assignments.push(`${normalizeVariableName(leftVar)} = ${param}`);
          }
      }
      else if (stmt.expression.right.type === 'BinaryOperation' || stmt.expression.right.type === 'BooleanLiteral') {
        const stateVar = stateInfo.variables.find(v => v.originalName === leftVar);
        let param = translateExpression(stmt.expression.right, uniqueParams, stateInfo);
        if (param.match(/\(msg[a-zA-Z]+\s+st\)/)) {
          param = param.replace(/\(msg[a-zA-Z]+\s+st\)/, "msgctx");
        }
        if (param.match(/\(block[a-zA-Z]+\s+st\)/)) {
          param = param.replace(/\(block[a-zA-Z]+\s+st\)/, "block");
        }
        if (stateVar) {
          assignments.push(`${stateVar.name} = ${param}`);
        }
        else{
          assignments.push(`${normalizeVariableName(leftVar)} = ${param}`);
  
        }
      }
      else if (stmt.expression.right.type === 'NumberLiteral') {
        const stateVar = stateInfo.variables.find(v => v.originalName === leftVar);
        if (stateVar) {
          assignments.push(`${stateVar.name} = ${stmt.expression.right.number}`);
        }
        else{
          assignments.push(`${normalizeVariableName(leftVar)} = ${stmt.expression.right.number}`);
  
        }
      }
      else {
        // Find matching uniqueParam for the right-side variable
        const param = uniqueParams.find(p => p.originalName === stmt.expression.right.name);
        const paramName = param ? param.name : stmt.expression.right.name;
        const stateVar = stateInfo.variables.find(v => v.originalName === leftVar);
        if (stateVar) {
          assignments.push(`${stateVar.name} = ${paramName}`);
        }
        else{
          assignments.push(`${normalizeVariableName(leftVar)} = ${paramName}`);

        }
      }
    }
  });

  // Format assignments with proper indentation and commas
  return assignments
  .map((assign, i) => i === 0 ? assign : `              ${assign}`)
  .join(',\n');
}

/**
 * A predefined Haskell function to handle reverts, included in generated code.
 * 
 * @constant REVERT_FUNCTION
 * @type {string}
 **/
const REVERT_FUNCTION = `
{-@ revert :: {v:String | False} -> a  @-}
revert :: String -> a
revert  = error
`;

module.exports = {
  generateHaskellFunctions,
  getConstructorAssignments,
  REVERT_FUNCTION
};
