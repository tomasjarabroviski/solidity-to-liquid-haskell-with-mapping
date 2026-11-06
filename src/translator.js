/**
 * @file translator.js
 * @description Translates Solidity AST nodes (expressions and statements)
 *   into Haskell. Expressions read the current contract state through the
 *   variable `st`; a sequence of statements becomes a `let` chain of states
 *   `st1 = ...; st2 = ...` whose last binding is the function's result.
 */

const { lowerFirst, walkAst, isMsgValue } = require('./astUtils');

/**
 * Translates a Solidity expression into a Haskell expression. Unsupported
 * expressions are translated as the string 'undefined', which callers check.
 *
 * @function translateExpression
 * @param {Object} expr - AST node of a Solidity expression.
 * @param {Array<{name: string, type: string, originalName: string}>} params - Function parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @param {Object} [opts]
 * @param {boolean} [opts.modular] - Translate uint +, -, * as wrapping
 *   arithmetic (addU/subU/mulU). Used for conditions when overflow checking
 *   is on; stored values instead use plain arithmetic checked by the Uint type.
 * @returns {string} The Haskell expression.
 *
 * @example
 * // `x + 1` (x a state variable of contract C) -> "((xC st) + 1)"
 */
function translateExpression(expr, params, stateInfo, opts = {}) {
  if (!stateInfo) return 'undefined';
  const stateVariables = stateInfo.variables || [];

  // revert() / revert("message")
  if (expr.type === 'FunctionCall' && expr.expression.name === 'revert') {
    const args = expr.arguments || [];
    if (args.length > 0) {
      const msg = translateExpression(args[0], params, stateInfo);
      return `revert ${msg}`;
    }
    return 'revert "error"';
  }

  // new Other(args): calls the other contract's constructor.
  if (expr.type === 'FunctionCall' && expr.expression.type === 'NewExpression') {
    const args = expr.arguments || [];
    const functionName = expr.expression.typeName.namePath;
    return `${'constructor' + functionName} (msg${stateInfo.contractName} st) (block${stateInfo.contractName} st) ${args.map(arg => translateExpression(arg, params, stateInfo)).join(' ')}`;
  }

  // payable(addr) is just a type conversion on the address.
  if (expr.type === 'FunctionCall' && expr.expression.type === 'Identifier' && expr.expression.name === 'payable' &&
      (expr.arguments || []).length === 1) {
    return translateExpression(expr.arguments[0], params, stateInfo);
  }

  // address(this) / address(0)
  if (expr.type === 'FunctionCall' && expr.expression.type === 'Identifier' && expr.expression.name === 'address') {
    const arg = expr.arguments[0];
    if (arg.name === 'this') {
      return `address${stateInfo.contractName} st`;
    } else if (arg.type === 'NumberLiteral') {
      return arg.number;
    }
  }

  // x.f(args): a call on a contract instance, or on this contract.
  if (expr.type === 'FunctionCall' && expr.expression.type === 'MemberAccess') {
    const args = expr.arguments || [];
    const memberAccess = expr.expression;

    if (stateInfo.contractInstances && stateInfo.contractInstances[memberAccess.expression.name]) {
      const instanceName = memberAccess.expression.name;
      const functionName = lowerFirst(memberAccess.memberName);
      return `${functionName} ${instanceName} ${args.map(arg =>
        translateExpression(arg, params, stateInfo)).join(' ')}`;
    } else {
      const functionName = lowerFirst(memberAccess.memberName);
      return `${functionName} st ${args.map(arg =>
        translateExpression(arg, params, stateInfo)).join(' ')}`;
    }
  }

  // balances[addr] -> currentBalance (balances st) addr, which reads 0 for a
  // missing key, like a Solidity mapping.
  if (expr.type === 'IndexAccess') {
    const mapName = resolveMapStateVarName(expr.base, stateInfo);
    if (!mapName) return 'undefined';
    const indexExpr = translateExpression(expr.index, params, stateInfo, opts);
    if (indexExpr === 'undefined') return 'undefined';
    return `(currentBalance (${mapName} st) ${indexExpr})`;
  }

  if (expr.type === 'BooleanLiteral') {
    return expr.value.toString().charAt(0).toUpperCase() + expr.value.toString().slice(1);
  }

  if (expr.type === 'MemberAccess') {
    if (expr.expression.name === 'msg') {
      if (expr.memberName === 'sender') {
        return `(sender (${'msg' + stateInfo.contractName} st))`;
      }
      if (expr.memberName === 'value') {
        return `(value (${'msg' + stateInfo.contractName} st))`;
      }
    }
    if (expr.memberName === 'balance') {
      return `(balance${stateInfo.contractName} st)`;
    }
    if (expr.expression.name === 'block' && expr.memberName === 'number') {
      return `(number (${'block' + stateInfo.contractName} st))`;
    }
    if (expr.expression.name === 'block' && expr.memberName === 'timestamp') {
      return `(timestamp (${'block' + stateInfo.contractName} st))`;
    }
    // Enum member (`StateType.Request`): its Haskell constructor is the
    // member name suffixed with the contract name.
    if (expr.expression.name && expr.memberName) {
      return expr.memberName + stateInfo.contractName;
    }
  }

  if (expr.type === 'BinaryOperation') {
    const left = translateExpression(expr.left, params, stateInfo, opts);
    const right = translateExpression(expr.right, params, stateInfo, opts);

    const wrapping = { '+': 'addU', '-': 'subU', '*': 'mulU' }[expr.operator];
    if (opts.modular && stateInfo.checkOverflow && wrapping && !isSignedExpression(expr, params, stateInfo)) {
      return `(${wrapping} ${left} ${right})`;
    }
    const operator = translateOperator(expr.operator);
    return `(${left} ${operator} ${right})`;
  }

  if (expr.type === 'UnaryOperation') {
    const subExpression = translateExpression(expr.subExpression, params, stateInfo, opts);
    return `(${translateOperator(expr.operator)}(${subExpression}))`;
  }

  const paramMap = new Map(params.map(p => [p.originalName, p.name]));

  // Identifiers are resolved in order: local variable, parameter, constant,
  // state variable, and finally the `now` built-in.
  if (expr.type === 'Identifier') {
    if (stateInfo.localVars.has(expr.name)) {
      return expr.name;
    }
    const identifierName = expr.name;
    if (paramMap.has(identifierName)) {
      return paramMap.get(identifierName);
    }
    if (stateInfo.constants && stateInfo.constants.has(identifierName)) {
      return translateExpression(stateInfo.constants.get(identifierName), params, stateInfo);
    }
    const stateVar = stateVariables.find(v => v.originalName === identifierName);
    if (stateVar) {
      return `(${stateVar.name} st)`;
    }
    // `now` is the pre-0.7 alias of block.timestamp.
    if (identifierName === 'now') {
      return `(timestamp (${'block' + stateInfo.contractName} st))`;
    }
  }

  if (expr.type === 'NumberLiteral') {
    return applyDenomination(expr.number, expr.subdenomination);
  }

  if (expr.type === 'StringLiteral') {
    return `"${expr.value}"`;
  }

  if (expr.type === 'TupleExpression') {
    return `${expr.components.map((c) => translateExpression(c, params, stateInfo)).join(', ')}`;
  }

  if (expr.type === 'Conditional') {
    const condition = translateExpression(expr.condition, params, stateInfo, opts);
    const trueExpr = translateExpression(expr.trueExpression, params, stateInfo, opts);
    const falseExpr = translateExpression(expr.falseExpression, params, stateInfo, opts);
    return `if ${condition} then ${trueExpr} else ${falseExpr}`;
  }

  return 'undefined';
}

