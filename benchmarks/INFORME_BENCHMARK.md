# Evaluación del traductor Solidity → Liquid Haskell con un benchmark real (SmartBugs)

## 1. Objetivo

Hasta ahora el traductor se había probado con contratos de ejemplo escritos a mano (SimpleBank, Wallet, Rewards). Para ver si funciona fuera de esos ejemplos, lo corrimos contra un benchmark público de contratos inteligentes. Por cada contrato vemos dos cosas:

1. que un contrato **correcto** verifique como **SAFE**, y
2. que, al introducir un **error lógico chico** (sacar un `require`, invertir un operador, validar la variable equivocada), el resultado pase a **UNSAFE**.

Esta es la misma metodología del informe anterior, ahora aplicada a contratos reales.

**Resumen de resultados**

| | Modo normal (como la tesis) | Modo `--overflow` (nuevo) |
|---|---|---|
| Contratos originales de SmartBugs (15, todos vulnerables) | 5/15 detectados | **13/15 detectados** |
| Variantes nuevas: correcto vs. error introducido (21) | 21/21 | **21/21** |
| Total | 26/36 | **34/36** |

Los dos que no se detectan en ningún modo (`timelock.sol`, `BECToken.sol`) usan construcciones que el traductor todavía no soporta (`now`, unidades de tiempo, `.transfer`, arrays, loops, herencia).

## 2. Benchmark elegido: SmartBugs Curated, categoría `arithmetic`

- Repositorio: <https://github.com/smartbugs/smartbugs-curated> (carpeta `dataset/arithmetic`).
- Es un dataset de referencia en la literatura para evaluar herramientas de análisis de contratos. Cada contrato está etiquetado como **vulnerable** y tiene la línea del bug marcada con `// <yes> <report> ARITHMETIC`.
- Elegimos la categoría `arithmetic` (overflow/underflow) porque es la que más se acerca a lo que modela la herramienta: `uint` como entero no negativo y `mapping(address => uint)` mediante `BalancedMap`.

Los 15 contratos originales se copiaron **sin modificar** a `benchmarks/smartbugs/original/`. Las variantes nuevas están en `benchmarks/smartbugs/variants/`.

## 3. Herramientas nuevas

### 3.1 `scripts/verify_contract.js`: verificación por línea de comandos

Traduce uno o varios `.sol` a Liquid Haskell y corre la verificación real con el mismo comando que usa el servidor web (`cabal exec -- ghc -fplugin=LiquidHaskell -fno-code`).

```bash
node scripts/verify_contract.js archivo.sol [otro.sol ...]
node scripts/verify_contract.js --overflow archivo.sol      # con chequeo de overflow (sección 4.4)
VERBOSE=1 node scripts/verify_contract.js archivo.sol       # muestra la salida de Liquid Haskell
node scripts/verify_contract.js archivo.sol --keep          # conserva el .hs generado
```

Resultados posibles:

| Resultado | Significado |
|---|---|
| `SAFE` | Liquid Haskell verificó todas las refinaciones. |
| `UNSAFE` | Liquid Haskell encontró una refinación que no se cumple. |
| `ERROR` | El Haskell generado **no compila** (no es una falla de la prueba). |
| `SAFE (con N sentencias no traducidas)` | Dio SAFE, pero el traductor reemplazó N sentencias por un no-op o por `undefined`. Ese SAFE **no es confiable**. |
| `TRANSLATOR CRASH` / `PARSE ERROR` | Falló el traductor JS o el parser de Solidity. |

**Diferencia con la interfaz web:** la web informa cualquier error de compilación como "Unsafe" (`valid: false`). El script separa los dos casos, y gracias a eso encontramos el bug descrito en la sección 4.1.

### 3.2 `scripts/run_benchmarks.js`: corrida completa contra lo esperado

Recorre todos los `.sol` de `benchmarks/` y compara el resultado con el esperado:

