# Extensiones al traductor Solidity → Liquid Haskell

Este informe resume lo que se agregó a la herramienta de la tesis original (Consoli, 2025, *Liquid Types para la verificación de smart contracts*) y cómo se evaluó. No incluye el código de los contratos de prueba: están en `benchmarks/smartbugs/` y cada uno indica en su cabecera el resultado esperado.

## 1. Punto de partida

La herramienta original traduce un contrato Solidity a Haskell y convierte cada `require` en precondición y cada `assert` en postcondición de Liquid Haskell. Su capítulo de trabajo futuro (6.1) enumera, entre otras cosas:

| Trabajo futuro de la tesis | Estado ahora |
|---|---|
| Soporte de diccionarios (*mappings*) | ✅ `mapping(K => uint)`, incluyendo varios por contrato |
| Propiedades aritméticas (desbordamientos) | ✅ Modo `--overflow` (sección 4) |
| Soporte de arreglos (*arrays*) | ❌ Pendiente |
| Eventos | ❌ Pendiente |
| Interfaces y contratos abstractos | ❌ Pendiente |
| Prueba formal de correctitud | ❌ Pendiente. Se reemplazó por una evaluación empírica más amplia (sección 6) |

## 2. Mappings con balance (`BalancedMap`)

Un `mapping(K => uint)` se traduce a un `BalancedMap K`: una lista clave-valor que además guarda la suma de todos los valores (`mBal`). Liquid Haskell prueba en cada operación que `mBal` coincide con la suma real.

- **Lectura** (`m[k]`): `currentBalance`. Si la clave no está, devuelve 0, como Solidity.
- **Escritura** (`m[k] = v`, `+=`, `-=`): `setWB`, que mantiene la suma.
- **Lemas nuevos de la librería:**
  - escribir una clave no cambia las demás;
  - cada valor es ≤ la suma total (lo usa la invariante de solvencia, sección 5.2).
- **Cambio de tipos:** `Uint`, `Address` y `Amount` pasaron de `Integer` a `Int`. Con `Integer`, la prueba por evaluación lógica (`--ple`) de la librería no funciona. La tabla de tipos 3.1 de la tesis queda igual, salvo ese detalle de implementación.

## 3. Construcciones de Solidity nuevas

| Construcción | Antes | Ahora |
|---|---|---|
| Constructor estilo 0.4 (`function NombreDelContrato(...)`) | Función común | Constructor |
| `constant` (equivalente a `view` en 0.4) | Modificaba estado | `view` |
| `return` / `return x` en función que modifica estado | Error de tipos o crash | Termina la función |
| *Early return* `if (c) { ...; return; } resto` | El resto se ejecutaba igual | `if c then ... else resto` |
| `if (c) sentencia;` sin llaves | Se perdía la rama | Soportado |
| Escritura a mapping en el constructor | Ignorada | Soportada |
| Asignación encadenada `a = b = c` | Error | Soportada |
| Inicializadores de variables de estado (`uint x = 1;`) | Siempre 0 | Se usa el valor |
| Constantes (`uint constant P = 1 ether;`) | Campo del estado con valor arbitrario | Se reemplazan por su valor |
| `*=`, `/=` | Ignoradas en silencio | Soportadas |
| `now`, `block.timestamp` | No compilaba | Campo `timestamp` del bloque |
| Unidades (`1 weeks`, `1 ether`, `0.5 ether`) | Se ignoraba la unidad | Se aplica |
| `addr.transfer(x)`, `addr.send(x)` | Ignoradas en silencio | Igual que `addr.call{value: x}` de la tesis |
| Funciones `payable` | El ether recibido no se contaba | Suman `msg.value` al balance del contrato |
| Variable de estado llamada `balance` | Campo duplicado | Se renombra |
| Nombre de contrato con `_` | Liquid Haskell lo rechazaba | Se quitan los `_` |
| `receive()` / `fallback()` | Se tomaban como constructor (no tienen nombre) | Funciones comunes; si son `payable` suman `msg.value` aunque el cuerpo esté vacío |
| `unchecked { ... }` (0.8) | Ignorado | Sus sentencias se ejecutan en línea (ningún modo modela el *revert* por overflow de 0.8, ver sección 9) |
| `payable(addr)` | No compilaba | Es la dirección misma |
| `selfdestruct(to)` | Ignorado | Envía todo el balance del contrato a `to` |
| `/` entre `uint` | No compilaba (`/` de Haskell es fraccionaria) | División entera (`div`) |
| Parámetros con nombre reservado de Haskell (`data`, `type`, ...) | No compilaba | Se renombran |
| Declaración de tupla con huecos (`(bool ok, ) = ...`) | Crash | Soportada |

