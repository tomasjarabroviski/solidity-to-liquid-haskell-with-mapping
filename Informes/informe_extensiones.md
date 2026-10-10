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

### 6.2 Regresión

- Los contratos de la tesis (`test_contracts/`, `azure_require/`) dan los mismos resultados que antes en modo normal.
- La única diferencia es un caso que antes no compilaba y la interfaz web mostraba como "Unsafe" (ver sección 7).
- Los 43 contratos siguen compilando (`npm run comp`), y los tests unitarios pasaron de 125 a 140.

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
  - `/` sobre enteros no está bien traducido.
- **Invariante de solvencia:** solo se detecta en los dos patrones de la tabla 5.2.
- **No se verifica:** la lógica temporal (por ejemplo, "no retirar antes de tiempo") ni la reentrancy.
- **Literales mayores a 2⁶³ en el código** desbordan el `Int` de Haskell.
- **Correctitud:** como en la tesis, la evidencia es empírica, no una prueba formal.
