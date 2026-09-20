
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
        bool condition = humidity > MaxHumidity;
        if ( condition )
        {
            ComplianceSensorType = SensorType.Humidity;
            ComplianceStatus = false;
        }
    }
}