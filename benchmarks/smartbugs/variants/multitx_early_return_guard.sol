// Variant of SmartBugs arithmetic/integer_overflow_multitx_multifunc_feasible.sol:
// the early return guards the subtraction (tests that `return` ends the control flow).
// Expected with --overflow: SAFE
// Expected: SAFE
pragma solidity ^0.4.23;

contract IntegerOverflowMultiTxMultiFuncFeasible {
    uint256 private initialized = 0;
    uint256 public count = 1;

    function init() public {
        initialized = 1;
    }

    function run(uint256 input) {
        if (input > count) {
            return;
        }
        count -= input;
    }
}
