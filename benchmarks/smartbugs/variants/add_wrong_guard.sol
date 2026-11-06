// Variant of SmartBugs arithmetic/integer_overflow_add.sol with a guard that does not help.
// Expected: SAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.4.19;

contract IntegerOverflowAdd {
    uint public count = 1;

    function run(uint256 input) public {
        require(input > 0);
        count += input;
    }
}
