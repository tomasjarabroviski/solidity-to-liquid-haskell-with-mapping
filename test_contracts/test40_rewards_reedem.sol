contract Rewards {
    mapping(address => uint) public points;

    function addPoints(uint amount) public {
        require(amount <= 100, "Too many points at once");
        points[msg.sender] += amount;
    }

    function redeem(uint amount) public {
        require(points[msg.sender] >= amount, "Not enough points");
        points[msg.sender] -= amount;
    }
}