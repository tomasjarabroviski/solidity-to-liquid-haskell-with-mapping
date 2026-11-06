// Taken from SunWeb3Sec/DeFiVulnLabs (commit f61f6ee), src/test/self-transfer.sol, contract SimpleBank, unmodified (only the Foundry test was removed).
// Documented bug: transferring to oneself creates funds. Also, inside unchecked the subtraction does not check the balance (underflow), which is what the tool detects.
// Expected: UNSAFE
// Expected with --overflow: UNSAFE
pragma solidity ^0.8.18;

contract SimpleBank {
    mapping(address => uint256) private _balances;

    function balanceOf(address _account) public view virtual returns (uint256) {
        return _balances[_account];
    }

    function transfer(address _from, address _to, uint256 _amount) public {
        // not check self-transfer
        uint256 _fromBalance = _balances[_from];
        uint256 _toBalance = _balances[_to];

        unchecked {
            _balances[_from] = _fromBalance - _amount;
            _balances[_to] = _toBalance + _amount;
        }
    }
}
