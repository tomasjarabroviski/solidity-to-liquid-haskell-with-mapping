// Variante de SmartBugs arithmetic/integer_overflow_mapping_sym_1.sol chequeando la clave equivocada.
// Esperado: UNSAFE
// Esperado con --overflow: UNSAFE
pragma solidity ^0.4.11;

contract IntegerOverflowMappingSym1 {
    mapping(uint256 => uint256) map;

    function init(uint256 k, uint256 v) public {
        require(map[0] >= v);
        map[k] -= v;
    }
}