- Si el archivo tiene un comentario `// Esperado: SAFE` o `// Esperado: UNSAFE`, se usa ese valor.
- Con `--overflow`, si además hay un comentario `// Esperado con --overflow: SAFE|UNSAFE`, ese tiene prioridad.
- Los archivos dentro de `original/` no tienen comentario. Son ground truth de SmartBugs (todos vulnerables), así que se espera `UNSAFE`.

```bash
node scripts/run_benchmarks.js              # modo normal
node scripts/run_benchmarks.js --overflow   # modo overflow
```

### 3.3 Interfaz web

Se agregó un checkbox **"Check overflow"** al lado de *Convert* que activa el mismo modo (sección 4.4). Sin tildar, la web se comporta igual que antes.

## 4. Cambios en el traductor

### 4.1 Errores que ya estaban en el traductor

| Problema | Efecto | Arreglo |
|---|---|---|
| Una condición de `require` que mencionaba dos parámetros se colgaba del parámetro equivocado (`to` en vez de `amount`). | **El caso 4 del informe anterior ("Wallet dirección equivocada") no daba UNSAFE: no compilaba** ("Unbound symbol amount"). La web lo mostraba como "Unsafe" y parecía correcto. | La condición se coloca sobre el **último** parámetro (en orden de la firma) que menciona. Ahora da UNSAFE real. (`liquidConditions.js`) |
| Solo se detectaba un parámetro si era operando directo de la comparación (`x >= amount`), no si estaba anidado (`balances[msg.sender] - _value >= 0`). | La precondición quedaba sobre `st` y no compilaba. | Se buscan los parámetros en toda la expresión. (`liquidConditions.js`) |
| Las variables locales leían siempre el estado **inicial** `st`, aunque se declararan después de modificar el estado. | `x -= 1; uint y = x;` usaba el `x` viejo. | Las locales leen el estado vigente en el punto donde se declaran. (`translator.js`) |
| `return;` sin valor. | El traductor se colgaba (`Cannot read properties of null`). | Ver 4.2. |
| Nombre de contrato con `_` (`Overflow_Add`). | Liquid Haskell rechaza `Overflow_AddState`. | Se sacan los `_` del nombre del contrato. (`index.js`) |
| Variable de estado propia llamada `balance`. | Campo duplicado `balance<Contrato>` en el record. | La variable del usuario se renombra a `balance_<Contrato>` y tapa al campo interno, igual que en Solidity. (`gatherState.js`, `index.js`) |

### 4.2 Construcciones de Solidity soportadas ahora

| Construcción Solidity | Antes | Ahora |
|---|---|---|
| Constructor estilo 0.4: `function Token(uint x)` | Se traducía como función común. | Se reconoce como constructor. |
| `constant` (sinónimo de `view` en 0.4) | Se trataba como función que modifica estado. | Se trata como `view`. |
| `return` / `return x;` en una función que modifica estado | `st4 = True` (error de tipos) o crash. | El `return` termina la función; el valor se descarta porque la función devuelve el estado. |
| Early return: `if (c) { ...; return; } resto` | El `resto` se ejecutaba igual (semántica incorrecta). | Se traduce como `if c then {...} else {resto}`. |
| `if (c) sentencia;` sin llaves | La rama se perdía. | Se trata como un bloque de una sentencia. |
| `balances[k] = v` / `+=` / `-=` **dentro del constructor** | Se ignoraba (el mapping quedaba vacío). | Se encadena con `setWB` sobre `empWB`, en orden. |
| Asignación encadenada `a = b = c` | Campo `undefined` en el record. | Se separa en `b = c; a = c`. |
| Inicializador de variable de estado: `uint count = 1;` | Siempre se inicializaba en 0. | Se usa el literal como valor inicial. |
| `*=` y `/=` | Se ignoraban en silencio (no-op → SAFE falso). | Se traducen a `*` y `` `div` ``. |

### 4.3 Regresión

