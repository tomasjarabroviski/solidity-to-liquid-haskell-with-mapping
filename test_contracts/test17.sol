contract Counter {
    uint256 public count;
    uint256 public another_count;
    function increment() public { if (true!=true) {count++;} }
    function increment2() public { if (true==true) {count++;} else {another_count++;} }
}