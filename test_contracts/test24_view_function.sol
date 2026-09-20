
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

}
