const { gatherFunctionDefinitions, createUniqueParamName } = require('../src/gatherFunctions');

jest.mock('../src/typeMappings', () => ({
    solidityTypeToHaskellType: (type) => type?.name || 'UnknownType'
}));

describe('createUniqueParamName', () => {
    test('returns normalized name when no conflict', () => {
        const stateVars = [{ name: 'other' }];
        expect(createUniqueParamName('MyParam', stateVars)).toBe('myParam');
    });

    test('returns prefixed name when conflict exists', () => {
        const stateVars = [{ name: 'myParam' }];
        expect(createUniqueParamName('myParam', stateVars)).toBe('_input_myParam');
    });
});

describe('gatherFunctionDefinitions', () => {
    test('handles empty contract', () => {
        const result = gatherFunctionDefinitions({ subNodes: [] });
        expect(result).toEqual({
            functions: [],
            nameMap: new Map()
        });
    });

    test('processes regular function', () => {
        const contract = {
            subNodes: [{
                type: 'FunctionDefinition',
                name: 'increment',
                parameters: [{
                    name: 'x',
                    typeName: { name: 'uint256' }
                }],
                body: { statements: [] }
            }]
        };

        const result = gatherFunctionDefinitions(contract);
        expect(result.functions[0]).toEqual({
            name: 'increment',
            isPure: false,
            isView: false,
            originalName: 'increment',
            params: [{
                name: 'x',
                type: 'uint256',
                originalName: 'x'
            }],
            returnType: null,
            body: []
        });
    });

    test('handles constructor', () => {
        const contract = {
            subNodes: [{
                type: 'FunctionDefinition',
                parameters: [],
                body: { statements: [] }
            }]
        };

        const result = gatherFunctionDefinitions(contract);
        expect(result.functions[0].name).toBe('constructor');
    });

    test('handles unnamed parameters', () => {
        const contract = {
            subNodes: [{
                type: 'FunctionDefinition',
                name: 'test',
                parameters: [{ typeName: { name: 'uint256' } }],
                body: { statements: [] }
            }]
        };

        const result = gatherFunctionDefinitions(contract);
        expect(result.functions[0].params[0].name).toBe('arg0');
    });

    test('handles function without body', () => {
        const contract = {
            subNodes: [{
                type: 'FunctionDefinition',
                name: 'test',
                parameters: [],
                body: null
            }]
        };

        const result = gatherFunctionDefinitions(contract);
        expect(result.functions[0].body).toEqual([]);
    });
});

describe('gatherFunctionDefinitions - non-function nodes', () => {
    test('should ignore non-function nodes', () => {
        const contract = {
            subNodes: [
                {
                    type: 'StateVariableDeclaration',
                    name: 'someVar'
                },
                {
                    type: 'FunctionDefinition',
                    name: 'validFunction',
                    parameters: [],
                    body: { statements: [] }
                },
                {
                    type: 'EventDefinition',
                    name: 'someEvent'
                }
            ]
        };

        const result = gatherFunctionDefinitions(contract);
        expect(result.functions).toHaveLength(1);
        expect(result.functions[0].name).toBe('validFunction');
    });
});