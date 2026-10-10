const express = require('express');
const path = require('path');
const { solidityToHaskell } = require('./index');
const parser = require('@solidity-parser/parser');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
// Default body-size limit (100kb) is too small for generated Haskell
// code once mappings/multiple functions are involved.
app.use(express.json({ limit: '5mb' }));

// Validate Solidity code
app.post('/validate-solidity', (req, res) => {
    try {
        parser.parse(req.body.code);
        res.json({ valid: true });
    } catch (error) {
        res.json({ valid: false, error: error.message });
    }
});

// Minimal cabal project, bundled in this same repo (./verify folder),
// that exists only to have the `liquidhaskell` dependency already
// resolved. No need to touch this or configure any external path:
// after cloning the repo, `cd verify && cabal build` (just once)
// downloads the dependencies, and from then on the server can use it.
const CABAL_PROJECT_DIR = path.join(__dirname, 'verify');

// Validate Haskell code
app.post('/validate-haskell', (req, res) => {
    // The file name has to match the `module X where` of the generated
    // code, otherwise GHC rejects it ("file name does not match module
    // name").
    const moduleMatch = req.body.code.match(/^\s*module\s+([A-Za-z_][A-Za-z0-9_']*)/m);
    const moduleName = moduleMatch ? moduleMatch[1] : 'Temp';
    const tempFile = path.join(os.tmpdir(), `${moduleName}.hs`);

    try {
        fs.writeFileSync(tempFile, req.body.code);

        try {
            // `cabal exec` runs ghc in the same context (same GHC, same
            // package environment with `liquidhaskell` already resolved)
            // that `cabal build` uses in the verify/ project, so this DOES
            // trigger real Liquid Haskell verification (unlike a bare
            // `ghc`, which ignores the plugin entirely). The generated
            // file is self-contained, so it doesn't need to live inside
            // verify/ or be one of its modules.
            const output = execSync(
                `cabal exec -- ghc -fplugin=LiquidHaskell -fno-code "${tempFile}" 2>&1`,
                {
                    cwd: CABAL_PROJECT_DIR,
                    encoding: 'utf8',
                    // Liquid Haskell can print a LOT of text (one line per
                    // constraint checked). The default execSync buffer is
                    // only 1MB, which silently truncates long output and
                    // can cut off the "LIQUID: SAFE/UNSAFE" line entirely,
                    // making this look "randomly" wrong.
                    maxBuffer: 1024 * 1024 * 50,
                }
            );
            const isSafe = /LIQUID: SAFE/.test(output) && !/LIQUID: UNSAFE/.test(output);
            // Send the same "error" field the frontend reads in both the
            // success (exit code 0, but content says UNSAFE) and the
            // exception (non-zero exit code) paths below - otherwise the
            // frontend shows "Unsafe" with an empty message when GHC exits
            // 0 but Liquid Haskell reports UNSAFE.
            res.json({ valid: isSafe, output, error: isSafe ? undefined : output });
        } catch (error) {
            // execSync puts the output (stdout/stderr) inside the error
            // when the process exits with a non-zero code (e.g. UNSAFE).
            const output = (error.stdout || error.message || '').toString();
            res.json({ valid: false, error: output });
        } finally {
            fs.unlinkSync(tempFile);
        }
    } catch (error) {
        res.json({ valid: false, error: error.message });
    }
});

app.post('/convert', async (req, res) => {
    try {
        const { solidity, checkOverflow } = req.body;
        const haskell = solidityToHaskell(solidity, { checkOverflow: !!checkOverflow });
        res.json({ haskell });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));