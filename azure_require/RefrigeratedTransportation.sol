pragma solidity >=0.4.25 <0.6.0;

contract RefrigeratedTransportation
{
    //Set of States
    enum StateType { Created, InTransit, Completed, OutOfCompliance }
    enum SensorType { None, Humidity, Temperature }

    //List of properties
    StateType public State;
    address public Owner;
    address public InitiatingCounterparty;
    address public Counterparty;
    address public PreviousCounterparty;
    address public Device;
    address public SupplyChainOwner;
    address public SupplyChainObserver;
    int public MinHumidity;
    int public MaxHumidity;
    int public MinTemperature;
    int public MaxTemperature;
    SensorType public ComplianceSensorType;
    int public ComplianceSensorReading;
    bool public ComplianceStatus;
    string public ComplianceDetail;
    int public LastSensorUpdateTimestamp;

    constructor(address device, address supplyChainOwner, address supplyChainObserver, int minHumidity, int maxHumidity, int minTemperature, int maxTemperature) public {
        ComplianceStatus = true;
        ComplianceSensorReading = -1;
        InitiatingCounterparty = msg.sender;
        Owner = msg.sender;
        Counterparty = msg.sender;
        Device = device;
        SupplyChainOwner = supplyChainOwner;
        SupplyChainObserver = supplyChainObserver;
        MinHumidity = minHumidity;
        MaxHumidity = maxHumidity;
        MinTemperature = minTemperature;
        MaxTemperature = maxTemperature;
        State = StateType.Created;
        ComplianceDetail = "N/A";
    }

    function IngestTelemetry(int humidity, int temperature, int timestamp) public {
        require(State != StateType.Completed);
        require(State != StateType.OutOfCompliance);
        require(Device == msg.sender);
        
        LastSensorUpdateTimestamp = timestamp;

        if (humidity > MaxHumidity || humidity < MinHumidity) {
            ComplianceSensorType = SensorType.Humidity;
            ComplianceSensorReading = humidity;
            ComplianceDetail = "Humidity value out of range.";
            ComplianceStatus = false;
        } else if (temperature > MaxTemperature || temperature < MinTemperature) {
            ComplianceSensorType = SensorType.Temperature;
            ComplianceSensorReading = temperature;
            ComplianceDetail = "Temperature value out of range.";
            ComplianceStatus = false;
        }

        if (!ComplianceStatus) {
            State = StateType.OutOfCompliance;
        }
    }

    function TransferResponsibility(address newCounterparty) public {
        require(State != StateType.Completed);
        require(State != StateType.OutOfCompliance);
        require(InitiatingCounterparty == msg.sender || Counterparty == msg.sender);
        require(newCounterparty != Device);
        
        if (State == StateType.Created) {
            State = StateType.InTransit;
        }
        
        PreviousCounterparty = Counterparty;
        Counterparty = newCounterparty;
    }

    function Complete() public {
        require(State != StateType.Completed);
        require(State != StateType.OutOfCompliance);
        require(Owner == msg.sender || SupplyChainOwner == msg.sender);
        
        State = StateType.Completed;
        PreviousCounterparty = Counterparty;
        Counterparty = 0x0000000000000000000000000000000000000000;
    }
}
