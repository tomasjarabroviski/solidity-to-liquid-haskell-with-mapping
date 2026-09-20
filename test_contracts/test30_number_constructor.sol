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

}