/**
 * Translates a single Solidity statement.
 *
 * The returned `code` is either a state expression (in terms of `st`) that
 * becomes the next state of the chain, or, when `isLocal` is true, a
 * `name = value` binding for a local variable that leaves the state as is.
 * Unsupported statements are translated as `st -- ...` (a no-op).
 *
 * @function translateStatement
 * @param {Object} statement - AST node of a Solidity statement.
 * @param {Array<{name: string, type: string, originalName: string}>} params - Function parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @param {number} [indentLevel=0] - Indentation of nested blocks.
 * @returns {{code: string, isLocal: boolean, checkedLocal?: string}}
 *   `checkedLocal` names a uint local whose range must be checked.
 *
 * @example
 * // `count++` -> { code: "st { countC = ((countC st) + 1) }", isLocal: false }
 */
function translateStatement(statement, params, stateInfo, indentLevel = 0) {
  if (statement.type === 'IfStatement') {
    const condition = translateExpression(statement.condition, params, stateInfo, { modular: true });
    const trueBody = translateStatements(blockStatements(statement.trueBody), params, stateInfo, indentLevel);
    const falseBody = statement.falseBody
      ? translateStatements(blockStatements(statement.falseBody), params, stateInfo, indentLevel)
      : 'st';

    const code = translateIf(condition, trueBody, falseBody, indentLevel);
    return { code, isLocal: false };
  }

  // Synthetic first statement of a payable function (see generateFunctions.js).
  if (statement.type === 'PayableCredit') {
    const balance = `balance${stateInfo.contractName}`;
    return { code: `st { ${balance} = ((${balance} st) + (value (msg${stateInfo.contractName} st))) }`, isLocal: false };
  }

  if (statement.type === 'Block') {
    const blockCode = translateStatements(statement.statements, params, stateInfo, indentLevel);
    return { code: blockCode, isLocal: false };
  }

  if (statement.type === 'ExpressionStatement') {
    const expr = statement.expression;

    // revert(...)
    if (expr.type === 'FunctionCall' && expr.expression.name === 'revert') {
      return { code: translateExpression(expr, params, stateInfo), isLocal: false };
    }

    // require(cond): continue if it holds, revert otherwise. The condition
    // also becomes a precondition of the function (see liquidConditions.js).
    if (expr.type === 'FunctionCall' && expr.expression.name === 'require') {
      const condition = translateExpression(expr.arguments[0], params, stateInfo, { modular: true });
      // A condition that can't be translated (e.g. `require(sent)` on a
      // call's result) is dropped: that only allows more executions.
      if (condition === 'undefined') {
        return { code: 'st -- skipped require statement', isLocal: false };
      }
      return { code: `if ${condition} then st else revert "error"`, isLocal: false };
    }

    // assert(cond) is checked where it is written, with the locals in scope:
    // continue if it holds, revert otherwise. Since `revert` requires False,
    // Liquid Haskell has to prove that the condition always holds there.
    if (isAssertCall(expr)) {
      const condition = translateAssertCondition(expr, params, stateInfo);
      if (!condition) {
        return { code: 'st -- skipped assert statement', isLocal: false };
      }
      return { code: `if ${condition} then st else revert "assert"`, isLocal: false };
    }

    // addr.call{value: x}(...), with its result ignored.
    if (isCallWithValue(expr)) {
      return translateEtherSend(expr.expression.expression.expression, callValueArgument(expr), params, stateInfo);
    }

    // addr.transfer(x) / addr.send(x).
    if (isEtherTransfer(expr, stateInfo)) {
      return translateEtherSend(expr.expression.expression, expr.arguments[0], params, stateInfo);
    }

    // selfdestruct(to) sends the whole contract balance to `to`.
    if (expr.type === 'FunctionCall' && expr.expression.name === 'selfdestruct') {
      return translateEtherSend(expr.arguments[0], CONTRACT_BALANCE, params, stateInfo);
    }

    // f(args): call to another function of this contract.
    if (expr.type === 'FunctionCall' && expr.expression.type === 'Identifier') {
      const functionName = lowerFirst(expr.expression.name);
      const args = expr.arguments || [];
      return { code: `${functionName} st ${args.map(arg => translateExpression(arg, params, stateInfo)).join(' ')}`, isLocal: false };
    }

    // balances[addr] = value;  /  balances[addr] += value;  /  balances[addr] -= value;
    if (expr.type === 'BinaryOperation' &&
        (expr.operator === '=' || expr.operator === '+=' || expr.operator === '-=') &&
        expr.left.type === 'IndexAccess') {
      return translateMappingWrite(expr, params, stateInfo, expr.operator);
    }

    // x++
    if (expr.type === 'UnaryOperation' && expr.operator === '++') {
      const originalName = expr.subExpression.name;
      const normalizedName = stateInfo.nameMap.get(originalName) || originalName;
      const code = `st { ${normalizedName} = ((${normalizedName} st) + 1) }`;
      return { code: code, isLocal: false };
    }

    // x = value
    if (expr.type === 'BinaryOperation' && expr.operator === '=') {
      const leftSide = expr.left.name;
      const normalizedLeft = stateInfo.nameMap.get(leftSide) || leftSide;
      const rightSide = translateExpression(expr.right, params, stateInfo);
      return { code: `st { ${normalizedLeft} = ${rightSide} }`, isLocal: false };
    }

    // x += value, x -= value, x *= value, x /= value
    if (expr.type === 'BinaryOperation' && ['+=', '-=', '*=', '/='].includes(expr.operator)) {
      const leftSide = expr.left.name;
      const normalizedLeft = stateInfo.nameMap.get(leftSide) || leftSide;
      const rightSide = translateExpression(expr.right, params, stateInfo);
      if (expr.operator === '+=' && stateInfo.checkOverflow && isMsgValue(expr.right)) {
        return { code: `st { ${normalizedLeft} = (addEther (${normalizedLeft} st) ${rightSide}) }`, isLocal: false };
      }
      const op = { '+=': '+', '-=': '-', '*=': '*', '/=': '`div`' }[expr.operator];
      return { code: `st { ${normalizedLeft} = ((${normalizedLeft} st) ${op} ${rightSide}) }`, isLocal: false };
    }
  }

  if (statement.type === 'ReturnStatement') {
    const returnVal = translateExpression(statement.expression, params, stateInfo);
    return { code: returnVal, isLocal: false };
  }

  // `(bool ok, ) = addr.call{value: x}("")`: the ether transfer is modeled,
  // the returned flag is not.
  if (statement.type === 'VariableDeclarationStatement' && isCallWithValue(statement.initialValue)) {
    const call = statement.initialValue;
    return translateEtherSend(call.expression.expression.expression, callValueArgument(call), params, stateInfo);
  }

  // Local variable declaration: `name = value`.
  if (statement.type === 'VariableDeclarationStatement') {
    // Tuple declarations (`(bool ok, ) = ...`) may leave some slots empty.
    const declaration = statement.variables.find(v => v);
    const varName = declaration.name;

    stateInfo.localVars.add(varName);

    if (!statement.initialValue) {
      return { code: `st -- local var ${varName} (no init)`, isLocal: true };
    }
    const initialValue = translateExpression(statement.initialValue, params, stateInfo);
    // A uint local must hold an in-range value (e.g. `uint res = count - input;`).
    const isUintLocal = declaration.typeName?.type === 'ElementaryTypeName' && (declaration.typeName.name || '').startsWith('uint');
    if (stateInfo.checkOverflow && isUintLocal && initialValue !== 'undefined') {
      return { code: `${varName} = checkU (${initialValue})`, isLocal: true, checkedLocal: varName };
    }
    // A local holding a contract instance (`Other o = new Other()`): calls
    // on it are translated as calls on that instance.
    if (declaration.typeName.type && declaration.typeName.type === 'UserDefinedTypeName') {
      stateInfo.contractInstances[varName] = declaration.typeName.namePath;
    }
    return { code: `${varName} = ${initialValue}`, isLocal: true };
  }

  return { code: 'st  -- TODO: Complex expression', isLocal: false };
}

