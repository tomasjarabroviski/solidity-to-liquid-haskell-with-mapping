{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module RoomThermostat where

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


{-@ callRoomThermostat :: ctx:RoomThermostatState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceRoomThermostat ctx}
           -> ctx':{ RoomThermostatState | balanceRoomThermostat ctx' == balanceRoomThermostat ctx - amount  && (msgRoomThermostat ctx' == msgRoomThermostat ctx) && (blockRoomThermostat ctx' == blockRoomThermostat ctx) && (addressRoomThermostat ctx' == addressRoomThermostat ctx) && (stateRoomThermostat ctx' == stateRoomThermostat ctx) && (installerRoomThermostat ctx' == installerRoomThermostat ctx) && (userRoomThermostat ctx' == userRoomThermostat ctx) && (targetTemperatureRoomThermostat ctx' == targetTemperatureRoomThermostat ctx) && (modeRoomThermostat ctx' == modeRoomThermostat ctx)}
@-}
callRoomThermostat:: RoomThermostatState -> Address -> Amount -> RoomThermostatState
callRoomThermostat ctx _addr amount = ctx { balanceRoomThermostat = balanceRoomThermostat ctx - amount }

data StateTypeRoomThermostat = CreatedRoomThermostat | InUseRoomThermostat deriving (Show, Eq)
data ModeEnumRoomThermostat = OffRoomThermostat | CoolRoomThermostat | HeatRoomThermostat | AutoRoomThermostat deriving (Show, Eq)

{-@ data RoomThermostatState = RoomThermostatState {
  msgRoomThermostat :: Message,
  blockRoomThermostat :: Block,
  balanceRoomThermostat :: Amount,
  addressRoomThermostat :: Address,
  stateRoomThermostat :: StateTypeRoomThermostat,
  installerRoomThermostat :: Address,
  userRoomThermostat :: Address,
  targetTemperatureRoomThermostat :: Integer,
  modeRoomThermostat :: ModeEnumRoomThermostat
}
@-} 

data RoomThermostatState = RoomThermostatState {
  msgRoomThermostat :: Message,
  blockRoomThermostat :: Block,
  balanceRoomThermostat :: Amount,
  addressRoomThermostat :: Address,
  stateRoomThermostat :: StateTypeRoomThermostat,
  installerRoomThermostat :: Address,
  userRoomThermostat :: Address,
  targetTemperatureRoomThermostat :: Integer,
  modeRoomThermostat :: ModeEnumRoomThermostat
}

{-@ constructorRoomThermostat :: Message -> Block  -> {thermostatInstaller:Address | True} -> {thermostatUser:Address | True} -> {v:RoomThermostatState | True} @-}
constructorRoomThermostat :: Message -> Block -> Address -> Address -> RoomThermostatState
constructorRoomThermostat msgctx block thermostatInstaller thermostatUser = RoomThermostatState
            { msgRoomThermostat = msgctx,
              blockRoomThermostat = block,
              balanceRoomThermostat = 0,
              addressRoomThermostat = fromString "RoomThermostat",
              installerRoomThermostat = thermostatInstaller,
              userRoomThermostat = thermostatUser,
              targetTemperatureRoomThermostat = 70,
              stateRoomThermostat = CreatedRoomThermostat,
              modeRoomThermostat = OffRoomThermostat
            }