- Los 132 tests unitarios de jest pasan (125 de antes + 7 nuevos del modo overflow).
- En **modo normal**, `test_contracts/` y `azure_require/` dan exactamente los mismos resultados que antes de los cambios, salvo `test39_wallet_wrong_address.sol`, que pasó de `ERROR` (no compilaba) a `UNSAFE` (correcto).

### 4.4 Modo `--overflow`: detección de overflow de `uint`

**Por qué antes no se detectaba.** `Uint` estaba refinado como `{v:Int | v >= 0}`, sin cota superior. Así, `count += input` o `count *= input` nunca violaban nada. Además, las condiciones se evaluaban con aritmética de enteros matemáticos. Por eso, en `token.sol`, `require(balances[msg.sender] - _value >= 0)` equivalía a `balance >= value` y el contrato daba SAFE. En Solidity 0.4 la resta da la vuelta (módulo 2²⁵⁶), así que esa condición es **siempre verdadera** y no protege nada.

**Qué hace el modo nuevo** (activado con `--overflow` o el checkbox de la web; `solidityToHaskell(code, { checkOverflow: true })`):

1. **Cota superior en `uint`.** El rango de un `uint` pasa a ser `0 <= v <= 2^256 - 1` (predicado `InRange`). Este rango se usa en el tipo `Uint` (campos de estado, parámetros, `msg.value`) **y en los valores del mapping** (`BalancedMap`: `setWB`, `getWB`, `currentBalance`). Entonces cualquier valor que se **guarda** (`count += input`, `balances[_to] += _value`, `count *= input`) tiene que quedar en rango. Si no se puede probar, da UNSAFE.

   Los literales 2²⁵⁶ − 1 y 2²⁵⁶ solo aparecen dentro de refinaciones, donde son enteros matemáticos. Un literal `Int` de Haskell de ese tamaño se desbordaría.

2. **Aritmética modular en las condiciones.** En `require`, `if` y `assert`, los `+`, `-` y `*` sobre `uint` se traducen a `addU`, `subU` y `mulU`, que calculan como Solidity < 0.8 (dan la vuelta módulo 2²⁵⁶):

   ```haskell
   {-@ assume subU :: a:Uint -> b:Uint ->
         {v:Uint | v == subUL a b && v == (if b <= a then a - b else a - b + 2^256)} @-}
   ```

   Gracias a esto, las guardas clásicas significan lo mismo que en la blockchain:
   - `require(a + b >= a)` (guarda de overflow pre-SafeMath) prueba que `a + b` no desborda, y
   - `require(a - b >= 0)` (el bug de `token.sol`) **no protege nada**.

   Las precondiciones generadas usan las versiones lógicas no interpretadas (`addUL`, `subUL`, `mulUL`), con las que las funciones Haskell quedan especificadas como iguales.

3. **Variables locales.** `uint res = count - input;` se traduce a `res = checkU (...)`, que exige que el valor esté en rango. Hubo que "usar" la variable (`seq res st`) porque GHC descarta los `let` que no se usan antes de que Liquid Haskell los vea.

4. **Claves de un mapping que no cambian.** Con cota superior, para probar `balances[_to] + _value <= MAX` después de modificar `balances[msg.sender]`, Liquid Haskell necesita saber que escribir una clave no cambia las otras. Se agregó el lema `lemma_currentBalance_setWB_maybe_other` a la librería del mapping, y el traductor lo invoca para cada clave del mismo mapping que lee la función.

5. **Supuesto explícito: acreditar `msg.value` no desborda.** `balances[msg.sender] += msg.value` se traduce con `addEther`, cuyo resultado se **asume** en rango. Justificación: todo el ether existente (~1,2·10²⁶ wei) es muchísimo menor que 2²⁵⁶. SmartBugs tampoco marca esas líneas como vulnerables (por ejemplo, el `deposit` de `timelock.sol` no está marcado; sí lo está `lockTime[msg.sender] += ...`). Sin este supuesto, todo `deposit` daría UNSAFE.

