{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module RefrigeratedTransportationWithTime where

import Data.Char (ord)

{-@ reflect fromStringGoInts @-}
{-@ fromStringGoInts :: acc:{Int | acc >= 0} -> [Int] -> {v:Int | v >= 0} @-}
fromStringGoInts :: Int -> [Int] -> Int
fromStringGoInts acc [] = acc
fromStringGoInts acc (x:xs) =
  let acc' = acc * 31 + x
  in fromStringGoInts (if acc' >= 0 then acc' else 0) xs

{-@ fromString :: String -> {v:Int | v >= 0} @-}
fromString :: String -> Int
fromString s = fromStringGoInts 0 (map ord s)
data Message = Message {
  sender :: Address,
  value :: Uint
} deriving (Show, Eq)

{-@ data Message = Message {
  sender :: Address,
  value :: Uint}
@-}

data Block = Block {
  number :: Uint}

{-@ data Block = Block {
  number :: Uint}
@-}

{-@ type Amount = {v: Int | v >= 0} @-}
type Amount = Int

{-@ type Uint = {v: Int | v >= 0} @-}
type Uint = Int

type Address = Int
{-@ type Address = Int @-}

{-@ revert :: {v:String | False} -> a  @-}
revert :: String -> a
revert  = error


{-@ callRefrigeratedTransportationWithTime :: ctx:RefrigeratedTransportationWithTimeState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceRefrigeratedTransportationWithTime ctx}
           -> ctx':{ RefrigeratedTransportationWithTimeState | balanceRefrigeratedTransportationWithTime ctx' == balanceRefrigeratedTransportationWithTime ctx - amount  && (msgRefrigeratedTransportationWithTime ctx' == msgRefrigeratedTransportationWithTime ctx) && (blockRefrigeratedTransportationWithTime ctx' == blockRefrigeratedTransportationWithTime ctx) && (addressRefrigeratedTransportationWithTime ctx' == addressRefrigeratedTransportationWithTime ctx) && (stateRefrigeratedTransportationWithTime ctx' == stateRefrigeratedTransportationWithTime ctx) && (ownerRefrigeratedTransportationWithTime ctx' == ownerRefrigeratedTransportationWithTime ctx) && (initiatingCounterpartyRefrigeratedTransportationWithTime ctx' == initiatingCounterpartyRefrigeratedTransportationWithTime ctx) && (counterpartyRefrigeratedTransportationWithTime ctx' == counterpartyRefrigeratedTransportationWithTime ctx) && (previousCounterpartyRefrigeratedTransportationWithTime ctx' == previousCounterpartyRefrigeratedTransportationWithTime ctx) && (deviceRefrigeratedTransportationWithTime ctx' == deviceRefrigeratedTransportationWithTime ctx) && (supplyChainOwnerRefrigeratedTransportationWithTime ctx' == supplyChainOwnerRefrigeratedTransportationWithTime ctx) && (supplyChainObserverRefrigeratedTransportationWithTime ctx' == supplyChainObserverRefrigeratedTransportationWithTime ctx) && (minHumidityRefrigeratedTransportationWithTime ctx' == minHumidityRefrigeratedTransportationWithTime ctx) && (maxHumidityRefrigeratedTransportationWithTime ctx' == maxHumidityRefrigeratedTransportationWithTime ctx) && (minTemperatureRefrigeratedTransportationWithTime ctx' == minTemperatureRefrigeratedTransportationWithTime ctx) && (maxTemperatureRefrigeratedTransportationWithTime ctx' == maxTemperatureRefrigeratedTransportationWithTime ctx) && (complianceSensorTypeRefrigeratedTransportationWithTime ctx' == complianceSensorTypeRefrigeratedTransportationWithTime ctx) && (complianceSensorReadingRefrigeratedTransportationWithTime ctx' == complianceSensorReadingRefrigeratedTransportationWithTime ctx) && (complianceStatusRefrigeratedTransportationWithTime ctx' == complianceStatusRefrigeratedTransportationWithTime ctx) && (complianceDetailRefrigeratedTransportationWithTime ctx' == complianceDetailRefrigeratedTransportationWithTime ctx) && (lastSensorUpdateTimestampRefrigeratedTransportationWithTime ctx' == lastSensorUpdateTimestampRefrigeratedTransportationWithTime ctx)}
