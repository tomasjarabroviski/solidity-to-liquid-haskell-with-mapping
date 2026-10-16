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
    stateInfo.currentFunctionBody = fn.body;
    stateInfo.currentFunctionPayable = !!fn.isPayable;
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
    // An empty state-modifying body still needs a binding (it returns the
    // state, crediting msg.value when payable).
    if (fn.body && (fn.body.length > 0 || (fn.hasBody && !fn.isView && !fn.isPure))) {
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
        // A payable function receives msg.value before its body runs.
        const body = fn.isPayable ? [{ type: 'PayableCredit' }, ...fn.body] : fn.body;
        impl = `${fn.name} st${uniqueParams.length ? ' ' + paramNames : ''} = ${translateStatements(body, uniqueParams, stateInfo)}`;
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
  // A payable constructor starts out holding the ether it was deployed with.
  assignments.push(`balance${stateInfo.contractName} = ${stateInfo.currentFunctionPayable ? 'value msgctx' : '0'}`);
  //generate random number for address.
  assignments.push(`address${stateInfo.contractName} = fromString "${stateInfo.contractName}"`);

  // Mapping-type state vars (mapping(KeyType => uint) -> BalancedMap KeyType)
  // start out empty, mirroring Solidity's implicit default-initialization of
  // mappings (there is no literal mapping syntax to assign in the constructor
  // body, so this default is always correct for the common case).
  // Per-key writes in the constructor (`balances[msg.sender] = v;`) are
  // chained as setWB calls on top of empWB, in source order.
  const mappingVars = (stateInfo.variables || []).filter(v => v.isMapping);
  const mappingExprs = new Map(mappingVars.map(v => [v.name, 'empWB']));
  const toConstructorScope = code => code
    .replace(/\(msg[A-Za-z0-9_]+\s+st\)/g, 'msgctx')
    .replace(/\(block[A-Za-z0-9_]+\s+st\)/g, 'block');

  // Process constructor body
  desugarChainedAssignments(body).forEach(stmt => {
    if (stmt.type === 'ExpressionStatement' && stmt.expression.type !== 'FunctionCall') {
      const left = stmt.expression.left;
      if (left && left.type === 'IndexAccess') {
        const mapVar = mappingVars.find(v => left.base.type === 'Identifier' && v.originalName === left.base.name);
        const op = stmt.expression.operator;
        if (!mapVar || !['=', '+=', '-='].includes(op)) return;
        const key = toConstructorScope(translateExpression(left.index, uniqueParams, stateInfo));
        let value = toConstructorScope(translateExpression(stmt.expression.right, uniqueParams, stateInfo));
        const prev = mappingExprs.get(mapVar.name);
        if (op !== '=') {
          value = `((currentBalance (${prev}) ${key}) ${op === '+=' ? '+' : '-'} ${value})`;
        }
        mappingExprs.set(mapVar.name, `setWB (${prev}) ${key} ${value}`);
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

  for (const [name, expr] of mappingExprs) {
    assignments.push(`${name} = ${expr}`);
  }

  // Default-initialize any state variable that Solidity would implicitly
  // zero-initialize (address(0), 0, false, "", or the first enum member)
  // but that the constructor body above never explicitly assigns. Without
  // this, the generated record literal is missing fields; GHC still
  // compiles it (warnings are suppressed) by inserting a hidden
  // "recConError" thunk for each missing field, which then breaks Liquid
  // Haskell's PLE with a "casesToLg"/"Unexpected empty cases" error.
  // Mapping-typed vars are already defaulted to empWB above, and the
  // msg/block/balance/address fields are always injected standard fields,
  // so both are skipped here.
  const assignedFields = new Set(assignments.map(a => a.split('=')[0].trim()));
  const standardFields = new Set([
    `msg${stateInfo.contractName}`,
    `block${stateInfo.contractName}`,
    `balance${stateInfo.contractName}`,
    `address${stateInfo.contractName}`,
  ]);
  for (const v of (stateInfo.variables || [])) {
    if (v.isMapping) continue;
    if (standardFields.has(v.name)) continue;
    if (assignedFields.has(v.name)) continue;

    let defaultValue = '0';
    const init = v.initialValue;
    if (init && (init.type === 'NumberLiteral' || init.type === 'BooleanLiteral')) {
      // Inline initializer (`uint count = 1;`) runs before the constructor body.
      defaultValue = translateExpression(init, uniqueParams, stateInfo);
    } else if (v.type === 'Bool') {
      defaultValue = 'False';
    } else if (v.type === 'String') {
      defaultValue = '""';
    } else {
      const matchingEnum = (stateInfo.enums || []).find(e => e.name === v.type);
      if (matchingEnum && matchingEnum.members && matchingEnum.members.length > 0) {
        defaultValue = matchingEnum.members[0].name;
      }
    }
    assignments.push(`${v.name} = ${defaultValue}`);
  }

  // Format assignments with proper indentation and commas
  return assignments
  .map((assign, i) => i === 0 ? assign : `              ${assign}`)
  .join(',\n');
}

/**
 * Splits chained assignments (`a = b = c;`) into `b = c; a = c;`, so each
 * statement assigns a single target. The right-hand side is duplicated
 * instead of reading `b` back, since the constructor builds a record literal
 * whose fields can't refer to each other. The parser groups the chain as
 * `(a = b) = c`, so operands are flattened rather than relying on nesting.
 */
function desugarChainedAssignments(body) {
  const isAssignment = e => e && e.type === 'BinaryOperation' && e.operator === '=';
  const flatten = e => isAssignment(e) ? [...flatten(e.left), ...flatten(e.right)] : [e];
  const result = [];
  for (const stmt of body) {
    const expr = stmt.type === 'ExpressionStatement' ? stmt.expression : null;
    if (!isAssignment(expr) || !(isAssignment(expr.left) || isAssignment(expr.right))) {
      result.push(stmt);
      continue;
    }
    const operands = flatten(expr);
    const value = operands.pop();
    for (const target of operands.reverse()) {
      result.push({ ...stmt, expression: { ...expr, left: target, right: value } });
    }
  }
  return result;
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
