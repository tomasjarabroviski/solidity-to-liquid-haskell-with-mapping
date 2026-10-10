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

{-@ type Uint = {v: Int | InRange v} @-}
type Uint = Int

type Address = Int
{-@ type Address = Int @-}
{-@ predicate InRange V = V >= 0 @-}


{-@ revert :: {v:String | False} -> a  @-}
revert :: String -> a
revert  = error


{-@ callBazaar :: ctx:BazaarState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceBazaar ctx}
           -> ctx':{ BazaarState | balanceBazaar ctx' == balanceBazaar ctx - amount  && (msgBazaar ctx' == msgBazaar ctx) && (blockBazaar ctx' == blockBazaar ctx) && (addressBazaar ctx' == addressBazaar ctx) && (stateBazaar ctx' == stateBazaar ctx) && (instancePartyABazaar ctx' == instancePartyABazaar ctx) && (partyABalanceBazaar ctx' == partyABalanceBazaar ctx) && (instancePartyBBazaar ctx' == instancePartyBBazaar ctx) && (partyBBalanceBazaar ctx' == partyBBalanceBazaar ctx) && (instanceBazaarMaintainerBazaar ctx' == instanceBazaarMaintainerBazaar ctx) && (currentSellerBazaar ctx' == currentSellerBazaar ctx) && (itemNameBazaar ctx' == itemNameBazaar ctx) && (itemPriceBazaar ctx' == itemPriceBazaar ctx)}
@-}
callBazaar:: BazaarState -> Address -> Amount -> BazaarState
callBazaar ctx _addr amount = ctx { balanceBazaar = balanceBazaar ctx - amount }

data StateTypeBazaar = PartyProvisionedBazaar | ItemListedBazaar | CurrentSaleFinalizedBazaar deriving (Show, Eq)

{-@ data BazaarState = BazaarState {
  msgBazaar :: Message,
  blockBazaar :: Block,
  balanceBazaar :: Amount,
  addressBazaar :: Address,
  stateBazaar :: StateTypeBazaar,
  instancePartyABazaar :: Address,
  partyABalanceBazaar :: Integer,
  instancePartyBBazaar :: Address,
  partyBBalanceBazaar :: Integer,
  instanceBazaarMaintainerBazaar :: Address,
  currentSellerBazaar :: Address,
  itemNameBazaar :: String,
  itemPriceBazaar :: Integer
}
@-} 

data BazaarState = BazaarState {
  msgBazaar :: Message,
  blockBazaar :: Block,
  balanceBazaar :: Amount,
  addressBazaar :: Address,
  stateBazaar :: StateTypeBazaar,
  instancePartyABazaar :: Address,
  partyABalanceBazaar :: Integer,
  instancePartyBBazaar :: Address,
  partyBBalanceBazaar :: Integer,
  instanceBazaarMaintainerBazaar :: Address,
  currentSellerBazaar :: Address,
  itemNameBazaar :: String,
  itemPriceBazaar :: Integer
}

{-@ constructorBazaar :: Message -> Block  -> {partyA:Address | True} -> {balanceA:Integer | True} -> {partyB:Address | True} -> {balanceB:Integer | True} -> {v:BazaarState | True} @-}
constructorBazaar :: Message -> Block -> Address -> Integer -> Address -> Integer -> BazaarState
constructorBazaar msgctx block partyA balanceA partyB balanceB = BazaarState
            { msgBazaar = msgctx,
              blockBazaar = block,
              balanceBazaar = 0,
              addressBazaar = fromString "Bazaar",
              instanceBazaarMaintainerBazaar = sender msgctx,
              instancePartyABazaar = partyA,
              partyABalanceBazaar = balanceA,
              instancePartyBBazaar = partyB,
              partyBBalanceBazaar = balanceB,
              stateBazaar = PartyProvisionedBazaar,
              currentSellerBazaar = 0,
              itemNameBazaar = "",
              itemPriceBazaar = 0
            }

{-@ hasBalance :: {st:BazaarState | True} -> {buyer:Address | True} -> {itemPrice:Integer | True} -> {v:Bool | True} @-}
hasBalance :: BazaarState -> Address -> Integer -> Bool
hasBalance st buyer itemPrice = 
  if (buyer == (instancePartyABazaar st))
then ((partyABalanceBazaar st) >= itemPrice)
else if (buyer == (instancePartyBBazaar st))
then ((partyBBalanceBazaar st) >= itemPrice)
else False

