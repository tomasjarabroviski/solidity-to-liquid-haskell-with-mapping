// Extra branch coverage for getConstructorAssignments (src/generateFunctions.js).
// The existing __tests__/generateFunctions.test.js already covers the "happy
// path" branches (MemberAccess/msg.sender, enum with a matching state var,
// plain parameter assignment). This file fills in the branches that were
// still untested: mapping defaults, the IndexAccess skip, payable()/address()
// calls, BinaryOperation/BooleanLiteral/NumberLiteral right-hand sides (both
// with and without a matching state var), and the new "default-initialize
// unassigned fields" pass added for the recConError fix.
const { getConstructorAssignments } = require('../src/generateFunctions');

describe('getConstructorAssignments - additional branches', () => {
    test('mapping-type state vars default to empWB', () => {
        const stateInfo = {
            contractName: 'Test',
            variables: [{
                name: 'balancesTest',
                originalName: 'balances',
                type: 'BalancedMap Address',
                isMapping: true
            }],
            enums: []
        };
        const result = getConstructorAssignments([], [], stateInfo);
        expect(result).toContain('balancesTest = empWB');
    });

    test('a mapping index write inside the constructor body is skipped (unsupported)', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: { type: 'Assignment', left: { type: 'IndexAccess' }, right: {} }
        }];
        const result = getConstructorAssignments(constructorBody, [], { contractName: 'Test', variables: [], enums: [] });
        expect(result).not.toContain('IndexAccess');
        expect(result).toBe(
            'msgTest = msgctx,\n' +
            '              blockTest = block,\n' +
            '              balanceTest = 0,\n' +
            '              addressTest = fromString "Test"'
        );
    });

    test('enum member access falls back to normalizeVariableName when there is no matching state var', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: {
                type: 'Assignment',
                left: { name: 'state' },
                right: { type: 'MemberAccess', expression: { name: 'StateType' }, memberName: 'Pending' }
            }
        }];
        const stateInfo = {
            contractName: 'Test',
            variables: [],
            enums: [{ originalName: 'StateType', name: 'StateTypeTest', members: [{ name: 'PendingTest', originalName: 'Pending' }] }]
        };
        const result = getConstructorAssignments(constructorBody, [], stateInfo);
        expect(result).toContain('state = PendingTest');
    });

    test('payable(msg.sender) with a matching state var', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: {
                type: 'Assignment',
                left: { name: 'owner' },
                right: {
                    type: 'FunctionCall',
                    expression: { name: 'payable' },
                    arguments: [{ type: 'MemberAccess', expression: { name: 'msg' }, memberName: 'sender' }]
                }
            }
        }];
        const stateInfo = { contractName: 'Test', variables: [{ name: 'ownerTest', originalName: 'owner', type: 'Address' }], enums: [] };
        const result = getConstructorAssignments(constructorBody, [], stateInfo);
        // The "(msgTest st)" that translateExpression would normally produce
        // gets rewritten to plain "msgctx" since we're inside the constructor.
        expect(result).toContain('ownerTest = (sender msgctx)');
    });

    test('payable(msg.sender) with no matching state var falls back to normalizeVariableName', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: {
                type: 'Assignment',
                left: { name: 'Owner' },
                right: {
                    type: 'FunctionCall',
                    expression: { name: 'payable' },
                    arguments: [{ type: 'MemberAccess', expression: { name: 'msg' }, memberName: 'sender' }]
                }
            }
        }];
        const result = getConstructorAssignments(constructorBody, [], { contractName: 'Test', variables: [], enums: [] });
        expect(result).toContain('owner = (sender msgctx)');
    });

    test('address(this) with a matching state var', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: {
                type: 'Assignment',
                left: { name: 'addr' },
                right: { type: 'FunctionCall', expression: { name: 'address' }, arguments: [{ name: 'this' }] }
            }
        }];
        const stateInfo = { contractName: 'Test', variables: [{ name: 'addrTest', originalName: 'addr', type: 'Address' }], enums: [] };
        const result = getConstructorAssignments(constructorBody, [], stateInfo);
        expect(result).toContain('addrTest = fromString "Test"');
    });

    test('address(<numberLiteral>) with no matching state var', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: {
                type: 'Assignment',
                left: { name: 'Addr' },
                right: { type: 'FunctionCall', expression: { name: 'address' }, arguments: [{ type: 'NumberLiteral', number: '7' }] }
            }
        }];
        const result = getConstructorAssignments(constructorBody, [], { contractName: 'Test', variables: [], enums: [] });
        expect(result).toContain('addr = 7');
    });

    test('a BinaryOperation right-hand side rewrites msg/block references to msgctx/block', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: {
                type: 'Assignment',
                left: { name: 'total' },
                right: {
                    type: 'BinaryOperation',
                    operator: '+',
                    left: { type: 'MemberAccess', expression: { name: 'msg' }, memberName: 'value' },
                    right: { type: 'NumberLiteral', number: '1' }
                }
            }
        }];
        const stateInfo = { contractName: 'Test', variables: [{ name: 'totalTest', originalName: 'total', type: 'Integer' }], enums: [] };
        const result = getConstructorAssignments(constructorBody, [], stateInfo);
        expect(result).toContain('totalTest = ((value msgctx) + 1)');
    });

    test('a BooleanLiteral right-hand side with no matching state var', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: { type: 'Assignment', left: { name: 'Flag' }, right: { type: 'BooleanLiteral', value: true } }
        }];
        const result = getConstructorAssignments(constructorBody, [], { contractName: 'Test', variables: [], enums: [] });
        expect(result).toContain('flag = True');
    });

    test('a NumberLiteral right-hand side, with and without a matching state var', () => {
        const withStateVar = getConstructorAssignments([{
            type: 'ExpressionStatement',
            expression: { type: 'Assignment', left: { name: 'price' }, right: { type: 'NumberLiteral', number: '99' } }
        }], [], { contractName: 'Test', variables: [{ name: 'priceTest', originalName: 'price', type: 'Integer' }], enums: [] });
        expect(withStateVar).toContain('priceTest = 99');

        const withoutStateVar = getConstructorAssignments([{
            type: 'ExpressionStatement',
            expression: { type: 'Assignment', left: { name: 'Price' }, right: { type: 'NumberLiteral', number: '99' } }
        }], [], { contractName: 'Test', variables: [], enums: [] });
        expect(withoutStateVar).toContain('price = 99');
    });

    test('default-initializes state vars the constructor never assigns (Bool/String/enum/numeric)', () => {
        // This is the fix for the recConError/casesToLg bug: any state var the
        // constructor body doesn't explicitly assign gets Solidity's implicit
        // default value instead of being left out of the record literal.
        const stateInfo = {
            contractName: 'Test',
            variables: [
                { name: 'flagTest', originalName: 'flag', type: 'Bool' },
                { name: 'nameTest', originalName: 'name', type: 'String' },
                { name: 'stateTest', originalName: 'state', type: 'StateTypeTest' },
                { name: 'countTest', originalName: 'count', type: 'Integer' }
            ],
            enums: [{
                originalName: 'StateType',
                name: 'StateTypeTest',
                members: [{ name: 'PendingTest', originalName: 'Pending' }]
            }]
        };

        const result = getConstructorAssignments([], [], stateInfo);

        expect(result).toContain('flagTest = False');
        expect(result).toContain('nameTest = ""');
        expect(result).toContain('stateTest = PendingTest');
        expect(result).toContain('countTest = 0');
    });

    test('does not re-default a state var the constructor body already assigned', () => {
        const constructorBody = [{
            type: 'ExpressionStatement',
            expression: { type: 'Assignment', left: { name: 'count' }, right: { type: 'NumberLiteral', number: '5' } }
        }];
        const stateInfo = {
            contractName: 'Test',
            variables: [{ name: 'countTest', originalName: 'count', type: 'Integer' }],
            enums: []
        };
        const result = getConstructorAssignments(constructorBody, [], stateInfo);
        // "countTest" should appear exactly once, with the explicit value (5),
        // not the default (0).
        expect(result.match(/countTest =/g)).toHaveLength(1);
        expect(result).toContain('countTest = 5');
    });

    test('does not default a mapping-type var a second time', () => {
        const stateInfo = {
            contractName: 'Test',
            variables: [{ name: 'balancesTest', originalName: 'balances', type: 'BalancedMap Address', isMapping: true }],
            enums: []
        };
        const result = getConstructorAssignments([], [], stateInfo);
        expect(result.match(/balancesTest =/g)).toHaveLength(1);
    });
});
