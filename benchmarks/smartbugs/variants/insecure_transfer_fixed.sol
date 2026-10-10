// Variante de SmartBugs arithmetic/insecure_transfer.sol con la guarda de overflow.
// Esperado: SAFE
// Esperado con --overflow: SAFE
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