## 4. Modo `--overflow`: detección de desbordamientos

La tesis modela `uint` como entero no negativo **sin cota superior**, así que una suma o multiplicación nunca puede "pasarse". El modo nuevo, opcional, modela la aritmética de Solidity < 0.8:

1. **Cota superior.** Todo `uint` guardado (variables de estado, valores de mappings, variables locales) tiene que estar entre 0 y 2²⁵⁶ − 1. Si no se puede probar, el resultado es UNSAFE.
2. **Aritmética modular en las condiciones.** Dentro de `require`, `if` y `assert`, `+ - *` "dan la vuelta" módulo 2²⁵⁶, como en la blockchain. Así:
   - la guarda clásica `require(a + b >= a)` prueba que no hay overflow, y
   - un `require(a - b >= 0)` se reconoce como siempre verdadero (no protege nada).
3. **Supuestos explícitos.**
   - Sumar `msg.value` a un balance no desborda, porque todo el ether existente es mucho menor que 2²⁵⁶.
   - `block.timestamp < 2⁶⁴`.

   SmartBugs tampoco marca como vulnerables las líneas que estos supuestos excluyen.

Es **opcional** porque cambia resultados de la tesis: un `count++` sin chequeo o un `balances[to] += amount` sin guarda pasan a dar UNSAFE, y es correcto bajo esta semántica. Sin el modo, todos los resultados previos se mantienen. Se activa con `--overflow` en los scripts o con el checkbox *Check overflow* de la interfaz web.

## 5. Ether y solvencia

### 5.1 Modelo de ether

La tesis ya modelaba los envíos de ether (`call{value: x}`), que exigen `x ≤ balance del contrato`. Faltaban dos cosas, y se agregaron:
- las funciones `payable` suman `msg.value` al balance del contrato (antes el balance solo podía bajar);
- `transfer` y `send` usan el mismo modelo que `call`.

### 5.2 Invariante de solvencia

Para probar que un retiro es seguro, hace falta saber que **el contrato tiene el ether que les debe a sus usuarios**. El traductor detecta automáticamente los mappings que llevan cuentas en ether y les agrega una invariante, que es pre y postcondición de todas las funciones:

| Patrón detectado | Invariante generada |
|---|---|
| `m[k] += msg.value` | `suma(m) ≤ balance del contrato` |
| `require(msg.value == n * PRECIO); m[k] += n` (precio constante) | `suma(m) × PRECIO ≤ balance del contrato` |

Antes de cada envío de ether, el traductor agrega además el lema "cada valor del mapping es ≤ su suma". Con la invariante, eso permite probar que se puede pagar lo que dice el mapping **antes** de actualizarlo (el patrón `require(balances[x] >= v); x.call{value: v}(""); balances[x] -= v;`).

Esto detecta errores de contabilidad que antes pasaban:
- retirar sin poner el balance en 0 (doble retiro);
- pagar más de lo depositado;
- vender tokens más caro de lo que se cobraron;
- comprar tokens pagando menos por un overflow en la multiplicación.

## 6. Evaluación

### 6.1 Benchmark: SmartBugs Curated

La tesis evaluó la herramienta con los ejemplos de Azure y chequeó que el código generado compilara. Ahora se usó además **SmartBugs Curated**, un dataset público de referencia de contratos vulnerables, en su categoría aritmética (15 contratos, todos con un bug conocido). La metodología fue:

- **originales sin modificar**: se espera UNSAFE;
- **variantes** (29) creadas a partir de los originales, en pares: versión corregida (se espera SAFE) contra la misma versión con un error chico introducido (se espera UNSAFE). Los errores son: falta de `require`, dirección o clave equivocada, operador invertido, guarda de overflow inútil, doble retiro, pagar de más.

