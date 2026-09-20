pragma solidity >=0.4.25 <0.6.0;

contract RefrigeratedTransportation
{
    enum SensorType { None, Humidity, Temperature }
    int public  MaxHumidity;
    SensorType public  ComplianceSensorType;
    bool public  ComplianceStatus;
    int public  LastSensorUpdateTimestamp;

    function IngestTelemetry(int humidity, int temperature, int timestamp) public
    {
        LastSensorUpdateTimestamp = timestamp;

        if (humidity > MaxHumidity )
        {
            ComplianceSensorType = SensorType.Humidity;
            ComplianceStatus = false;
        }
    }
}