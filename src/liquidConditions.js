const { translateExpression, translateOperator } = require('./translator');

/**
 * Translates a require/assert operand for use inside a refinement. Conditions
 * use wrapping uint arithmetic (see translator.js), whose functions can't be
 * called in a refinement: their uninterpreted logic names (addUL...) are used
 * instead, which the Haskell versions are specified to be equal to.
 */
function toLogic(expr, params, stateInfo) {
  return translateExpression(expr, params, stateInfo, { modular: true })
    .replace(/\b(addU|subU|mulU)\b/g, '$1L');
}


  
  /**
 * Converts binary expression to Liquid Haskell predicate
 */
  function expressionToLiquidPredicate(expr, params = [], stateInfo, isPostCondition = false) {
    if (expr.type === 'Identifier') {
      // Handle simple identifier
      let condition = toLogic(expr, params, stateInfo);
      if (condition === 'undefined') {
        return null;
      }
      return {
        type: 'state',
        predicate: condition
      };
    }

    if (!expr || expr.type !== 'BinaryOperation') return null;
  
    const op = translateOperator(expr.operator);
    const statePrefix = isPostCondition ? 'v' : 'st';

    // Check if condition involves a parameter anywhere (not only as a direct
    // operand, e.g. `balances[msg.sender] - _value >= 0`). Pick the last one
    // in the signature so all mentioned parameters are bound before it.
    const translated = `${translateExpression(expr.left, params, stateInfo)} ${translateExpression(expr.right, params, stateInfo)}`;
    const mentioned = params.filter(p =>
      new RegExp(`(^|[^A-Za-z0-9_'])${p.name}($|[^A-Za-z0-9_'])`).test(translated));
    const paramName = mentioned.length ? mentioned[mentioned.length - 1].name : undefined;

    if (paramName) {
      // Format as parameter condition
      let left = toLogic(expr.left, params, stateInfo).replace(/\bst\b/g, statePrefix);
      let right = toLogic(expr.right, params, stateInfo).replace(/\bst\b/g, statePrefix);
      return {
        type: 'param',
        param: paramName,
        predicate: `((${left}) ${op} (${right}))`
      };
    }
  
    // Handle state conditions
    let left = toLogic(expr.left, params, stateInfo).replace(/\bst\b/g, statePrefix);
    let right = toLogic(expr.right, params, stateInfo).replace(/\bst\b/g, statePrefix);

    // TODO: Probably to fix this, it just worked for the example
    if(left === 'undefined') {
      left = statePrefix;
    }

    return {
      type: 'state', 
      predicate: `((${left}) ${op} (${right}))`
    };
  }


/**
 * Extracts require conditions from function body
 */
function extractRequireConditions(body) {
  if (!body) return [];
  return body.filter(stmt => 
    stmt.type === 'ExpressionStatement' && 
    stmt.expression.type === 'FunctionCall' &&
    stmt.expression.expression.name === 'require'
  ).map(stmt => stmt.expression.arguments[0]);
}

function extractAssertConditions(body) {
  if (!body) return [];
  return body.filter(stmt => 
    stmt.type === 'ExpressionStatement' && 
    stmt.expression.type === 'FunctionCall' &&
    stmt.expression.expression.name === 'assert'
  ).map(stmt => stmt.expression.arguments[0]);
}

/**
 * Generates Liquid Haskell refinement type annotations
 */

function generateLiquidAnnotation(contractName, fn, params, stateInfo) {
  const requires = extractRequireConditions(fn.body);
  const asserts = extractAssertConditions(fn.body);
  
  // Collect predicates and separate by type
  const predicates = requires
    .map(r => expressionToLiquidPredicate(r, params, stateInfo))
    .filter(p => p !== null);

  const stateConditions = predicates
    .filter(p => p.type === 'state')
    .map(p => p.predicate);

  // Create a map to store conditions that reference multiple parameters
  const multiParamConditions = new Map();
  // Group parameter conditions by parameter name  
  const paramConditions = {};
  predicates
    .filter(p => p.type === 'param')
    .forEach(p => {
      // Check if the predicate references other parameters
      const mentions = name => new RegExp(`(^|[^A-Za-z0-9_'])${name}($|[^A-Za-z0-9_'])`).test(p.predicate);
      const otherParams = params
        .filter(param => param.name !== p.param && mentions(param.name));

      if (otherParams.length > 0) {
        // Store the condition with the rightmost referenced parameter (by
        // position in the signature, including p.param itself), so every
        // parameter it mentions is already bound when Liquid Haskell reads it.
        const referenced = params.filter(param => param.name === p.param || mentions(param.name));
        const targetParam = referenced[referenced.length - 1].name;
        if (!multiParamConditions.has(targetParam)) {
          multiParamConditions.set(targetParam, []);
        }
        multiParamConditions.get(targetParam).push(p.predicate);
      } else {
        // Handle single parameter conditions as before
        paramConditions[p.param] = paramConditions[p.param] || [];
        paramConditions[p.param].push(p.predicate);
      }
    });
  let annotation;  
  if (fn.name === 'constructor') {
    annotation = `{-@ ${fn.name+contractName} :: Message -> Block `;
    }
  else{
    annotation = `{-@ ${fn.name} :: {st:${contractName}State | ${stateConditions.join(' && ') || 'True'}}`;
  }
  // Add parameter conditions 
  params.forEach(param => {
    const regularConditions = paramConditions[param.name] || [];
    const multiConditions = multiParamConditions.get(param.name) || [];
    const allConditions = [...regularConditions, ...multiConditions];
    annotation += ` -> {${param.name}:${param.type} | ${allConditions.length ? allConditions.join(' && ') : 'True'}}`;
  });

  // Add postconditions from asserts
  const assertConditions = asserts
    .map(a => expressionToLiquidPredicate(a, params, stateInfo, true))
    .filter(p => p !== null)
    .map(p => p.predicate);

    let returnType;
    if (fn.isView || fn.isPure) {
      switch(fn.returnType) {
        case 'Bool':
          returnType = 'v:Bool';
          break;
        case 'Integer':
          returnType = 'v:Integer';
          break;
        case 'Uint':
          returnType = 'v:Uint';
          break;
        default:
          returnType = `v:${fn.returnType}`;
      }
    } else {
      returnType = `v:${contractName}State`;
    }
  
    annotation += ` -> {${returnType} | ${assertConditions.join(' && ') || 'True'}} @-}`;
  
    return annotation;
}

// {-# OPTIONS_GHC -fplugin=LiquidHaskell #-}
// {-# LANGUAGE RecordWildCards #-}
// {-@ LIQUID "--exact-data-cons" @-}
// {-@ LIQUID "--ple"    	@-}

// "--reflection" es necesario para poder usar `reflect` sobre empWB/getWB/
// setWB/currentBalance/etc. (ver mapDefinitions.js), que es lo que permite
// traducir mapping(KeyType => uint) usando BalancedMap. No afecta contratos
// que no usan mappings.
LIQUID_ANNOTATIONS = `{-@ LIQUID "--exact-data-cons" @-}
{-@ LIQUID "--reflection"     @-}
{-@ LIQUID "--ple"    	@-}
{-@ LIQUID "--no-termination"        @-}
{-# OPTIONS_GHC -Wno-incomplete-patterns #-}
{-# OPTIONS_GHC -Wno-unused-imports #-}
`

module.exports = {
  generateLiquidAnnotation,
  expressionToLiquidPredicate,
  extractAssertConditions,
  extractRequireConditions,
  LIQUID_ANNOTATIONS
 };
