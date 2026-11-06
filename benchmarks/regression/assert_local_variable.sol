// Regression: an assert may read local variables.
// Without --overflow arithmetic is unbounded, so the check always holds; with
// --overflow, `count + x` has no guard and can overflow.
// Expected: SAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.8.0;

contract AssertLocal {
    uint count;

    function inc(uint x) public {
        uint before = count;
        count = count + x;
        assert(before <= count);
    }
}
