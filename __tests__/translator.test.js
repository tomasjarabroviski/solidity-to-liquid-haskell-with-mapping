const {
    translateExpression,
    translateStatement,
    translateStatements,
    translateOperator,
} = require('../src/translator');

// Minimal "fixture" stateInfo with just what translator.js needs: state
// variables (including a mapping, so IndexAccess/mapping writes can be
// tested), an enum, and the sets/maps that get filled in live during the
// project's actual translation (localVars, contractInstances).
function makeStateInfo() {
    return {
        contractName: 'Test',
        variables: [
            { name: 'msgTest', type: 'Message', originalName: 'msg' },
            { name: 'blockTest', type: 'Block', originalName: 'block' },
            { name: 'balanceTest', type: 'Amount', originalName: 'balance' },
            { name: 'addressTest', type: 'Address', originalName: 'address' },
            { name: 'ownerTest', type: 'Address', originalName: 'owner' },
            {
                name: 'balancesTest',
                type: 'BalancedMap Address',
                originalName: 'balances',
                isMapping: true,
                mapKeyType: 'Address'
            }
        ],
        enums: [{
            originalName: 'StateType',
            name: 'StateTypeTest',
            members: [{ name: 'PendingTest', originalName: 'Pending' }]
        }],
        nameMap: new Map([
            ['owner', 'ownerTest'],
            ['balances', 'balancesTest']
        ]),
        localVars: new Set(),
        contractInstances: {},
    };
}

const amountParam = [{ originalName: 'amount', name: 'amount', type: 'Integer' }];

