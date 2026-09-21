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
           -> ctx':{ BazaarState | balanceBazaar ctx' == balanceBazaar ctx - amount  && (msgBazaar ctx' == msgBazaar ctx) && (blockBazaar ctx' == blockBazaar ctx) && (addressBazaar ctx' == addressBazaar ctx) && (instanceBazaarMaintainerBazaar ctx' == instanceBazaarMaintainerBazaar ctx)}
@-}
callBazaar:: BazaarState -> Address -> Amount -> BazaarState
callBazaar ctx _addr amount = ctx { balanceBazaar = balanceBazaar ctx - amount }


{-@ data BazaarState = BazaarState {
  msgBazaar :: Message,
  blockBazaar :: Block,
  balanceBazaar :: Amount,
  addressBazaar :: Address,
  instanceBazaarMaintainerBazaar :: Address
}
@-} 

data BazaarState = BazaarState {
  msgBazaar :: Message,
  blockBazaar :: Block,
  balanceBazaar :: Amount,
  addressBazaar :: Address,
  instanceBazaarMaintainerBazaar :: Address
}

{-@ constructorBazaar :: Message -> Block  -> {v:BazaarState | True} @-}
constructorBazaar :: Message -> Block -> BazaarState
constructorBazaar msgctx block  = BazaarState
            { msgBazaar = msgctx,
              blockBazaar = block,
              balanceBazaar = 0,
              addressBazaar = fromString "Bazaar",
              instanceBazaarMaintainerBazaar = sender msgctx
            }

{-@ validPrice :: {st:BazaarState | True} -> {itemPrice:Integer | ((itemPrice) > (0))} -> {v:Bool | ((v) == (True))} @-}
validPrice :: BazaarState -> Integer -> Bool
validPrice st itemPrice = 
  let result = True in
  result



{-@ callItemListing :: ctx:ItemListingState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceItemListing ctx}
           -> ctx':{ ItemListingState | balanceItemListing ctx' == balanceItemListing ctx - amount  && (msgItemListing ctx' == msgItemListing ctx) && (blockItemListing ctx' == blockItemListing ctx) && (addressItemListing ctx' == addressItemListing ctx) && (flagItemListing ctx' == flagItemListing ctx)}
@-}
callItemListing:: ItemListingState -> Address -> Amount -> ItemListingState
callItemListing ctx _addr amount = ctx { balanceItemListing = balanceItemListing ctx - amount }


{-@ data ItemListingState = ItemListingState {
  msgItemListing :: Message,
  blockItemListing :: Block,
  balanceItemListing :: Amount,
  addressItemListing :: Address,
  flagItemListing :: Bool
}
@-} 

data ItemListingState = ItemListingState {
  msgItemListing :: Message,
  blockItemListing :: Block,
  balanceItemListing :: Amount,
  addressItemListing :: Address,
  flagItemListing :: Bool
}

{-@ buyItemRevert_WrongCall :: {st:ItemListingState | True} -> {v:ItemListingState | True} @-}
buyItemRevert_WrongCall :: ItemListingState -> ItemListingState
buyItemRevert_WrongCall st = let
  bazaar = constructorBazaar (msgItemListing st) (blockItemListing st) 
  st1 = st { flagItemListing = validPrice bazaar (-(5)) }
    in
      st1

{-@ buyItemNoRevert :: {st:ItemListingState | True} -> {v:ItemListingState | (((flagItemListing v)) == (True))} @-}
buyItemNoRevert :: ItemListingState -> ItemListingState
buyItemNoRevert st = let
  bazaar = constructorBazaar (msgItemListing st) (blockItemListing st) 
  st1 = if (not(validPrice bazaar 50))
    then
    let
      st1 = revert "It is not a valid price"
        in
          st1
    else st
  st2 = st1 { flagItemListing = True }
  st3 = st2 -- assert statement
    in
      st3

{-@ buyItemRevert_ReturnsTrue :: {st:ItemListingState | True} -> {v:ItemListingState | (((flagItemListing v)) == (True))} @-}
buyItemRevert_ReturnsTrue :: ItemListingState -> ItemListingState
buyItemRevert_ReturnsTrue st = let
  bazaar = constructorBazaar (msgItemListing st) (blockItemListing st) 
  st1 = if validPrice bazaar 50
    then
    let
      st1 = revert "It is not a valid price"
        in
          st1
    else st
  st2 = st1 { flagItemListing = True }
  st3 = st2 -- assert statement
    in
      st3

