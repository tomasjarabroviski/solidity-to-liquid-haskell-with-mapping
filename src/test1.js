const parser = require('@solidity-parser/parser')

const input = `
pragma solidity >=0.4.25 <0.6.0;

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

    // call this function to send a request
    function SendRequest(string memory requestMessage) public
    {
        if (Requestor != msg.sender)
        {
            revert();
        }

        RequestMessage = requestMessage;
        State = StateType.Request;
    }

    // call this function to send a response
    function SendResponse(string memory responseMessage) public
    {
        Responder = msg.sender;

        // call ContractUpdated() to record this action
        ResponseMessage = responseMessage;
        State = StateType.Respond;
    }
}
`
try {
    var ast = parser.parse(input)

    // output the path of each import found
    parser.visit(ast, {
        FunctionDefinition: function (node) {
          // node.name puede ser null si es un constructor o función fallback/receive
          const functionName = node.name ? node.name : "(constructor/fallback/receive)";
          const visibility = node.visibility; // public, private, etc.
          
          console.log(`Función: ${functionName}, Visibilidad: ${visibility}`);
        },
      });
} catch (e) {
  if (e instanceof parser.ParserError) {
    console.error(e.errors)
  }
}
// var ast = parser.parse('contract test { uint a; }')

// // output the path of each import found
// parser.visit(ast, {
//   ImportDirective: function (node) {
//     console.log(node.path)
//   },
// })