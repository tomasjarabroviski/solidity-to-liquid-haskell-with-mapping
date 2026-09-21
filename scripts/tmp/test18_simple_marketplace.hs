{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module SimpleMarketplace where

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


{-@ callSimpleMarketplace :: ctx:SimpleMarketplaceState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceSimpleMarketplace ctx}
           -> ctx':{ SimpleMarketplaceState | balanceSimpleMarketplace ctx' == balanceSimpleMarketplace ctx - amount  && (msgSimpleMarketplace ctx' == msgSimpleMarketplace ctx) && (blockSimpleMarketplace ctx' == blockSimpleMarketplace ctx) && (addressSimpleMarketplace ctx' == addressSimpleMarketplace ctx) && (instanceOwnerSimpleMarketplace ctx' == instanceOwnerSimpleMarketplace ctx) && (descriptionSimpleMarketplace ctx' == descriptionSimpleMarketplace ctx) && (askingPriceSimpleMarketplace ctx' == askingPriceSimpleMarketplace ctx) && (stateSimpleMarketplace ctx' == stateSimpleMarketplace ctx) && (instanceBuyerSimpleMarketplace ctx' == instanceBuyerSimpleMarketplace ctx) && (offerPriceSimpleMarketplace ctx' == offerPriceSimpleMarketplace ctx)}
@-}
callSimpleMarketplace:: SimpleMarketplaceState -> Address -> Amount -> SimpleMarketplaceState
callSimpleMarketplace ctx _addr amount = ctx { balanceSimpleMarketplace = balanceSimpleMarketplace ctx - amount }

data StateTypeSimpleMarketplace = ItemAvailableSimpleMarketplace | OfferPlacedSimpleMarketplace | AcceptedSimpleMarketplace deriving (Show, Eq)

{-@ data SimpleMarketplaceState = SimpleMarketplaceState {
  msgSimpleMarketplace :: Message,
  blockSimpleMarketplace :: Block,
  balanceSimpleMarketplace :: Amount,
  addressSimpleMarketplace :: Address,
  instanceOwnerSimpleMarketplace :: Address,
  descriptionSimpleMarketplace :: String,
  askingPriceSimpleMarketplace :: Integer,
  stateSimpleMarketplace :: StateTypeSimpleMarketplace,
  instanceBuyerSimpleMarketplace :: Address,
  offerPriceSimpleMarketplace :: Integer
}
@-} 

data SimpleMarketplaceState = SimpleMarketplaceState {
  msgSimpleMarketplace :: Message,
  blockSimpleMarketplace :: Block,
  balanceSimpleMarketplace :: Amount,
  addressSimpleMarketplace :: Address,
  instanceOwnerSimpleMarketplace :: Address,
  descriptionSimpleMarketplace :: String,
  askingPriceSimpleMarketplace :: Integer,
  stateSimpleMarketplace :: StateTypeSimpleMarketplace,
  instanceBuyerSimpleMarketplace :: Address,
  offerPriceSimpleMarketplace :: Integer
}

{-@ constructorSimpleMarketplace :: Message -> Block  -> {description:String | True} -> {price:Integer | True} -> {v:SimpleMarketplaceState | True} @-}
constructorSimpleMarketplace :: Message -> Block -> String -> Integer -> SimpleMarketplaceState
constructorSimpleMarketplace msgctx block description price = SimpleMarketplaceState
            { msgSimpleMarketplace = msgctx,
              blockSimpleMarketplace = block,
              balanceSimpleMarketplace = 0,
              addressSimpleMarketplace = fromString "SimpleMarketplace",
              instanceOwnerSimpleMarketplace = sender msgctx,
              askingPriceSimpleMarketplace = price,
              descriptionSimpleMarketplace = description,
              stateSimpleMarketplace = ItemAvailableSimpleMarketplace,
              instanceBuyerSimpleMarketplace = 0,
              offerPriceSimpleMarketplace = 0
            }

{-@ makeOffer :: {st:SimpleMarketplaceState | True} -> {offerPrice:Integer | True} -> {v:SimpleMarketplaceState | True} @-}
makeOffer :: SimpleMarketplaceState -> Integer -> SimpleMarketplaceState
makeOffer st offerPrice = let
  st1 = if (offerPrice == 0)
    then
    let
      st1 = revert "error"
        in
          st1
    else st
  st2 = if ((stateSimpleMarketplace st1) /= ItemAvailableSimpleMarketplace)
    then
    let
      st1 = revert "error"
        in
          st1
    else st1
  st3 = if ((instanceOwnerSimpleMarketplace st2) == (sender (msgSimpleMarketplace st2)))
    then
    let
      st1 = revert "error"
        in
          st1
    else st2
  st4 = st3 { instanceBuyerSimpleMarketplace = (sender (msgSimpleMarketplace st3)) }
  st5 = st4 { offerPriceSimpleMarketplace = offerPrice }
  st6 = st5 { stateSimpleMarketplace = OfferPlacedSimpleMarketplace }
    in
      st6

{-@ reject :: {st:SimpleMarketplaceState | True} -> {v:SimpleMarketplaceState | True} @-}
reject :: SimpleMarketplaceState -> SimpleMarketplaceState
reject st = let
  st1 = if ((stateSimpleMarketplace st) /= OfferPlacedSimpleMarketplace)
    then
    let
      st1 = revert "error"
        in
          st1
    else st
  st2 = if ((instanceOwnerSimpleMarketplace st1) /= (sender (msgSimpleMarketplace st1)))
    then
    let
      st1 = revert "error"
        in
          st1
    else st1
  st3 = st2 { instanceBuyerSimpleMarketplace = 0x0000000000000000000000000000000000000000 }
  st4 = st3 { stateSimpleMarketplace = ItemAvailableSimpleMarketplace }
    in
      st4

{-@ acceptOffer :: {st:SimpleMarketplaceState | True} -> {v:SimpleMarketplaceState | True} @-}
acceptOffer :: SimpleMarketplaceState -> SimpleMarketplaceState
acceptOffer st = let
  st1 = if ((sender (msgSimpleMarketplace st)) /= (instanceOwnerSimpleMarketplace st))
    then
    let
      st1 = revert "error"
        in
          st1
    else st
  st2 = st1 { stateSimpleMarketplace = AcceptedSimpleMarketplace }
    in
      st2

