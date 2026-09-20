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

    constructor(string memory message) public
    {
        RequestMessage = message;
        State = StateType.Request;
    }
}