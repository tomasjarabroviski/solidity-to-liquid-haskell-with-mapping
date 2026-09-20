const { translateExpression, translateOperator } = require('./translator');


  
  /**
 * Converts binary expression to Liquid Haskell predicate
 */
  function expressionToLiquidPredicate(expr, params = [], stateInfo, isPostCondition = false) {
    if (expr.type === 'Identifier') {
      // Handle simple identifier
      let condition = translateExpression(expr, params, stateInfo);
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
    
    // Check if condition involves a parameter
    const paramName = params.find(p => 
      expr.left.name === p.originalName || 
      expr.right.name === p.originalName
    )?.name;
  
    const statePrefix = isPostCondition ? 'v' : 'st';
  
    if (paramName) {
      // Format as parameter condition
      let left = translateExpression(expr.left, params, stateInfo).replace(/\bst\b/g, statePrefix);
      let right = translateExpression(expr.right, params, stateInfo).replace(/\bst\b/g, statePrefix);
      return {
        type: 'param',
        param: paramName,
        predicate: `((${left}) ${op} (${right}))`
      };
    }
  
    // Handle state conditions
    let left = translateExpression(expr.left, params, stateInfo).replace(/\bst\b/g, statePrefix);
    let right = translateExpression(expr.right, params, stateInfo).replace(/\bst\b/g, statePrefix);

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
      const otherParams = params
        .filter(param => param.name !== p.param && p.predicate.includes(param.name));
      
      if (otherParams.length > 0) {
        // Store the condition with the rightmost referenced parameter
        const targetParam = otherParams[otherParams.length - 1].name;
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
