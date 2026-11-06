# Solidity to Liquid Haskell Translator

A tool that translates Solidity smart contracts to Liquid Haskell code, preserving the contract's logic while adding formal verification capabilities through Liquid Haskell's refinement types.

## Features

- Converts Solidity contracts to Liquid Haskell code
- Preserves contract state and functions
- Handles enums, state variables, and function parameters
- Converts Solidity types to appropriate Haskell types
- Handles `mapping(address => uint)` via a verified `MapWithBalance` structure
- Generates Liquid Haskell refinement types: `require` conditions become preconditions, each
  `assert` is verified at the point where it is written, and the asserts that end a function
  also become postconditions
- Web interface for interactive conversion **and real Liquid Haskell verification**
- Command-line tools for batch processing

## Requirements

- **Node.js** (to run the server and the converter itself)
- **GHC 9.8.2**
- **Cabal** (tested with `cabal-install 3.14.2.0`)
- **LiquidHaskell 0.9.8.2** (installed automatically as a dependency the first time you build the `verify/` project, see below)
- An SMT solver compatible with LiquidHaskell, installed and available on `PATH` (default: **Z3**; CVC4 also works)

Any version compatible with GHC 9.8.x should work, but the versions above are the ones this project was built and tested against.

### Installing GHC/Cabal (recommended: ghcup)

`ghcup` works the same way on Linux and macOS. If you don't have GHC 9.8.2 installed:

```bash
# If ghcup isn't installed yet (Linux or macOS):
curl --proto '=https' --tlsv1.2 -sSf https://get-ghcup.haskell.org | sh

# Install and select GHC 9.8.2
ghcup install ghc 9.8.2
ghcup set ghc 9.8.2
ghcup install cabal recommended
```

Check that it's set correctly:

```bash
ghc --version
# The Glorious Glasgow Haskell Compilation System, version 9.8.2

cabal --version
```

### Installing Z3 (SMT solver)

**Linux (Debian/Ubuntu):**

```bash
sudo apt install z3
```

**macOS (with Homebrew):**

```bash
brew install z3
```

**Verify on either OS:**

```bash
z3 --version
```

#### Adding Z3 to PATH (only if `z3 --version` fails)

