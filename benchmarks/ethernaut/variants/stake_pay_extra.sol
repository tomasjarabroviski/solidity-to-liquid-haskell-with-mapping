// Variant of Ethernaut level 31 "Stake" (Solidity 0.8). WETH (low-level calls with bytes/abi), the Stakers (bool) mapping and totalStaked were removed, since they are unsupported or play no part in the bug.
// Broken: Unstake pays amount + 1 extra wei.
// Expected: UNSAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.8.0;

contract Stake {
    mapping(address => uint256) public UserStake;

    constructor() payable {
    }

    function StakeETH() public payable {
        require(msg.value > 0.001 ether, "Don't be cheap");
        UserStake[msg.sender] += msg.value;
    }

    function Unstake(uint256 amount) public returns (bool) {
        require(UserStake[msg.sender] >= amount, "Don't be greedy");
        UserStake[msg.sender] -= amount;
        (bool success, ) = payable(msg.sender).call{value: amount + 1}("");
        return success;
    }
}