/**
 * Translates a sequence of statements.
 *
 * For a state-modifying function, each statement becomes the next binding
 * of a `let st1 = ...; st2 = ... in stN` chain. For a view/pure function
 * (`isView`), the result is the returned value instead: local declarations
 * become `let` bindings and `if`/`return` become an if-then-else expression.
 *
 * @function translateStatements
 * @param {Array<Object>} statements - AST nodes of the statements.
 * @param {Array<{name: string, type: string, originalName: string}>} params - Function parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @param {number} [indentLevel=0] - Indentation of nested blocks.
 * @param {boolean} [isView=false] - Translate as a view/pure function body.
 * @returns {string} The Haskell expression.
 */
function translateStatements(statements, params, stateInfo, indentLevel = 0, isView = false) {
  // `unchecked { ... }` (0.8+) only turns off the overflow revert, which
  // neither mode models, so its statements run inline (keeping its locals
  // in scope).
  statements = (statements || []).flatMap(s => s.type === 'UncheckedStatement' ? s.block.statements : [s]);
  if (!statements || statements.length === 0) {
    return isView ? 'False' : `${indent(indentLevel)}st`;
  }

  if (isView) {
    const localVars = [];

    // First gather the local variable declarations.
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.type === 'VariableDeclarationStatement') {
        const varName = stmt.variables.find(v => v).name;
        const value = stmt.initialValue ? translateExpression(stmt.initialValue, params, stateInfo) : 'undefined';
        localVars.push(`${varName} = ${value}`);
        stateInfo.localVars.add(varName);
      }
    }

    // Then translate the control flow into the returned expression.
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];

      // assert(cond) guards the rest of the body (its locals are already
      // bound by the `let` above, so they are left out of the rest).
      if (stmt.type === 'ExpressionStatement' && isAssertCall(stmt.expression)) {
        const rest = statements.slice(i + 1).filter(s => s.type !== 'VariableDeclarationStatement');
        const continuation = translateStatements(rest, params, stateInfo, indentLevel, true);
        const condition = translateAssertCondition(stmt.expression, params, stateInfo);
        const guarded = condition
          ? `if ${condition}\nthen ${continuation}\nelse revert "assert"`
          : `${continuation} -- skipped assert statement`;
        return localVars.length > 0
          ? `let ${localVars.join('\n    ')} in\n  ${guarded}`
          : guarded;
      }

      if (stmt.type === 'IfStatement') {
        const condition = translateExpression(stmt.condition, params, stateInfo);

        const thenReturn = stmt.trueBody.type === 'ReturnStatement'
          ? translateExpression(stmt.trueBody.expression, params, stateInfo)
          : translateStatements([stmt.trueBody], params, stateInfo, indentLevel, true);

        const result = localVars.length > 0
          ? `let ${localVars.join('\n    ')} in\n  if ${condition}\nthen ${thenReturn}`
          : `if ${condition}\nthen ${thenReturn}`;

        // The else branch is the following `if` (else-if chain) or `return`.
        if (i < statements.length - 1 && statements[i + 1].type === 'IfStatement') {
          const nextStmt = translateStatements(statements.slice(i + 1), params, stateInfo, indentLevel, true);
          return `${result}\nelse ${nextStmt}`;
        } else if (i === statements.length - 2 && statements[i + 1].type === 'ReturnStatement') {
          const elseReturn = translateExpression(statements[i + 1].expression, params, stateInfo);
          return `${result}\nelse ${elseReturn}`;
        }

        return result;
      } else if (stmt.type === 'ReturnStatement') {
        const returnExpr = translateExpression(stmt.expression, params, stateInfo);
        return localVars.length > 0
          ? `let ${localVars.join('\n    ')} in\n  ${returnExpr}`
          : returnExpr;
      } else if (stmt.type === 'Block') {
        return translateStatements(stmt.statements, params, stateInfo, indentLevel, true);
      }
    }
  } else {
    const lines = [];
    let currentState = 'st';
    let nextStateIndex = 1;

    for (let i = 0; i < statements.length; i++) {
      let statement = statements[i];
      // State-modifying functions return the new state, so a `return` (with
      // or without a value) just ends the function: anything after it is dead.
      if (statement.type === 'ReturnStatement') break;
      // Early return: `if (c) { ...; return; } rest` == `if (c) { ... } else { rest }`.
      const isEarlyReturn = statement.type === 'IfStatement' && !statement.falseBody &&
        blockStatements(statement.trueBody).some(s => s.type === 'ReturnStatement');
      if (isEarlyReturn) {
        statement = { ...statement, falseBody: { type: 'Block', statements: statements.slice(i + 1) } };
      }
      const { code, isLocal, checkedLocal } = translateStatement(statement, params, stateInfo, indentLevel);

      if (isLocal) {
        // Locals read the state as of their declaration, not the initial one.
        lines.push(code.replace(/\bst\b/g, currentState));
        if (checkedLocal) {
          // GHC drops unused let bindings before Liquid Haskell sees them, so
          // use the local to keep its range check. Both branches return the
          // same state, so Liquid Haskell still knows the state is unchanged.
          const stNext = `st${nextStateIndex}`;
          lines.push(`${stNext} = if ${checkedLocal} >= 0 then ${currentState} else ${currentState}`);
          currentState = stNext;
          nextStateIndex++;
        }
      } else {
        const stNext = `st${nextStateIndex}`;
        const replacedCode = code.replace(/\bst\b/g, currentState);

        lines.push(`${stNext} = ${replacedCode}`);
        currentState = stNext;
        nextStateIndex++;
      }
      if (isEarlyReturn) break;
    }

    const finalState = currentState;

    return translateLet(lines, finalState, indentLevel);
  }
}

