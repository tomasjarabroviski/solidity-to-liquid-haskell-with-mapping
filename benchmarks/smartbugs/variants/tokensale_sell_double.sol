// Variante de SmartBugs arithmetic/tokensalechallenge.sol. Roto: sell paga el doble de lo que se cobro en buy (el contrato queda insolvente).
// Esperado: UNSAFE
// Esperado con --overflow: UNSAFE
pragma solidity ^0.4.21;

contract TokenSaleChallenge {
    mapping(address => uint256) public balanceOf;
    uint256 constant PRICE_PER_TOKEN = 1 ether;

    function TokenSaleChallenge(address _player) public payable {
        require(msg.value == 1 ether);
    }

    function isComplete() public view returns (bool) {
        return address(this).balance < 1 ether;
    }

    function buy(uint256 numTokens) public payable {
        require(numTokens <= 1000000);
        require(msg.value == numTokens * PRICE_PER_TOKEN);
        require(balanceOf[msg.sender] + numTokens >= balanceOf[msg.sender]);
        balanceOf[msg.sender] += numTokens;
    }

    function sell(uint256 numTokens) public {
        require(balanceOf[msg.sender] >= numTokens);
        balanceOf[msg.sender] -= numTokens;
        msg.sender.transfer(numTokens * PRICE_PER_TOKEN * 2);
    }
}
