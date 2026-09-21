{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module HelloBlockchain where

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


{-@ callHelloBlockchain :: ctx:HelloBlockchainState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceHelloBlockchain ctx}
           -> ctx':{ HelloBlockchainState | balanceHelloBlockchain ctx' == balanceHelloBlockchain ctx - amount  && (msgHelloBlockchain ctx' == msgHelloBlockchain ctx) && (blockHelloBlockchain ctx' == blockHelloBlockchain ctx) && (addressHelloBlockchain ctx' == addressHelloBlockchain ctx) && (stateHelloBlockchain ctx' == stateHelloBlockchain ctx) && (requestorHelloBlockchain ctx' == requestorHelloBlockchain ctx) && (requestMessageHelloBlockchain ctx' == requestMessageHelloBlockchain ctx)}
@-}
callHelloBlockchain:: HelloBlockchainState -> Address -> Amount -> HelloBlockchainState
callHelloBlockchain ctx _addr amount = ctx { balanceHelloBlockchain = balanceHelloBlockchain ctx - amount }

data StateTypeHelloBlockchain = RequestHelloBlockchain | RespondHelloBlockchain deriving (Show, Eq)

{-@ data HelloBlockchainState = HelloBlockchainState {
  msgHelloBlockchain :: Message,
  blockHelloBlockchain :: Block,
  balanceHelloBlockchain :: Amount,
  addressHelloBlockchain :: Address,
  stateHelloBlockchain :: StateTypeHelloBlockchain,
  requestorHelloBlockchain :: Address,
  requestMessageHelloBlockchain :: String
}
@-} 

data HelloBlockchainState = HelloBlockchainState {
  msgHelloBlockchain :: Message,
  blockHelloBlockchain :: Block,
  balanceHelloBlockchain :: Amount,
  addressHelloBlockchain :: Address,
  stateHelloBlockchain :: StateTypeHelloBlockchain,
  requestorHelloBlockchain :: Address,
  requestMessageHelloBlockchain :: String
}

{-@ constructorHelloBlockchain :: Message -> Block  -> {message:String | True} -> {v:HelloBlockchainState | True} @-}
constructorHelloBlockchain :: Message -> Block -> String -> HelloBlockchainState
constructorHelloBlockchain msgctx block message = HelloBlockchainState
            { msgHelloBlockchain = msgctx,
              blockHelloBlockchain = block,
              balanceHelloBlockchain = 0,
              addressHelloBlockchain = fromString "HelloBlockchain",
              requestorHelloBlockchain = sender msgctx,
              requestMessageHelloBlockchain = message,
              stateHelloBlockchain = RequestHelloBlockchain
            }

{-@ sendRequest :: {st:HelloBlockchainState | True} -> {xxx:String | True} -> {yyy:String | True} -> {v:HelloBlockchainState | True} @-}
sendRequest :: HelloBlockchainState -> String -> String -> HelloBlockchainState
sendRequest st xxx yyy = let
  st1 = if False
    then
    let
      st1 = st { requestMessageHelloBlockchain = xxx }
        in
          st1
    else
    let
      st1 = st { requestMessageHelloBlockchain = yyy }
        in
          st1
  st2 = st1 { stateHelloBlockchain = RequestHelloBlockchain }
    in
      st2