/**
 * Statements of an if/else branch, which may be a Block or a single
 * statement (`if (c) return;`).
 */
function blockStatements(body) {
  if (!body) return [];
  return body.type === 'Block' ? body.statements : [body];
}

/** Two spaces repeated `level` times. */
function indent(level) {
  return '  '.repeat(level);
}

/** Indents each line of `lines` (an array, or a newline-separated string) by `level`. */
function withIndent(lines, level) {
  if (typeof lines === 'string') {
    lines = lines.split('\n');
  }
  return lines.map(line => indent(level) + line).join('\n');
}

/** Formats `if condition then trueBody else falseBody`, nesting multi-line bodies. */
function translateIf(condition, trueBody, falseBody, indentLevel) {
  const formattedTrueBody = trueBody.includes('\n')
    ? '\n' + withIndent(trueBody.trim(), indentLevel + 2)
    : ' ' + trueBody;

  const formattedFalseBody = falseBody.includes('\n')
    ? '\n' + withIndent(falseBody.trim(), indentLevel + 2)
    : ' ' + falseBody;

  return [
    `${indent(indentLevel)}if ${condition}`,
    `${indent(indentLevel + 2)}then${formattedTrueBody}`,
    `${indent(indentLevel + 2)}else${formattedFalseBody}`
  ].join('\n');
}

