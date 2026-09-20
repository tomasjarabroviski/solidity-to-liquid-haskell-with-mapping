pragma solidity >=0.4.25 <0.6.0;

contract Bazaar
{

    address public CurrentContractAddress;
    address public AddresZero;

    constructor() public {

        CurrentContractAddress = address(this);
        AddresZero = address(0);

    }

    function test(){
        CurrentContractAddress = address(this);
        AddresZero = address(0);
    }


}