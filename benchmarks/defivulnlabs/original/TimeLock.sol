// Taken from SunWeb3Sec/DeFiVulnLabs (commit f61f6ee), src/test/Overflow.sol, contract TimeLock, unmodified.
// Bug: lockTime[msg.sender] += _secondsToIncrease overflows (Solidity 0.7) and allows withdrawing early.
// Expected: SAFE (without --overflow no overflow is possible)
// Expected with --overflow: UNSAFE
pragma solidity ^0.7.6;

contract TimeLock {
    mapping(address => uint) public balances;
    mapping(address => uint) public lockTime;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
        lockTime[msg.sender] = block.timestamp + 1 weeks;
    }

    function increaseLockTime(uint _secondsToIncrease) public {
        lockTime[msg.sender] += _secondsToIncrease; // vulnerable
    }

    function withdraw() public {
        require(balances[msg.sender] > 0, "Insufficient funds");
        require(
            block.timestamp > lockTime[msg.sender],
            "Lock time not expired"
        );

        uint amount = balances[msg.sender];
        balances[msg.sender] = 0;

        (bool sent, ) = msg.sender.call{value: amount}("");
        require(sent, "Failed to send Ether");
    }
}