/** Formats `let <bindings> in <body>`. */
function translateLet(bindings, body, indentLevel) {
  const letBlock = [
    `${indent(indentLevel)}let`,
    withIndent(bindings, indentLevel + 1),
    `${indent(indentLevel + 2)}in`,
    `${indent(indentLevel + 3)}${body}`
  ];

  return letBlock.join('\n');
}

/**
 * Translates a Solidity operator to its Haskell / Liquid Haskell equivalent.
 * Operators without an entry are returned unchanged.
 *
 * @function translateOperator
 * @param {string} operator - The Solidity operator.
 * @returns {string} The equivalent Haskell operator.
 */
function translateOperator(operator) {
  const operatorMap = {
    // Comparison
    '!=': '/=',
    '==': '==',
    '<': '<',
    '<=': '<=',
    '>': '>',
    '>=': '>=',

    // Arithmetic
    '+': '+',
    '-': '-',
    '*': '*',
    // uint division truncates, like Haskell's `div` (`/` needs Fractional).
    '/': '`div`',

    // Logical
    '&&': '&&',
    '||': '||',
    '!': 'not'
  };

  return operatorMap[operator] || operator;
}

/**
 * Given the `base` expression of an IndexAccess (e.g. the `balances` in
 * `balances[addr]`), finds the corresponding normalized state variable name,
 * but only if it was gathered as a mapping (isMapping). Returns null if the
 * base isn't a simple identifier referring to a known mapping state variable
 * (nested mappings, mapping-typed locals, etc. are not supported).
 *
 * @function resolveMapStateVarName
 * @param {Object} baseExpr - The base expression of the IndexAccess.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {string|null}
 */
