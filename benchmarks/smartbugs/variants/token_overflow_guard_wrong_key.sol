// Variante de SmartBugs arithmetic/token.sol. Roto: la guarda de overflow mira a msg.sender en vez de _to.
// Esperado: SAFE
// Esperado con --overflow: UNSAFE
pragma solidity ^0.4.18;

contract Token {

  mapping(address => uint) balances;
  uint public totalSupply;

  function Token(uint _initialSupply) {
    balances[msg.sender] = totalSupply = _initialSupply;
  }

  function transfer(address _to, uint _value) public returns (bool) {
    require(balances[msg.sender] >= _value);
    require(balances[msg.sender] + _value >= balances[msg.sender]);
    balances[msg.sender] -= _value;
    balances[_to] += _value;
    return true;
  }

  function balanceOf(address _owner) public constant returns (uint balance) {
    return balances[_owner];
  }
}
