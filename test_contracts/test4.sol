contract Counter {
    enum StateType { Request, Respond}

    StateType public State;

    uint256 public count;
    function increment() public { count++; }
}