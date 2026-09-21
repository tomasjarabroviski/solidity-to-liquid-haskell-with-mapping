{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module Counter where

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


{-@ callCounter :: ctx:CounterState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceCounter ctx}
           -> ctx':{ CounterState | balanceCounter ctx' == balanceCounter ctx - amount  && (msgCounter ctx' == msgCounter ctx) && (blockCounter ctx' == blockCounter ctx) && (addressCounter ctx' == addressCounter ctx) && (countCounter ctx' == countCounter ctx) && (another_countCounter ctx' == another_countCounter ctx)}
@-}
callCounter:: CounterState -> Address -> Amount -> CounterState
callCounter ctx _addr amount = ctx { balanceCounter = balanceCounter ctx - amount }


{-@ data CounterState = CounterState {
  msgCounter :: Message,
  blockCounter :: Block,
  balanceCounter :: Amount,
  addressCounter :: Address,
  countCounter :: Uint,
  another_countCounter :: Uint
}
@-} 

data CounterState = CounterState {
  msgCounter :: Message,
  blockCounter :: Block,
  balanceCounter :: Amount,
  addressCounter :: Address,
  countCounter :: Uint,
  another_countCounter :: Uint
}

{-@ increment2 :: {st:CounterState | True} -> {v:CounterState | True} @-}
increment2 :: CounterState -> CounterState
increment2 st = let
  st1 = st { countCounter = ((countCounter st) + 1) }
  st2 = st1 { countCounter = ((countCounter st1) + 1) }
    in
      st2

{-@ increment_another :: {st:CounterState | True} -> {v:CounterState | True} @-}
increment_another :: CounterState -> CounterState
increment_another st = let
  st1 = st { another_countCounter = ((another_countCounter st) + 1) }
    in
      st1

