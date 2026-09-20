pragma solidity >=0.4.25 <0.6.0;

contract SimpleMarketplace
{
    enum StateType { 
      ItemAvailable,
      OfferPlaced,
      Accepted
    }

    address public InstanceOwner;
    string public Description;
    int public AskingPrice;
    StateType public State;

    address public InstanceBuyer;
    int public OfferPrice;

    constructor(string memory description, int price) public {
        InstanceOwner = msg.sender;
        AskingPrice = price;
        Description = description;
        State = StateType.ItemAvailable;
    }

    function MakeOffer(int offerPrice) public {
        require(offerPrice > 0);
        require(State == StateType.ItemAvailable);
        require(InstanceOwner != msg.sender);

        InstanceBuyer = msg.sender;
        OfferPrice = offerPrice;
        State = StateType.OfferPlaced;
    }

    function Reject() public {
        require(State == StateType.OfferPlaced);
        require(InstanceOwner == msg.sender);

        InstanceBuyer = 0x0000000000000000000000000000000000000000;
        State = StateType.ItemAvailable;
    }

    function AcceptOffer() public {
        require(msg.sender == InstanceOwner);

        State = StateType.Accepted;
    }
}
