{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}

module Bet where

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


{-@ callBet :: ctx:BetState
           -> Address
           -> amount: {Amount | 0 <= amount && amount <= balanceBet ctx}
           -> ctx':{ BetState | balanceBet ctx' == balanceBet ctx - amount  && (msgBet ctx' == msgBet ctx) && (blockBet ctx' == blockBet ctx) && (addressBet ctx' == addressBet ctx) && (player1Bet ctx' == player1Bet ctx) && (player2Bet ctx' == player2Bet ctx) && (deadlineBet ctx' == deadlineBet ctx) && (oracleBet ctx' == oracleBet ctx) && (wagerBet ctx' == wagerBet ctx) && (openBet ctx' == openBet ctx)}
@-}
callBet:: BetState -> Address -> Amount -> BetState
callBet ctx _addr amount = ctx { balanceBet = balanceBet ctx - amount }


{-@ data BetState = BetState {
  msgBet :: Message,
  blockBet :: Block,
  balanceBet :: Amount,
  addressBet :: Address,
  player1Bet :: Address,
  player2Bet :: Address,
  deadlineBet :: Uint,
  oracleBet :: Address,
  wagerBet :: Uint,
  openBet :: Bool
}
@-} 

data BetState = BetState {
  msgBet :: Message,
  blockBet :: Block,
  balanceBet :: Amount,
  addressBet :: Address,
  player1Bet :: Address,
  player2Bet :: Address,
  deadlineBet :: Uint,
  oracleBet :: Address,
  wagerBet :: Uint,
  openBet :: Bool
}

{-@ constructorBet :: Message -> Block  -> {_oracle:Address | True} -> {_player2:Address | True} -> {_timeout:Uint | True} -> {v:BetState | True} @-}
constructorBet :: Message -> Block -> Address -> Address -> Uint -> BetState
constructorBet msgctx block _oracle _player2 _timeout = BetState
            { msgBet = msgctx,
              blockBet = block,
              balanceBet = 0,
              addressBet = fromString "Bet",
              wagerBet = value msgctx,
              oracleBet = _oracle,
              player1Bet = (sender msgctx),
              player2Bet = _player2,
              deadlineBet = ((number block) + _timeout),
              openBet = True
            }

{-@ join :: {st:BetState | (((value (msgBet st))) == ((wagerBet st))) && (((player2Bet st)) == ((sender (msgBet st)))) && (openBet st) && (((deadlineBet st)) >= ((number (blockBet st))))} -> {v:BetState | True} @-}
join :: BetState -> BetState
join st = let
  st1 = if ((value (msgBet st)) == (wagerBet st)) then st else revert "error"
  st2 = if ((player2Bet st1) == (sender (msgBet st1))) then st1 else revert "error"
  st3 = if (openBet st2) then st2 else revert "error"
  st4 = if ((deadlineBet st3) >= (number (blockBet st3))) then st3 else revert "error"
  st5 = st4 { openBet = False }
    in
      st5

{-@ win :: {st:BetState | (((sender (msgBet st))) == ((oracleBet st))) && (((balanceBet st)) == ((2 * (wagerBet st))))} -> {winner:Uint | ((winner) <= (1))} -> {v:BetState | True} @-}
win :: BetState -> Uint -> BetState
win st winner = let
  st1 = if ((sender (msgBet st)) == (oracleBet st)) then st else revert "error"
  st2 = if (winner <= 1) then st1 else revert "error"
  st3 = if ((balanceBet st2) == (2 * (wagerBet st2))) then st2 else revert "error"
  addressWinner = if (winner == 0) then (player1Bet st) else (player2Bet st)
  st4 = callBet st3 (addressWinner) (balanceBet st3)
  st5 = st4 -- skipped require statement
    in
      st5

{-@ timeout :: {st:BetState | (((deadlineBet st)) < ((number (blockBet st)))) && (((balanceBet st)) == ((2 * (wagerBet st))))} -> {v:BetState | True} @-}
timeout :: BetState -> BetState
timeout st = let
  st1 = if ((deadlineBet st) < (number (blockBet st))) then st else revert "error"
  st2 = if ((balanceBet st1) == (2 * (wagerBet st1))) then st1 else revert "error"
  st3 = callBet st2 ((player1Bet st2)) ((wagerBet st2))
  st4 = st3 -- skipped require statement
  st5 = callBet st4 ((player2Bet st4)) ((wagerBet st4))
  st6 = st5 -- skipped require statement
    in
      st6

{-@ timeout_wrong :: {st:BetState | (((deadlineBet st)) < ((number (blockBet st)))) && (((balanceBet st)) == ((2 * (wagerBet st))))} -> {v:BetState | True} @-}
timeout_wrong :: BetState -> BetState
timeout_wrong st = let
  st1 = if ((deadlineBet st) < (number (blockBet st))) then st else revert "error"
  st2 = if ((balanceBet st1) == (2 * (wagerBet st1))) then st1 else revert "error"
  st3 = callBet st2 ((player1Bet st2)) ((wagerBet st2))
  st4 = st3 -- skipped require statement
  st5 = callBet st4 ((player2Bet st4)) ((wagerBet st4))
  st6 = st5 -- skipped require statement
  st7 = callBet st6 ((player2Bet st6)) ((wagerBet st6))
  st8 = st7 -- skipped require statement
    in
      st8