describe('translateExpression', () => {
    test('returns undefined placeholder when stateInfo is missing', () => {
        expect(translateExpression({ type: 'NumberLiteral', number: '1' }, [], undefined))
            .toBe('undefined');
    });

    test('revert() without a message', () => {
        const expr = { type: 'FunctionCall', expression: { name: 'revert' }, arguments: [] };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('revert "error"');
    });

    test('revert("msg") with a message', () => {
        const expr = {
            type: 'FunctionCall',
            expression: { name: 'revert' },
            arguments: [{ type: 'StringLiteral', value: 'not allowed' }]
        };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('revert "not allowed"');
    });

    test('new Contract(...) constructor call', () => {
        const expr = {
            type: 'FunctionCall',
            expression: { type: 'NewExpression', typeName: { namePath: 'Foo' } },
            arguments: []
        };
        const result = translateExpression(expr, [], makeStateInfo());
        expect(result).toContain('constructorFoo (msgTest st) (blockTest st)');
    });

    test('address(this)', () => {
        const expr = {
            type: 'FunctionCall',
            expression: { type: 'Identifier', name: 'address' },
            arguments: [{ name: 'this' }]
        };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('addressTest st');
    });

    test('address(<numberLiteral>)', () => {
        const expr = {
            type: 'FunctionCall',
            expression: { type: 'Identifier', name: 'address' },
            arguments: [{ type: 'NumberLiteral', number: '5' }]
        };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('5');
    });

    test('member function call (obj.method(args))', () => {
        const expr = {
            type: 'FunctionCall',
            expression: {
                type: 'MemberAccess',
                expression: { name: 'foo' },
                memberName: 'Bar'
            },
            arguments: []
        };
        expect(translateExpression(expr, [], makeStateInfo())).toContain('bar st');
    });

    test('member function call on a tracked contract instance', () => {
        const stateInfo = makeStateInfo();
        stateInfo.contractInstances['inst'] = 'Foo';
        const expr = {
            type: 'FunctionCall',
            expression: {
                type: 'MemberAccess',
                expression: { name: 'inst' },
                memberName: 'DoThing'
            },
            arguments: []
        };
        expect(translateExpression(expr, [], stateInfo)).toContain('doThing inst');
    });

    test('IndexAccess on a mapping state var (balances[addr])', () => {
        const expr = {
            type: 'IndexAccess',
            base: { type: 'Identifier', name: 'balances' },
            index: { type: 'Identifier', name: 'amount' }
        };
        expect(translateExpression(expr, amountParam, makeStateInfo()))
            .toBe('(currentBalance (balancesTest st) amount)');
    });

    test('IndexAccess on something that is not a known mapping', () => {
        const expr = {
            type: 'IndexAccess',
            base: { type: 'Identifier', name: 'notAMapping' },
            index: { type: 'Identifier', name: 'amount' }
        };
        expect(translateExpression(expr, amountParam, makeStateInfo())).toBe('undefined');
    });

    test('boolean literal', () => {
        expect(translateExpression({ type: 'BooleanLiteral', value: true }, [], makeStateInfo())).toBe('True');
        expect(translateExpression({ type: 'BooleanLiteral', value: false }, [], makeStateInfo())).toBe('False');
    });

    test('msg.sender / msg.value', () => {
        const stateInfo = makeStateInfo();
        expect(translateExpression(
            { type: 'MemberAccess', expression: { name: 'msg' }, memberName: 'sender' }, [], stateInfo
        )).toBe('(sender (msgTest st))');
        expect(translateExpression(
            { type: 'MemberAccess', expression: { name: 'msg' }, memberName: 'value' }, [], stateInfo
        )).toBe('(value (msgTest st))');
    });

    test('<anything>.balance', () => {
        const expr = { type: 'MemberAccess', expression: { name: 'address(this)' }, memberName: 'balance' };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('(balanceTest st)');
    });

    test('block.number', () => {
        const expr = { type: 'MemberAccess', expression: { name: 'block' }, memberName: 'number' };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('(number (blockTest st))');
    });

    test('enum member access (StateType.Pending)', () => {
        const expr = { type: 'MemberAccess', expression: { name: 'StateType' }, memberName: 'Pending' };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('PendingTest');
    });

    test('binary operation', () => {
        const expr = {
            type: 'BinaryOperation',
            operator: '>',
            left: { type: 'NumberLiteral', number: '1' },
            right: { type: 'NumberLiteral', number: '2' }
        };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('(1 > 2)');
    });

    test('unary operation', () => {
        const expr = {
            type: 'UnaryOperation',
            operator: '!',
            subExpression: { type: 'BooleanLiteral', value: true }
        };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('(not(True))');
    });

    test('identifier resolves to local var, then param, then state var', () => {
        const stateInfo = makeStateInfo();
        stateInfo.localVars.add('localX');
        expect(translateExpression({ type: 'Identifier', name: 'localX' }, [], stateInfo)).toBe('localX');
        expect(translateExpression({ type: 'Identifier', name: 'amount' }, amountParam, stateInfo)).toBe('amount');
        expect(translateExpression({ type: 'Identifier', name: 'owner' }, [], stateInfo)).toBe('(ownerTest st)');
    });

    test('number and string literals', () => {
        expect(translateExpression({ type: 'NumberLiteral', number: '42' }, [], makeStateInfo())).toBe('42');
        expect(translateExpression({ type: 'StringLiteral', value: 'hi' }, [], makeStateInfo())).toBe('"hi"');
    });

    test('tuple expression', () => {
        const expr = {
            type: 'TupleExpression',
            components: [{ type: 'NumberLiteral', number: '1' }, { type: 'NumberLiteral', number: '2' }]
        };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('1, 2');
    });

    test('conditional (ternary) expression', () => {
        const expr = {
            type: 'Conditional',
            condition: { type: 'BooleanLiteral', value: true },
            trueExpression: { type: 'NumberLiteral', number: '1' },
            falseExpression: { type: 'NumberLiteral', number: '2' }
        };
        expect(translateExpression(expr, [], makeStateInfo())).toBe('if True then 1 else 2');
    });

    test('unknown expression type falls back to "undefined"', () => {
        expect(translateExpression({ type: 'SomethingWeird' }, [], makeStateInfo())).toBe('undefined');
    });
});

