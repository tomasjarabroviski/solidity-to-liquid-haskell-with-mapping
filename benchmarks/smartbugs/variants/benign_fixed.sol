// Variante de SmartBugs arithmetic/integer_overflow_benign_1.sol con el chequeo agregado.
// Esperado: SAFE
// Esperado con --overflow: SAFE
pragma solidity ^0.4.19;

contract IntegerOverflowBenign1 {
    uint public count = 1;

    function run(uint256 input) public {
        require(input <= count);
        uint res = count - input;
    }
}
