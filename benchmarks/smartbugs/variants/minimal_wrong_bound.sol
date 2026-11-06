// Variant of SmartBugs arithmetic/integer_overflow_minimal.sol with a wrong check.
// Expected: UNSAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.4.19;

contract IntegerOverflowMinimal {
    uint public count = 1;

    function run(uint256 input) public {
        require(input < count + 1000);
        count -= input;
    }
}
