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

{-@ type Uint = {v: Int | v >= 0} @-}
type Uint = Int

type Address = Int
{-@ type Address = Int @-}

{-@ revert :: {v:String | False} -> a  @-}
revert :: String -> a
revert  = error


{-@ callRefrigeratedTransportation :: ctx:RefrigeratedTransportationState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceRefrigeratedTransportation ctx}
           -> ctx':{ RefrigeratedTransportationState | balanceRefrigeratedTransportation ctx' == balanceRefrigeratedTransportation ctx - amount  && (msgRefrigeratedTransportation ctx' == msgRefrigeratedTransportation ctx) && (blockRefrigeratedTransportation ctx' == blockRefrigeratedTransportation ctx) && (addressRefrigeratedTransportation ctx' == addressRefrigeratedTransportation ctx) && (maxHumidityRefrigeratedTransportation ctx' == maxHumidityRefrigeratedTransportation ctx) && (complianceSensorTypeRefrigeratedTransportation ctx' == complianceSensorTypeRefrigeratedTransportation ctx) && (complianceStatusRefrigeratedTransportation ctx' == complianceStatusRefrigeratedTransportation ctx) && (lastSensorUpdateTimestampRefrigeratedTransportation ctx' == lastSensorUpdateTimestampRefrigeratedTransportation ctx)}
@-}
callRefrigeratedTransportation:: RefrigeratedTransportationState -> Address -> Amount -> RefrigeratedTransportationState
callRefrigeratedTransportation ctx _addr amount = ctx { balanceRefrigeratedTransportation = balanceRefrigeratedTransportation ctx - amount }

data SensorTypeRefrigeratedTransportation = NoneRefrigeratedTransportation | HumidityRefrigeratedTransportation | TemperatureRefrigeratedTransportation deriving (Show, Eq)

{-@ data RefrigeratedTransportationState = RefrigeratedTransportationState {
  msgRefrigeratedTransportation :: Message,
  blockRefrigeratedTransportation :: Block,
  balanceRefrigeratedTransportation :: Amount,
  addressRefrigeratedTransportation :: Address,
  maxHumidityRefrigeratedTransportation :: Integer,
  complianceSensorTypeRefrigeratedTransportation :: SensorTypeRefrigeratedTransportation,
  complianceStatusRefrigeratedTransportation :: Bool,
  lastSensorUpdateTimestampRefrigeratedTransportation :: Integer
}
@-} 

data RefrigeratedTransportationState = RefrigeratedTransportationState {
  msgRefrigeratedTransportation :: Message,
  blockRefrigeratedTransportation :: Block,
  balanceRefrigeratedTransportation :: Amount,
  addressRefrigeratedTransportation :: Address,
  maxHumidityRefrigeratedTransportation :: Integer,
  complianceSensorTypeRefrigeratedTransportation :: SensorTypeRefrigeratedTransportation,
  complianceStatusRefrigeratedTransportation :: Bool,
  lastSensorUpdateTimestampRefrigeratedTransportation :: Integer
}

{-@ ingestTelemetry :: {st:RefrigeratedTransportationState | True} -> {humidity:Integer | True} -> {temperature:Integer | True} -> {timestamp:Integer | True} -> {v:RefrigeratedTransportationState | True} @-}
ingestTelemetry :: RefrigeratedTransportationState -> Integer -> Integer -> Integer -> RefrigeratedTransportationState
ingestTelemetry st humidity temperature timestamp = let
  st1 = st { lastSensorUpdateTimestampRefrigeratedTransportation = timestamp }
  condition = (humidity > (maxHumidityRefrigeratedTransportation st))
  st2 = if condition
    then
    let
      st1 = st1 { complianceSensorTypeRefrigeratedTransportation = HumidityRefrigeratedTransportation }
      st2 = st1 { complianceStatusRefrigeratedTransportation = False }
        in
          st2
    else st1
    in
      st2

