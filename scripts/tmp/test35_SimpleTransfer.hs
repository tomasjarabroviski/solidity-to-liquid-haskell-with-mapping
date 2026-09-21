{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module SimpleTransfer where

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


{-@ callSimpleTransfer :: ctx:SimpleTransferState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceSimpleTransfer ctx}
           -> ctx':{ SimpleTransferState | balanceSimpleTransfer ctx' == balanceSimpleTransfer ctx - amount  && (msgSimpleTransfer ctx' == msgSimpleTransfer ctx) && (blockSimpleTransfer ctx' == blockSimpleTransfer ctx) && (addressSimpleTransfer ctx' == addressSimpleTransfer ctx) && (recipientSimpleTransfer ctx' == recipientSimpleTransfer ctx) && (ownerSimpleTransfer ctx' == ownerSimpleTransfer ctx)}
@-}
callSimpleTransfer:: SimpleTransferState -> Address -> Amount -> SimpleTransferState
callSimpleTransfer ctx _addr amount = ctx { balanceSimpleTransfer = balanceSimpleTransfer ctx - amount }


{-@ data SimpleTransferState = SimpleTransferState {
  msgSimpleTransfer :: Message,
  blockSimpleTransfer :: Block,
  balanceSimpleTransfer :: Amount,
  addressSimpleTransfer :: Address,
  recipientSimpleTransfer :: Address,
  ownerSimpleTransfer :: Address
}
@-} 

data SimpleTransferState = SimpleTransferState {
  msgSimpleTransfer :: Message,
  blockSimpleTransfer :: Block,
  balanceSimpleTransfer :: Amount,
  addressSimpleTransfer :: Address,
  recipientSimpleTransfer :: Address,
  ownerSimpleTransfer :: Address
}

{-@ constructorSimpleTransfer :: Message -> Block  -> {_recipient:Address | True} -> {v:SimpleTransferState | True} @-}
constructorSimpleTransfer :: Message -> Block -> Address -> SimpleTransferState
constructorSimpleTransfer msgctx block _recipient = SimpleTransferState
            { msgSimpleTransfer = msgctx,
              blockSimpleTransfer = block,
              balanceSimpleTransfer = 0,
              addressSimpleTransfer = fromString "SimpleTransfer",
              recipientSimpleTransfer = _recipient,
              ownerSimpleTransfer = sender msgctx
            }

{-@ deposit :: {st:SimpleTransferState | (((sender (msgSimpleTransfer st))) == ((ownerSimpleTransfer st)))} -> {v:SimpleTransferState | True} @-}
deposit :: SimpleTransferState -> SimpleTransferState
deposit st = let
  st1 = if ((sender (msgSimpleTransfer st)) == (ownerSimpleTransfer st)) then st else revert "error"
    in
      st1

{-@ withdraw :: {st:SimpleTransferState | (((sender (msgSimpleTransfer st))) == ((recipientSimpleTransfer st)))} -> {amount:Uint | ((amount) <= ((balanceSimpleTransfer st)))} -> {v:SimpleTransferState | True} @-}
withdraw :: SimpleTransferState -> Uint -> SimpleTransferState
withdraw st amount = let
  st1 = if ((sender (msgSimpleTransfer st)) == (recipientSimpleTransfer st)) then st else revert "error"
  st2 = if (amount <= (balanceSimpleTransfer st1)) then st1 else revert "error"
  st3 = callSimpleTransfer st2 ((recipientSimpleTransfer st2)) (amount)
  st4 = st3 -- skipped require statement
    in
      st4

