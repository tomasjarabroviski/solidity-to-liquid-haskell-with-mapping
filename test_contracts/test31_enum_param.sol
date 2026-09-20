pragma solidity >=0.4.25 <0.6.0;

contract RoomThermostat
{
    //Set of States
    enum StateType { Created, InUse }
    
    //List of properties
    StateType public State;
    address public Installer;
    address public User;
    int public TargetTemperature;
    enum ModeEnum { Off, Cool, Heat, Auto }
    ModeEnum public Mode;
    
    constructor(address thermostatInstaller, address thermostatUser) public {
        Installer = thermostatInstaller;
        User = thermostatUser;
        TargetTemperature = 70;
    }

    function StartThermostat() public {
        require(Installer == msg.sender);
        require(State == StateType.Created);
        
        State = StateType.InUse;
    }

    function SetTargetTemperature(int targetTemperature) public {
        require(User == msg.sender);
        require(State == StateType.InUse);
        
        TargetTemperature = targetTemperature;
    }

    function SetMode(ModeEnum mode) public {
        require(User == msg.sender);
        require(State == StateType.InUse);
        
        Mode = mode;
    }
}
