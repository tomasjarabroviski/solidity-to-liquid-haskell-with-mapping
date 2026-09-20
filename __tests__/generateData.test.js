const { generateHaskellData } = require('../src/generateData');

describe('generateHaskellData', () => {
    test('empty state', () => {
        const result = generateHaskellData('Contract', {
            variables: [],
            enums: []
        });
        expect(result).toBe('\ndata ContractState = ContractState');
    });

    test('only variables', () => {
        const stateInfo = {
            variables: [
                { name: 'count', type: 'Integer' },
                { name: 'owner', type: 'Address' }
            ],
            enums: []
        };
        const expected = '\n{-@ data ContractState = ContractState {\n  count :: Integer,\n  owner :: Address\n}\n@-} \n\ndata ContractState = ContractState {\n  count :: Integer,\n  owner :: Address\n}'

        result = generateHaskellData('Contract', stateInfo);
        expect(result).toBe(expected);
    });

    test('only enums', () => {
        const stateInfo = {
            variables: [],
            enums: [{
                originalName: 'Status',
                name: 'StatusContract', // Adding contract name suffix
                members: [
                    { name: 'ActiveContract', originalName: 'Active' },
                    { name: 'PendingContract', originalName: 'Pending' }
                ]
            }]
        };
        const expected =
            'data StatusContract = ActiveContract | PendingContract deriving (Show, Eq)\n\n' +
            'data ContractState = ContractState';
        expect(generateHaskellData('Contract', stateInfo)).toBe(expected);
    });

    test('both variables and enums', () => {
        const stateInfo = {
            variables: [{ name: 'status', type: 'Status' }],
            enums: [{
                originalName: 'Status',
                name: 'StatusContract', // Adding contract name suffix
                members: [
                    { name: 'ActiveContract', originalName: 'Active' },
                    { name: 'PendingContract', originalName: 'Pending' }
                ]
            }]
        };
        const expected = `data StatusContract = ActiveContract | PendingContract deriving (Show, Eq)

{-@ data ContractState = ContractState {
  status :: Status
}
@-} 

data ContractState = ContractState {
  status :: Status
}`;
        expect(generateHaskellData('Contract', stateInfo)).toBe(expected);
    });
});

describe('generateHaskellData - enum handling edge cases', () => {
    test('handles missing enums property', () => {
        const stateInfo = {
            variables: [{ name: 'count', type: 'Integer' }]
            // enums property missing
        };
        const expected =
            `{-@ data ContractState = ContractState {
  count :: Integer
}
@-} 

data ContractState = ContractState {
  count :: Integer
}`;
        expect(generateHaskellData('Contract', stateInfo)).toBe(expected);
    });

    test('handles null enums', () => {
        const stateInfo = {
            variables: [{ name: 'count', type: 'Integer' }],
            enums: null
        };
        const expected =
            `{-@ data ContractState = ContractState {
  count :: Integer
}
@-} 

data ContractState = ContractState {
  count :: Integer
}`;
        expect(generateHaskellData('Contract', stateInfo)).toBe(expected);
    });
});