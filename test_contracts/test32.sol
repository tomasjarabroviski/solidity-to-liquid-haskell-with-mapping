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

    // address public CurrentContractAddress;

    constructor(address partyA, int balanceA, address partyB, int balanceB) public {
        InstanceBazaarMaintainer = msg.sender;

        require(partyB != partyA);

        InstancePartyA = partyA;
        PartyABalance = balanceA;

        InstancePartyB = partyB;
        PartyBBalance = balanceB;

        // CurrentContractAddress = address(this);

        State = StateType.PartyProvisioned;
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