// Variante de SmartBugs arithmetic/integer_overflow_minimal.sol con un chequeo equivocado.
// Esperado: UNSAFE
// Esperado con --overflow: UNSAFE
pragma solidity ^0.4.19;

contract IntegerOverflowMinimal {
    uint public count = 1;

    function run(uint256 input) public {
        require(input < count + 1000);
        count -= input;
    }
}
