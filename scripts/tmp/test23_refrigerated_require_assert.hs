{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module RefrigeratedTransportation where

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

{-@ type Uint = {v: Int | InRange v} @-}
type Uint = Int

type Address = Int
{-@ type Address = Int @-}
{-@ predicate InRange V = V >= 0 @-}


{-@ revert :: {v:String | False} -> a  @-}
revert :: String -> a
revert  = error


{-@ callRefrigeratedTransportation :: ctx:RefrigeratedTransportationState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceRefrigeratedTransportation ctx}
           -> ctx':{ RefrigeratedTransportationState | balanceRefrigeratedTransportation ctx' == balanceRefrigeratedTransportation ctx - amount  && (msgRefrigeratedTransportation ctx' == msgRefrigeratedTransportation ctx) && (blockRefrigeratedTransportation ctx' == blockRefrigeratedTransportation ctx) && (addressRefrigeratedTransportation ctx' == addressRefrigeratedTransportation ctx) && (stateRefrigeratedTransportation ctx' == stateRefrigeratedTransportation ctx) && (ownerRefrigeratedTransportation ctx' == ownerRefrigeratedTransportation ctx) && (initiatingCounterpartyRefrigeratedTransportation ctx' == initiatingCounterpartyRefrigeratedTransportation ctx) && (counterpartyRefrigeratedTransportation ctx' == counterpartyRefrigeratedTransportation ctx) && (previousCounterpartyRefrigeratedTransportation ctx' == previousCounterpartyRefrigeratedTransportation ctx) && (deviceRefrigeratedTransportation ctx' == deviceRefrigeratedTransportation ctx) && (supplyChainOwnerRefrigeratedTransportation ctx' == supplyChainOwnerRefrigeratedTransportation ctx) && (supplyChainObserverRefrigeratedTransportation ctx' == supplyChainObserverRefrigeratedTransportation ctx) && (minHumidityRefrigeratedTransportation ctx' == minHumidityRefrigeratedTransportation ctx) && (maxHumidityRefrigeratedTransportation ctx' == maxHumidityRefrigeratedTransportation ctx) && (minTemperatureRefrigeratedTransportation ctx' == minTemperatureRefrigeratedTransportation ctx) && (maxTemperatureRefrigeratedTransportation ctx' == maxTemperatureRefrigeratedTransportation ctx) && (complianceSensorTypeRefrigeratedTransportation ctx' == complianceSensorTypeRefrigeratedTransportation ctx) && (complianceSensorReadingRefrigeratedTransportation ctx' == complianceSensorReadingRefrigeratedTransportation ctx) && (complianceStatusRefrigeratedTransportation ctx' == complianceStatusRefrigeratedTransportation ctx) && (complianceDetailRefrigeratedTransportation ctx' == complianceDetailRefrigeratedTransportation ctx) && (lastSensorUpdateTimestampRefrigeratedTransportation ctx' == lastSensorUpdateTimestampRefrigeratedTransportation ctx)}
@-}
callRefrigeratedTransportation:: RefrigeratedTransportationState -> Address -> Amount -> RefrigeratedTransportationState
callRefrigeratedTransportation ctx _addr amount = ctx { balanceRefrigeratedTransportation = balanceRefrigeratedTransportation ctx - amount }

data StateTypeRefrigeratedTransportation = CreatedRefrigeratedTransportation | InTransitRefrigeratedTransportation | CompletedRefrigeratedTransportation | OutOfComplianceRefrigeratedTransportation deriving (Show, Eq)
data SensorTypeRefrigeratedTransportation = NoneRefrigeratedTransportation | HumidityRefrigeratedTransportation | TemperatureRefrigeratedTransportation deriving (Show, Eq)