describe('translateOperator', () => {
    test('maps known Solidity operators to their Haskell equivalents', () => {
        expect(translateOperator('!=')).toBe('/=');
        expect(translateOperator('==')).toBe('==');
        expect(translateOperator('+')).toBe('+');
        expect(translateOperator('!')).toBe('not');
    });

    test('passes through unknown operators unchanged', () => {
        expect(translateOperator('**')).toBe('**');
    });
});

describe('translateStatement', () => {
    test('AssignmentStatement', () => {
        const stmt = { type: 'AssignmentStatement', variable: { name: 'count' }, value: { type: 'NumberLiteral', number: '0' } };
        const { code, isLocal } = translateStatement(stmt, [], makeStateInfo());
        expect(code).toBe('st { count = 0 }');
        expect(isLocal).toBe(false);
    });

    test('require(cond) with a valid condition', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'FunctionCall',
                expression: { name: 'require' },
                arguments: [{ type: 'BooleanLiteral', value: true }]
            }
        };
        const { code } = translateStatement(stmt, [], makeStateInfo());
        expect(code).toBe('if True then st else revert "error"');
    });

    test('require(cond) that cannot be translated is skipped, not left as "undefined"', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'FunctionCall',
                expression: { name: 'require' },
                arguments: [{ type: 'SomethingWeird' }]
            }
        };
        const { code } = translateStatement(stmt, [], makeStateInfo());
        expect(code).toBe('st -- skipped require statement');
    });

    test('assert(cond) becomes a no-op placeholder in the body (handled via the type signature instead)', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'FunctionCall',
                expression: { name: 'assert' },
                arguments: [{ type: 'BooleanLiteral', value: true }]
            }
        };
        const { code } = translateStatement(stmt, [], makeStateInfo());
        expect(code).toBe('st -- assert statement');
    });

    test('a plain function call statement (helper(args))', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'FunctionCall',
                expression: { type: 'Identifier', name: 'Helper' },
                arguments: [{ type: 'NumberLiteral', number: '1' }]
            }
        };
        const { code } = translateStatement(stmt, [], makeStateInfo());
        expect(code).toBe('helper st 1');
    });

    test('x++', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: { type: 'UnaryOperation', operator: '++', subExpression: { name: 'owner' } }
        };
        const { code } = translateStatement(stmt, [], makeStateInfo());
        expect(code).toBe('st { ownerTest = ((ownerTest st) + 1) }');
    });

    test('x = value', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'BinaryOperation',
                operator: '=',
                left: { name: 'owner' },
                right: { type: 'NumberLiteral', number: '0' }
            }
        };
        const { code } = translateStatement(stmt, [], makeStateInfo());
        expect(code).toBe('st { ownerTest = 0 }');
    });

    test('x += value / x -= value', () => {
        const plusStmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'BinaryOperation', operator: '+=',
                left: { name: 'owner' }, right: { type: 'NumberLiteral', number: '1' }
            }
        };
        expect(translateStatement(plusStmt, [], makeStateInfo()).code)
            .toBe('st { ownerTest = ((ownerTest st) + 1) }');

        const minusStmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'BinaryOperation', operator: '-=',
                left: { name: 'owner' }, right: { type: 'NumberLiteral', number: '1' }
            }
        };
        expect(translateStatement(minusStmt, [], makeStateInfo()).code)
            .toBe('st { ownerTest = ((ownerTest st) - 1) }');
    });

    test('balances[addr] = value  (mapping write)', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'BinaryOperation',
                operator: '=',
                left: { type: 'IndexAccess', base: { type: 'Identifier', name: 'balances' }, index: { type: 'Identifier', name: 'amount' } },
                right: { type: 'NumberLiteral', number: '10' }
            }
        };
        const { code } = translateStatement(stmt, amountParam, makeStateInfo());
        expect(code).toContain('setWB (balancesTest st) amount 10');
        expect(code).toContain('st { balancesTest = balancesTestNext }');
    });

    test('balances[addr] += value  (mapping write)', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'BinaryOperation',
                operator: '+=',
                left: { type: 'IndexAccess', base: { type: 'Identifier', name: 'balances' }, index: { type: 'Identifier', name: 'amount' } },
                right: { type: 'NumberLiteral', number: '10' }
            }
        };
        const { code } = translateStatement(stmt, amountParam, makeStateInfo());
        expect(code).toContain('(currentBalance (balancesTest st) amount) + 10');
    });

    test('mapping write on an unknown base is skipped, not left as garbage', () => {
        const stmt = {
            type: 'ExpressionStatement',
            expression: {
                type: 'BinaryOperation',
                operator: '=',
                left: { type: 'IndexAccess', base: { type: 'Identifier', name: 'notAMapping' }, index: { type: 'Identifier', name: 'amount' } },
                right: { type: 'NumberLiteral', number: '10' }
            }
        };
        const { code } = translateStatement(stmt, amountParam, makeStateInfo());
        expect(code).toBe('st -- skipped mapping assignment (unsupported base)');
    });

    test('ReturnStatement', () => {
        const stmt = { type: 'ReturnStatement', expression: { type: 'NumberLiteral', number: '7' } };
        expect(translateStatement(stmt, [], makeStateInfo()).code).toBe('7');
    });

    test('VariableDeclarationStatement with an initial value', () => {
        const stmt = {
            type: 'VariableDeclarationStatement',
            variables: [{ name: 'x', typeName: { type: 'ElementaryTypeName' } }],
            initialValue: { type: 'NumberLiteral', number: '3' }
        };
        const stateInfo = makeStateInfo();
        const { code, isLocal } = translateStatement(stmt, [], stateInfo);
        expect(code).toBe('x = 3');
        expect(isLocal).toBe(true);
        expect(stateInfo.localVars.has('x')).toBe(true);
    });

    test('VariableDeclarationStatement without an initial value', () => {
        const stmt = {
            type: 'VariableDeclarationStatement',
            variables: [{ name: 'x', typeName: { type: 'ElementaryTypeName' } }],
            initialValue: null
        };
        const { code, isLocal } = translateStatement(stmt, [], makeStateInfo());
        expect(code).toBe('st -- local var x (no init)');
        expect(isLocal).toBe(true);
    });

    test('IfStatement (with and without an else branch)', () => {
        const withElse = {
            type: 'IfStatement',
            condition: { type: 'BooleanLiteral', value: true },
            trueBody: { statements: [] },
            falseBody: { statements: [] }
        };
        expect(translateStatement(withElse, [], makeStateInfo()).code).toContain('if True');

        const withoutElse = {
            type: 'IfStatement',
            condition: { type: 'BooleanLiteral', value: false },
            trueBody: { statements: [] },
            falseBody: null
        };
        expect(translateStatement(withoutElse, [], makeStateInfo()).code).toContain('if False');
    });

    test('unrecognized statement type falls back to a TODO placeholder', () => {
        const { code } = translateStatement({ type: 'SomeWeirdStatement' }, [], makeStateInfo());
        expect(code).toBe('st  -- TODO: Complex expression');
    });
});

describe('translateStatements', () => {
    test('empty body (non-view) returns "st"', () => {
        expect(translateStatements([], [], makeStateInfo())).toBe('st');
    });

    test('empty body (view) returns "False"', () => {
        expect(translateStatements([], [], makeStateInfo(), 0, true)).toBe('False');
    });

    test('a single statement produces a let/in chain threading state', () => {
        const statements = [{
            type: 'ExpressionStatement',
            expression: {
                type: 'BinaryOperation', operator: '=',
                left: { name: 'owner' }, right: { type: 'NumberLiteral', number: '1' }
            }
        }];
        const result = translateStatements(statements, [], makeStateInfo());
        expect(result).toContain('let');
        expect(result).toContain('st1 = st { ownerTest = 1 }');
        expect(result).toContain('in');
        expect(result.trim().endsWith('st1')).toBe(true);
    });

    test('a view function with a plain return', () => {
        const statements = [{ type: 'ReturnStatement', expression: { type: 'NumberLiteral', number: '9' } }];
        expect(translateStatements(statements, [], makeStateInfo(), 0, true)).toBe('9');
    });
});
