/**
 * @file mapDefinitions.js
 * @description Embeds the Map / MapWithBalance Liquid Haskell library (adapted from
 * Map.hs and MapWithBalance.hs) so the generated Haskell module can represent
 * Solidity `mapping(KeyType => uint)` state variables as a `BalancedMap KeyType`.
 *
 * This is the extension proposed as future work in the thesis this tool
 * builds on (Consoli, 2025): mappings are modeled with a Map structure whose
 * operations (get/set) come with Liquid Haskell refinements, and a running
 * total (`mBal`) that is kept in sync with the sum of all values (`sumBids`),
 * so that functions like `require(balances[msg.sender] >= amount)` and
 * `balances[to] += amount` can be verified the same way scalar balances
 * already are in this tool. The thesis' hand-written bank examples follow
 * this same pattern.
 *
 * Only ONE map value type is supported for now: non-negative Int (i.e.
 * Solidity's `uint`), which covers the overwhelming majority of real-world
 * mappings such as `mapping(address => uint) balances`. Nested mappings,
 * mappings to structs/enums, and mappings used as function parameters are out
 * of scope (same spirit as the thesis explicitly leaving arrays/events out of
 * scope).
 *
 * This module uses `Int` (not `Integer`) as the map's value type, matching
 * `Uint`/`Amount`/`Address` from typeMappings.js (all `type ... = Int`) and
 * matching the original, already-proven MapWithBalance.hs exactly. Using
 * `Integer` here breaks Liquid Haskell's PLE proof of `lemma_sumBids_nonneg`
 * (GHC's `Integer` is backed by ghc-bignum's real data constructors, which
 * interacts badly with PLE's unfolding for this proof), so `Int` is required,
 * not just a style choice.
 */

