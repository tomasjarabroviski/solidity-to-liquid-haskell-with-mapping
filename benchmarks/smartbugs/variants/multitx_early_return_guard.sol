// Variante de SmartBugs arithmetic/integer_overflow_multitx_multifunc_feasible.sol:
// el early return protege la resta (prueba que el `return` corta el flujo).
// Esperado con --overflow: SAFE
// Esperado: SAFE
pragma solidity ^0.4.23;

contract IntegerOverflowMultiTxMultiFuncFeasible {
    uint256 private initialized = 0;
    uint256 public count = 1;

    function init() public {
        initialized = 1;
    }

    function run(uint256 input) {
        if (input > count) {
            return;
        }
        count -= input;
    }
}
