/**
 * @file generateFunctions.js
 * @description Generates the Haskell functions of a contract: for each
 *   Solidity function, its Liquid Haskell refinement type, its Haskell type
 *   signature and its translated body; plus the `call<Contract>` model of
 *   sending ether and the shared `revert` function.
 */

const { translateStatements, translateExpression } = require('./translator');
const { createUniqueParamName } = require('./gatherFunctions');
const { generateLiquidAnnotation, splitAsserts } = require('./liquidConditions');
const { lowerFirst } = require('./astUtils');

/**
 * Generates the Haskell functions of a contract. Their shape depends on the
 * kind of Solidity function:
 *  - constructor:     `constructor<Name> :: Message -> Block -> params -> <Name>State`
 *  - view/pure:       `f :: <Name>State -> params -> ReturnType`
 *  - state-modifying: `f :: <Name>State -> params -> <Name>State`
 *
 * @function generateHaskellFunctions
 * @param {string} contractName - Contract name (prefix of the state type).
 * @param {Object} fnInfo - Output of gatherFunctionDefinitions.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {string} The Haskell function definitions.
 *
 * @example
 * // `function increment(uint x) public { count += x; }` in contract Counter:
 * // {-@ increment :: {st:CounterState | True} -> {x:Uint | True} -> {v:CounterState | True} @-}
 * // increment :: CounterState -> Uint -> CounterState
 * // increment st x = let
 * //   st1 = st { countCounter = ((countCounter st) + x) }
 * //     in
 * //       st1
 */
