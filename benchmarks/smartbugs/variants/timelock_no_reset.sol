// Variant of SmartBugs arithmetic/timelock.sol. Broken: does not reset the balance to 0 before transferring (it can be withdrawn twice).
// Expected: UNSAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.4.10;

contract TimeLock {

    mapping(address => uint) public balances;
    mapping(address => uint) public lockTime;

    function deposit() public payable {
        balances[msg.sender] += msg.value;
        lockTime[msg.sender] = now + 1 weeks;
    }

    function increaseLockTime(uint _secondsToIncrease) public {
        require(lockTime[msg.sender] + _secondsToIncrease >= lockTime[msg.sender]);
        lockTime[msg.sender] += _secondsToIncrease;
    }

    function withdraw() public {
        require(balances[msg.sender] > 0);
        require(now > lockTime[msg.sender]);
        uint transferValue = balances[msg.sender];

        msg.sender.transfer(transferValue);
    }
}
