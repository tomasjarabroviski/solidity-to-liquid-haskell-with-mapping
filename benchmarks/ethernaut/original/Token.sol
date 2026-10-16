// Ethernaut nivel 5 "Token" (OpenZeppelin/ethernaut, contracts/src/levels/Token.sol, commit d05643a), sin modificar salvo esta cabecera.
// Bug: require(balances[msg.sender] - _value >= 0) siempre es verdadero en Solidity < 0.8 (la resta da la vuelta), asi que cualquiera transfiere mas de lo que tiene.
// Esperado: SAFE (sin --overflow la resta es matematica y la guarda si protege)
// Esperado con --overflow: UNSAFE
// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

contract Token {
    mapping(address => uint256) balances;
    uint256 public totalSupply;

    constructor(uint256 _initialSupply) public {
        balances[msg.sender] = totalSupply = _initialSupply;
    }

    function transfer(address _to, uint256 _value) public returns (bool) {
        require(balances[msg.sender] - _value >= 0);
        balances[msg.sender] -= _value;
        balances[_to] += _value;
        return true;
    }

    function balanceOf(address _owner) public view returns (uint256 balance) {
        return balances[_owner];
    }
}
