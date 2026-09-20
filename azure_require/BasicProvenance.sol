pragma solidity >=0.4.25 <0.6.0;

contract BasicProvenance
{
    //Set of States
    enum StateType { Created, InTransit, Completed }
    
    //List of properties
    StateType public State;
    address public InitiatingCounterparty;
    address public Counterparty;
    address public PreviousCounterparty;
    address public SupplyChainOwner;
    address public SupplyChainObserver;
    
    constructor(address supplyChainOwner, address supplyChainObserver) public {
        InitiatingCounterparty = msg.sender;
        Counterparty = msg.sender;
        SupplyChainOwner = supplyChainOwner;
        SupplyChainObserver = supplyChainObserver;
        State = StateType.Created;
    }

    function TransferResponsibility(address newCounterparty) public {
        require(Counterparty == msg.sender);
        require(State != StateType.Completed);
        
        if (State == StateType.Created) {
            State = StateType.InTransit;
        }
        
        PreviousCounterparty = Counterparty;
        Counterparty = newCounterparty;
    }

    function Complete() public {
        require(SupplyChainOwner == msg.sender);
        require(State != StateType.Completed);
        
        State = StateType.Completed;
        PreviousCounterparty = Counterparty;
        Counterparty = 0x0000000000000000000000000000000000000000;
    }
}
