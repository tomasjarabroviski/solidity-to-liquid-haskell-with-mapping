/**
 * @file liquidConditions.js
 * @description Generates the Liquid Haskell refinement type of each
 *   function: `require` conditions become preconditions (on the input state
 *   or on a parameter), the `assert` statements that end a function also
 *   become postconditions, and ledger mappings get the solvency invariant on
 *   both sides. (Every `assert` is also checked in the function body, where
 *   it is written; see translator.js.)
 */

const { translateExpression, translateOperator } = require('./translator');
const { walkAst } = require('./astUtils');

/**
 * Translates a require operand for use inside a refinement. Conditions
 * use wrapping uint arithmetic (see translator.js), whose functions can't be
 * called in a refinement: their uninterpreted logic names (addUL...) are used
 * instead, which the Haskell versions are specified to be equal to.
 */
function toLogic(expr, params, stateInfo) {
  return translateExpression(expr, params, stateInfo, { modular: true })
    .replace(/\b(addU|subU|mulU)\b/g, '$1L');
}

/**
 * Converts a require condition into a Liquid Haskell precondition.
 *
 * A condition that mentions a parameter is attached to that parameter's
 * refinement (`type: 'param'`); otherwise it is a condition on the input
 * state `st` (`type: 'state'`).
 *
 * @function expressionToLiquidPredicate
 * @param {Object} expr - AST node of the condition.
 * @param {Array<{name: string, type: string, originalName: string}>} [params=[]] - Function parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {{type: 'state'|'param', predicate: string, param?: string}|null}
 *   null if the condition can't be translated (e.g. it reads a local
 *   variable, which does not exist yet when the function is called). A
 *   dropped precondition is safe: it only allows more executions.
 */
function expressionToLiquidPredicate(expr, params = [], stateInfo) {
  // A bare boolean identifier, e.g. `require(isOpen)`.
  if (expr.type === 'Identifier') {
    const condition = toLogic(expr, params, stateInfo);
    if (condition === 'undefined') {
      return null;
    }
    return {
      type: 'state',
      predicate: condition
    };
  }

  if (!expr || expr.type !== 'BinaryOperation') return null;

  const op = translateOperator(expr.operator);
  const left = toLogic(expr.left, params, stateInfo);
  const right = toLogic(expr.right, params, stateInfo);
  if (/\bundefined\b/.test(`${left} ${right}`)) return null;

  // Check if condition involves a parameter anywhere (not only as a direct
  // operand, e.g. `balances[msg.sender] - _value >= 0`). Pick the last one
  // in the signature so all mentioned parameters are bound before it.
  const translated = `${translateExpression(expr.left, params, stateInfo)} ${translateExpression(expr.right, params, stateInfo)}`;
  const mentioned = params.filter(p =>
    new RegExp(`(^|[^A-Za-z0-9_'])${p.name}($|[^A-Za-z0-9_'])`).test(translated));
  const paramName = mentioned.length ? mentioned[mentioned.length - 1].name : undefined;

  const predicate = `((${left}) ${op} (${right}))`;
  return paramName
    ? { type: 'param', param: paramName, predicate }
    : { type: 'state', predicate };
}

/**
 * Solvency invariant: what a mapping that accounts for received ether (a
 * "ledger", e.g. `balances[msg.sender] += msg.value`) owes, sum * unit price,
 * never exceeds the ether the contract holds. See index.js (findLedgerMappings).
 *
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @param {string} stateVar - Name of the state in the refinement (`st` or `v`).
 * @returns {Array<string>} One predicate per ledger mapping.
 */
function solvencyInvariants(stateInfo, stateVar) {
  return (stateInfo.ledgerMappings || []).map(({ name, price }) => {
    const owed = price === '1' ? `mBal (${name} ${stateVar})` : `mBal (${name} ${stateVar}) * ${price}`;
    return `(${owed} <= balance${stateInfo.contractName} ${stateVar})`;
  });
}

/**
 * Conditions of the top-level `require(...)` statements of a function body.
 *
 * @param {Array<Object>} body - AST nodes of the function body.
 * @returns {Array<Object>} The condition AST nodes.
 */
