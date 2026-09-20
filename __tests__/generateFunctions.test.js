const { generateHaskellFunctions, REVERT_FUNCTION } = require('../src/generateFunctions');



describe('generateHaskellFunctions', () => {
    test('handles empty functions array', () => {
        const result = generateHaskellFunctions('Test', { functions: [] }, { variables: [] });
        expect(result).toBe('');
    });

    test('generates function without parameters', () => {
        const fnInfo = {
            functions: [{
                name: 'initialize',
                params: [],
                body: []
            }]
        };
        const result = generateHaskellFunctions('Test', fnInfo, { variables: [] });
        expect(result).toContain('initialize :: TestState -> TestState');
    });

    test('generates function with parameters', () => {
        const fnInfo = {
            functions: [{
                name: 'increment',
                params: [
                    { name: 'amount', type: 'Integer' }
                ],
                body: []
            }]
        };
        const result = generateHaskellFunctions('Test', fnInfo, { variables: [] });
        expect(result).toContain('increment :: TestState -> Integer -> TestState');
    });

    test('handles function without body', () => {
        const fnInfo = {
            functions: [{
                name: 'view',
                params: [],
                body: null
            }]
        };
        const result = generateHaskellFunctions('Test', fnInfo, { variables: [] });
        expect(result).toContain('view :: TestState -> TestState');
    });

    test('handles parameter name conflicts', () => {
        const fnInfo = {
            functions: [{
                name: 'set',
                params: [{ name: 'count', type: 'Integer' }],
                body: [{ 
                    type: 'Assignment',
                    value: '_input_count'
                }]
            }]
        };
        const stateInfo = {
            variables: [{ name: 'count', type: 'Integer' }]
        };
        
        const expected =
            '{-@ test :: TestState -> TestState @-}\n' +
            'set :: TestState -> Integer -> TestState\n' +
            'set st _input_count = st { count = count st + 1 }\n';

        const result = generateHaskellFunctions('Test', fnInfo, stateInfo);
        expect(result).toContain('set :: TestState -> Integer -> TestState');
        expect(result).toContain('set st _input_count =');
    });


});

describe('generateHaskellFunctions - implementation line', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.mock('../src/translator', () => ({
            translateStatements: jest.fn((body, params, state, indent, isView) => {
                if (isView) {
                    return 'value st';
                }
                return 'st { value = value st + amount }';
            }),
            translateExpression: jest.fn((expr) => expr.value || 'value st')
        }));
    });

    test('generates implementation line with body and parameters', () => {
        const { generateHaskellFunctions, REVERT_FUNCTION, getConstructorAssignments } = require('../src/generateFunctions');


        const fnInfo = {
            functions: [{
                name: 'increment',
                params: [{ name: 'amount', type: 'Integer' }],
                body: [{ type: 'Assignment', value: 'amount' }]
            }]
        };

        const stateInfo = {
            variables: [],
            enums: []
        };

        const expected =
            '{-@ increment :: {st:TestState | True} -> {amount:Integer | True} -> {v:TestState | True} @-}\n' +
            'increment :: TestState -> Integer -> TestState\n' +
            'increment st amount = st { value = value st + amount }\n';

        const result = generateHaskellFunctions('Test', fnInfo, stateInfo);
        expect(result).toBe(expected);
    });
});

describe('generateHaskellFunctions - parameter string generation', () => {
    test('handles empty and non-empty parameters', () => {
        const emptyParamsFn = {
            functions: [{
                name: 'test',
                params: [],
                body: [{ type: 'Assignment' }]
            }]
        };

        const withParamsFn = {
            functions: [{
                name: 'test',
                params: [
                    { name: 'x', type: 'Integer' },
                    { name: 'y', type: 'Integer' }
                ],
                body: [{ type: 'Assignment' }]
            }]
        };

        const stateInfo = { variables: [], enums: [] };

        const emptyResult = generateHaskellFunctions('Test', emptyParamsFn, stateInfo);
        const withParamsResult = generateHaskellFunctions('Test', withParamsFn, stateInfo);

        expect(emptyResult).toContain('test st =');
        expect(withParamsResult).toContain('test st x y =');
    });
});