In most cases **nothing extra is needed**: both `apt` (Linux) and `brew` (macOS) install the
binary somewhere already on `PATH` by default (`/usr/bin/z3` or `/opt/homebrew/bin/z3` /
`/usr/local/bin/z3` depending on whether it's Apple Silicon or Intel).

If `z3 --version` returns `command not found`, find where it was installed and add it manually:

```bash
# Find the binary
which z3          # if this returns nothing, try:
brew --prefix z3  # on macOS, gives the install path

# Add it to PATH (example: macOS + Homebrew on Apple Silicon)
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

On Linux, if it was installed manually to a custom path (not via `apt`), the pattern is the
same but editing `~/.bashrc` instead of `~/.zshrc`.

LiquidHaskell looks for the `z3` binary directly on the `PATH` of the process running the
build, so it's enough that `z3 --version` works in the same terminal you use to build/run
the server.

## Installation

```bash
# Clone the repository
git clone https://github.com/GonzaloConsoli/solidity-to-lh.git
cd solidity-to-lh

npm install

# Clean and Build the verify/ project once. This resolves and compiles
# LiquidHaskell and its dependencies for real verification through the
# web interface's "Validate Liquid" button. Can take several minutes
# the first time.
cd src/verify
cabal clean
cabal build
cd ../..
```

## Usage

#### Web Interface

```bash
npm run dev
```

Then open `http://localhost:3000` in your browser.

- **Convert**: translates the Solidity code on the left into Haskell with Liquid Haskell annotations.
- **Validate Liquid**: runs real Liquid Haskell verification on the generated code (via the bundled `src/verify/` project) and shows whether it's `SAFE` or `UNSAFE`, including the solver's error output when it isn't.

#### Command Line Tools

All scripts live in `scripts/` and are run from the repository root. Each one has an npm
alias; `npm run <alias> -- <args>` is equivalent to `node scripts/<script>.js <args>`
(the `--` is needed so npm passes the arguments through to the script).

| Alias | Script | What it does |
|---|---|---|
| `npm run show` | `run_contract.js` | Prints a contract from `test_contracts/` and its generated Haskell (no compilation or verification). |
| `npm run verify` | `verify_contract.js` | Translates one or more `.sol` files and runs real Liquid Haskell verification. |
| `npm run bench` | `run_benchmarks.js` | Verifies every contract under `benchmarks/` and compares against the expected result. |
| `npm run comp` | `compile-all.js` | Translates every contract in `test_contracts/` and checks the output compiles with plain `ghc` (see [Testing](#testing)). |

`verify` and `bench` need the `src/verify/` project to be built (see Installation).

##### Show a translation (`run_contract.js`)

Takes the contract name from `test_contracts/`, without the `.sol` extension:

```bash
npm run show -- test18_simple_marketplace
# or: node scripts/run_contract.js test18_simple_marketplace
```

##### Verify contracts (`verify_contract.js`)

Accepts any `.sol` path (one or several). It runs the same command as the web interface
(`cabal exec -- ghc -fplugin=LiquidHaskell -fno-code`) and prints one result per file:

- `SAFE` / `UNSAFE` — Liquid Haskell's verdict.
- `SAFE (N untranslated statements)` — SAFE, but N statements/expressions were not
  translated (emitted as `TODO` or `undefined`), so the result may be vacuous.
- `ERROR` — the generated Haskell does not compile (unlike the web UI, this is not reported as UNSAFE).
- `PARSE ERROR` / `TRANSLATOR CRASH` — the Solidity parser or the translator failed.
- `FILE NOT FOUND` — the path doesn't exist (paths are relative to where the command is run,
  normally the repository root).

```bash
npm run verify -- benchmarks/ethernaut/original/Token.sol
npm run verify -- a.sol b.sol --overflow
VERBOSE=1 npm run verify -- benchmarks/ethernaut/original/Token.sol
```

Flags:

- `--overflow` — model `uint` arithmetic modulo 2^256 and check for overflow/underflow.
  Without it, integers are mathematical (no wraparound).
- `--keep` — keep the generated `.hs` file and print its path.
- `VERBOSE=1` (environment variable) — print Liquid Haskell's output when the result is not `SAFE`.

##### Run the benchmarks (`run_benchmarks.js`)

Recursively verifies every `.sol` under `benchmarks/` (or the directory passed as argument)
and prints `OK`/`FAIL` per file plus a summary (`X/Y match the expected result`). It is slow:
it runs Liquid Haskell once per file.

```bash
npm run bench
npm run bench -- --overflow
npm run bench -- benchmarks/ethernaut
npm run bench -- benchmarks/smartbugs --overflow
```

The expected result for each file is read from a comment in the contract:

- `// Expected: SAFE|UNSAFE` — expected result in the default mode.
- `// Expected with --overflow: SAFE|UNSAFE` — expected result with `--overflow`; takes
  precedence over the previous one in that mode.
- A file under an `original/` folder with no comment is expected to be `UNSAFE`
  (SmartBugs ground truth: all those contracts are vulnerable).

The same contract can be expected `SAFE` in one mode and `UNSAFE` in the other. For example,
Ethernaut's `Token.sol` guards with `require(balances[msg.sender] - _value >= 0)`, which only
protects if subtraction doesn't wrap around: it verifies without `--overflow` but is `UNSAFE` with it.

## Testing

For converting all smart contracts in `test_contracts/` and checking that the generated code
compiles with `ghc -fno-code` (generated files go to `scripts/tmp/`). This only typechecks
the Haskell; it does **not** run Liquid Haskell verification (use `npm run verify` for that):

```bash
npm run comp
```

For running unit tests:

```bash
npm run test
```

## Project Structure

- `src` - Source code
  - `index.js` - Entry point (`solidityToHaskell`): parses the contract and assembles the module
  - `gatherState.js` - Collects state variables, enums and constants
  - `gatherFunctions.js` - Collects function definitions
  - `generateData.js` - Generates the state record and enum types
  - `generateFunctions.js` - Generates the Haskell functions, the `call<Contract>` ether model and `revert`
  - `liquidConditions.js` - Generates refinement types (require/assert, solvency invariant)
  - `translator.js` - Translates Solidity expressions and statements
  - `typeMappings.js` - Solidity-to-Haskell types and the shared prelude (`Message`, `Block`, `Uint`...)
  - `mapDefinitions.js` - `MapWithBalance` structure used for `mapping(address => uint)`
  - `astUtils.js` - Small shared helpers (identifier normalization, AST walking)
  - `server.js` - Web server (conversion + real Liquid Haskell validation)
  - `public/` - Web interface (`index.html`)
  - `verify/` - Minimal cabal project bundled only to have `liquidhaskell` already
    resolved as a dependency, so `server.js` can run real verification
    (`cabal exec -- ghc -fplugin=LiquidHaskell -fno-code <file>`) on whatever the
    converter generates. It builds nothing of its own beyond an empty placeholder
    module — you never need to edit anything inside it, just build it once
    (see Installation).
- `scripts` - Command line tools
- `test_contracts` - Example Solidity contracts
- `benchmarks` - Verification benchmarks (SmartBugs, Ethernaut, DeFiVulnLabs, plus `regression/`
  cases for past translator bugs) with their expected results
- `azure_require` - Azure blockchain workbench sample contracts
- `__tests__` - Unit tests

## Notes

- `src/verify/verify.cabal` pins `liquidhaskell == 0.9.8.2`, which needs GHC 9.8.x. If your
  machine has a different GHC selected (check with `ghc --version`), `cabal build` inside
  `src/verify/` will fail to resolve or build. Select GHC 9.8.2 with
  `ghcup set ghc 9.8.2` before building.
- If you use VS Code + HLS to edit the Haskell code, keep in mind HLS keeps its own
  incremental LiquidHaskell cache, separate from `cabal build`. If the editor shows errors
  that don't reproduce with a real build, stop the LSP server and work from the terminal
  instead (`Ctrl+Shift+P` → "Haskell: Stop Haskell LSP Server").

## Troubleshooting

- **`EADDRINUSE: address already in use :::3000`**: a previous server process is still
  holding port 3000. Kill it with `lsof -ti:3000 | xargs kill -9` and start the server again.
- **`can't find a package database at .../dist-newstyle/packagedb/...`**: the `verify/`
  project hasn't been built yet on this machine. Run `cabal build` inside `src/verify/`
  (see Installation).

## Files not tracked in git (`.gitignore`)

The project generates build and verification artifacts that shouldn't be committed:

```gitignore
node_modules/
dist-newstyle/
.liquid/
*.hi
*.o
.ghc.environment.*
```

- `node_modules/` — installed npm packages.
- `dist-newstyle/` — cabal's build output (compiled interfaces, binaries) for `src/verify/`.
- `.liquid/` — LiquidHaskell's cache (constraints and intermediate SMT queries). This is
  specific to each machine/build and can cause problems if committed and cloned elsewhere,
  so it should never be versioned.
