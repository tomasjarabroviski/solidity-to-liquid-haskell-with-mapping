// Variant of SmartBugs arithmetic/overflow_simple_add.sol with the overflow guard
// (also tests a user state variable named `balance`).
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity 0.4.25;

contract Overflow_Add {
    uint public balance = 1;

    function add(uint256 deposit) public {
        require(balance + deposit >= balance);
        balance += deposit;
    }
}
