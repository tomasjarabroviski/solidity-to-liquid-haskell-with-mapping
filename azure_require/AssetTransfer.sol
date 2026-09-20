pragma solidity >=0.4.25 <0.6.0;

contract AssetTransfer {
    enum StateType { Active, OfferPlaced, PendingInspection, Inspected, Appraised, NotionalAcceptance, BuyerAccepted, SellerAccepted, Accepted, Terminated }
    address public InstanceOwner;
    string public Description;
    uint public AskingPrice;
    StateType public State;

    address public InstanceBuyer;
    uint public OfferPrice;
    address public InstanceInspector;
    address public InstanceAppraiser;

    constructor(string memory description, uint256 price) public {
        InstanceOwner = msg.sender;
        AskingPrice = price;
        Description = description;
        State = StateType.Active;
    }

    function Terminate() public {
        require(InstanceOwner == msg.sender);
        State = StateType.Terminated;
    }

    function Modify(string memory description, uint256 price) public {
        require(State == StateType.Active);
        require(InstanceOwner == msg.sender);
        
        Description = description;
        AskingPrice = price;
    }

    function MakeOffer(address inspector, address appraiser, uint256 offerPrice) public {
        require(inspector != 0x0000000000000000000000000000000000000000);
        require(appraiser != 0x0000000000000000000000000000000000000000);
        require(offerPrice > 0);
        require(State == StateType.Active);
        require(InstanceOwner != msg.sender);
        
        InstanceBuyer = msg.sender;
        InstanceInspector = inspector;
        InstanceAppraiser = appraiser;
        OfferPrice = offerPrice;
        State = StateType.OfferPlaced;
    }

    function AcceptOffer() public {
        require(State == StateType.OfferPlaced);
        require(InstanceOwner == msg.sender);
        
        State = StateType.PendingInspection;
    }

    function Reject() public {
        require(
            State == StateType.OfferPlaced || State == StateType.PendingInspection ||
            State == StateType.Inspected || State == StateType.Appraised ||
            State == StateType.NotionalAcceptance || State == StateType.BuyerAccepted
        );
        require(InstanceOwner == msg.sender);
        
        InstanceBuyer = 0x0000000000000000000000000000000000000000;
        State = StateType.Active;
    }

    function Accept() public {
        require(msg.sender == InstanceBuyer || msg.sender == InstanceOwner);
        
        if (msg.sender == InstanceOwner) {
            require(State == StateType.NotionalAcceptance || State == StateType.BuyerAccepted);
        } else {
            require(State == StateType.NotionalAcceptance || State == StateType.SellerAccepted);
        }
        
        if (msg.sender == InstanceBuyer) {
            State = (State == StateType.NotionalAcceptance) ? StateType.BuyerAccepted : StateType.Accepted;
        } else {
            State = (State == StateType.NotionalAcceptance) ? StateType.SellerAccepted : StateType.Accepted;
        }
    }

    function ModifyOffer(uint256 offerPrice) public {
        require(State == StateType.OfferPlaced);
        require(InstanceBuyer == msg.sender);
        require(offerPrice > 0);
        
        OfferPrice = offerPrice;
    }

    function RescindOffer() public {
        require(
            State == StateType.OfferPlaced || State == StateType.PendingInspection ||
            State == StateType.Inspected || State == StateType.Appraised ||
            State == StateType.NotionalAcceptance || State == StateType.SellerAccepted
        );
        require(InstanceBuyer == msg.sender);
        
        InstanceBuyer = 0x0000000000000000000000000000000000000000;
        OfferPrice = 0;
        State = StateType.Active;
    }

    function MarkAppraised() public {
        require(InstanceAppraiser == msg.sender);
        
        if (State == StateType.PendingInspection) {
            State = StateType.Appraised;
        } else if (State == StateType.Inspected) {
            State = StateType.NotionalAcceptance;
        } else {
            revert();
        }
    }

    function MarkInspected() public {
        require(InstanceInspector == msg.sender);
        
        if (State == StateType.PendingInspection) {
            State = StateType.Inspected;
        } else if (State == StateType.Appraised) {
            State = StateType.NotionalAcceptance;
        } else {
            revert();
        }
    }
}
