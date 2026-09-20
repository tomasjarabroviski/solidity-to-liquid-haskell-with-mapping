const {
    gatherStateDefinitions,
    generateEnumType,
    normalizeVariableName
} = require('../src/gatherState');

jest.mock('../src/typeMappings', () => ({
    solidityTypeToHaskellType: (type) => type?.name || 'UnknownType'
}));

describe('normalizeVariableName', () => {
    test('should convert first character to lowercase', () => {
        expect(normalizeVariableName('Count')).toBe('count');
        expect(normalizeVariableName('MyVariable')).toBe('myVariable');
        expect(normalizeVariableName('already_lowercase')).toBe('already_lowercase');
    });
});

describe('generateEnumType', () => {
    test('should generate correct Haskell enum definition', () => {
        const enumDef = {
            name: 'StateType',
            originalName: 'StateType',
            members: [
                { name: 'Pending', originalName: 'Pending' },
                { name: 'Approved', originalName: 'Approved' },
                { name: 'Rejected', originalName: 'Rejected' }
            ]
        };
        expect(generateEnumType(enumDef))
            .toBe('data StateType = Pending | Approved | Rejected deriving (Show, Eq)');
    });
});

describe('gatherStateDefinitions', () => {
    test('should include default msg variable', () => {
        const contract = { name: 'TestContract', subNodes: [] };
        const result = gatherStateDefinitions(contract, 'TestContract');
        expect(result.variables).toContainEqual({
            name: 'msgTestContract',
            type: 'Message',
            originalName: 'msg'
        });
    });

    test('should process state variables', () => {
        const contract = {
            name: 'TestContract',
            subNodes: [{
                type: 'StateVariableDeclaration',
                variables: [{
                    name: 'Count',
                    typeName: { name: 'uint256' }
                }]
            }]
        };
        const result = gatherStateDefinitions(contract, 'TestContract');
        expect(result.variables).toContainEqual({
            name: 'countTestContract',
            type: 'uint256',
            originalName: 'Count'
        });
    });

    test('should process enum definitions', () => {
        const contract = {
            name: 'TestContract',
            subNodes: [{
                type: 'EnumDefinition',
                name: 'Status',
                members: [
                    { name: 'Pending' },
                    { name: 'Active' }
                ]
            }]
        };
        const result = gatherStateDefinitions(contract, 'TestContract');
        expect(result.enums).toContainEqual({
            name: 'StatusTestContract',
            originalName: 'Status',
            members: [
                { name: 'PendingTestContract', originalName: 'Pending' },
                { name: 'ActiveTestContract', originalName: 'Active' }
            ]
        });
    });

    test('should handle empty contract', () => {
        const contract = { name: 'TestContract', subNodes: [] };
        const result = gatherStateDefinitions(contract, 'TestContract');
        expect(result).toEqual({
            contractName: 'TestContract',
            contractInstances: {},
            variables: [{
                name: 'msgTestContract',
                type: 'Message',
                originalName: 'msg'
            }, {
                name: 'blockTestContract',
                type: 'Block',
                originalName: 'block'
            },{
                name:'balanceTestContract',
                type:'Amount',
                originalName:'balance'
            },
            {
                name:'addressTestContract',
                type:'Address',
                originalName:'address'
            }],
            enums: [],
            nameMap: new Map(),
            localVars: new Set()
        });
    });
});

describe('gatherStateDefinitions - variable processing', () => {
    test('should handle variable without name', () => {
        const contract = {
            name: 'TestContract',
            subNodes: [{
                type: 'StateVariableDeclaration',
                variables: [
                    { name: null, typeName: { name: 'uint256' } },
                    { typeName: { name: 'uint256' } }
                ]
            }]
        };
        const result = gatherStateDefinitions(contract, 'TestContract');
        // Should only contain default msg variable and block
        expect(result.variables).toHaveLength(4);
        expect(result.nameMap.size).toBe(0);
    });

    test('should process multiple variables in same declaration', () => {
        const contract = {
            name: 'TestContract',
            subNodes: [{
                type: 'StateVariableDeclaration',
                variables: [
                    { name: 'firstVar', typeName: { name: 'uint256' } },
                    { name: 'SecondVar', typeName: { name: 'bool' } }
                ]
            }]
        };
        const result = gatherStateDefinitions(contract, 'TestContract');

        expect(result.variables).toContainEqual({
            name: 'firstVarTestContract',
            type: 'uint256',
            originalName: 'firstVar'
        });
        expect(result.variables).toContainEqual({
            name: 'secondVarTestContract',
            type: 'bool',
            originalName: 'SecondVar'
        });
        expect(result.nameMap.get('SecondVar')).toBe('secondVarTestContract');
    });
});

describe('gatherStateDefinitions - enum branch', () => {
    test('should handle non-enum node types', () => {
        const contract = {
            name: 'TestContract',
            subNodes: [{
                type: 'OtherType',
                name: 'Test',
                members: []
            }]
        };
        const result = gatherStateDefinitions(contract, 'TestContract');
        expect(result.enums).toHaveLength(0);
    });

    test('should specifically test enum branch', () => {
        const contract = {
            name: 'TestContract',
            subNodes: [
                {
                    type: 'EnumDefinition',
                    name: 'Status',
                    members: [{ name: 'Active' }]
                },
                {
                    type: 'EnumDefinition',
                    name: 'Role',
                    members: [{ name: 'Admin' }]
                }
            ]
        };
        const result = gatherStateDefinitions(contract, 'TestContract');
        expect(result.enums).toHaveLength(2);
        expect(result.enums).toEqual([
            { 
                name: 'StatusTestContract', 
                originalName: 'Status', 
                members: [{ name: 'ActiveTestContract', originalName: 'Active' }] 
            },
            { 
                name: 'RoleTestContract', 
                originalName: 'Role', 
                members: [{ name: 'AdminTestContract', originalName: 'Admin' }] 
            }
        ]);
    });
});