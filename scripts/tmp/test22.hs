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

{-@ type Uint = {v: Int | InRange v} @-}
type Uint = Int

type Address = Int
{-@ type Address = Int @-}
{-@ predicate InRange V = V >= 0 @-}


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

{-@ makeOffer :: {st:SimpleMarketplaceState | (((stateSimpleMarketplace st)) == (ItemAvailableSimpleMarketplace)) && (((instanceOwnerSimpleMarketplace st)) /= ((sender (msgSimpleMarketplace st))))} -> {offerPrice:Integer | ((offerPrice) /= (0))} -> {v:SimpleMarketplaceState | (((stateSimpleMarketplace v)) == (OfferPlacedSimpleMarketplace)) && (((instanceBuyerSimpleMarketplace v)) == ((sender (msgSimpleMarketplace v)))) && (((offerPriceSimpleMarketplace v)) == (offerPrice))} @-}
makeOffer :: SimpleMarketplaceState -> Integer -> SimpleMarketplaceState
makeOffer st offerPrice = let
  st1 = if (offerPrice /= 0) then st else revert "error"
  st2 = if ((stateSimpleMarketplace st1) == ItemAvailableSimpleMarketplace) then st1 else revert "error"
  st3 = if ((instanceOwnerSimpleMarketplace st2) /= (sender (msgSimpleMarketplace st2))) then st2 else revert "error"
  st4 = st3 { instanceBuyerSimpleMarketplace = (sender (msgSimpleMarketplace st3)) }
  st5 = st4 { offerPriceSimpleMarketplace = offerPrice }
  st6 = st5 { stateSimpleMarketplace = OfferPlacedSimpleMarketplace }
  st7 = st6 -- assert statement
  st8 = st7 -- assert statement
  st9 = st8 -- assert statement
    in
      st9

{-@ reject :: {st:SimpleMarketplaceState | (((stateSimpleMarketplace st)) == (OfferPlacedSimpleMarketplace)) && (((instanceOwnerSimpleMarketplace st)) == ((sender (msgSimpleMarketplace st))))} -> {v:SimpleMarketplaceState | (((stateSimpleMarketplace v)) == (ItemAvailableSimpleMarketplace)) && (((instanceBuyerSimpleMarketplace v)) == (0x0000000000000000000000000000000000000000))} @-}
reject :: SimpleMarketplaceState -> SimpleMarketplaceState
reject st = let
  st1 = if ((stateSimpleMarketplace st) == OfferPlacedSimpleMarketplace) then st else revert "error"
  st2 = if ((instanceOwnerSimpleMarketplace st1) == (sender (msgSimpleMarketplace st1))) then st1 else revert "error"
  st3 = st2 { instanceBuyerSimpleMarketplace = 0x0000000000000000000000000000000000000000 }
  st4 = st3 { stateSimpleMarketplace = ItemAvailableSimpleMarketplace }
  st5 = st4 -- assert statement
  st6 = st5 -- assert statement
    in
      st6

{-@ acceptOffer :: {st:SimpleMarketplaceState | (((sender (msgSimpleMarketplace st))) == ((instanceOwnerSimpleMarketplace st)))} -> {v:SimpleMarketplaceState | (((stateSimpleMarketplace v)) == (AcceptedSimpleMarketplace))} @-}
acceptOffer :: SimpleMarketplaceState -> SimpleMarketplaceState
acceptOffer st = let
  st1 = if ((sender (msgSimpleMarketplace st)) == (instanceOwnerSimpleMarketplace st)) then st else revert "error"
  st2 = st1 { stateSimpleMarketplace = AcceptedSimpleMarketplace }
  st3 = st2 -- assert statement
    in
      st3

