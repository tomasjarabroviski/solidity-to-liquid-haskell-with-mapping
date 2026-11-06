// Regression: an assert is checked where it is written, not on the final
// state. Here it holds at its line even though `count` changes afterwards.
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity ^0.8.0;

contract AssertMiddle {
    uint count;

    function f() public {
        count = 1;
        assert(count == 1);
        count = 2;
    }
}
