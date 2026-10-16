// Extraido de SunWeb3Sec/DeFiVulnLabs (commit f61f6ee), src/test/self-transfer.sol, contrato FixedSimpleBank (la version "arreglada" del repo), sin modificar.
// Arregla la auto-transferencia, pero sigue restando sin chequear el saldo dentro de unchecked: cualquiera puede dejar un saldo en 2^256 - x.
// Esperado: UNSAFE
// Esperado con --overflow: UNSAFE
pragma solidity ^0.8.18;

contract FixedSimpleBank {
    mapping(address => uint256) private _balances;

    function balanceOf(address _account) public view virtual returns (uint256) {
        return _balances[_account];
    }

    function transfer(address _from, address _to, uint256 _amount) public {
        //Mitigation
        require(_from != _to, "Cannot transfer funds to the same address.");

        uint256 _fromBalance = _balances[_from];
        uint256 _toBalance = _balances[_to];

        unchecked {
            _balances[_from] = _fromBalance - _amount;
            _balances[_to] = _toBalance + _amount;
            /*
            Another mitigation
            _balances[_id][_from] -= _amount;
            _balances[_id][_to] += _amount;
            */
        }
    }
}
