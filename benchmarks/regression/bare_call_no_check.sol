// Regression: ether sent with a bare `call{value:}` (result ignored) must be
// modeled. Anyone can withdraw any amount, so the contract can be drained.
// Expected: UNSAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.8.0;

contract BareCall {
    mapping(address => uint) balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint amount) public {
        payable(msg.sender).call{value: amount}("");
    }
}