**Efecto sobre los contratos de la tesis (`test_contracts/`).** En modo `--overflow` cambian 8 contratos de SAFE a UNSAFE, y en todos el overflow es real:

| Contrato | Motivo |
|---|---|
| `test1`, `test2_b`, `test4`, `test8_if`, `test17` | `count++` |
| `test3` | `count = count + 4` |
| `test38_wallet_transfer_ok` (caso 3 del informe anterior) | `balances[to] += amount`, **el mismo código** que `insecure_transfer.sol`, que SmartBugs marca como vulnerable |
| `test40_rewards_reedem` (caso 5 del informe anterior) | `points[msg.sender] += amount` |

No se puede tener a la vez Wallet.transfer SAFE e `insecure_transfer.sol` UNSAFE, porque son el mismo código. Por eso el modo es **opcional**: sin el flag, los resultados de la tesis quedan exactamente iguales.

## 5. Resultados

### 5.1 Contratos originales de SmartBugs (todos vulnerables → se espera UNSAFE)

| Contrato | Bug | Modo normal | Modo `--overflow` |
|---|---|---|---|
| `integer_overflow_minimal.sol` | `count -= input` (underflow) | UNSAFE ✅ | UNSAFE ✅ |
| `integer_overflow_mapping_sym_1.sol` | `map[k] -= v` (underflow en mapping) | UNSAFE ✅ | UNSAFE ✅ |
| `overflow_single_tx.sol` | varios (suma, multiplicación, resta) | UNSAFE ✅ | UNSAFE ✅ |
| `integer_overflow_multitx_onefunc_feasible.sol` | `count -= input` tras early return | UNSAFE ✅ | UNSAFE ✅ |
| `integer_overflow_multitx_multifunc_feasible.sol` | `count -= input` | UNSAFE ✅ | UNSAFE ✅ |
| `token.sol` | `require(balances[msg.sender] - _value >= 0)` siempre verdadero | SAFE ❌ | UNSAFE ✅ |
| `integer_overflow_add.sol` | `count += input` | SAFE ❌ | UNSAFE ✅ |
| `integer_overflow_mul.sol` | `count *= input` | SAFE ❌ | UNSAFE ✅ |
| `integer_overflow_1.sol` | `sellerBalance += value` | SAFE ❌ | UNSAFE ✅ |
| `overflow_simple_add.sol` | `balance += deposit` | SAFE ❌ | UNSAFE ✅ |
| `insecure_transfer.sol` | `balanceOf[_to] += _value` | SAFE ❌ | UNSAFE ✅ |
| `integer_overflow_benign_1.sol` | `uint res = count - input` (local) | SAFE ❌ | UNSAFE ✅ |
| `tokensalechallenge.sol` | `balanceOf[msg.sender] += numTokens`, `numTokens * PRICE` | SAFE* ❌ | UNSAFE ✅ |
| `timelock.sol` | `lockTime[msg.sender] += ...` | ERROR ❌ | ERROR ❌ |
| `BECToken.sol` | `cnt * _value` | ERROR ❌ | ERROR ❌ |
| **Total** | | **5/15** | **13/15** |

\* `SAFE (con 1 sentencia no traducida)`: `msg.sender.transfer(...)` no está soportado.

### 5.2 Variantes: correcto (SAFE) vs. error introducido (UNSAFE)

Cada archivo tiene en la cabecera su `// Esperado:` (modo normal) y su `// Esperado con --overflow:`.

**Familia `token.sol`** (token tipo ERC20, `mapping(address => uint)`):

