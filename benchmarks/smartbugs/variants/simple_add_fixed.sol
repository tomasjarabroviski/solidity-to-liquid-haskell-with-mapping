// Variante de SmartBugs arithmetic/overflow_simple_add.sol con la guarda de overflow
// (ademas prueba una variable de estado propia llamada `balance`).
// Esperado: SAFE
// Esperado con --overflow: SAFE
pragma solidity 0.4.25;

contract Overflow_Add {
    uint public balance = 1;

    function add(uint256 deposit) public {
        require(balance + deposit >= balance);
        balance += deposit;
    }
}
