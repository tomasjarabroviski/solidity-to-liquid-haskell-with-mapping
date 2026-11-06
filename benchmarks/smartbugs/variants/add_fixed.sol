// Variant of SmartBugs arithmetic/integer_overflow_add.sol with the overflow guard.
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity ^0.4.19;

contract IntegerOverflowAdd {
    uint public count = 1;

    function run(uint256 input) public {
        require(count + input >= count);
        count += input;
    }
}