function generateHaskellFunctions(contractName, fnInfo, stateInfo) {
  const lines = [];

  for (const fn of fnInfo.functions) {
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
      typeSig = `${fn.name + stateInfo.contractName} :: Message -> Block -> ${paramTypes}`
        + (paramTypes ? ' -> ' : '')
        + `${contractName}State`;
    } else if (fn.isView || fn.isPure) {
      typeSig = `${fn.name} :: ${contractName}State`
        + (uniqueParams.length ? ` -> ${paramTypes}` : '')
        + ` -> ${fn.returnType || 'UnknownType'}`;
    } else {
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
        impl = `${fn.name + stateInfo.contractName} msgctx block ${paramNames} = ${contractName}State
            { ${assignments}
            }`;
        // The constructor builds the state as a single record, so its asserts
        // are only checked as postconditions, which requires them to end it.
        if (splitAsserts(fn.body).other.length > 0) {
          impl += '\n-- skipped assert statement (not at the end of the constructor)';
        }
      } else if (fn.isView || fn.isPure) {
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

/**
 * Builds the field assignments of the record literal returned by the
 * constructor. A constructor has no previous state, so `msg.*` and
 * `block.*` refer to its `msgctx` and `block` arguments instead of `st`.
 *
 * Fields are filled in this order: the built-in fields (msg, block,
 * balance, address), the assignments of the constructor body, the mappings
 * (as a chain of `setWB` writes on an empty map) and finally a default
 * value for every field the constructor never assigns.
 *
 * @function getConstructorAssignments
 * @param {Array<Object>} body - AST nodes of the constructor body.
 * @param {Array<{name: string, type: string, originalName: string}>} uniqueParams - Constructor parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {string} The comma-separated `field = value` assignments.
 */
function getConstructorAssignments(body, uniqueParams, stateInfo) {
  const assignments = [];

  // Built-in fields.
  assignments.push(`msg${stateInfo.contractName} = msgctx`);
  assignments.push(`block${stateInfo.contractName} = block`);
  // A payable constructor starts out holding the ether it was deployed with.
  assignments.push(`balance${stateInfo.contractName} = ${stateInfo.currentFunctionPayable ? 'value msgctx' : '0'}`);
  // The contract's own address: a deterministic hash of its name.
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

  // Assignments of the constructor body. The target is the state field
  // named `leftVar`, or the normalized name itself if there is none.
  const assign = (leftVar, value) => {
    const stateVar = stateInfo.variables.find(v => v.originalName === leftVar);
    assignments.push(`${stateVar ? stateVar.name : lowerFirst(leftVar)} = ${value}`);
  };
  desugarChainedAssignments(body).forEach(stmt => {
    if (stmt.type !== 'ExpressionStatement' || stmt.expression.type === 'FunctionCall') return;
    const { left, right, operator: op } = stmt.expression;

    // m[key] = v / m[key] += v / m[key] -= v
    if (left && left.type === 'IndexAccess') {
      const mapVar = mappingVars.find(v => left.base.type === 'Identifier' && v.originalName === left.base.name);
      if (!mapVar || !['=', '+=', '-='].includes(op)) return;
      const key = toConstructorScope(translateExpression(left.index, uniqueParams, stateInfo));
      let value = toConstructorScope(translateExpression(right, uniqueParams, stateInfo));
      const prev = mappingExprs.get(mapVar.name);
      if (op !== '=') {
        value = `((currentBalance (${prev}) ${key}) ${op === '+=' ? '+' : '-'} ${value})`;
      }
      mappingExprs.set(mapVar.name, `setWB (${prev}) ${key} ${value}`);
      return;
    }

    const leftVar = left.name;
    if (right.type === 'MemberAccess' && (right.memberName === 'sender' || right.memberName === 'value')) {
      // x = msg.sender / msg.value
      assign(leftVar, `${right.memberName} msgctx`);
    } else if (right.type === 'MemberAccess') {
      // x = EnumType.Member
      const selectedEnum = stateInfo.enums.find(e => e.originalName === right.expression.name);
      if (selectedEnum) {
        const member = selectedEnum.members.find(m => m.originalName === right.memberName);
        assign(leftVar, member.name);
      }
    } else if (right.type === 'FunctionCall' && right.expression.name === 'payable') {
      // x = payable(addr)
      let param = translateExpression(right.arguments[0], uniqueParams, stateInfo);
      if (param.match(/\(msg[a-zA-Z]+\s+st\)/)) {
        param = param.replace(/\(msg[a-zA-Z]+\s+st\)/, 'msgctx');
      }
      assign(leftVar, param);
    } else if (right.type === 'FunctionCall' && right.expression.name === 'address') {
      // x = address(this) / address(0)
      let param;
      if (right.arguments[0]?.name === 'this') {
        param = `fromString "${stateInfo.contractName}"`;
      } else if (right.arguments[0]?.type === 'NumberLiteral') {
        param = right.arguments[0].number;
      }
      assign(leftVar, param);
    } else if (right.type === 'BinaryOperation' || right.type === 'BooleanLiteral') {
      // x = a + b / x = true
      let param = translateExpression(right, uniqueParams, stateInfo);
      if (param.match(/\(msg[a-zA-Z]+\s+st\)/)) {
        param = param.replace(/\(msg[a-zA-Z]+\s+st\)/, 'msgctx');
      }
      if (param.match(/\(block[a-zA-Z]+\s+st\)/)) {
        param = param.replace(/\(block[a-zA-Z]+\s+st\)/, 'block');
      }
      assign(leftVar, param);
    } else if (right.type === 'NumberLiteral') {
      // x = 42
      assign(leftVar, right.number);
    } else {
      // x = parameter
      const param = uniqueParams.find(p => p.originalName === right.name);
      assign(leftVar, param ? param.name : right.name);
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

  // One assignment per line, aligned under the record's opening brace.
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
 * Generates `call<Contract>`, the model of sending ether to an external
 * address (`addr.call{value: x}("")`, `transfer`, `send`, `selfdestruct`):
 * it only decreases the contract balance by the amount sent.
 *
 * Every other field is specified as unchanged, mappings included: `==` in a
 * refinement is logical equality (no Eq instance needed), and it is what lets
 * the solvency invariant survive a transfer.
 *
 * @function generateCallFunction
 * @param {string} moduleName - Contract name (suffix of the generated names).
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {string} The Haskell signature and definition of `call<Contract>`.
 */
function generateCallFunction(moduleName, stateInfo) {
  const filteredNames = stateInfo.variables
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
`;
}

/**
 * `revert`, included in every generated module. Its refinement requires a
 * `False` argument, so Liquid Haskell accepts a function only if every
 * `revert` it contains is unreachable, i.e. every require/condition that
 * guards it holds.
 *
 * @constant REVERT_FUNCTION
 * @type {string}
 */
const REVERT_FUNCTION = `
{-@ revert :: {v:String | False} -> a  @-}
revert :: String -> a
revert  = error
`;

module.exports = {
  generateHaskellFunctions,
  generateCallFunction,
  getConstructorAssignments,
  REVERT_FUNCTION
};
