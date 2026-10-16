const { solidityToHaskell } = require('../src/index');

// Solidity >= 0.6 constructs found in Ethernaut and DeFiVulnLabs
// (benchmarks/ethernaut, benchmarks/defivulnlabs).
describe('modern Solidity constructs', () => {
    test('receive() and fallback() are entry points, not constructors', () => {
        const haskell = solidityToHaskell(`
            contract C {
                uint x;
                constructor() { x = 1; }
                receive() external payable { x = 2; }
                fallback() external { x = 3; }
            }`);
        expect(haskell.match(/^constructorC ::/gm)).toHaveLength(1);
        expect(haskell).toMatch(/^receive :: CState -> CState$/m);
        expect(haskell).toMatch(/^fallback :: CState -> CState$/m);
    });

    test('an empty payable receive() still credits msg.value', () => {
        const haskell = solidityToHaskell(`
            contract C {
                uint x;
                receive() external payable {}
            }`);
        expect(haskell).toContain('st1 = st { balanceC = ((balanceC st) + (value (msgC st))) }');
    });

    test('unchecked blocks run inline', () => {
        const haskell = solidityToHaskell(`
            contract C {
                mapping(address => uint) balances;
                function f(address to, uint amount) public {
                    uint old = balances[to];
                    unchecked { balances[to] = old - amount; }
                }
            }`);
        expect(haskell).not.toMatch(/-- TODO/);
        expect(haskell).toContain('setWB (balancesC st) to (old - amount)');
    });

    test('payable(addr) is the address itself', () => {
        const haskell = solidityToHaskell(`
            contract C {
                uint x;
                function f() public { payable(msg.sender).transfer(1); }
            }`);
        expect(haskell).toContain('callC st ((sender (msgC st))) (1)');
    });

    test('uint division is integer division', () => {
        const haskell = solidityToHaskell(`
            contract C {
                uint x;
                function f(uint a) public { x = a / 100; }
            }`);
        expect(haskell).toContain('(a `div` 100)');
    });

    test('parameters named like Haskell keywords are renamed', () => {
        const haskell = solidityToHaskell(`
            contract C {
                uint x;
                function f(uint data) public { x = data; }
            }`);
        expect(haskell).toMatch(/^f st _input_data = /m);
    });

    test('tuple declarations with empty slots do not crash', () => {
        expect(() => solidityToHaskell(`
            contract C {
                uint x;
                function f() public {
                    (bool ok, ) = msg.sender.call{value: 1}("");
                    (, uint y) = g();
                }
            }`)).not.toThrow();
    });

    test('ledger lemmas are available before sending ether', () => {
        const haskell = solidityToHaskell(`
            contract Store {
                mapping(address => uint) balances;
                function deposit() public payable { balances[msg.sender] += msg.value; }
                function withdraw(uint w) public {
                    require(balances[msg.sender] >= w);
                    (bool ok, ) = msg.sender.call{value: w}("");
                    balances[msg.sender] -= w;
                }
            }`);
        expect(haskell).toMatch(
            /assert \(lemma_currentBalance_le_mBal \(balancesStore st\d\) \(sender \(msgStore st\d\)\)\) \$ callStore/);
    });
});
