contract HelloBlockchain
{
     //Set of States
    enum StateType { Request, Respond}

    //List of properties
    StateType public  State;
    address public  Requestor;

    string public RequestMessage;

    // constructor function
    constructor(string memory message) public
    {
        Requestor = msg.sender;
        RequestMessage = message;
        State = StateType.Request;
    }

    // call this function to send a request
    function sendRequest(string memory xxx) public
    {
        if (false)
        {
            RequestMessage = xxx;
        }
        
        State = StateType.Request;
    }
}