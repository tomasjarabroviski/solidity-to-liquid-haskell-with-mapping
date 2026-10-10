// Variante de SmartBugs arithmetic/integer_overflow_minimal.sol con el chequeo agregado.
// Esperado: SAFE
// Esperado con --overflow: SAFE
pragma solidity ^0.4.19;

contract IntegerOverflowMinimal {
    uint public count = 1;

    function run(uint256 input) public {
        require(input <= count);
        count -= input;
    }
}
