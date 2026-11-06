// Variant of SmartBugs arithmetic/integer_overflow_minimal.sol with the check added.
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity ^0.4.19;

contract IntegerOverflowMinimal {
    uint public count = 1;

    function run(uint256 input) public {
        require(input <= count);
        count -= input;
    }
}
