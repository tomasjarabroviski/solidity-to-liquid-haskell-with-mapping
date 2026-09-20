contract Counter {
    uint256 public count;
    uint256 public Another_count;
    function increment2() public { count++; count++; }

    function increment_another() public { Another_count++; }
}