function extractRequireConditions(body) {
  if (!body) return [];
  return body.filter(stmt =>
    stmt.type === 'ExpressionStatement' &&
    stmt.expression.type === 'FunctionCall' &&
    stmt.expression.expression.name === 'require'
  ).map(stmt => stmt.expression.arguments[0]);
}

/** Whether a statement is `assert(...);`. */
function isAssertStatement(stmt) {
  return stmt.type === 'ExpressionStatement' &&
    stmt.expression.type === 'FunctionCall' &&
    stmt.expression.expression.name === 'assert';
}

/**
 * The `assert` statements that end a function body (ignoring a final
 * `return`), split from the asserts elsewhere in the body.
 *
 * Only the ending asserts hold on the final state, so only they can become
 * postconditions. If the body has another `return` (an early return), no
 * assert is known to be reached on every path, so none of them is ending.
 *
 * @function splitAsserts
 * @param {Array<Object>} body - AST nodes of the function body.
 * @returns {{ending: Array<Object>, other: Array<Object>}} The assert statements.
 */
function splitAsserts(body) {
  const statements = body || [];
  let end = statements.length;
  if (end > 0 && statements[end - 1].type === 'ReturnStatement') end--;

  let hasEarlyReturn = false;
  walkAst(statements.slice(0, end), node => {
    if (node.type === 'ReturnStatement') hasEarlyReturn = true;
  });

  let start = end;
  while (!hasEarlyReturn && start > 0 && isAssertStatement(statements[start - 1])) start--;

  const ending = statements.slice(start, end);
  const other = [];
  walkAst(statements, node => {
    if (node.type === 'ExpressionStatement' && isAssertStatement(node) && !ending.includes(node)) other.push(node);
  });
  return { ending, other };
}

/**
 * Translates an ending `assert` into a postcondition on the result `v`: the
 * new state, or, in a view/pure function that ends in `return x`, the
 * returned value `x`.
 *
 * @function assertPostcondition
 * @param {Object} assertStmt - The `assert(...);` statement.
 * @param {Object} fn - Function definition, as gathered by gatherFunctionDefinitions.
 * @param {Array<{name: string, type: string, originalName: string}>} params - Function parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {string|null} The predicate, or null if it reads a local variable
 *   (other than the returned one), which does not exist after the call.
 */
function assertPostcondition(assertStmt, fn, params, stateInfo) {
  const condition = assertStmt.expression.arguments[0];
  const isView = fn.isView || fn.isPure;

  const locals = new Set();
  walkAst(fn.body, node => {
    if (node.type === 'VariableDeclarationStatement') {
      node.variables.forEach(v => v && locals.add(v.name));
    }
  });
  const last = (fn.body || [])[fn.body.length - 1];
  const returned = isView && last?.type === 'ReturnStatement' &&
    last.expression?.type === 'Identifier' && locals.has(last.expression.name)
    ? last.expression.name
    : null;

  let readsOtherLocal = false;
  walkAst(condition, node => {
    if (node.type === 'Identifier' && locals.has(node.name) && node.name !== returned) readsOtherLocal = true;
  });
  if (readsOtherLocal) return null;

  // The returned local is translated by name and then renamed to `v`.
  const addedReturned = returned && !stateInfo.localVars.has(returned);
  if (addedReturned) stateInfo.localVars.add(returned);
  let predicate = toLogic(condition, params, stateInfo);
  if (addedReturned) stateInfo.localVars.delete(returned);

  if (/\bundefined\b/.test(predicate)) return null;
  if (returned) predicate = predicate.replace(new RegExp(`\\b${returned}\\b`, 'g'), 'v');
  // A view/pure function doesn't change the state, so `st` still is the
  // state; otherwise the state is the result `v`.
  if (!isView) predicate = predicate.replace(/\bst\b/g, 'v');
  return predicate;
}

