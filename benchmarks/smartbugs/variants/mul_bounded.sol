// Variant of SmartBugs arithmetic/integer_overflow_mul.sol bounding the factors.
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity ^0.4.19;

contract IntegerOverflowMul {
    uint public count = 2;

    function run(uint256 input) public {
        require(count <= 1000000 && input <= 1000000);
        count *= input;
    }
}