const MAP_DEFINITION = `
-- ============================================================
-- Map / MapWithBalance: support for mapping(KeyType => uint)
-- ============================================================
-- A Solidity mapping is translated as a BalancedMap KeyType. Reading a
-- missing key gives 0 (currentBalance), as in Solidity, and set/get on the
-- map automatically keep the invariant mBal == sumBids (mMap m).

{-@ reflect notIn @-}
notIn :: Eq k => k -> [(k, v)]  -> Bool
notIn _ ([]) = True
notIn x ((x', _) :xs) = x /= x' && notIn x xs

{-@ reflect isUniq @-}
isUniq :: (Eq k) => [(k, v)] -> Bool
isUniq ([]) = True
isUniq ((x, _) :xs) = notIn x xs && isUniq xs

{-@ type Map k v =  {m : [(k,v)] | isUniq m} @-}
type Map k v = [(k , v)]

{-@ measure keys @-}
keys ::(Ord k) => [(k, v)] -> S.Set k
keys []  = S.empty
keys ((x, _) : xs) =  S.singleton x \`S.union\` keys xs

{-@ measure toSet @-}
toSet::(Ord t) => [t] -> S.Set t
toSet []  = S.empty
toSet (x : xs) =  S.singleton x \`S.union\` toSet xs

{-@ reflect emp @-}
{-@ emp ::  {m: Map k v | Set_emp (toSet m) && Set_emp (keys m)} @-}
emp :: Map k v
emp = []

{-@reflect assert @-}
assert :: a -> b -> b
assert _ x = x

{-@ reflect add @-}
{-@ add :: m: Map k v -> key: {k | not (Set_mem key (keys m))} -> value : v ->
            {n : Map k v | keys n  == S.union (Set_sng key) (keys m)
                      && toSet n == S.union (S.singleton (key,value)) (toSet m)
                      && get n key == value
            }
@-}
add :: Eq k =>  Map k v -> k -> v -> Map k v
add ps key value = assert (lemma_mem ps key) $ (key, value) : ps

{-@ reflect lemma_mem @-}
{-@ lemma_mem ::  m : Map k v -> key : { k | not (Set_mem key (keys m))} ->  {v : Bool | notIn key m} @-}
lemma_mem :: Eq k => Map k v -> k -> Bool
lemma_mem [] _ = True
lemma_mem m@((x, _) : xs) k =  assert (lemma_mem2 m k) $ assert (lemma_mem3 m) $ x /= k && lemma_mem xs k

{-@ reflect lemma_mem2 @-}
{-@ lemma_mem2 ::  {m : Map k v | len m > 0} -> key : { k | not (Set_mem key (keys m))} ->  {v : Bool | not (Set_mem key (keys (tail m)))} @-}
lemma_mem2 :: Eq k => Map k v -> k -> Bool
lemma_mem2 [_] _ = True
lemma_mem2 (_ : xs ) k = lemma_mem2 xs k
lemma_mem2 [] _ = True  -- impossible case, only here to satisfy GHC

{-@ reflect lemma_mem3 @-}
{-@ lemma_mem3 ::  {m : Map k v | len m > 0} ->  {v : Bool | isUniq (tail m)} @-}
lemma_mem3 :: Eq k => Map k v -> Bool
lemma_mem3 [_] = True
lemma_mem3 (_ : xs )= lemma_mem3 xs
lemma_mem3 [] = True  -- impossible case, only here to satisfy GHC

{-@reflect get @-}
{-@ get :: (Eq k) => m : Map k v ->  key : {k | Set_mem key (keys m)}  ->
        {r :  v | Set_mem (key, r)(toSet m)}
@-}
get :: (Eq k) => Map k v -> k ->  v
get ((k, v) : xs) k'
  | k == k' = v
  | otherwise = get xs k'

{-@ reflect remove @-}
{-@ remove :: m: Map k v -> key: {k | Set_mem key (keys m)} ->
            {n : Map k v |  (keys n == Set_dif (keys m) (Set_sng key))
                        &&  toSet m = Set_cup (toSet n) (Set_sng (key, get m key))
                        &&  Set_dif (toSet m) (toSet n) = Set_sng (key, get m key)
            }
@-}
remove :: (Ord k) =>  Map k v -> k -> Map k v
remove [] _ = []
remove m@((k, v) : xs) k'
  | k == k' = assert (lemma_not_mem_tail m k) $
              assert (lemma_not_mem_not_dif xs k k') $
              assert (lemma_notIn_same_set xs k v) $
              xs
  | otherwise =
    assert (lemma_not_mem xs k' k) $
    assert (lemma_not_mem2 (remove xs k') k' k) $
    (k,v) : remove xs k'

{-@ reflect lemma_notIn_not_mem_keys @-}
{-@ lemma_notIn_not_mem_keys :: m : Map k v -> key : {k | notIn key m} -> {v : Bool | not (Set_mem key (keys m)) } @-}
lemma_notIn_not_mem_keys :: Eq k => Map k v -> k -> Bool
lemma_notIn_not_mem_keys [] _ = True
lemma_notIn_not_mem_keys (_:xs) k =  lemma_notIn_not_mem_keys xs k

{-@ reflect lemma_notIn_same_set @-}
{-@ lemma_notIn_same_set :: m : Map k v -> key : {k | notIn key m} -> value : v
      -> {r : Bool | toSet m == Set_dif (toSet m) (Set_sng (key, value)) } @-}
lemma_notIn_same_set :: Eq k => Map k v -> k -> v -> Bool
lemma_notIn_same_set [] _ _  = True
lemma_notIn_same_set (_:xs) k v =  lemma_notIn_same_set xs k v

{-@ reflect lemma_not_mem_tail @-}
{-@ lemma_not_mem_tail :: {m : Map k v | len m > 0 } -> key : {k | key = fst (head m)}
        -> {v : Bool | not (Set_mem key (keys (tail m))) }@-}
lemma_not_mem_tail :: Eq k => Map k v -> k -> Bool
lemma_not_mem_tail [_] _ = True
lemma_not_mem_tail ((x,_) : xs) k | x == k = lemma_notIn_not_mem_keys xs k
                                  | otherwise = False

{-@ reflect lemma_not_mem_not_dif @-}
{-@ lemma_not_mem_not_dif :: m : Map k v -> key : {k | not (Set_mem key (keys m))}  -> key' : {k | key = key'}
      -> {v : Bool | not (Set_mem key (Set_dif (keys m) (Set_sng key))) }@-}
lemma_not_mem_not_dif :: Map k v -> k -> k -> Bool
lemma_not_mem_not_dif [] _ _ = True
lemma_not_mem_not_dif (_ : xs) k k' = lemma_not_mem_not_dif xs k k'

{-@ reflect lemma_set_dif @-}
{-@ lemma_set_dif :: s : S.Set k  -> s' : S.Set k -> e : {k | not (Set_mem e s)} -> {v : Bool | not (Set_mem e (Set_dif s s'))} @-}
lemma_set_dif :: S.Set k  -> S.Set k -> k -> Bool
lemma_set_dif _ _ _ = True

{-@ reflect lemma_not_mem @-}
{-@ lemma_not_mem :: m : Map k v ->  key' : k -> key: {k | notIn key m } -> {v : Bool | not (Set_mem key (Set_dif (keys m) (Set_sng key')))} @-}
lemma_not_mem :: Eq k =>  Map k v  -> k -> k -> Bool
lemma_not_mem [] _ _  = True
lemma_not_mem (_ : xs) k' k = lemma_not_mem xs k' k

{-@ reflect lemma_not_mem2 @-}
{-@ lemma_not_mem2 :: m : Map k v -> key' : k -> key : { k | key' /= key && not (Set_mem key (Set_dif (keys m) (Set_sng key')))} -> {v : Bool | notIn key m} @-}
lemma_not_mem2 :: Ord k => Map k v ->  k -> k ->  Bool
lemma_not_mem2 [] _ _  = True
lemma_not_mem2 m@((_, _) : xs) k' k  =
    assert (lemma_set_dif (keys m) (S.singleton k') k) $
    assert (lemma_not_mem3 xs k) $ lemma_not_mem2 xs k' k

{-@ reflect lemma_not_mem3 @-}
{-@ lemma_not_mem3 :: m : Map k v -> key : { k | not (Set_mem key (keys m))} -> {v : Bool | notIn key m} @-}
lemma_not_mem3 :: Eq k => Map k v -> k ->  Bool
lemma_not_mem3 [] _   = True
lemma_not_mem3 (_ : xs) k = lemma_not_mem3 xs k

{-@ reflect lemma_key_notin_toSet @-}
{-@ lemma_key_notin_toSet :: m : Map k v -> key : {k | not (Set_mem key (keys m))} -> value : v
      -> {b : Bool | not (Set_mem (key, value) (toSet m))} @-}
lemma_key_notin_toSet :: Eq k => Map k v -> k -> v -> Bool
lemma_key_notin_toSet [] _ _ = True
lemma_key_notin_toSet (_ : xs) k v = lemma_key_notin_toSet xs k v

-- Assumed set lemma: if x is not in s, then ({x} cup s) \\ {x} = s.
{-@ reflect lemma_dif_cup_self @-}
{-@ assume lemma_dif_cup_self :: s : S.Set t -> x : {t | not (Set_mem x s)}
      -> {b : Bool | Set_dif (Set_cup (Set_sng x) s) (Set_sng x) == s} @-}
lemma_dif_cup_self :: S.Set t -> t -> Bool
lemma_dif_cup_self _ _ = True

-- Assumed set lemma: (s cup t) \\ u = (s \\ u) cup (t \\ u).
{-@ reflect lemma_set_dist_r_dif_union @-}
{-@ assume lemma_set_dist_r_dif_union :: s: S.Set k -> t : S.Set k -> u: S.Set k -> {v : Bool | Set_dif (Set_cup s t) u == Set_cup (Set_dif s u)  (Set_dif t u) } @-}
lemma_set_dist_r_dif_union :: S.Set k  -> S.Set k -> S.Set k ->  Bool
lemma_set_dist_r_dif_union _ _ _ = True

{-@ reflect sumBids @-}
sumBids ::  Map k Int -> Int
sumBids [] = 0
sumBids ((_, x) : xs) = x + sumBids xs

{-@ reflect lemma_get_add_other @-}
{-@ lemma_get_add_other :: m:Map k v -> key:{k | not (Set_mem key (keys m))} -> value:v
      -> key':{k | key' /= key && Set_mem key' (keys m)}
      -> {b:Bool | get (add m key value) key' == get m key'} @-}
lemma_get_add_other :: Eq k => Map k v -> k -> v -> k -> Bool
lemma_get_add_other _ _ _ _ = True

{-@ reflect lemma_get_remove_other @-}
{-@ lemma_get_remove_other :: m:Map k v -> key:{k | Set_mem key (keys m)}
      -> key':{k | key' /= key && Set_mem key' (keys m)}
      -> {b:Bool | get (remove m key) key' == get m key'} @-}
lemma_get_remove_other :: Eq k => Map k v -> k -> k -> Bool
lemma_get_remove_other ((k,_):xs) key key'
  | k == key  = True
  | k == key' = True
  | otherwise = lemma_get_remove_other xs key key'

-- ------------------- MapWithBalance -------------------

{-@ data MapWithBalance k = MB {mMap :: (Map k {v : Int | InRange v}), mBal :: {v : Int | v >= 0}} @-}
data MapWithBalance k = MB {mMap :: (Map k Int), mBal :: Int }

{-@ type BalancedMap k = { m : MapWithBalance k | sumBids (mMap m) == mBal m} @-}
type BalancedMap k =  MapWithBalance k

{-@ reflect empWB @-}
{-@ empWB :: b :{ BalancedMap k | Set_emp (keys(mMap b)) && Set_emp (toSet (mMap b)) && mBal b == 0} @-}
empWB :: BalancedMap k
empWB = MB [] 0

{-@reflect getWB @-}
{-@ getWB :: (Eq k) => m : BalancedMap k -> key : {k | Set_mem key (keys (mMap m)) } ->
        {r : Int |  Set_mem (key, r) (toSet (mMap m)) && InRange r
                    }
@-}
getWB :: (Eq k) => BalancedMap k -> k -> Int
getWB (MB m _) k = get m k

{-@ predicate AddWB_pred N M Key V =
        keys (mMap N) == S.union (Set_sng Key) (keys (mMap M))
        && toSet (mMap N) == S.union (S.singleton (Key,V)) (toSet (mMap M))
        && mBal N == (mBal M) + V
        && sumBids (mMap N) = sumBids (mMap M) + V
        && get (mMap N) Key == V @-}

{-@ reflect lemma_balance_add @-}
{-@ lemma_balance_add :: m : Map k Int -> key : {k | not (Set_mem key (keys m))} -> value : Int
      -> {b : Bool | sumBids (add m key value) == value + sumBids m} @-}
lemma_balance_add :: Eq k => Map k Int -> k -> Int -> Bool
lemma_balance_add _ _ _ = True

{-@ reflect addWB @-}
{-@ addWB :: m: BalancedMap k -> key: {k | not (Set_mem key (keys (mMap m)))} -> value : {v : Int | InRange v} ->
            {n : BalancedMap k | AddWB_pred n m key value}
      @-}
addWB :: Eq k =>  BalancedMap k -> k -> Int -> BalancedMap k
addWB (MB xs b) key value =
    assert (lemma_balance_add xs key value) $ MB (add xs key value) (b + value)

{-@ reflect removeWB @-}
{-@ removeWB :: m: BalancedMap k -> key: {k | Set_mem key (keys (mMap m))} ->
            {n : BalancedMap k |  keys (mMap n) == Set_dif (keys (mMap m)) (Set_sng key)
                        && toSet (mMap m) = Set_cup (toSet (mMap n)) (Set_sng (key, getWB m key))
                        && Set_dif (toSet (mMap m)) (toSet (mMap n)) = Set_sng (key, getWB m key)
                        && mBal n = mBal m - getWB m key
            }
@-}
removeWB :: (Ord k) =>  BalancedMap k -> k -> BalancedMap k
removeWB (MB xs b) key =
    assert (lemma_balance_remove xs key) $ assert (lemma_sumBids_nonneg (remove xs key)) $ MB (remove xs key) (b - get xs key)

{-@ reflect lemma_balance_remove @-}
{-@ lemma_balance_remove :: m : Map k Int -> key : {k | Set_mem key (keys m)} ->
      {b : Bool | sumBids (remove m key) == sumBids m - get m key} @-}
lemma_balance_remove :: (Ord k) => Map k Int -> k -> Bool
lemma_balance_remove ((k, _) : xs) key
  | k == key  = True
  | otherwise = lemma_balance_remove xs key

{-@ reflect lemma_sumBids_nonneg @-}
{-@ lemma_sumBids_nonneg :: m : Map k {v:Int | v >= 0} -> {b:Bool | sumBids m >= 0} @-}
lemma_sumBids_nonneg :: Map k Int -> Bool
lemma_sumBids_nonneg [] = True
lemma_sumBids_nonneg ((_, _) : xs) = lemma_sumBids_nonneg xs

{-@ predicate SetWB_pred N M Key Val =
                  ((Set_mem Key (keys (mMap M))) =>
                    (keys (mMap N) == keys (mMap M) &&
                     mBal N == mBal M - get (mMap M) Key + Val &&
                     sumBids (mMap M) == sumBids (mMap N) - Val + get (mMap M) Key &&
                     toSet (mMap M) == Set_cup (Set_dif (toSet (mMap N)) (Set_sng (Key, Val))) (Set_sng (Key, get (mMap M) Key)) &&
                     toSet (mMap N) == Set_cup (Set_dif (toSet (mMap M)) (Set_sng (Key, get (mMap M) Key))) (Set_sng (Key, Val)) &&
                     get (mMap N) Key == Val
                      )) &&
                  ((not (Set_mem Key (keys (mMap M)))) =>
                    (keys (mMap N) == Set_cup (keys (mMap M)) (Set_sng Key) &&
                     mBal N == mBal M + Val &&
                     sumBids (mMap N) == sumBids (mMap M) + Val  &&
                     toSet (mMap N) == Set_cup (Set_sng (Key,Val)) (toSet (mMap M)) &&
                     get (mMap N) Key == Val
                      ))
@-}
{-@ reflect setWB @-}
{-@ setWB :: m:BalancedMap k -> key:k -> val:{Int | InRange val} ->
            {n : BalancedMap k | SetWB_pred n m key val}
@-}
setWB :: (Ord k) => BalancedMap k -> k -> Int -> BalancedMap k
setWB m key val
  | S.member key (keys (mMap m)) =
      assert (lemma_set_dist_r_dif_union (toSet (mMap m))
                                          (S.singleton (key, get (mMap m) key))
                                          (S.singleton (key, get (mMap m) key))) $
      assert (lemma_key_notin_toSet (mMap (removeWB m key)) key val) $
      assert (lemma_dif_cup_self (toSet (mMap (removeWB m key))) (key, val)) $
      addWB (removeWB m key) key val
  | otherwise = addWB m key val

{-@ reflect lemma_getWB_setWB_other @-}
{-@ lemma_getWB_setWB_other :: m:BalancedMap k -> key:k -> value:{Int | InRange value}
      -> key':{k | key' /= key && Set_mem key' (keys (mMap m))}
      -> {b:Bool | get (mMap (setWB m key value)) key' == get (mMap m) key'} @-}
lemma_getWB_setWB_other :: (Ord k) => BalancedMap k -> k -> Int -> k -> Bool
lemma_getWB_setWB_other (MB xs _) key value key'
  | S.member key (keys xs) =
      assert (lemma_get_remove_other xs key key') $
      assert (lemma_get_add_other (remove xs key) key value key') $
      True
  | otherwise =
      assert (lemma_get_add_other xs key value key') $
      True

-- ---- Read with default 0, as in Solidity: a missing key reads as 0 ----

{-@ reflect currentBalance @-}
{-@ currentBalance :: (Ord k) => m:BalancedMap k -> key:k -> {v:Int | InRange v} @-}
currentBalance :: (Ord k) => BalancedMap k -> k -> Int
currentBalance m key
  | S.member key (keys (mMap m)) = getWB m key
  | otherwise = 0

{-@ reflect lemma_currentBalance_get @-}
{-@ lemma_currentBalance_get :: m:BalancedMap k -> key:k ->
      {b:Bool | (Set_mem key (keys (mMap m)) => currentBalance m key == get (mMap m) key)
              && (not (Set_mem key (keys (mMap m))) => currentBalance m key == 0)}
@-}
lemma_currentBalance_get :: (Ord k) => BalancedMap k -> k -> Bool
lemma_currentBalance_get m key
  | S.member key (keys (mMap m)) = currentBalance m key == getWB m key
  | otherwise                    = currentBalance m key == 0

{-@ reflect lemma_currentBalance_setWB_other @-}
{-@ lemma_currentBalance_setWB_other :: m:BalancedMap k -> key:k -> value:{Int | InRange value}
      -> key':{k | key' /= key}
      -> {b:Bool | currentBalance (setWB m key value) key' == currentBalance m key'} @-}
lemma_currentBalance_setWB_other :: (Ord k) => BalancedMap k -> k -> Int -> k -> Bool
lemma_currentBalance_setWB_other m key value key'
  | S.member key' (keys (mMap m)) =
      assert (lemma_getWB_setWB_other m key value key') $
      assert (lemma_currentBalance_get m key') $
      currentBalance (setWB m key value) key' == currentBalance m key'
  | otherwise = currentBalance (setWB m key value) key' == currentBalance m key'

-- Every value of the map is <= the total sum (values are non-negative).
-- This is what proves that withdrawing balances[k] does not exceed the
-- contract's ether when the invariant mBal <= contract balance holds.
{-@ reflect lemma_get_le_sumBids @-}
{-@ lemma_get_le_sumBids :: m:Map k {v:Int | v >= 0} -> key:{k | Set_mem key (keys m)}
      -> {b:Bool | get m key <= sumBids m} @-}
lemma_get_le_sumBids :: Eq k => Map k Int -> k -> Bool
lemma_get_le_sumBids ((k, _) : xs) key
  | k == key  = lemma_sumBids_nonneg xs
  | otherwise = lemma_get_le_sumBids xs key
lemma_get_le_sumBids [] _ = True  -- impossible case, only here to satisfy GHC

{-@ reflect lemma_currentBalance_le_mBal @-}
{-@ lemma_currentBalance_le_mBal :: m:BalancedMap k -> key:k
      -> {b:Bool | currentBalance m key <= mBal m} @-}
lemma_currentBalance_le_mBal :: (Ord k) => BalancedMap k -> k -> Bool
lemma_currentBalance_le_mBal m key
  | S.member key (keys (mMap m)) =
      assert (lemma_currentBalance_get m key) $
      assert (lemma_get_le_sumBids (mMap m) key) $
      True
  | otherwise =
      assert (lemma_currentBalance_get m key) $
      assert (lemma_sumBids_nonneg (mMap m)) $
      True

-- Same as lemma_currentBalance_setWB_other but without requiring key' /= key:
-- the translator uses it for every key of the same mapping that the function
-- reads, without knowing whether they are equal.
{-@ reflect lemma_currentBalance_setWB_maybe_other @-}
{-@ lemma_currentBalance_setWB_maybe_other :: m:BalancedMap k -> key:k -> value:{Int | InRange value}
      -> key':k
      -> {b:Bool | key' /= key => currentBalance (setWB m key value) key' == currentBalance m key'} @-}
lemma_currentBalance_setWB_maybe_other :: (Ord k) => BalancedMap k -> k -> Int -> k -> Bool
lemma_currentBalance_setWB_maybe_other m key value key'
  | key' /= key = lemma_currentBalance_setWB_other m key value key'
  | otherwise = True
`;

module.exports = {
  MAP_DEFINITION
};