function resolveMapStateVarName(baseExpr, stateInfo) {
  if (!stateInfo || baseExpr.type !== 'Identifier') return null;
  const stateVar = (stateInfo.variables || []).find(
    v => v.originalName === baseExpr.name && v.isMapping
  );
  return stateVar ? stateVar.name : null;
}

/**
 * Translates an assignment/compound-assignment whose left-hand side is a
 * mapping index access (`balances[addr] = v`, `balances[addr] += v`,
 * `balances[addr] -= v`) into a state update built on top of `setWB` /
 * `currentBalance` from the embedded Map/MapWithBalance library
 * (see mapDefinitions.js).
 *
 * It follows the idiom of the hand-written bank examples of the thesis
 * this work extends (Consoli, 2025): it binds the updated map to a local
 * name and threads `assert (lemma_... )` calls through, which is what lets
 * Liquid Haskell relate `currentBalance` before and after the `setWB` call.
 *
 * Values use plain `+`/`-`: `setWB` itself requires the new value to be in
 * range (InRange), so e.g. a withdrawal (`-=`) that would leave a negative
 * balance does not typecheck.
 *
 * @function translateMappingWrite
 * @param {Object} expr - The BinaryOperation AST node.
 * @param {Array<{name: string, type: string, originalName: string}>} params - Function parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @param {string} op - '=', '+=' or '-='.
 * @returns {{code: string, isLocal: boolean}}
 */
