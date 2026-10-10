{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module DefectiveComponentCounter where

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


{-@ callDefectiveComponentCounter :: ctx:DefectiveComponentCounterState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceDefectiveComponentCounter ctx}
           -> ctx':{ DefectiveComponentCounterState | balanceDefectiveComponentCounter ctx' == balanceDefectiveComponentCounter ctx - amount  && (msgDefectiveComponentCounter ctx' == msgDefectiveComponentCounter ctx) && (blockDefectiveComponentCounter ctx' == blockDefectiveComponentCounter ctx) && (addressDefectiveComponentCounter ctx' == addressDefectiveComponentCounter ctx) && (manufacturerDefectiveComponentCounter ctx' == manufacturerDefectiveComponentCounter ctx) && (totalDefectiveComponentCounter ctx' == totalDefectiveComponentCounter ctx)}
@-}
callDefectiveComponentCounter:: DefectiveComponentCounterState -> Address -> Amount -> DefectiveComponentCounterState
callDefectiveComponentCounter ctx _addr amount = ctx { balanceDefectiveComponentCounter = balanceDefectiveComponentCounter ctx - amount }


{-@ data DefectiveComponentCounterState = DefectiveComponentCounterState {
  msgDefectiveComponentCounter :: Message,
  blockDefectiveComponentCounter :: Block,
  balanceDefectiveComponentCounter :: Amount,
  addressDefectiveComponentCounter :: Address,
  manufacturerDefectiveComponentCounter :: Address,
  totalDefectiveComponentCounter :: Integer
}
@-} 

data DefectiveComponentCounterState = DefectiveComponentCounterState {
  msgDefectiveComponentCounter :: Message,
  blockDefectiveComponentCounter :: Block,
  balanceDefectiveComponentCounter :: Amount,
  addressDefectiveComponentCounter :: Address,
  manufacturerDefectiveComponentCounter :: Address,
  totalDefectiveComponentCounter :: Integer
}


