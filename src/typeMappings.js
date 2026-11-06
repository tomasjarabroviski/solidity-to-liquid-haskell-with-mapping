/**
 * @file typeMappings.js
 * @description Maps Solidity types to Haskell types, and defines the shared
 *   prelude of every generated module: the `Message` and `Block` records, the
 *   numeric types (`Uint`, `Amount`, `Address`) and, in overflow mode, the
 *   wrapping arithmetic helpers.
 */

/**
 * Maps a Solidity TypeName node to a Haskell type.
 *
 * @function solidityTypeToHaskellType
 * @param {Object} typeNode - The AST node representing a Solidity type.
 * @param {string} [contractName=''] - The name of the contract (suffix of user-defined types).
 * @returns {string} The corresponding Haskell type: 'UnknownType' (or
 *   'UnknownType_<name>' for an unsupported elementary type) if there is none.
 *
 * @example
 * // uint256 -> 'Uint', int8 -> 'Integer', bool -> 'Bool',
 * // string -> 'String', address -> 'Address', enum E in contract C -> 'EC'.
 */
function solidityTypeToHaskellType(typeNode, contractName = '') {
  if (!typeNode) return 'UnknownType';

  switch (typeNode.type) {
    case 'ElementaryTypeName': {
      const name = typeNode.name;
      if (name.startsWith('uint')) {
        return 'Uint';
      } else if (name.startsWith('int')) {
        return 'Integer';
      } else if (name === 'bool') {
        return 'Bool';
      } else if (name === 'string') {
        return 'String';
      } else if (name === 'address') {
        return 'Address';
      }
      return `UnknownType_${name}`;
    }
    case 'UserDefinedTypeName': {
      // Enums (and other user-defined types) are suffixed with the contract name.
      return typeNode.namePath ? typeNode.namePath + contractName : 'UnknownType';
    }
    default:
      return 'UnknownType';
  }
}

/**
 * Shared Haskell definitions of every generated module:
 *  - `fromString`: a deterministic, non-negative hash of a string, used as
 *    the address of a contract.
 *  - `Message` (msg.sender, msg.value) and `Block` (block.number,
 *    block.timestamp).
 *  - The numeric types: `Uint` (a value within the uint range, InRange), `Amount` (an
 *    ether amount, >= 0) and `Address`.
 *
 * @constant MSG_DEFINITION
 * @type {string}
 */
const MSG_DEFINITION = `import Data.Char (ord)

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
  number :: Uint,
  timestamp :: Uint}

{-@ data Block = Block {
  number :: Uint,
  timestamp :: {v:Int | TimeRange v}}
@-}

{-@ type Amount = {v: Int | v >= 0} @-}
type Amount = Int

{-@ type Uint = {v: Int | InRange v} @-}
type Uint = Int

type Address = Int
{-@ type Address = Int @-}`;

// 2^256 - 1 and 2^256. They only appear inside refinements, where literals
// are mathematical integers (a Haskell Int literal this big would wrap).
const MAX_UINT = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
const UINT_MODULUS = '115792089237316195423570985008687907853269984665640564039457584007913129639936';
const TIMESTAMP_BOUND = '18446744073709551616'; // 2^64

/**
 * Range of a Solidity uint. Without overflow checking only the lower bound is
 * modeled (the original behavior): uint is an unbounded natural number.
 */
function uintRangePredicate(checkOverflow) {
  return checkOverflow
    ? `{-@ predicate InRange V = 0 <= V && V <= ${MAX_UINT} @-}`
    : `{-@ predicate InRange V = V >= 0 @-}`;
}

/**
 * Range of block.timestamp / now. With overflow checking it is ASSUMED to be
 * below 2^64 seconds (~5.8e11 years): otherwise `now + 1 weeks` could
 * "overflow" and every time-based contract would be reported UNSAFE.
 */
function timeRangePredicate(checkOverflow) {
  return checkOverflow
    ? `{-@ predicate TimeRange V = 0 <= V && V < ${TIMESTAMP_BOUND} @-}`
    : `{-@ predicate TimeRange V = V >= 0 @-}`;
}

/**
 * Helpers used only when overflow checking is on:
 *  - addU/subU/mulU: wrapping (mod 2^256) uint arithmetic, as in
 *    Solidity < 0.8. Used for require/if/assert conditions, so that guards
 *    like \`require(a + b >= a)\` or \`require(a - b >= 0)\` mean what they
 *    mean on-chain. Their logic counterparts (addUL/...) are uninterpreted
 *    so they can appear in the generated preconditions.
 *  - checkU: a uint local variable must hold a value in range.
 *  - addEther: \`x += msg.value\`. ASSUMPTION: crediting received ether can't
 *    overflow, since all the ether in existence is far below 2^256 (SmartBugs
 *    doesn't label these lines as vulnerable either).
 * Stored values (state fields, mapping values) are checked by the Uint
 * refinement itself, so plain +, -, * there must stay in range.
 */
const OVERFLOW_DEFINITIONS = `
{-@ measure addUL :: Int -> Int -> Int @-}
{-@ measure subUL :: Int -> Int -> Int @-}
{-@ measure mulUL :: Int -> Int -> Int @-}

{-@ assume addU :: a:Uint -> b:Uint -> {v:Uint | v == addUL a b && v == (if a + b <= ${MAX_UINT} then a + b else a + b - ${UINT_MODULUS})} @-}
addU :: Int -> Int -> Int
addU a b = a + b

{-@ assume subU :: a:Uint -> b:Uint -> {v:Uint | v == subUL a b && v == (if b <= a then a - b else a - b + ${UINT_MODULUS})} @-}
subU :: Int -> Int -> Int
subU a b = a - b

{-@ assume mulU :: a:Uint -> b:Uint -> {v:Uint | v == mulUL a b && (a * b <= ${MAX_UINT} => v == a * b)} @-}
mulU :: Int -> Int -> Int
mulU a b = a * b

{-@ checkU :: x:{v:Int | InRange v} -> {v:Uint | v == x} @-}
checkU :: Int -> Int
checkU x = x

{-@ assume addEther :: a:Uint -> b:Uint -> {v:Uint | v == a + b} @-}
addEther :: Int -> Int -> Int
addEther a b = a + b
`;

/**
 * Shared prelude of the generated module: MSG_DEFINITION plus the range
 * predicates and, in overflow mode, the overflow helpers.
 *
 * @function msgDefinition
 * @param {boolean} [checkOverflow=false] - Whether overflow checking is on.
 * @returns {string} The Haskell definitions.
 */
function msgDefinition(checkOverflow = false) {
  return [
    MSG_DEFINITION,
    uintRangePredicate(checkOverflow),
    timeRangePredicate(checkOverflow),
    checkOverflow ? OVERFLOW_DEFINITIONS : '',
  ].join('\n');
}

module.exports = {
  solidityTypeToHaskellType,
  msgDefinition,
  MSG_DEFINITION
};