// Extraido de SunWeb3Sec/DeFiVulnLabs (commit f61f6ee), src/test/Overflow.sol, contrato TimeLock, sin modificar.
// Bug: lockTime[msg.sender] += _secondsToIncrease desborda (Solidity 0.7) y permite retirar antes de tiempo.
// Esperado: SAFE (sin --overflow no hay desborde posible)
// Esperado con --overflow: UNSAFE
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
