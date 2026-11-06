/**
 * @file astUtils.js
 * @description Small helpers shared by the translator modules: identifier
 *   normalization and generic queries over the Solidity AST.
 */

/**
 * Lowercases the first character of an identifier, making it a valid
 * Haskell variable/function name (`SendRequest` -> `sendRequest`).
 *
 * @function lowerFirst
 * @param {string} name - The identifier.
 * @returns {string} The normalized identifier.
 */
function lowerFirst(name) {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Calls `visit` on `node` and, recursively, on every object nested in it
 * (child nodes and the elements of child arrays), in pre-order.
 *
 * @function walkAst
 * @param {Object|Array} node - The AST node (or array of nodes) to walk.
 * @param {function(Object): void} visit - Called once per nested object.
 */
function walkAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(child => walkAst(child, visit));
    return;
  }
  visit(node);
  Object.values(node).forEach(child => walkAst(child, visit));
}

/**
 * Whether the expression is `msg.value`.
 *
 * @function isMsgValue
 * @param {Object} expr - AST node of an expression.
 * @returns {boolean}
 */
function isMsgValue(expr) {
  return !!expr && expr.type === 'MemberAccess' && expr.memberName === 'value' && expr.expression.name === 'msg';
}

module.exports = {
  lowerFirst,
  walkAst,
  isMsgValue
};