function translateMappingWrite(expr, params, stateInfo, op) {
  const mapName = resolveMapStateVarName(expr.left.base, stateInfo);
  if (!mapName) {
    return { code: 'st -- skipped mapping assignment (unsupported base)', isLocal: false };
  }
  const indexExpr = translateExpression(expr.left.index, params, stateInfo);
  const rightExpr = translateExpression(expr.right, params, stateInfo);
  if (indexExpr === 'undefined' || rightExpr === 'undefined') {
    return { code: 'st -- skipped mapping assignment (unsupported expression)', isLocal: false };
  }

  let newValueExpr;
  if (op === '=') {
    newValueExpr = rightExpr;
  } else if (op === '+=' && stateInfo.checkOverflow && isMsgValue(expr.right)) {
    newValueExpr = `(addEther (currentBalance (${mapName} st) ${indexExpr}) ${rightExpr})`;
  } else if (op === '+=') {
    newValueExpr = `((currentBalance (${mapName} st) ${indexExpr}) + ${rightExpr})`;
  } else {
    // op === '-='
    newValueExpr = `((currentBalance (${mapName} st) ${indexExpr}) - ${rightExpr})`;
  }

  const nextMapVar = `${mapName}Next`;
  // With upper bounds, later writes need to know that this write didn't
  // change the other keys the function reads (e.g. `balances[_to]` after
  // writing `balances[msg.sender]`), not just that they are >= 0.
  const otherKeys = stateInfo.checkOverflow
    ? mappingKeysInFunction(expr.left.base.name, params, stateInfo).filter(k => k !== indexExpr)
    : [];
  const otherKeyLemmas = otherKeys
    .map(k => `assert (lemma_currentBalance_setWB_maybe_other (${mapName} st) ${indexExpr} ${newValueExpr} ${k}) $ `)
    .join('');
  // For a mapping under the solvency invariant (mBal <= contract balance),
  // every value the function reads is <= mBal, so it can be sent out.
  const isLedger = (stateInfo.ledgerMappings || []).some(l => l.name === mapName);
  const ledgerLemmas = isLedger
    ? [...new Set([indexExpr, ...mappingKeysInFunction(expr.left.base.name, params, stateInfo)])]
        .map(k => `assert (lemma_currentBalance_le_mBal (${mapName} st) ${k}) $ `)
        .join('')
    : '';
  const code =
    `let ${nextMapVar} = setWB (${mapName} st) ${indexExpr} ${newValueExpr} in ` +
    `assert (lemma_currentBalance_get (${mapName} st) ${indexExpr}) $ ` +
    `assert (lemma_currentBalance_get ${nextMapVar} ${indexExpr}) $ ` +
    ledgerLemmas +
    otherKeyLemmas +
    `st { ${mapName} = ${nextMapVar} }`;

  return { code, isLocal: false };
}

/**
 * True if the expression mentions a signed (`int`) parameter or state
 * variable; wrapping uint arithmetic doesn't apply to those.
 */
function isSignedExpression(expr, params, stateInfo) {
  let signed = false;
  walkAst(expr, node => {
    if (node.type !== 'Identifier') return;
    const param = params.find(p => p.originalName === node.name);
    const stateVar = (stateInfo.variables || []).find(v => v.originalName === node.name);
    if ((param || stateVar)?.type === 'Integer') signed = true;
  });
  return signed;
}

/**
 * `<address>.call{value: x}(...)` (possibly with other options, like `gas`).
 */
function isCallWithValue(expr) {
  return expr?.type === 'FunctionCall' &&
    expr.expression?.type === 'NameValueExpression' &&
    expr.expression.expression?.type === 'MemberAccess' &&
    expr.expression.expression.memberName === 'call' &&
    !!callValueArgument(expr);
}

/** The `value` option of `<address>.call{..., value: x}(...)`, or undefined. */
function callValueArgument(callExpr) {
  const options = callExpr.expression.arguments;
  if (options?.type !== 'NameValueList') return undefined;
  return options.arguments[options.names.indexOf('value')];
}

/** `assert(...)`. */
function isAssertCall(expr) {
  return expr.type === 'FunctionCall' && expr.expression.name === 'assert';
}

/**
 * The condition of an `assert`, or null if it can't be fully translated
 * (an assert that is dropped is reported as untranslated, since dropping
 * it could hide a violation).
 */