describe('generateHaskellFunctions - constructor and special functions', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.mock('../src/translator', () => ({
        translateStatements: jest.fn((body, params, state, indent, isView) => {
          if (isView) return '(value st)';  // Fix return format
          return 'st { value = newValue }';
        }),
        translateExpression: jest.fn((expr) => {
          if (!expr) return '';  // Handle undefined expressions
          if (expr.type === 'Identifier') return expr.name;
          if (expr.type === 'MemberAccess') return `${expr.base.name}.${expr.memberName}`;
          return expr.value || 'value st';
        })
      }));
    });
  
    test('generates constructor signature correctly', () => {
      const fnInfo = {
        functions: [{
          name: 'constructor',
          params: [
            { name: 'initialValue', type: 'Integer' }
          ],
          body: [{
            type: 'ExpressionStatement',
            expression: {
              type: 'Assignment',
              left: { name: 'value' },
              right: { name: 'initialValue' }
            }
          }]
        }]
      };
  
      const stateInfo = {
        contractName: 'Counter',
        variables: [{ name: 'value', type: 'Integer' }]
      };
  
      const result = generateHaskellFunctions('Counter', fnInfo, stateInfo);
      expect(result).toContain('constructorCounter :: Message -> Block -> Integer -> CounterState');
      expect(result).toContain('constructorCounter msgctx block initialValue = CounterState');
    });
  
    test('generates pure function with parameters', () => {
      const fnInfo = {
        functions: [{
          name: 'calculate',
          isPure: true,
          returnType: 'Integer',
          params: [
            { name: 'x', type: 'Integer' },
            { name: 'y', type: 'Integer' }
          ],
          body: [{ type: 'Return', value: 0 }]
        }]
      };
  
      const result = generateHaskellFunctions('Test', fnInfo, { variables: [] });
      expect(result).toContain('calculate :: TestState -> Integer -> Integer -> Integer');
    });
  
    test('handles complex constructor assignments', () => {
      const fnInfo = {
        functions: [{
          name: 'constructor',
          params: [{ name: 'owner', type: 'Address' }],
          body: [{
            type: 'ExpressionStatement',
            expression: {
              type: 'Assignment',
              left: { name: 'owner' },
              right: { 
                type: 'MemberAccess',
                memberName: 'sender'
              }
            }
          }]
        }]
      };
  
      const stateInfo = {
        contractName: 'Test',
        variables: [{ name: 'owner', type: 'Address' }]
      };
  
      const result = generateHaskellFunctions('Test', fnInfo, stateInfo);
      expect(result).toContain('msgTest = msgctx');
      expect(result).toContain('owner = sender msgctx');
    });
  
    test('generates view function with correct signature', () => {
        const contractName = 'Test';
        const fnInfo = {
          functions: [{
            name: 'getValue',
            isView: true,
            returnType: 'Integer',
            params: [{ name: 'id', type: 'Integer' }],
            body: [{
              type: 'ReturnStatement',
              expression: { type: 'Identifier', name: 'value' }
            }]
          }]
        };
        
        const stateInfo = { 
          variables: [{ name: 'value', type: 'Integer' }],
          localVars: new Set(),
          enums: []
        };
        
        const result = generateHaskellFunctions(contractName, fnInfo, stateInfo);
        expect(result).toContain('getValue :: TestState -> Integer -> Integer');
    });
      
    test('generates view function with proper indentation', () => {
      jest.resetModules();
      jest.mock('../src/translator', () => ({
        translateStatements: jest.fn((body, params, state, indent, isView) => {
          if (isView) return '(value st)';
          return 'st { value = value st }';
        })
      }));
      
      const { generateHaskellFunctions } = require('../src/generateFunctions');
        const contractName = 'Test';
        const stateInfo = {
            contractName: 'Test',
            variables: [{ 
                name: 'value', 
                type: 'Integer',
                originalName: 'value'
            }],
            localVars: new Set(),
            enums: []
        };
        
        const fnInfo = {
            functions: [{
                name: 'getValue',
                isView: true,
                returnType: 'Integer',
                params: [],
                body: [{
                    type: 'ReturnStatement',
                    expression: {
                        type: 'Identifier',
                        name: 'value'
                    }
                }]
            }]
        };
        
        const result = generateHaskellFunctions(contractName, fnInfo, stateInfo);
        expect(result).toContain('getValue :: TestState -> Integer');
        expect(result).toMatch(/getValue st =\s+\(value st\)/);
    });
  });

  describe('getConstructorAssignments', () => {
    const { getConstructorAssignments } = require('../src/generateFunctions');

    // First expose the function we want to test

    test('handles member access assignments correctly', () => {
      const constructorBody = [{
        type: 'ExpressionStatement',
        expression: {
          type: 'Assignment',
          left: { name: 'state' },
          right: {
            type: 'MemberAccess',
            expression: { name: 'StateType' },
            memberName: 'Request'
          }
        }
      }];

      const stateInfo = {
        contractName: 'Test',
        variables: [{
          name: 'stateTest',
          originalName: 'state',
          type: 'StateTypeTest'
        }],
        enums: [{
          originalName: 'StateType',
          name: 'StateTypeTest',
          members: [
            { name: 'RequestTest', originalName: 'Request' }
          ]
        }]
      };

      const result = getConstructorAssignments(constructorBody, [], stateInfo);
      expect(result).toContain('stateTest = RequestTest');
    });

    test('handles msg.sender member access specifically', () => {
      const constructorBody = [{
        type: 'ExpressionStatement',
        expression: {
          type: 'Assignment',
          left: { name: 'owner' },
          right: {
            type: 'MemberAccess',
            memberName: 'sender'
          }
        }
      }];

      const stateInfo = {
        contractName: 'Test',
        variables: [{
          name: 'owner',
          originalName: 'owner',
          type: 'Address'
        }]
      };

      const result = getConstructorAssignments(constructorBody, [], stateInfo);
      expect(result).toContain('owner = sender msgctx');
    });

    test('handles multiple assignments with proper formatting', () => {
      const constructorBody = [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'Assignment',
            left: { name: 'owner' },
            right: {
              type: 'MemberAccess',
              memberName: 'sender'
            }
          }
        },
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'Assignment',
            left: { name: 'state' },
            right: {
              type: 'MemberAccess',
              expression: { name: 'StateType' },
              memberName: 'Request'
            }
          }
        }
      ];

      const stateInfo = {
        contractName: 'Test',
        variables: [{
          name: 'ownerTest',
          originalName: 'owner',
          type: 'Address'
        },
        {
          name: 'stateTest',
          originalName: 'state',
          type: 'StateTypeTest'
        }],
        enums: [{
          originalName: 'StateType',
          name: 'StateTypeTest',
          members: [
            { name: 'RequestTest', originalName: 'Request' }
          ]
        }]
      };

      const result = getConstructorAssignments(constructorBody, [], stateInfo);
      expect(result).toBe(
        'msgTest = msgctx,\n' +
        '              blockTest = block,\n' +
        '              balanceTest = 0,\n' +
        '              addressTest = fromString "Test",\n' +
        '              ownerTest = sender msgctx,\n' +
        '              stateTest = RequestTest'
      );
    });

    test('handles assignments with constructor parameters', () => {
      const constructorBody = [{
        type: 'ExpressionStatement',
        expression: {
          type: 'Assignment',
          left: { name: 'message' },
          right: { 
            name: 'message'  // Parameter name
          }
        }
      }];

      const uniqueParams = [{
        originalName: 'message',
        name: 'message',
        type: 'String'
      }];

      const stateInfo = {
        contractName: 'Test',
        variables: [{
          name: 'message',
          originalName: 'message',
          type: 'String'
        }]
      };

      const result = getConstructorAssignments(constructorBody, uniqueParams, stateInfo);

      // Check parameter assignment
      expect(result).toContain('message = message');
    });
  });

  