{-@ data RefrigeratedTransportationState = RefrigeratedTransportationState {
  msgRefrigeratedTransportation :: Message,
  blockRefrigeratedTransportation :: Block,
  balanceRefrigeratedTransportation :: Amount,
  addressRefrigeratedTransportation :: Address,
  stateRefrigeratedTransportation :: StateTypeRefrigeratedTransportation,
  ownerRefrigeratedTransportation :: Address,
  initiatingCounterpartyRefrigeratedTransportation :: Address,
  counterpartyRefrigeratedTransportation :: Address,
  previousCounterpartyRefrigeratedTransportation :: Address,
  deviceRefrigeratedTransportation :: Address,
  supplyChainOwnerRefrigeratedTransportation :: Address,
  supplyChainObserverRefrigeratedTransportation :: Address,
  minHumidityRefrigeratedTransportation :: Integer,
  maxHumidityRefrigeratedTransportation :: Integer,
  minTemperatureRefrigeratedTransportation :: Integer,
  maxTemperatureRefrigeratedTransportation :: Integer,
  complianceSensorTypeRefrigeratedTransportation :: SensorTypeRefrigeratedTransportation,
  complianceSensorReadingRefrigeratedTransportation :: Integer,
  complianceStatusRefrigeratedTransportation :: Bool,
  complianceDetailRefrigeratedTransportation :: String,
  lastSensorUpdateTimestampRefrigeratedTransportation :: Integer
}
@-} 

data RefrigeratedTransportationState = RefrigeratedTransportationState {
  msgRefrigeratedTransportation :: Message,
  blockRefrigeratedTransportation :: Block,
  balanceRefrigeratedTransportation :: Amount,
  addressRefrigeratedTransportation :: Address,
  stateRefrigeratedTransportation :: StateTypeRefrigeratedTransportation,
  ownerRefrigeratedTransportation :: Address,
  initiatingCounterpartyRefrigeratedTransportation :: Address,
  counterpartyRefrigeratedTransportation :: Address,
  previousCounterpartyRefrigeratedTransportation :: Address,
  deviceRefrigeratedTransportation :: Address,
  supplyChainOwnerRefrigeratedTransportation :: Address,
  supplyChainObserverRefrigeratedTransportation :: Address,
  minHumidityRefrigeratedTransportation :: Integer,
  maxHumidityRefrigeratedTransportation :: Integer,
  minTemperatureRefrigeratedTransportation :: Integer,
  maxTemperatureRefrigeratedTransportation :: Integer,
  complianceSensorTypeRefrigeratedTransportation :: SensorTypeRefrigeratedTransportation,
  complianceSensorReadingRefrigeratedTransportation :: Integer,
  complianceStatusRefrigeratedTransportation :: Bool,
  complianceDetailRefrigeratedTransportation :: String,
  lastSensorUpdateTimestampRefrigeratedTransportation :: Integer
}

{-@ constructorRefrigeratedTransportation :: Message -> Block  -> {device:Address | True} -> {supplyChainOwner:Address | True} -> {supplyChainObserver:Address | True} -> {minHumidity:Integer | True} -> {maxHumidity:Integer | True} -> {minTemperature:Integer | True} -> {maxTemperature:Integer | True} -> {v:RefrigeratedTransportationState | (((stateRefrigeratedTransportation v)) == (CreatedRefrigeratedTransportation)) && (((complianceStatusRefrigeratedTransportation v)) == (True))} @-}
constructorRefrigeratedTransportation :: Message -> Block -> Address -> Address -> Address -> Integer -> Integer -> Integer -> Integer -> RefrigeratedTransportationState
constructorRefrigeratedTransportation msgctx block device supplyChainOwner supplyChainObserver minHumidity maxHumidity minTemperature maxTemperature = RefrigeratedTransportationState
            { msgRefrigeratedTransportation = msgctx,
              blockRefrigeratedTransportation = block,
              balanceRefrigeratedTransportation = 0,
              addressRefrigeratedTransportation = fromString "RefrigeratedTransportation",
              complianceStatusRefrigeratedTransportation = True,
              complianceSensorReadingRefrigeratedTransportation = undefined,
              initiatingCounterpartyRefrigeratedTransportation = sender msgctx,
              ownerRefrigeratedTransportation = sender msgctx,
              counterpartyRefrigeratedTransportation = sender msgctx,
              deviceRefrigeratedTransportation = device,
              supplyChainOwnerRefrigeratedTransportation = supplyChainOwner,
              supplyChainObserverRefrigeratedTransportation = supplyChainObserver,
              minHumidityRefrigeratedTransportation = minHumidity,
              maxHumidityRefrigeratedTransportation = maxHumidity,
              minTemperatureRefrigeratedTransportation = minTemperature,
              maxTemperatureRefrigeratedTransportation = maxTemperature,
              stateRefrigeratedTransportation = CreatedRefrigeratedTransportation,
              complianceDetailRefrigeratedTransportation = undefined,
              previousCounterpartyRefrigeratedTransportation = 0,
              complianceSensorTypeRefrigeratedTransportation = NoneRefrigeratedTransportation,
              lastSensorUpdateTimestampRefrigeratedTransportation = 0
            }

