{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module ItemListing where

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


{-@ callItemListing :: ctx:ItemListingState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceItemListing ctx}
           -> ctx':{ ItemListingState | balanceItemListing ctx' == balanceItemListing ctx - amount  && (msgItemListing ctx' == msgItemListing ctx) && (blockItemListing ctx' == blockItemListing ctx) && (addressItemListing ctx' == addressItemListing ctx) && (stateItemListing ctx' == stateItemListing ctx) && (sellerItemListing ctx' == sellerItemListing ctx) && (instanceBuyerItemListing ctx' == instanceBuyerItemListing ctx) && (parentContractItemListing ctx' == parentContractItemListing ctx) && (itemNameItemListing ctx' == itemNameItemListing ctx) && (itemPriceItemListing ctx' == itemPriceItemListing ctx) && (partyAItemListing ctx' == partyAItemListing ctx) && (partyBItemListing ctx' == partyBItemListing ctx)}
@-}
callItemListing:: ItemListingState -> Address -> Amount -> ItemListingState
callItemListing ctx _addr amount = ctx { balanceItemListing = balanceItemListing ctx - amount }

data StateTypeItemItemListing = ItemAvailableItemListing | ItemSoldItemListing deriving (Show, Eq)

{-@ data ItemListingState = ItemListingState {
  msgItemListing :: Message,
  blockItemListing :: Block,
  balanceItemListing :: Amount,
  addressItemListing :: Address,
  stateItemListing :: StateTypeItemItemListing,
  sellerItemListing :: Address,
  instanceBuyerItemListing :: Address,
  parentContractItemListing :: Address,
  itemNameItemListing :: String,
  itemPriceItemListing :: Integer,
  partyAItemListing :: Address,
  partyBItemListing :: Address
}
@-} 

data ItemListingState = ItemListingState {
  msgItemListing :: Message,
  blockItemListing :: Block,
  balanceItemListing :: Amount,
  addressItemListing :: Address,
  stateItemListing :: StateTypeItemItemListing,
  sellerItemListing :: Address,
  instanceBuyerItemListing :: Address,
  parentContractItemListing :: Address,
  itemNameItemListing :: String,
  itemPriceItemListing :: Integer,
  partyAItemListing :: Address,
  partyBItemListing :: Address
}

{-@ buyItem :: {st:ItemListingState | True} -> {v:ItemListingState | True} @-}
buyItem :: ItemListingState -> ItemListingState
buyItem st = let
  st1 = st { instanceBuyerItemListing = (sender (msgItemListing st)) }
  st2 = if ((sellerItemListing st1) == (instanceBuyerItemListing st1))
    then
    let
      st1 = revert "error"
        in
          st1
    else st1
  bazaar = constructorBazaar (msgItemListing st2) (blockItemListing st2) (partyAItemListing st2) 100 (partyBItemListing st2) 100
  st3 = if (not(hasBalance bazaar (instanceBuyerItemListing st2) (itemPriceItemListing st2)))
    then
    let
      st1 = revert "error"
        in
          st1
    else st2
  st4 = st3 { stateItemListing = ItemSoldItemListing }
    in
      st4



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