| Archivo | Cambio respecto del original | Normal | `--overflow` |
|---|---|---|---|
| `token_overflow_guard.sol` | `require(balances[msg.sender] >= _value)` + `require(balances[_to] + _value >= balances[_to])` | SAFE ✅ | **SAFE** ✅ |
| `token_overflow_guard_wrong_key.sol` | la guarda de overflow mira `msg.sender` en vez de `_to` | SAFE ✅ | **UNSAFE** ✅ |
| `token_overflow_guard_useless.sol` | "guarda" `require(balances[_to] + _value > 0)` | SAFE ✅ | **UNSAFE** ✅ |
| `token_fixed.sol` | solo `require(balances[msg.sender] >= _value)` | SAFE ✅ | **UNSAFE** ✅ (el `+=` al destino puede desbordar) |
| `token_strict_off_by_one.sol` | solo `require(balances[msg.sender] > _value)` | SAFE ✅ | **UNSAFE** ✅ (ídem) |
| `token_no_require.sol` | sin `require` | UNSAFE ✅ | UNSAFE ✅ |
| `token_wrong_address.sol` | `require(balances[_to] >= _value)` | UNSAFE ✅ | UNSAFE ✅ |
| `token_inverted_operator.sol` | `require(balances[msg.sender] <= _value)` | UNSAFE ✅ | UNSAFE ✅ |
| `token_wrong_check.sol` | `require(_value > 0)` | UNSAFE ✅ | UNSAFE ✅ |

**Otras familias:**

| Archivo | Basado en | Cambio | Normal | `--overflow` |
|---|---|---|---|---|
| `insecure_transfer_fixed.sol` | `insecure_transfer.sol` | + `require(balanceOf[_to] + _value >= balanceOf[_to])` | SAFE ✅ | SAFE ✅ |
| `add_fixed.sol` | `integer_overflow_add.sol` | `require(count + input >= count)` | SAFE ✅ | SAFE ✅ |
| `add_wrong_guard.sol` | `integer_overflow_add.sol` | `require(input > 0)` | SAFE ✅ | **UNSAFE** ✅ |
| `simple_add_fixed.sol` | `overflow_simple_add.sol` | `require(balance + deposit >= balance)` (usa una variable `balance` propia) | SAFE ✅ | SAFE ✅ |
| `mul_bounded.sol` | `integer_overflow_mul.sol` | `require(count <= 1000000 && input <= 1000000)` | SAFE ✅ | SAFE ✅ |
| `benign_fixed.sol` | `integer_overflow_benign_1.sol` | `require(input <= count)` antes de la resta local | SAFE ✅ | SAFE ✅ |
| `minimal_fixed.sol` | `integer_overflow_minimal.sol` | `require(input <= count)` | SAFE ✅ | SAFE ✅ |
| `minimal_wrong_bound.sol` | `integer_overflow_minimal.sol` | `require(input < count + 1000)` | UNSAFE ✅ | UNSAFE ✅ |
| `mapping_sym_fixed.sol` | `integer_overflow_mapping_sym_1.sol` | `require(map[k] >= v)` | SAFE ✅ | SAFE ✅ |
| `mapping_sym_wrong_key.sol` | `integer_overflow_mapping_sym_1.sol` | `require(map[0] >= v)` | UNSAFE ✅ | UNSAFE ✅ |
| `multitx_onefunc_fixed.sol` | `integer_overflow_multitx_onefunc_feasible.sol` | `require(input <= count)` después del early return | SAFE ✅ | SAFE ✅ |
| `multitx_early_return_guard.sol` | `integer_overflow_multitx_multifunc_feasible.sol` | `if (input > count) return;` protege la resta | SAFE ✅ | SAFE ✅ |

**21/21 en los dos modos.** En modo normal, las variantes que solo agregan o rompen una guarda **de overflow** dan SAFE porque ese modo no modela overflow. Por eso tienen un esperado distinto por modo.

### 5.3 Código de las variantes principales

**Familia `token`.** Todas las variantes comparten este código y solo cambian las líneas de `require` según la tabla 5.2. Esta es `token_overflow_guard.sol`:

```solidity
pragma solidity ^0.4.18;

contract Token {

  mapping(address => uint) balances;
  uint public totalSupply;

  function Token(uint _initialSupply) {
    balances[msg.sender] = totalSupply = _initialSupply;
  }

  function transfer(address _to, uint _value) public returns (bool) {
    require(balances[msg.sender] >= _value);           // balance suficiente
    require(balances[_to] + _value >= balances[_to]);  // el destino no desborda
    balances[msg.sender] -= _value;
    balances[_to] += _value;
    return true;
  }

  function balanceOf(address _owner) public constant returns (uint balance) {
    return balances[_owner];
  }
}
```

