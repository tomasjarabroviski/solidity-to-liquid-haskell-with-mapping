// Variante de Ethernaut nivel 31 "Stake" (Solidity 0.8). Se quitaron WETH (llamadas de bajo nivel con bytes/abi), el mapping Stakers (bool) y totalStaked, que no estan soportados o no intervienen en el bug.
// Roto: Unstake paga sin descontar el stake (se puede retirar varias veces).
// Esperado: UNSAFE
// Esperado con --overflow: UNSAFE
pragma solidity ^0.8.0;

contract Stake {
    mapping(address => uint256) public UserStake;

    constructor() payable {
    }

    function StakeETH() public payable {
        require(msg.value > 0.001 ether, "Don't be cheap");
        UserStake[msg.sender] += msg.value;
    }

    function Unstake(uint256 amount) public returns (bool) {
        require(UserStake[msg.sender] >= amount, "Don't be greedy");
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        return success;
    }
}
