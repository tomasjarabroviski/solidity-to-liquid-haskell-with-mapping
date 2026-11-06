const { lowerFirst, walkAst, isMsgValue } = require('../src/astUtils');

describe('lowerFirst', () => {
  test('converts the first character to lowercase', () => {
    expect(lowerFirst('Count')).toBe('count');
    expect(lowerFirst('MyVariable')).toBe('myVariable');
    expect(lowerFirst('already_lowercase')).toBe('already_lowercase');
  });
});

describe('walkAst', () => {
  test('visits every nested node in pre-order, including array elements', () => {
    const ast = {
      type: 'BinaryOperation',
      left: { type: 'Identifier', name: 'a' },
      right: { type: 'TupleExpression', components: [{ type: 'Identifier', name: 'b' }] }
    };
    const visited = [];
    walkAst(ast, node => visited.push(node.type));
    expect(visited).toEqual(['BinaryOperation', 'Identifier', 'TupleExpression', 'Identifier']);
  });

  test('ignores null and primitive values', () => {
    const visit = jest.fn();
    walkAst(null, visit);
    walkAst('x', visit);
    expect(visit).not.toHaveBeenCalled();
  });
});

describe('isMsgValue', () => {
  test('recognizes msg.value only', () => {
    const member = (object, memberName) => ({ type: 'MemberAccess', memberName, expression: { type: 'Identifier', name: object } });
    expect(isMsgValue(member('msg', 'value'))).toBe(true);
    expect(isMsgValue(member('msg', 'sender'))).toBe(false);
    expect(isMsgValue(member('tx', 'value'))).toBe(false);
    expect(isMsgValue(null)).toBe(false);
  });
});
