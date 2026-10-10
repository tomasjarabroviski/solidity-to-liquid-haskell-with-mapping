// Variante de SmartBugs arithmetic/integer_overflow_add.sol con la guarda de overflow.
// Esperado: SAFE
// Esperado con --overflow: SAFE
pragma solidity ^0.4.19;

contract IntegerOverflowAdd {
    uint public count = 1;

    function run(uint256 input) public {
        require(count + input >= count);
        count += input;
    }
}
