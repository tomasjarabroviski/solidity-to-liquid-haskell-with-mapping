pragma solidity >=0.4.25 <0.6.0;

contract RefrigeratedTransportation
{
    //Set of States
    enum StateType { Created, InTransit, Completed, OutOfCompliance }
    enum SensorType { None, Humidity, Temperature }

    //List of properties
    StateType public  State;
    address public  Owner;
    address public  InitiatingCounterparty;
    address public  Counterparty;
    address public  PreviousCounterparty;
    address public  Device;
    address public  SupplyChainOwner;
    address public  SupplyChainObserver;
    int public  MinHumidity;
    int public  MaxHumidity;
    int public  MinTemperature;
    int public  MaxTemperature;
    SensorType public  ComplianceSensorType;
    int public  ComplianceSensorReading;
    bool public  ComplianceStatus;
    string public  ComplianceDetail;
    int public  LastSensorUpdateTimestamp;

    constructor(address device, address supplyChainOwner, address supplyChainObserver, int minHumidity, int maxHumidity, int minTemperature, int maxTemperature) public
    {
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

        // Assert invariants
        assert(State == StateType.Created);
        assert(ComplianceStatus == true);
    }

    function IngestTelemetry(int humidity, int temperature, int timestamp) public
    {
        require(State != StateType.Completed, "Cannot ingest telemetry, state is Completed.");
        require(State != StateType.OutOfCompliance, "Cannot ingest telemetry, state is OutOfCompliance.");
        require(Device == msg.sender, "Only the device can send telemetry.");

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

        if (ComplianceStatus == false) {
            State = StateType.OutOfCompliance;
        }

        // Assert invariant: Timestamp must be updated
        assert(LastSensorUpdateTimestamp == timestamp);
    }

    function TransferResponsibility(address newCounterparty) public
    {
        require(State != StateType.Completed, "Cannot transfer responsibility, state is Completed.");
        require(State != StateType.OutOfCompliance, "Cannot transfer responsibility, state is OutOfCompliance.");
        require(InitiatingCounterparty == msg.sender || Counterparty == msg.sender, "Only current parties can transfer responsibility.");
        require(newCounterparty != Device, "New counterparty cannot be the device.");

        if (State == StateType.Created) {
            State = StateType.InTransit;
        }

        PreviousCounterparty = Counterparty;
        Counterparty = newCounterparty;

        // Assert invariant: Counterparty must be updated
        assert(Counterparty == newCounterparty);
    }

    function Complete() public
    {
        require(State != StateType.Completed, "Cannot complete, state is already Completed.");
        require(State != StateType.OutOfCompliance, "Cannot complete, state is OutOfCompliance.");
        require(Owner == msg.sender || SupplyChainOwner == msg.sender, "Only the owner or supply chain owner can complete.");

        State = StateType.Completed;
        PreviousCounterparty = Counterparty;
        Counterparty = 0x0000000000000000000000000000000000000000;

        // Assert invariants: State must be completed, Counterparty reset
        assert(State == StateType.Completed);
        assert(Counterparty == 0x0000000000000000000000000000000000000000);
    }
}
