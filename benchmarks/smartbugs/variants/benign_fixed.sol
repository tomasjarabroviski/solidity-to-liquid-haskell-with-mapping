// Variant of SmartBugs arithmetic/integer_overflow_benign_1.sol with the check added.
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity ^0.4.19;

contract IntegerOverflowBenign1 {
    uint public count = 1;

    function run(uint256 input) public {
        require(input <= count);
        uint res = count - input;
    }
}