Este contrato usa varias de las construcciones nuevas a la vez: constructor estilo 0.4, asignación encadenada, escritura a mapping en el constructor, `return true` en una función que modifica estado y `constant`. Este es el Haskell que se genera para el constructor:

```haskell
constructorToken msgctx block _initialSupply = TokenState
            { msgToken = msgctx,
              blockToken = block,
              balanceToken = 0,
              addressToken = fromString "Token",
              totalSupplyToken = _initialSupply,
              balancesToken = setWB (empWB) (sender msgctx) _initialSupply
            }
```

**`add_fixed.sol` / `add_wrong_guard.sol`:**

```solidity
pragma solidity ^0.4.19;

contract IntegerOverflowAdd {
    uint public count = 1;

    function run(uint256 input) public {
        require(count + input >= count);   // add_wrong_guard: require(input > 0);  -> UNSAFE con --overflow
        count += input;
    }
}
```

**`insecure_transfer_fixed.sol`:**

```solidity
pragma solidity ^0.4.10;

contract IntegerOverflowAdd {
    mapping (address => uint256) public balanceOf;

    function transfer(address _to, uint256 _value) public{
        require(balanceOf[msg.sender] >= _value);
        require(balanceOf[_to] + _value >= balanceOf[_to]);
        balanceOf[msg.sender] -= _value;
        balanceOf[_to] += _value;
    }
}
```

**`minimal_fixed.sol` / `minimal_wrong_bound.sol`:**

```solidity
pragma solidity ^0.4.19;

contract IntegerOverflowMinimal {
    uint public count = 1;

    function run(uint256 input) public {
        require(input <= count);          // wrong_bound: require(input < count + 1000);  -> UNSAFE
        count -= input;
    }
}
```

**`mapping_sym_fixed.sol` / `mapping_sym_wrong_key.sol`:**

```solidity
pragma solidity ^0.4.11;

contract IntegerOverflowMappingSym1 {
    mapping(uint256 => uint256) map;

    function init(uint256 k, uint256 v) public {
        require(map[k] >= v);             // wrong_key: require(map[0] >= v);  -> UNSAFE
        map[k] -= v;
    }
}
```

**`multitx_early_return_guard.sol`:**

```solidity
pragma solidity ^0.4.23;

contract IntegerOverflowMultiTxMultiFuncFeasible {
    uint256 private initialized = 0;
    uint256 public count = 1;

    function init() public {
        initialized = 1;
    }

    function run(uint256 input) {
        if (input > count) {
            return;
        }
        count -= input;
    }
}
```

El resto de las variantes (`benign_fixed`, `mul_bounded`, `simple_add_fixed`, `multitx_onefunc_fixed`, etc.) son el original de SmartBugs con el `require` que figura en la tabla 5.2.

## 6. Lo que sigue sin andar

### 6.1 Construcciones no soportadas todavía (fuera del alcance de esta etapa)

| Construcción | Dónde aparece | Qué pasa hoy |
|---|---|---|
| `msg.sender.transfer(x)` / `.send(x)` | `timelock`, `tokensalechallenge` | Se reemplaza por un no-op (`-- TODO`). Podría mapearse al `call<Contrato>` que ya existe para `.call{value:}`. |
| `now` / `block.timestamp` | `timelock` | Se traduce como `undefined` → no compila. |
| Unidades (`1 weeks`, `1 ether`) | `timelock`, `tokensalechallenge` | Se ignora la unidad. |
| Dos mappings en el mismo contrato | `timelock` | Nunca probado end-to-end (bloqueado por lo anterior). |
| Arrays, loops, herencia, librerías, `mapping` anidado | `BECToken` | Fuera de alcance (igual que en la tesis original). |