{-@ ingestTelemetry :: {st:RefrigeratedTransportationState | (((stateRefrigeratedTransportation st)) /= (CompletedRefrigeratedTransportation)) && (((stateRefrigeratedTransportation st)) /= (OutOfComplianceRefrigeratedTransportation)) && (((deviceRefrigeratedTransportation st)) == ((sender (msgRefrigeratedTransportation st))))} -> {humidity:Integer | True} -> {temperature:Integer | True} -> {timestamp:Integer | True} -> {v:RefrigeratedTransportationState | (((lastSensorUpdateTimestampRefrigeratedTransportation v)) == (timestamp))} @-}
ingestTelemetry :: RefrigeratedTransportationState -> Integer -> Integer -> Integer -> RefrigeratedTransportationState
ingestTelemetry st humidity temperature timestamp = let
  st1 = if ((stateRefrigeratedTransportation st) /= CompletedRefrigeratedTransportation) then st else revert "error"
  st2 = if ((stateRefrigeratedTransportation st1) /= OutOfComplianceRefrigeratedTransportation) then st1 else revert "error"
  st3 = if ((deviceRefrigeratedTransportation st2) == (sender (msgRefrigeratedTransportation st2))) then st2 else revert "error"
  st4 = st3 { lastSensorUpdateTimestampRefrigeratedTransportation = timestamp }
  st5 = if ((humidity > (maxHumidityRefrigeratedTransportation st4)) || (humidity < (minHumidityRefrigeratedTransportation st4)))
    then
    let
      st1 = st4 { complianceSensorTypeRefrigeratedTransportation = HumidityRefrigeratedTransportation }
      st2 = st1 { complianceSensorReadingRefrigeratedTransportation = humidity }
      st3 = st2 { complianceDetailRefrigeratedTransportation = "Humidity value out of range." }
      st4 = st3 { complianceStatusRefrigeratedTransportation = False }
        in
          st4
    else
    let
      st1 = if ((temperature > (maxTemperatureRefrigeratedTransportation st4)) || (temperature < (minTemperatureRefrigeratedTransportation st4)))
        then
        let
          st1 = st4 { complianceSensorTypeRefrigeratedTransportation = TemperatureRefrigeratedTransportation }
          st2 = st1 { complianceSensorReadingRefrigeratedTransportation = temperature }
          st3 = st2 { complianceDetailRefrigeratedTransportation = "Temperature value out of range." }
          st4 = st3 { complianceStatusRefrigeratedTransportation = False }
            in
              st4
        else st4
        in
          st1
  st6 = if ((complianceStatusRefrigeratedTransportation st5) == False)
    then
    let
      st1 = st5 { stateRefrigeratedTransportation = OutOfComplianceRefrigeratedTransportation }
        in
          st1
    else st5
  st7 = st6 -- assert statement
    in
      st7

