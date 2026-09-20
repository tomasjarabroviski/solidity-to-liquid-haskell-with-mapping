contract Counter {
    uint256 public count;
    uint256 public another_count;
    function increment() public { count++; }
    function add(uint256 x) public { count = count + x; }
    function increment2() public { count++; count++; }

    function increment_another() public { another_count++; }
}