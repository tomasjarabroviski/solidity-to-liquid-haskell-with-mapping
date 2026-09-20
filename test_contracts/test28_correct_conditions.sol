// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Bazaar {
    address public InstanceBazaarMaintainer;

    constructor() {
        InstanceBazaarMaintainer = msg.sender;
    }

    function ValidPrice(int itemPrice) public pure returns (bool) {
        require(itemPrice > 0, "The price must be greater than 0");
        bool result = true;
        assert(result==true);
        return result;
    }
}

contract ItemListing {
    bool flag = true;

    // This function is not valid because it breaks the precondition
    function BuyItemRevert_WrongCall() public {
        Bazaar bazaar = new Bazaar();
        flag = bazaar.ValidPrice(-5);
    }

    // This functions is valid
    function BuyItemNoRevert() public {
        Bazaar bazaar = new Bazaar();
        if (!bazaar.ValidPrice(50)) {
            revert("It is not a valid price");
        }
        flag = true;
        assert(flag==true);
    }

    // This functions is not valid because it's always going to revert
    function BuyItemRevert_ReturnsTrue() public {
        Bazaar bazaar = new Bazaar();
        if (bazaar.ValidPrice(50)) {
            revert("It is not a valid price");
        }
        flag = true;
        assert(flag==true);
    }
}
