const {
    generateLiquidAnnotation,
    expressionToLiquidPredicate,
    extractRequireConditions,
    splitAsserts,
    LIQUID_ANNOTATIONS
} = require('../src/liquidConditions');

jest.mock('../src/translator', () => ({
    translateExpression: jest.fn((expr) => expr.name || 'translated'),
    translateOperator: jest.fn(() => '==')
}));

describe('generateLiquidAnnotation', () => {
    test('generates basic annotation without conditions', () => {
        const fn = {
            name: 'test',
            body: [],
            params: []
        };

        const result = generateLiquidAnnotation('Test', fn, [], {});
        expect(result).toBe('{-@ test :: {st:TestState | True} -> {v:TestState | True} @-}');
    });

    test('handles require conditions', () => {
        const fn = {
            name: 'transfer',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionCall',
                    expression: { name: 'require' },
                    arguments: [{
                        type: 'BinaryOperation',
                        operator: '>',
                        left: { name: 'balance' },
                        right: { name: 'amount' }
                    }]
                }
            }],
            params: [{ name: 'amount', type: 'Integer', originalName: 'amount' }]
        };

        const result = generateLiquidAnnotation('Test', fn,
            [{ name: 'amount', type: 'Integer', originalName: 'amount' }],
            { variables: [] }
        );
        expect(result).toContain('(balance) == (amount)');
    });

    test('splitAsserts: only the asserts that end the body (before a final return) are ending', () => {
        const assertStmt = name => ({
            type: 'ExpressionStatement',
            expression: { type: 'FunctionCall', expression: { name: 'assert' }, arguments: [{ name }] }
        });
        const other = { type: 'ExpressionStatement', expression: { type: 'OtherExpression' } };
        const ret = { type: 'ReturnStatement', expression: null };
        const [a, b, c] = [assertStmt('a'), assertStmt('b'), assertStmt('c')];

        expect(splitAsserts([a, other, b, c, ret])).toEqual({ ending: [b, c], other: [a] });
        // An early return means no assert is reached on every path.
        const earlyReturn = { type: 'IfStatement', trueBody: ret };
        expect(splitAsserts([earlyReturn, b, c])).toEqual({ ending: [], other: [b, c] });
        expect(splitAsserts(null)).toEqual({ ending: [], other: [] });
    });

    test('handles parameter conditions', () => {
        const fn = {
            name: 'test',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionCall',
                    expression: { name: 'require' },
                    arguments: [{
                        type: 'BinaryOperation',
                        operator: '>',
                        left: { name: 'param' },
                        right: { name: 'value' }
                    }]
                }
            }],
            params: [{ name: 'param', type: 'Integer', originalName: 'param' }]
        };

        const result = generateLiquidAnnotation('Test', fn,
            [{ name: 'param', type: 'Integer', originalName: 'param' }],
            { variables: [] }
        );
        expect(result).toContain('{param:Integer |');
        expect(result).toContain('(param) == (value)');
    });
});

    describe('generateLiquidAnnotation - predicate mapping', () => {
        test('handles state condition predicates', () => {
            const fn = {
                name: 'test',
                body: [
                    {
                        type: 'ExpressionStatement',
                        expression: {
                            type: 'FunctionCall',
                            expression: { name: 'require' },
                            arguments: [
                                {
                                    type: 'BinaryOperation',
                                    operator: '>',
                                    left: { name: 'balance' },
                                    right: { name: 'amount' }
                                }
                            ]
                        }
                    }
                ]
            };

        const stateInfo = {
            variables: [{ name: 'balance', type: 'Integer' }]
        };

        const result = generateLiquidAnnotation('Test', fn, [], stateInfo);
        expect(result).toContain('{st:TestState |');
        expect(result).toContain('(balance) == (amount)');
    });
});


describe('liquidConditions utilities', () => {

    test('extractRequireConditions handles null body', () => {
        const result = extractRequireConditions(null);
        expect(result).toEqual([]);
    });
});

describe('extractConditions', () => {
    test('extracts require conditions', () => {
        const body = [{
            type: 'ExpressionStatement',
            expression: {
                type: 'FunctionCall',
                expression: { name: 'require' },
                arguments: [{ type: 'BinaryOperation' }]
            }
        }, {
            type: 'ExpressionStatement',
            expression: { type: 'OtherExpression' }
        }];

        const requires = extractRequireConditions(body);
        expect(requires).toHaveLength(1);
        expect(requires[0].type).toBe('BinaryOperation');
    });
});

describe('generateLiquidAnnotation - parameter conditions', () => {
    test('handles parameters with and without conditions', () => {
        const fn = {
            name: 'test',
            body: [{
                type: 'ExpressionStatement',
                expression: {
                    type: 'FunctionCall',
                    expression: { name: 'require' },
                    arguments: [{
                        type: 'BinaryOperation',
                        operator: '>',
                        left: { name: 'amount' },
                        right: { name: '0' }
                    }]
                }
            }],
            params: [
                { name: 'amount', type: 'Integer', originalName: 'amount' },
                { name: 'recipient', type: 'Address', originalName: 'recipient' }
            ]
        };

        const result = generateLiquidAnnotation('Test', fn,
            [
                { name: 'amount', type: 'Integer', originalName: 'amount' },
                { name: 'recipient', type: 'Address', originalName: 'recipient' }
            ],
            { variables: [] }
        );

        // Should contain amount parameter with condition
        expect(result).toContain('{amount:Integer | ((amount) == (0))}');
        // Should contain recipient parameter with default 'True' condition
        expect(result).toContain('{recipient:Address | True}');
    });
});

describe('generateLiquidAnnotation - constructor handling', () => {
    test('generates constructor annotation correctly', () => {
      const fn = {
        name: 'constructor',
        body: [],
        params: [
          { name: 'initialValue', type: 'Integer', originalName: 'initialValue' }
        ]
      };
  
      const result = generateLiquidAnnotation('Test', fn, 
        [{ name: 'initialValue', type: 'Integer', originalName: 'initialValue' }], 
        {});
      
      expect(result).toMatch(/^{-@ constructorTest :: Message -> Block  -> {initialValue:Integer/);
    });
  });
  
  describe('generateLiquidAnnotation - return types', () => {
    test('handles view function with Bool return type', () => {
      const fn = {
        name: 'isValid',
        isView: true,
        returnType: 'Bool',
        body: [],
        params: []
      };
  
      const result = generateLiquidAnnotation('Test', fn, [], {});
      expect(result).toContain('-> {v:Bool |');
    });
  
    test('handles pure function with Integer return type', () => {
      const fn = {
        name: 'calculate',
        isPure: true, 
        returnType: 'Integer',
        body: [],
        params: []
      };
  
      const result = generateLiquidAnnotation('Test', fn, [], {});
      expect(result).toContain('-> {v:Integer |');
    });
  
    test('handles view function with custom return type', () => {
      const fn = {
        name: 'getData',
        isView: true,
        returnType: 'CustomType',
        body: [],
        params: []
      };
  
      const result = generateLiquidAnnotation('Test', fn, [], {});
      expect(result).toContain('-> {v:CustomType |');
    });
  
    test('handles non-view/pure function with state return type', () => {
      const fn = {
        name: 'modify',
        isView: false,
        isPure: false,
        body: [],
        params: []
      };
  
      const result = generateLiquidAnnotation('Test', fn, [], {});
      expect(result).toContain('-> {v:TestState |');
    });
  });