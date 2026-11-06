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

  test('every form of sending ether uses the same call model', () => {
    const haskell = solidityToHaskell(`
            contract C {
                function viaDeclaration(uint w) public { (bool ok, ) = msg.sender.call{value: w}(""); }
                function viaBareCall(uint w) public { msg.sender.call{value: w}(""); }
                function viaTransfer(uint w) public { payable(msg.sender).transfer(w); }
                function viaSend(uint w) public { payable(msg.sender).send(w); }
            }`);
    const sends = haskell.split('\n').filter(l => /= callC /.test(l)).map(l => l.trim());
    expect(sends).toEqual(Array(4).fill('st1 = callC st ((sender (msgC st))) (w)'));
  });

  test('assert is checked where it is written, with locals in scope', () => {
    const haskell = solidityToHaskell(`
            contract C {
                uint count;
                function f(uint x) public {
                    uint before = count;
                    count = count + x;
                    assert(before <= count);
                    count = 0;
                }
            }`);
    expect(haskell).toMatch(/st\d = if \(before <= \(countC st\d\)\) then st\d else revert "assert"/);
    // It is not at the end of the function, so it is not a postcondition.
    expect(haskell).toMatch(/-> \{v:CState \| True\} @-\}/);
  });

  test('asserts that end a function are also postconditions', () => {
    const haskell = solidityToHaskell(`
            contract C {
                uint count;
                constructor() { count = 1; assert(count == 1); }
                function f(uint x) public returns (bool) {
                    count = x;
                    assert(count == x);
                    return true;
                }
                function g(uint x) public {
                    uint before = count;
                    count = x;
                    assert(before >= 0);
                }
            }`);
    expect(haskell).toMatch(/\{-@ constructorC :: Message -> Block +-> \{v:CState \| \(\(\(countC v\) == 1\)\)\} @-\}/);
    expect(haskell).toMatch(/\{-@ f :: .* -> \{v:CState \| \(\(\(countC v\) == x\)\)\} @-\}/);
    // An assert that reads a local can't be a postcondition (but is still checked).
    expect(haskell).toMatch(/\{-@ g :: .* -> \{v:CState \| True\} @-\}/);
    expect(haskell).toMatch(/if \(before >= 0\) then st\d else revert "assert"/);
  });

  test('in a view function, an ending assert on the returned local is a postcondition on v', () => {
    const haskell = solidityToHaskell(`
            contract C {
                function f() public pure returns (bool) {
                    bool result = true;
                    assert(result == true);
                    return result;
                }
            }`);
    expect(haskell).toContain('-> {v:Bool | ((v == True))} @-}');
  });

  test('a constructor assert that does not end it is reported as skipped', () => {
    const haskell = solidityToHaskell(`
            contract C {
                uint count;
                constructor() { count = 1; assert(count == 1); count = 2; }
            }`);
    expect(haskell).toContain('-- skipped assert statement (not at the end of the constructor)');
  });

  test('assert in a view function guards its result', () => {
    const haskell = solidityToHaskell(`
            contract C {
                function f() public pure returns (bool) {
                    bool result = true;
                    assert(result == true);
                    return result;
                }
            }`);
    expect(haskell).toContain('let result = True in\n  if (result == True)\nthen result\nelse revert "assert"');
  });

  test('the amount is the `value` option, not the first one', () => {
    const haskell = solidityToHaskell(`
            contract C {
                function f(uint w) public { msg.sender.call{gas: 5000, value: w}(""); }
            }`);
    expect(haskell).toMatch(/st1 = callC st \(\(sender \(msgC st\)\)\) \(w\)/);
  });
});