/**
 * Generates the Liquid Haskell refinement type of a function:
 *
 *   {-@ f :: {st:<Name>State | invariants && state preconditions}
 *         -> {p1:T1 | preconditions on p1} -> ...
 *         -> {v:<Result> | invariants && postconditions} @-}
 *
 * A precondition that mentions several parameters is attached to the last
 * of them, so that all of them are in scope. The postconditions come from
 * the asserts that end the function (see splitAsserts).
 *
 * @function generateLiquidAnnotation
 * @param {string} contractName - Contract name (prefix of the state type).
 * @param {Object} fn - Function definition, as gathered by gatherFunctionDefinitions.
 * @param {Array<{name: string, type: string, originalName: string}>} params - Function parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {string} The `{-@ ... @-}` annotation.
 */
function generateLiquidAnnotation(contractName, fn, params, stateInfo) {
  const requires = extractRequireConditions(fn.body);

  const predicates = requires
    .map(r => expressionToLiquidPredicate(r, params, stateInfo))
    .filter(p => p !== null);

  const stateConditions = predicates
    .filter(p => p.type === 'state')
    .map(p => p.predicate);

  // Parameter conditions, grouped by the parameter they are attached to:
  // those mentioning a single parameter, and those mentioning several.
  const multiParamConditions = new Map();
  const paramConditions = {};
  predicates
    .filter(p => p.type === 'param')
    .forEach(p => {
      const mentions = name => new RegExp(`(^|[^A-Za-z0-9_'])${name}($|[^A-Za-z0-9_'])`).test(p.predicate);
      const otherParams = params
        .filter(param => param.name !== p.param && mentions(param.name));

      if (otherParams.length > 0) {
        // Store the condition with the rightmost referenced parameter (by
        // position in the signature, including p.param itself), so every
        // parameter it mentions is already bound when Liquid Haskell reads it.
        const referenced = params.filter(param => param.name === p.param || mentions(param.name));
        const targetParam = referenced[referenced.length - 1].name;
        if (!multiParamConditions.has(targetParam)) {
          multiParamConditions.set(targetParam, []);
        }
        multiParamConditions.get(targetParam).push(p.predicate);
      } else {
        paramConditions[p.param] = paramConditions[p.param] || [];
        paramConditions[p.param].push(p.predicate);
      }
    });

  // Input state (the constructor has no previous state).
  let annotation;
  if (fn.name === 'constructor') {
    annotation = `{-@ ${fn.name + contractName} :: Message -> Block `;
  } else {
    annotation = `{-@ ${fn.name} :: {st:${contractName}State | ${[...solvencyInvariants(stateInfo, 'st'), ...stateConditions].join(' && ') || 'True'}}`;
  }

  // Parameters.
  params.forEach(param => {
    const regularConditions = paramConditions[param.name] || [];
    const multiConditions = multiParamConditions.get(param.name) || [];
    const allConditions = [...regularConditions, ...multiConditions];
    annotation += ` -> {${param.name}:${param.type} | ${allConditions.length ? allConditions.join(' && ') : 'True'}}`;
  });

  // Result.
  const returnType = (fn.isView || fn.isPure) ? `v:${fn.returnType}` : `v:${contractName}State`;

  // Functions that return the new state (and the constructor) must keep
  // the solvency invariant.
  const postInvariants = (fn.isView || fn.isPure) ? [] : solvencyInvariants(stateInfo, 'v');
  const postconditions = splitAsserts(fn.body).ending
    .map(a => assertPostcondition(a, fn, params, stateInfo))
    .filter(p => p !== null)
    .map(p => `(${p})`);
  annotation += ` -> {${returnType} | ${[...postInvariants, ...postconditions].join(' && ') || 'True'}} @-}`;

  return annotation;
}

/**
 * Liquid Haskell flags and GHC options at the top of every generated module.
 * `--reflection` and `--ple` are what allow `reflect`-ing and reasoning
 * about the map functions (empWB, setWB, currentBalance...) used to
 * translate mappings (see mapDefinitions.js); they don't affect contracts
 * without mappings.
 *
 * @constant LIQUID_ANNOTATIONS
 * @type {string}
 */
const LIQUID_ANNOTATIONS = `{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}
`;

module.exports = {
  generateLiquidAnnotation,
  expressionToLiquidPredicate,
  extractRequireConditions,
  splitAsserts,
  LIQUID_ANNOTATIONS
};
