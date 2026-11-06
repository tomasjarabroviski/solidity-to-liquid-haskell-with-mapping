const { MAP_DEFINITION } = require('../src/mapDefinitions');

describe('mapDefinitions', () => {
  test('exports a non-empty Haskell BalancedMap definition', () => {
    expect(typeof MAP_DEFINITION).toBe('string');
    expect(MAP_DEFINITION.length).toBeGreaterThan(0);
  });

  test('defines the core BalancedMap operations used by the rest of the converter', () => {
    // These are the exact names that generateFunctions.js/translator.js
    // splice into the generated Haskell code (empWB, setWB, currentBalance,
    // etc.). If any of them is renamed here without updating those other
    // files, the generated Haskell stops compiling.
    ['empWB', 'getWB', 'setWB', 'addWB', 'removeWB', 'currentBalance', 'BalancedMap']
      .forEach(name => {
        expect(MAP_DEFINITION).toContain(name);
      });
  });

  test('keeps BalancedMap on Int (not Integer), as required by the PLE proof', () => {
    // See the comment at the top of mapDefinitions.js: using Integer here
    // breaks the lemma_sumBids_nonneg proof.
    expect(MAP_DEFINITION).toContain('data MapWithBalance k = MB {mMap :: (Map k Int), mBal :: Int }');
  });
});
