contract ItemListing
{
    enum StateTypeItem { ItemAvailable, ItemSold }

    StateTypeItem public State;

    address public Seller;
    address public InstanceBuyer;
    address public ParentContract;
    string public ItemName;
    int public ItemPrice;
    address public PartyA;
    address public PartyB;

    function BuyItem() public
    {
        InstanceBuyer = msg.sender;

        // ensure that the buyer is not the seller
        if (Seller == InstanceBuyer) {
            revert();
        }

        Bazaar bazaar = new Bazaar(PartyA, 100, PartyB, 100);

        // check Buyer's balance
        if (!bazaar.HasBalance(InstanceBuyer, ItemPrice)) {
            revert();
        }

        // indicate item bought by updating seller and buyer balances

        State = StateTypeItem.ItemSold;
    }
}


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
        if (partyA == partyB) {
            revert();
        }

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