@-}
callRefrigeratedTransportationWithTime:: RefrigeratedTransportationWithTimeState -> Address -> Amount -> RefrigeratedTransportationWithTimeState
callRefrigeratedTransportationWithTime ctx _addr amount = ctx { balanceRefrigeratedTransportationWithTime = balanceRefrigeratedTransportationWithTime ctx - amount }

data StateTypeRefrigeratedTransportationWithTime = CreatedRefrigeratedTransportationWithTime | InTransitRefrigeratedTransportationWithTime | CompletedRefrigeratedTransportationWithTime | OutOfComplianceRefrigeratedTransportationWithTime deriving (Show, Eq)
data SensorTypeRefrigeratedTransportationWithTime = NoneRefrigeratedTransportationWithTime | HumidityRefrigeratedTransportationWithTime | TemperatureRefrigeratedTransportationWithTime deriving (Show, Eq)

{-@ data RefrigeratedTransportationWithTimeState = RefrigeratedTransportationWithTimeState {
  msgRefrigeratedTransportationWithTime :: Message,
  blockRefrigeratedTransportationWithTime :: Block,
  balanceRefrigeratedTransportationWithTime :: Amount,
  addressRefrigeratedTransportationWithTime :: Address,
  stateRefrigeratedTransportationWithTime :: StateTypeRefrigeratedTransportationWithTime,
  ownerRefrigeratedTransportationWithTime :: Address,
  initiatingCounterpartyRefrigeratedTransportationWithTime :: Address,
  counterpartyRefrigeratedTransportationWithTime :: Address,
  previousCounterpartyRefrigeratedTransportationWithTime :: Address,
  deviceRefrigeratedTransportationWithTime :: Address,
  supplyChainOwnerRefrigeratedTransportationWithTime :: Address,
  supplyChainObserverRefrigeratedTransportationWithTime :: Address,
  minHumidityRefrigeratedTransportationWithTime :: Integer,
  maxHumidityRefrigeratedTransportationWithTime :: Integer,
  minTemperatureRefrigeratedTransportationWithTime :: Integer,
  maxTemperatureRefrigeratedTransportationWithTime :: Integer,
  complianceSensorTypeRefrigeratedTransportationWithTime :: SensorTypeRefrigeratedTransportationWithTime,
  complianceSensorReadingRefrigeratedTransportationWithTime :: Integer,
  complianceStatusRefrigeratedTransportationWithTime :: Bool,
  complianceDetailRefrigeratedTransportationWithTime :: String,
  lastSensorUpdateTimestampRefrigeratedTransportationWithTime :: Uint
}
@-} 

data RefrigeratedTransportationWithTimeState = RefrigeratedTransportationWithTimeState {
  msgRefrigeratedTransportationWithTime :: Message,
  blockRefrigeratedTransportationWithTime :: Block,
  balanceRefrigeratedTransportationWithTime :: Amount,
  addressRefrigeratedTransportationWithTime :: Address,
  stateRefrigeratedTransportationWithTime :: StateTypeRefrigeratedTransportationWithTime,
  ownerRefrigeratedTransportationWithTime :: Address,
  initiatingCounterpartyRefrigeratedTransportationWithTime :: Address,
  counterpartyRefrigeratedTransportationWithTime :: Address,
  previousCounterpartyRefrigeratedTransportationWithTime :: Address,
  deviceRefrigeratedTransportationWithTime :: Address,
  supplyChainOwnerRefrigeratedTransportationWithTime :: Address,
  supplyChainObserverRefrigeratedTransportationWithTime :: Address,
  minHumidityRefrigeratedTransportationWithTime :: Integer,
  maxHumidityRefrigeratedTransportationWithTime :: Integer,
  minTemperatureRefrigeratedTransportationWithTime :: Integer,
  maxTemperatureRefrigeratedTransportationWithTime :: Integer,
  complianceSensorTypeRefrigeratedTransportationWithTime :: SensorTypeRefrigeratedTransportationWithTime,
  complianceSensorReadingRefrigeratedTransportationWithTime :: Integer,
  complianceStatusRefrigeratedTransportationWithTime :: Bool,
  complianceDetailRefrigeratedTransportationWithTime :: String,
  lastSensorUpdateTimestampRefrigeratedTransportationWithTime :: Uint
}

