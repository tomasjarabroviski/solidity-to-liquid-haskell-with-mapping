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

{-@ type Uint = {v: Int | v >= 0} @-}
type Uint = Int

type Address = Int
{-@ type Address = Int @-}

{-@ inline maxValue @-}
maxValue :: Int
maxValue = 10

{-@ safeSum :: x:{v:Int | v >= 0 && v < maxValue}
            -> y:{v:Int | v >= 0 && v < maxValue - x}
            ->   {v:Int | v >= 0 && v < maxValue} @-}
safeSum :: Int -> Int -> Int
safeSum x y = x + y`;

module.exports = {
  solidityTypeToHaskellType,
  MSG_DEFINITION
};