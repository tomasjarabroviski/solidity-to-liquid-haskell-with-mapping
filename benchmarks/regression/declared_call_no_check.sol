// Regression: same contract as bare_call_no_check.sol, with the call's
// result stored in a variable. Both forms must give the same answer.
// Expected: UNSAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.8.0;

contract DeclCall {
    mapping(address => uint) balances;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw(uint amount) public {
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
    }
}
