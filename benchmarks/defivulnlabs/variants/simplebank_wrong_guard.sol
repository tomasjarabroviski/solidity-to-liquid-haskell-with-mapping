// Variante de DeFiVulnLabs FixedSimpleBank: chequea el saldo de la cuenta equivocada (_to en vez de _from).
// Esperado: UNSAFE
// Esperado con --overflow: UNSAFE
pragma solidity ^0.8.18;

contract SimpleBank {
    mapping(address => uint256) private _balances;

    function balanceOf(address _account) public view virtual returns (uint256) {
        return _balances[_account];
    }

    function transfer(address _from, address _to, uint256 _amount) public {
        //Mitigation
        require(_from != _to, "Cannot transfer funds to the same address.");
        require(_balances[_to] >= _amount, "Insufficient balance");

        uint256 _fromBalance = _balances[_from];
        uint256 _toBalance = _balances[_to];

        unchecked {
            _balances[_from] = _fromBalance - _amount;
            _balances[_to] = _toBalance + _amount;
        }
    }
}
