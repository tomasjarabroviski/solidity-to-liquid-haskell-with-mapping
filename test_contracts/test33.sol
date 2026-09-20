pragma solidity >=0.4.25 <0.6.0;


contract Bazaar
{
    enum StateType { PartyProvisioned, ItemListed, CurrentSaleFinalized}

    StateType public State;

    address public InstancePartyA;
    int public PartyABalance;

    address public InstancePartyB;
    int public PartyBBalance;

    address public InstanceBazaarMaintainer;
    address public CurrentSeller;

    string public ItemName;
    int public ItemPrice;


    constructor(address partyA, int balanceA, address partyB, int balanceB) public {
        InstanceBazaarMaintainer = msg.sender;

        // ensure the two parties are different
        require(partyB != partyA);

        InstancePartyA = partyA;
        PartyABalance = balanceA;

        InstancePartyB = partyB;
        PartyBBalance = balanceB;

        State = StateType.PartyProvisioned;
    }

    function HasBalance(address buyer, int itemPrice) public view returns (bool) {
        if (buyer == InstancePartyA) {
            return (PartyABalance >= itemPrice);
        }

        if (buyer == InstancePartyB) {
            return (PartyBBalance >= itemPrice);
        }

        return false;
    }

    function UpdateBalance(address sellerParty, address buyerParty, int itemPrice) public {
        ChangeBalance(sellerParty, itemPrice);
        ChangeBalance(buyerParty, -itemPrice);

        State = StateType.CurrentSaleFinalized;
    }

    function ChangeBalance(address party, int balance) public {
        if (party == InstancePartyA) {
            PartyABalance += balance;
        }

        if (party == InstancePartyB) {
            PartyBBalance += balance;
        }
    }


}
