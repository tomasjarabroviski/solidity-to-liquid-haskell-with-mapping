// Ethernaut level 5 "Token" (OpenZeppelin/ethernaut, contracts/src/levels/Token.sol, commit d05643a), unmodified except for this header.
// Bug: require(balances[msg.sender] - _value >= 0) is always true in Solidity < 0.8 (the subtraction wraps around), so anyone can transfer more than they have.
// Expected: SAFE (without --overflow the subtraction is mathematical and the guard does protect)
// Expected with --overflow: UNSAFE
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
