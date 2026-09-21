{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module Bazaar where

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


{-@ callBazaar :: ctx:BazaarState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceBazaar ctx}
           -> ctx':{ BazaarState | balanceBazaar ctx' == balanceBazaar ctx - amount  && (msgBazaar ctx' == msgBazaar ctx) && (blockBazaar ctx' == blockBazaar ctx) && (addressBazaar ctx' == addressBazaar ctx) && (currentContractAddressBazaar ctx' == currentContractAddressBazaar ctx) && (addresZeroBazaar ctx' == addresZeroBazaar ctx)}
@-}
callBazaar:: BazaarState -> Address -> Amount -> BazaarState
callBazaar ctx _addr amount = ctx { balanceBazaar = balanceBazaar ctx - amount }


{-@ data BazaarState = BazaarState {
  msgBazaar :: Message,
  blockBazaar :: Block,
  balanceBazaar :: Amount,
  addressBazaar :: Address,
  currentContractAddressBazaar :: Address,
  addresZeroBazaar :: Address
}
@-} 

data BazaarState = BazaarState {
  msgBazaar :: Message,
  blockBazaar :: Block,
  balanceBazaar :: Amount,
  addressBazaar :: Address,
  currentContractAddressBazaar :: Address,
  addresZeroBazaar :: Address
}

{-@ constructorBazaar :: Message -> Block  -> {v:BazaarState | True} @-}
constructorBazaar :: Message -> Block -> BazaarState
constructorBazaar msgctx block  = BazaarState
            { msgBazaar = msgctx,
              blockBazaar = block,
              balanceBazaar = 0,
              addressBazaar = fromString "Bazaar",
              currentContractAddressBazaar = fromString "Bazaar",
              addresZeroBazaar = 0
            }

{-@ test :: {st:BazaarState | True} -> {v:BazaarState | True} @-}
test :: BazaarState -> BazaarState
test st = let
  st1 = st { currentContractAddressBazaar = addressBazaar st }
  st2 = st1 { addresZeroBazaar = 0 }
    in
      st2

