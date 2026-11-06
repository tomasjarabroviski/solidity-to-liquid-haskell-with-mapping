// Variant of SmartBugs arithmetic/token.sol. Full fix: checks for enough balance and that the recipient does not overflow (classic pre-SafeMath guard).
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity ^0.4.18;

contract Token {

  mapping(address => uint) balances;
  uint public totalSupply;

  function Token(uint _initialSupply) {
    balances[msg.sender] = totalSupply = _initialSupply;
  }

  function transfer(address _to, uint _value) public returns (bool) {
    require(balances[msg.sender] >= _value);
    require(balances[_to] + _value >= balances[_to]);
    balances[msg.sender] -= _value;
    balances[_to] += _value;
    return true;
  }

  function balanceOf(address _owner) public constant returns (uint balance) {
    return balances[_owner];
  }
}