| | Modo normal (como la tesis) | Modo `--overflow` |
|---|---|---|
| Originales detectados como UNSAFE | 5/15 | **14/15** |
| Variantes con el resultado esperado | 29/29 | **29/29** |

- **En modo normal**, se detectan los underflows. Los overflows no, por diseño del modelo.
- **En modo `--overflow`**, se detectan todos menos `BECToken.sol`. Ese contrato necesita herencia, librerías, arrays y loops, que siguen sin soporte.
- En `timelock.sol` y `tokensalechallenge.sol`, los errores que reporta Liquid Haskell caen **exactamente en las líneas que SmartBugs marca como vulnerables**.

### 6.2 Benchmark: Ethernaut

[Ethernaut](https://github.com/OpenZeppelin/ethernaut) es el juego de retos de seguridad de OpenZeppelin: cada nivel es un contrato con una vulnerabilidad que hay que explotar. Se usaron dos niveles (`benchmarks/ethernaut/`, 8 contratos):

- **Nivel 5, Token** (Solidity 0.6), **sin modificar**. Es el mismo bug que `token.sol` de SmartBugs: la guarda `require(balances[msg.sender] - _value >= 0)` siempre es verdadera porque la resta da la vuelta. Además, dos variantes: arreglo solo del saldo y arreglo completo (saldo + overflow del destino).
- **Nivel 31, Stake** (Solidity 0.8), **solo como variantes**. El original usa un token WETH con llamadas de bajo nivel (`abi.encodeWithSelector`) y un mapping de `bool`, que no están soportados. Se quitaron esas partes y se conservó la lógica de stake/unstake en ether. Una versión correcta y cuatro rotas:
  - `Unstake` paga sin descontar el stake (retiro múltiple);
  - paga 1 wei de más;
  - `Unstake` solo chequea que haya algo de stake, no que alcance;
  - `StakeWETH` acredita stake sin recibir ether. Este es el bug real del nivel: el original acredita WETH que nunca llega y `Unstake` lo paga en ETH.

  Los cuatro son errores de contabilidad de ether, justo el tipo que apunta a detectar la invariante de solvencia (sección 5.2).

### 6.3 Benchmark: DeFiVulnLabs

[DeFiVulnLabs](https://github.com/SunWeb3Sec/DeFiVulnLabs) es una colección de contratos vulnerables de ejemplo, cada uno con su test de Foundry que reproduce el ataque. Se usaron tres contratos **sin modificar** (salvo quitar el test) y tres variantes (`benchmarks/defivulnlabs/`, 6 contratos):

- **`TimeLock`** (`Overflow.sol`, Solidity 0.7): `lockTime[msg.sender] += _secondsToIncrease` desborda y permite retirar antes de tiempo.
- **`SimpleBank`** (`self-transfer.sol`, Solidity 0.8): el bug documentado es que transferirse a uno mismo crea fondos. Además resta dentro de `unchecked` sin chequear el saldo.
- **`FixedSimpleBank`**: la versión "arreglada" del mismo repo. Corrige la auto-transferencia, pero **sigue** restando sin chequear el saldo dentro de `unchecked`: cualquiera puede dejarse un saldo de 2²⁵⁶ − x. La herramienta lo reporta como UNSAFE, es decir, encuentra un bug en el contrato que el propio repo presenta como mitigación.
- **Variantes** de `FixedSimpleBank`: con chequeo de saldo, con chequeo de saldo y de overflow del destino, y con el chequeo sobre la cuenta equivocada (`_to` en vez de `_from`).

La auto-transferencia de `SimpleBank` **no** es lo que detecta la herramienta: no hay ninguna propiedad que la exprese. El contrato no maneja ether, así que no se genera la invariante de solvencia, y nada exige que la suma de saldos se mantenga constante en una transferencia. La herramienta lo marca UNSAFE por el underflow.

### 6.4 Resultados de Ethernaut y DeFiVulnLabs

Cada contrato declara en su cabecera el resultado esperado en cada modo, porque algunos bugs solo existen con aritmética modular:

| | Contratos | Modo normal | Modo `--overflow` |
|---|---|---|---|
| Ethernaut | 8 (1 original + 7 variantes) | **8/8** | **8/8** |
| DeFiVulnLabs | 6 (3 originales + 3 variantes) | **6/6** | **6/6** |

Los originales en detalle:

| Contrato | Modo normal | Modo `--overflow` | Comentario |
|---|---|---|---|
| Ethernaut `Token.sol` | SAFE | UNSAFE | Sin wraparound la guarda `a - b >= 0` sí protege; el bug solo existe con aritmética modular |
| DeFiVulnLabs `TimeLock.sol` | SAFE | UNSAFE | Overflow de `lockTime`; sin cota superior no hay desborde posible |
| DeFiVulnLabs `SimpleBank.sol` | UNSAFE | UNSAFE | Underflow dentro de `unchecked` |
| DeFiVulnLabs `FixedSimpleBank.sol` | UNSAFE | UNSAFE | Ídem: la "mitigación" del repo no cubre el underflow |

Estos dos benchmarks agregan contratos de Solidity 0.6, 0.7 y 0.8, mientras que los de SmartBugs son de 0.4. Para soportarlos hicieron falta las construcciones nuevas de la sección 3 (`receive`, `unchecked`, `payable(addr)`, `selfdestruct`, división entera).

### 6.5 Total

| Benchmark | Contratos | Modo normal | Modo `--overflow` |
|---|---|---|---|
| SmartBugs | 44 | 34/44 | 43/44 |
| Ethernaut | 8 | 8/8 | 8/8 |
| DeFiVulnLabs | 6 | 6/6 | 6/6 |
| **Total** | **58** | **48/58** | **57/58** |

Todos los que no coinciden son originales de SmartBugs:

- En modo normal fallan 10: 9 son bugs de overflow, que ese modo no puede ver por diseño (sección 6.1), y el décimo es `BECToken.sol`.
- En modo `--overflow` falla solo `BECToken.sol`.

`BECToken.sol` da ERROR en los dos modos: el Haskell generado no compila, porque usa construcciones sin soporte.

### 6.6 Regresión

- Los contratos de la tesis (`test_contracts/`, `azure_require/`) dan los mismos resultados que antes en modo normal.
- Los 43 contratos siguen compilando (`npm run comp`), y los tests unitarios pasaron de 125 a 148.

## 7. Errores corregidos del traductor original

- **Condiciones de `require` con varios parámetros.** Se adjuntaban al parámetro equivocado y el código no compilaba. La interfaz web informa cualquier error de compilación como "Unsafe", así que **un caso que parecía UNSAFE correcto en realidad no compilaba**.
- **Parámetros anidados** en una condición (`m[x] - v >= 0`) no se detectaban.
- **Variables locales:** leían el estado inicial de la función en vez del estado vigente.
- **`return;` sin valor:** el traductor se colgaba.

## 8. Herramientas nuevas

- `scripts/verify_contract.js`: traduce y verifica uno o varios `.sol` desde la terminal. Separa **ERROR** (no compila) de **UNSAFE** y avisa cuando un SAFE puede no ser confiable porque el traductor ignoró alguna sentencia.
- `scripts/run_benchmarks.js`: corre todo `benchmarks/` y compara cada resultado con el esperado.
- Interfaz web: checkbox *Check overflow*.

## 9. Limitaciones y trabajo futuro

- **Sin soporte todavía:** herencia, `super`, modifiers, eventos, librerías (SafeMath), arrays, loops y mappings anidados. Son los que impiden `BECToken.sol`.
- **Sentencias no reconocidas:** se traducen como "no hacer nada", lo que puede dar un SAFE sin haber chequeado esa parte. El script lo advierte, pero sería mejor que el traductor fallara.
- **Modo `--overflow`:**
  - no cubre `int` con signo;
  - no puede probar la guarda de multiplicación estilo SafeMath (`c / a == b`);
- **Invariante de solvencia:** solo se detecta en los dos patrones de la tabla 5.2.
- **No se verifica:** la lógica temporal (por ejemplo, "no retirar antes de tiempo") ni la reentrancy.
- **Literales mayores a 2⁶³ en el código** desbordan el `Int` de Haskell.
- **Correctitud:** como en la tesis, la evidencia es empírica, no una prueba formal.
