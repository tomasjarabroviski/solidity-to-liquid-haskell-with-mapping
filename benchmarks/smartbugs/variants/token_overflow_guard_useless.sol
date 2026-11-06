// Variant of SmartBugs arithmetic/token.sol. Broken: the 'guard' only requires the sum to be positive, it does not detect the overflow.
// Expected: SAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.4.18;

contract Token {

  mapping(address => uint) balances;
  uint public totalSupply;

  function Token(uint _initialSupply) {
    balances[msg.sender] = totalSupply = _initialSupply;
  }

  function transfer(address _to, uint _value) public returns (bool) {
    require(balances[msg.sender] >= _value);
    require(balances[_to] + _value > 0);
    balances[msg.sender] -= _value;
    balances[_to] += _value;
    return true;
  }

  function balanceOf(address _owner) public constant returns (uint balance) {
    return balances[_owner];
  }
}