function translateAssertCondition(assertCall, params, stateInfo) {
  const condition = translateExpression(assertCall.arguments[0], params, stateInfo, { modular: true });
  return /\bundefined\b/.test(condition) ? null : condition;
}

// Marker for translateEtherSend: send the whole contract balance.
const CONTRACT_BALANCE = Symbol('contract balance');

/**
 * Translates sending ether to an address, in any of its forms
 * (`call{value: x}`, `transfer`, `send`, `selfdestruct`), as a call to the
 * `call<Contract>` model, which only decreases the contract balance.
 *
 * Before sending, every ledger value the function reads is shown to be
 * <= the contract balance (see ledgerLemmasBeforeSend), so it can be sent.
 *
 * @function translateEtherSend
 * @param {Object} targetExpr - AST node of the recipient address.
 * @param {Object|symbol} amountExpr - AST node of the amount, or CONTRACT_BALANCE.
 * @param {Array<{name: string, type: string, originalName: string}>} params - Function parameters.
 * @param {Object} stateInfo - Output of gatherStateDefinitions.
 * @returns {{code: string, isLocal: boolean}}
 */
function translateEtherSend(targetExpr, amountExpr, params, stateInfo) {
  const target = translateExpression(targetExpr, params, stateInfo);
  const amount = amountExpr === CONTRACT_BALANCE
    ? `balance${stateInfo.contractName} st`
    : translateExpression(amountExpr, params, stateInfo);
  return {
    code: `${ledgerLemmasBeforeSend(params, stateInfo)}call${stateInfo.contractName} st (${target}) (${amount})`,
    isLocal: false
  };
}

/**
 * `<address>.transfer(amount)` / `<address>.send(amount)`. Calls on contract
 * instances (`token.transfer(to, x)`) take two arguments and are excluded.
 */
function isEtherTransfer(expr, stateInfo) {
  return expr.type === 'FunctionCall' &&
    expr.expression.type === 'MemberAccess' &&
    ['transfer', 'send'].includes(expr.expression.memberName) &&
    (expr.arguments || []).length === 1 &&
    !(stateInfo.contractInstances && stateInfo.contractInstances[expr.expression.expression.name]);
}

// Base units (wei, seconds) per denomination (`1 ether`, `2 weeks`, ...).
const DENOMINATIONS = {
  wei: 1n, gwei: 10n ** 9n, szabo: 10n ** 12n, finney: 10n ** 15n, ether: 10n ** 18n,
  seconds: 1n, minutes: 60n, hours: 3600n, days: 86400n, weeks: 604800n, years: 31536000n,
};

/** Expands a number literal with a unit (`1 ether`, `0.5 ether`, `2 weeks`) into base units. */
function applyDenomination(number, subdenomination) {
  const factor = DENOMINATIONS[subdenomination];
  if (!factor) return number;
  // Decimals are allowed with units (`0.5 ether`).
  const [whole, fraction = ''] = number.split('.');
  const scale = 10n ** BigInt(fraction.length);
  return ((BigInt(whole + fraction) * factor) / scale).toString();
}

/**
 * Before sending ether: every ledger value the function reads is <= mBal <=
 * contract balance, so it can be sent even before the ledger is updated
 * (e.g. `require(balances[msg.sender] >= x); msg.sender.call{value: x}("")`).
 */
function ledgerLemmasBeforeSend(params, stateInfo) {
  return (stateInfo.ledgerMappings || []).flatMap(({ name }) => {
    const mapVar = (stateInfo.variables || []).find(v => v.name === name);
    if (!mapVar) return [];
    return mappingKeysInFunction(mapVar.originalName, params, stateInfo)
      .map(k => `assert (lemma_currentBalance_le_mBal (${name} st) ${k}) $ `);
  }).join('');
}

/**
 * Translated keys of every `mapName[key]` in the function being translated
 * (stateInfo.currentFunctionBody), deduplicated.
 */
function mappingKeysInFunction(mapOriginalName, params, stateInfo) {
  const keys = new Set();
  walkAst(stateInfo.currentFunctionBody || [], node => {
    if (node.type === 'IndexAccess' && node.base.type === 'Identifier' && node.base.name === mapOriginalName) {
      const key = translateExpression(node.index, params, stateInfo);
      if (key !== 'undefined') keys.add(key);
    }
  });
  return [...keys];
}

module.exports = {
  translateExpression,
  translateStatement,
  translateStatements,
  translateOperator,
};