{-@ transferResponsibility :: {st:RefrigeratedTransportationState | (((stateRefrigeratedTransportation st)) /= (CompletedRefrigeratedTransportation)) && (((stateRefrigeratedTransportation st)) /= (OutOfComplianceRefrigeratedTransportation)) && ((((initiatingCounterpartyRefrigeratedTransportation st) == (sender (msgRefrigeratedTransportation st)))) || (((counterpartyRefrigeratedTransportation st) == (sender (msgRefrigeratedTransportation st)))))} -> {newCounterparty:Address | ((newCounterparty) /= ((deviceRefrigeratedTransportation st)))} -> {v:RefrigeratedTransportationState | (((counterpartyRefrigeratedTransportation v)) == (newCounterparty))} @-}
transferResponsibility :: RefrigeratedTransportationState -> Address -> RefrigeratedTransportationState
transferResponsibility st newCounterparty = let
  st1 = if ((stateRefrigeratedTransportation st) /= CompletedRefrigeratedTransportation) then st else revert "error"
  st2 = if ((stateRefrigeratedTransportation st1) /= OutOfComplianceRefrigeratedTransportation) then st1 else revert "error"
  st3 = if (((initiatingCounterpartyRefrigeratedTransportation st2) == (sender (msgRefrigeratedTransportation st2))) || ((counterpartyRefrigeratedTransportation st2) == (sender (msgRefrigeratedTransportation st2)))) then st2 else revert "error"
  st4 = if (newCounterparty /= (deviceRefrigeratedTransportation st3)) then st3 else revert "error"
  st5 = if ((stateRefrigeratedTransportation st4) == CreatedRefrigeratedTransportation)
    then
    let
      st1 = st4 { stateRefrigeratedTransportation = InTransitRefrigeratedTransportation }
        in
          st1
    else st4
  st6 = st5 { previousCounterpartyRefrigeratedTransportation = (counterpartyRefrigeratedTransportation st5) }
  st7 = st6 { counterpartyRefrigeratedTransportation = newCounterparty }
  st8 = st7 -- assert statement
    in
      st8

{-@ complete :: {st:RefrigeratedTransportationState | (((stateRefrigeratedTransportation st)) /= (CompletedRefrigeratedTransportation)) && (((stateRefrigeratedTransportation st)) /= (OutOfComplianceRefrigeratedTransportation)) && ((((ownerRefrigeratedTransportation st) == (sender (msgRefrigeratedTransportation st)))) || (((supplyChainOwnerRefrigeratedTransportation st) == (sender (msgRefrigeratedTransportation st)))))} -> {v:RefrigeratedTransportationState | (((stateRefrigeratedTransportation v)) == (CompletedRefrigeratedTransportation)) && (((counterpartyRefrigeratedTransportation v)) == (0x0000000000000000000000000000000000000000))} @-}
complete :: RefrigeratedTransportationState -> RefrigeratedTransportationState
complete st = let
  st1 = if ((stateRefrigeratedTransportation st) /= CompletedRefrigeratedTransportation) then st else revert "error"
  st2 = if ((stateRefrigeratedTransportation st1) /= OutOfComplianceRefrigeratedTransportation) then st1 else revert "error"
  st3 = if (((ownerRefrigeratedTransportation st2) == (sender (msgRefrigeratedTransportation st2))) || ((supplyChainOwnerRefrigeratedTransportation st2) == (sender (msgRefrigeratedTransportation st2)))) then st2 else revert "error"
  st4 = st3 { stateRefrigeratedTransportation = CompletedRefrigeratedTransportation }
  st5 = st4 { previousCounterpartyRefrigeratedTransportation = (counterpartyRefrigeratedTransportation st4) }
  st6 = st5 { counterpartyRefrigeratedTransportation = 0x0000000000000000000000000000000000000000 }
  st7 = st6 -- assert statement
  st8 = st7 -- assert statement
    in
      st8

