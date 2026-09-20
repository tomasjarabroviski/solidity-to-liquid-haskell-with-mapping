contract Counter {
    enum StateType { Request, Respond}

    StateType public  state;

    uint256 public count;
    function increment() public { count = count + 4; }
}