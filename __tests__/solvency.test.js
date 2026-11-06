const { solidityToHaskell } = require('../src/index');

// Solvency invariant: mappings that account for received ether must not owe
// more than the contract holds (see findLedgerMappings in index.js).
describe('solvency invariant', () => {
  test('a mapping credited with msg.value owes 1 wei per unit', () => {
    const haskell = solidityToHaskell(`
            contract Bank {
                mapping(address => uint) balances;
                function deposit() public payable { balances[msg.sender] += msg.value; }
            }`);
    expect(haskell).toContain('{st:BankState | (mBal (balancesBank st) <= balanceBank st)}');
    expect(haskell).toContain('{v:BankState | (mBal (balancesBank v) <= balanceBank v)}');
  });

  test('a mapping bought at a constant price owes sum * price', () => {
    const haskell = solidityToHaskell(`
            contract Sale {
                mapping(address => uint) tokens;
                uint constant PRICE = 2 ether;
                function buy(uint n) public payable {
                    require(msg.value == n * PRICE);
                    tokens[msg.sender] += n;
                }
            }`);
    expect(haskell).toContain('(mBal (tokensSale st) * 2000000000000000000 <= balanceSale st)');
  });

  test('numeric constants are inlined, not state fields', () => {
    const haskell = solidityToHaskell(`
            contract Sale {
                uint constant PRICE = 2 ether;
                uint total;
                function f(uint n) public { total = n * PRICE; }
            }`);
    expect(haskell).not.toMatch(/pRICESale/);
    expect(haskell).toContain('(n * 2000000000000000000)');
  });

  test('mappings not credited with ether get no invariant', () => {
    const haskell = solidityToHaskell(`
            contract Token {
                mapping(address => uint) balances;
                function mint(uint n) public { balances[msg.sender] += n; }
            }`);
    expect(haskell).not.toContain('mBal (balancesToken st) <=');
  });
});
