contract HelloBlockchain
{
     //Set of States
    enum StateType { Request, Respond}

    //List of properties
    StateType public  State;
    address public  Requestor;
    address public  Responder;

    string public RequestMessage;
    string public ResponseMessage;

    // constructor function
    constructor(string memory message) public
    {
        Requestor = msg.sender;
        RequestMessage = message;
        State = StateType.Request;
    }

    // call this function to send a response
    function SendResponse(string memory xx) public
    {
        Responder = msg.sender;

        // call ContractUpdated() to record this action
        ResponseMessage = xx;
        State = StateType.Respond;
    }
}