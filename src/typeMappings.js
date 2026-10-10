/**
 * @file typeMappings.js
 * @description Provides functions for mapping Solidity types to Haskell types.
 */

/**
 * Maps a Solidity TypeName node to an approximate Haskell type.
 * 
 * @function solidityTypeToHaskellType
 * @param {Object} typeNode - The AST node representing a Solidity type.
 * @param {string} [contractName=''] - The name of the contract (used for user-defined types).
 * @returns {string} The corresponding Haskell type as a string. Defaults to 'UnknownType' if no mapping is found.
 * 
 * @example
 * // For a node representing 'uint256', it returns 'Integer'.
 * // For a node representing 'bool', it returns 'Bool'.
 * // For a node representing 'string', it returns 'String'.
 */
function solidityTypeToHaskellType(typeNode, contractName='') {
  if (!typeNode) return 'UnknownType';

  switch (typeNode.type) {
    case 'ElementaryTypeName': {
      // Examples include 'uint256', 'bool', 'string', etc.
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
      // For user-defined types (e.g., enums), return the type name directly.
      return typeNode.namePath ? typeNode.namePath + contractName  : 'UnknownType';
    }
    default:
      return 'UnknownType';
  }
}

/**
 * A predefined Haskell `Message` data type and an `Address` type alias for use in generated code.
 * 
 * @constant MSG_DEFINITION
 * @type {string}
 * @example
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
  number :: Uint}

{-@ data Block = Block {
  number :: Uint}
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

{-@ checkU :: {v:Int | InRange v} -> Uint @-}
checkU :: Int -> Int
checkU x = x

{-@ assume addEther :: a:Uint -> b:Uint -> {v:Uint | v == a + b} @-}
addEther :: Int -> Int -> Int
addEther a b = a + b
`;

/**
 * Shared prelude (Message, Block, numeric types) for the generated module.
 */
function msgDefinition(checkOverflow = false) {
  return [
    MSG_DEFINITION,
    uintRangePredicate(checkOverflow),
    checkOverflow ? OVERFLOW_DEFINITIONS : '',
  ].join('\n');
}

module.exports = {
  solidityTypeToHaskellType,
  msgDefinition,
  MSG_DEFINITION
};