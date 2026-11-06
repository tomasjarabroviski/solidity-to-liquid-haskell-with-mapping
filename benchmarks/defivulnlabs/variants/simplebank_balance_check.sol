// Variant of DeFiVulnLabs FixedSimpleBank: also checks that the balance is enough before subtracting.
// Expected: SAFE
// Expected with --overflow: UNSAFE (_toBalance + _amount can wrap around inside unchecked)
pragma solidity ^0.8.18;

contract SimpleBank {
    mapping(address => uint256) private _balances;

    function balanceOf(address _account) public view virtual returns (uint256) {
        return _balances[_account];
    }

    function transfer(address _from, address _to, uint256 _amount) public {
        //Mitigation
        require(_from != _to, "Cannot transfer funds to the same address.");
        require(_balances[_from] >= _amount, "Insufficient balance");

        uint256 _fromBalance = _balances[_from];
        uint256 _toBalance = _balances[_to];

        unchecked {
            _balances[_from] = _fromBalance - _amount;
            _balances[_to] = _toBalance + _amount;
        }
    }
}
