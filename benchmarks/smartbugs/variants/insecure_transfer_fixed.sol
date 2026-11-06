// Variant of SmartBugs arithmetic/insecure_transfer.sol with the overflow guard.
// Expected: SAFE
// Expected with --overflow: SAFE
pragma solidity ^0.4.10;

contract IntegerOverflowAdd {
    mapping (address => uint256) public balanceOf;

    function transfer(address _to, uint256 _value) public{
        require(balanceOf[msg.sender] >= _value);
        require(balanceOf[_to] + _value >= balanceOf[_to]);
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
    }
}
