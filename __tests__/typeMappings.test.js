const { solidityTypeToHaskellType } = require('../src/typeMappings');

describe('solidityTypeToHaskellType', () => {
    test('should handle null/undefined input', () => {
        expect(solidityTypeToHaskellType(null)).toBe('UnknownType');
        expect(solidityTypeToHaskellType(undefined)).toBe('UnknownType');
    });

    describe('ElementaryTypeName', () => {
        test('should convert uint types to Integer', () => {
            expect(solidityTypeToHaskellType({
                type: 'ElementaryTypeName',
                name: 'uint256'
            })).toBe('Uint');

            expect(solidityTypeToHaskellType({
                type: 'ElementaryTypeName',
                name: 'uint8'
            })).toBe('Uint');
        });

        test('should convert int types to Integer', () => {
            expect(solidityTypeToHaskellType({
                type: 'ElementaryTypeName',
                name: 'int256'
            })).toBe('Integer');

            expect(solidityTypeToHaskellType({
                type: 'ElementaryTypeName',
                name: 'int8'
            })).toBe('Integer');
        });

        test('should convert bool to Bool', () => {
            expect(solidityTypeToHaskellType({
                type: 'ElementaryTypeName',
                name: 'bool'
            })).toBe('Bool');
        });

        test('should convert string to String', () => {
            expect(solidityTypeToHaskellType({
                type: 'ElementaryTypeName',
                name: 'string'
            })).toBe('String');
        });

        test('should convert address to Address', () => {
            expect(solidityTypeToHaskellType({
                type: 'ElementaryTypeName',
                name: 'address'
            })).toBe('Address');
        });

        test('should handle unknown elementary types', () => {
            expect(solidityTypeToHaskellType({
                type: 'ElementaryTypeName',
                name: 'bytes32'
            })).toBe('UnknownType_bytes32');
        });
    });

    describe('UserDefinedTypeName', () => {
        test('should return namePath when available', () => {
            expect(solidityTypeToHaskellType({
                type: 'UserDefinedTypeName',
                namePath: 'CustomType'
            })).toBe('CustomType');
        });

        test('should return UnknownType when namePath is missing', () => {
            expect(solidityTypeToHaskellType({
                type: 'UserDefinedTypeName'
            })).toBe('UnknownType');
        });
    });

    test('should handle unknown type nodes', () => {
        expect(solidityTypeToHaskellType({
            type: 'UnknownType'
        })).toBe('UnknownType');
    });
});