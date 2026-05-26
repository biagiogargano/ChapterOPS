/**
 * Babel config for Expo (SDK 54).
 *
 * Adds one surgical transform on top of babel-preset-expo:
 * `neutralize-variable-dynamic-import`. Hermes cannot compile a dynamic
 * `import()` whose specifier is a non-literal expression (it throws
 * "Invalid expression encountered" at bytecode time). `@supabase/supabase-js`
 * ships exactly that — an OPTIONAL OpenTelemetry probe `import(OTEL_PKG)` guarded
 * by `.catch(() => null)` — which breaks release (Hermes) builds while passing in
 * Expo Go (no Hermes precompile). Metro can't rewrite a non-literal `import()`,
 * so we replace those calls with `Promise.resolve(null)`. Literal dynamic imports
 * (e.g. expo-router's `import('./route')`) are left untouched, so lazy routing is
 * unaffected. This only disables the optional tracing probe — no app behavior.
 */
function neutralizeVariableDynamicImport({ types: t }) {
  return {
    name: 'neutralize-variable-dynamic-import',
    visitor: {
      CallExpression(path) {
        if (path.node.callee.type !== 'Import') return;
        const arg = path.node.arguments[0];
        const isStaticString =
          t.isStringLiteral(arg) ||
          (t.isTemplateLiteral(arg) && arg.expressions.length === 0);
        if (isStaticString) return; // keep real lazy imports (router) for Metro
        // Hermes can't compile import(<expression>); make it a safe no-op promise.
        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier('Promise'), t.identifier('resolve')),
            [t.nullLiteral()],
          ),
        );
      },
    },
  };
}

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [neutralizeVariableDynamicImport],
  };
};
