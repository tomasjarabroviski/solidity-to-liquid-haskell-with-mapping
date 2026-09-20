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
        ResponseMessage = "";
    }

    // call this function to send a request


    // call this function to send a response
    function sendResponse(string memory xxx) public
    {
        Responder = msg.sender;

        ResponseMessage = xxx;
        State = StateType.Respond;
    }
}