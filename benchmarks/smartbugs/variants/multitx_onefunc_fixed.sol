// Variant of SmartBugs arithmetic/integer_overflow_multitx_onefunc_feasible.sol with the check added.
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity ^0.4.23;

contract IntegerOverflowMultiTxOneFuncFeasible {
    uint256 private initialized = 0;
    uint256 public count = 1;

    function run(uint256 input) public {
        if (initialized == 0) {
            initialized = 1;
            return;
        }
        require(input <= count);
        count -= input;
    }
}