### 6.2 Limitaciones del modo `--overflow`

- **Solo `uint`.** Los `int` con signo siguen sin cota (por ejemplo, `test32`/`test33`: `PartyABalance += balance` con `int`).
- **Guarda de multiplicación estilo SafeMath.** `require(c / a == b)` no se puede probar. El resultado de `mulU` cuando hay overflow se modela solo como "algún valor en rango", y además `/` sobre `Int` no está bien traducido (debería ser `div`). Con cotas explícitas (`mul_bounded.sol`) sí funciona.
- **Supuesto de `msg.value`** (sección 4.4, punto 5). Es una hipótesis del modelo, no algo probado.
- **Wraparound en lo que se guarda.** Los valores guardados se tratan como aritmética *chequeada*: cualquier wraparound que llegue al estado se reporta como UNSAFE, aunque el programador lo haya hecho a propósito. Es el mismo criterio que usa SmartBugs.

### 6.3 Riesgo: sentencias no traducidas que se convierten en no-op

Cuando el traductor no reconoce una sentencia, la reemplaza por `st -- TODO` (no hace nada) o una expresión por `undefined`. Si esa sentencia era la que violaba la propiedad, Liquid Haskell da **SAFE sin haberla chequeado**. El script marca estos casos como `SAFE (con N sentencias no traducidas)`. Aparece en `tokensalechallenge.sol` (modo normal), `test_contracts/test13.sol`, `test_contracts/test35_SimpleTransfer.sol` y `azure_require/RefrigeratedTransportation.sol`. Una mejora natural sería que el traductor **falle explícitamente** ante construcciones no soportadas.

## 7. Conclusiones

- Con contratos de un benchmark público, la herramienta distingue la versión correcta de errores lógicos típicos en **21/21 variantes**: sin `require`, dirección equivocada, operador invertido, validación insuficiente, clave equivocada, guarda de overflow equivocada o inútil.
- En modo normal (como la tesis), la herramienta detecta los **underflows** (5/15 originales). Las fallas se explican porque `uint` no tenía cota superior y las condiciones usaban aritmética matemática en vez de modular.
- Con el modo `--overflow`, que agrega la cota 2²⁵⁶ − 1 y la aritmética modular en las condiciones, detecta **13/15 originales**, incluido el bug sutil de `token.sol` (`require(a - b >= 0)` siempre verdadero). También prueba SAFE las versiones con las guardas correctas, incluida la guarda clásica `require(a + b >= a)`. Los 2 restantes necesitan `now`, unidades de tiempo, `.transfer`, o arrays y loops.
- El modo overflow es **opcional** porque cambia el veredicto de contratos que antes eran SAFE (`count++`, `balances[to] += amount`). Bajo la semántica de SmartBugs esos cambios son correctos, y sin el flag los resultados de la tesis no cambian.
- Se encontraron y arreglaron varios errores del traductor. El más importante: **el caso 4 del informe anterior en realidad no compilaba**, y ahora da UNSAFE de verdad.
- Próximos pasos posibles:
  1. `transfer`/`send` + `now` + unidades, para cubrir `timelock.sol` y probar dos mappings en el mismo contrato.
  2. Traducir `/` como `div` y modelar mejor `mulU`, para las guardas de multiplicación estilo SafeMath.
  3. Que el traductor falle explícitamente ante construcciones que no soporta.

## 8. Cómo reproducir

```bash
# una vez: cd src/verify && cabal build && cd ../..
node scripts/run_benchmarks.js                     # todo benchmarks/, modo normal
node scripts/run_benchmarks.js --overflow          # todo benchmarks/, modo overflow
node scripts/verify_contract.js --overflow benchmarks/smartbugs/variants/token_overflow_guard.sol
VERBOSE=1 node scripts/verify_contract.js --overflow benchmarks/smartbugs/original/token.sol
npm test                                           # tests unitarios
npm run dev                                        # web en http://localhost:3000 (checkbox "Check overflow")
```
