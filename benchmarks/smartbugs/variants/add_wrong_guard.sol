// Variante de SmartBugs arithmetic/integer_overflow_add.sol con una guarda que no sirve.
// Esperado: SAFE
// Esperado con --overflow: UNSAFE
pragma solidity ^0.4.19;

contract IntegerOverflowAdd {
    uint public count = 1;

    function run(uint256 input) public {
        require(input > 0);
        count += input;
    }
}