{-@ constructorRefrigeratedTransportationWithTime :: Message -> Block  -> {device:Address | True} -> {supplyChainOwner:Address | True} -> {supplyChainObserver:Address | True} -> {minHumidity:Integer | True} -> {maxHumidity:Integer | True} -> {minTemperature:Integer | True} -> {maxTemperature:Integer | True} -> {v:RefrigeratedTransportationWithTimeState | True} @-}
constructorRefrigeratedTransportationWithTime :: Message -> Block -> Address -> Address -> Address -> Integer -> Integer -> Integer -> Integer -> RefrigeratedTransportationWithTimeState
constructorRefrigeratedTransportationWithTime msgctx block device supplyChainOwner supplyChainObserver minHumidity maxHumidity minTemperature maxTemperature = RefrigeratedTransportationWithTimeState
            { msgRefrigeratedTransportationWithTime = msgctx,
              blockRefrigeratedTransportationWithTime = block,
              balanceRefrigeratedTransportationWithTime = 0,
              addressRefrigeratedTransportationWithTime = fromString "RefrigeratedTransportationWithTime",
              complianceStatusRefrigeratedTransportationWithTime = True,
              complianceSensorReadingRefrigeratedTransportationWithTime = undefined,
              initiatingCounterpartyRefrigeratedTransportationWithTime = sender msgctx,
              ownerRefrigeratedTransportationWithTime = sender msgctx,
              counterpartyRefrigeratedTransportationWithTime = sender msgctx,
              deviceRefrigeratedTransportationWithTime = device,
              supplyChainOwnerRefrigeratedTransportationWithTime = supplyChainOwner,
              supplyChainObserverRefrigeratedTransportationWithTime = supplyChainObserver,
              minHumidityRefrigeratedTransportationWithTime = minHumidity,
              maxHumidityRefrigeratedTransportationWithTime = maxHumidity,
              minTemperatureRefrigeratedTransportationWithTime = minTemperature,
              maxTemperatureRefrigeratedTransportationWithTime = maxTemperature,
              stateRefrigeratedTransportationWithTime = CreatedRefrigeratedTransportationWithTime,
              complianceDetailRefrigeratedTransportationWithTime = undefined,
              previousCounterpartyRefrigeratedTransportationWithTime = 0,
              complianceSensorTypeRefrigeratedTransportationWithTime = NoneRefrigeratedTransportationWithTime,
              lastSensorUpdateTimestampRefrigeratedTransportationWithTime = 0
            }

{-@ ingestTelemetry :: {st:RefrigeratedTransportationWithTimeState | True} -> {humidity:Integer | True} -> {temperature:Integer | True} -> {timestamp:Uint | True} -> {v:RefrigeratedTransportationWithTimeState | True} @-}
ingestTelemetry :: RefrigeratedTransportationWithTimeState -> Integer -> Integer -> Uint -> RefrigeratedTransportationWithTimeState
ingestTelemetry st humidity temperature timestamp = let
  st1 = if ((((deviceRefrigeratedTransportationWithTime st) /= (sender (msgRefrigeratedTransportationWithTime st))) || ((stateRefrigeratedTransportationWithTime st) == OutOfComplianceRefrigeratedTransportationWithTime)) || ((stateRefrigeratedTransportationWithTime st) == CompletedRefrigeratedTransportationWithTime))
    then
    let
      st1 = revert "error"
        in
          st1
    else st
  st2 = st1 { lastSensorUpdateTimestampRefrigeratedTransportationWithTime = timestamp }
  st3 = if ((humidity > (maxHumidityRefrigeratedTransportationWithTime st2)) || (humidity < (minHumidityRefrigeratedTransportationWithTime st2)))
    then
    let
      st1 = st2 { complianceSensorTypeRefrigeratedTransportationWithTime = HumidityRefrigeratedTransportationWithTime }
      st2 = st1 { complianceSensorReadingRefrigeratedTransportationWithTime = humidity }
      st3 = st2 { complianceDetailRefrigeratedTransportationWithTime = "Humidity value out of range." }
      st4 = st3 { complianceStatusRefrigeratedTransportationWithTime = False }
        in
          st4
    else st2
  st4 = if ((complianceStatusRefrigeratedTransportationWithTime st3) == False)
    then
    let
      st1 = st3 { stateRefrigeratedTransportationWithTime = OutOfComplianceRefrigeratedTransportationWithTime }
        in
          st1
    else st3
    in
      st4

{-@ transferResponsibility :: {st:RefrigeratedTransportationWithTimeState | True} -> {newCounterparty:Address | True} -> {v:RefrigeratedTransportationWithTimeState | True} @-}
transferResponsibility :: RefrigeratedTransportationWithTimeState -> Address -> RefrigeratedTransportationWithTimeState
transferResponsibility st newCounterparty = let
  st1 = if ((((((initiatingCounterpartyRefrigeratedTransportationWithTime st) /= (sender (msgRefrigeratedTransportationWithTime st))) && ((counterpartyRefrigeratedTransportationWithTime st) /= (sender (msgRefrigeratedTransportationWithTime st)))) || ((stateRefrigeratedTransportationWithTime st) == CompletedRefrigeratedTransportationWithTime)) || ((stateRefrigeratedTransportationWithTime st) == OutOfComplianceRefrigeratedTransportationWithTime)) || (newCounterparty == (deviceRefrigeratedTransportationWithTime st)))
    then
    let
      st1 = revert "error"
        in
          st1
    else st
  st2 = if ((stateRefrigeratedTransportationWithTime st1) == CreatedRefrigeratedTransportationWithTime)
    then
    let
      st1 = st1 { stateRefrigeratedTransportationWithTime = InTransitRefrigeratedTransportationWithTime }
        in
          st1
    else st1
  st3 = st2 { previousCounterpartyRefrigeratedTransportationWithTime = (counterpartyRefrigeratedTransportationWithTime st2) }
  st4 = st3 { counterpartyRefrigeratedTransportationWithTime = newCounterparty }
    in
      st4

{-@ complete :: {st:RefrigeratedTransportationWithTimeState | True} -> {v:RefrigeratedTransportationWithTimeState | True} @-}
complete :: RefrigeratedTransportationWithTimeState -> RefrigeratedTransportationWithTimeState
complete st = let
  st1 = if (((((ownerRefrigeratedTransportationWithTime st) /= (sender (msgRefrigeratedTransportationWithTime st))) && ((supplyChainOwnerRefrigeratedTransportationWithTime st) /= (sender (msgRefrigeratedTransportationWithTime st)))) || ((stateRefrigeratedTransportationWithTime st) == CompletedRefrigeratedTransportationWithTime)) || ((stateRefrigeratedTransportationWithTime st) == OutOfComplianceRefrigeratedTransportationWithTime))
    then
    let
      st1 = revert "error"
        in
          st1
    else st
  st2 = st1 { stateRefrigeratedTransportationWithTime = CompletedRefrigeratedTransportationWithTime }
  st3 = st2 { previousCounterpartyRefrigeratedTransportationWithTime = (counterpartyRefrigeratedTransportationWithTime st2) }
  st4 = st3 { counterpartyRefrigeratedTransportationWithTime = 0x0000000000000000000000000000000000000000 }
    in
      st4

