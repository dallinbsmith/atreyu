/**
 * Local ESLint plugin: catches config-value drift — the same locale-prefix
 * list, or the same environment/hostname classification logic, hand-typed a
 * second time instead of imported from this project's single source of
 * truth. This is the recurring bug class documented in
 * artifacts/master-plan/implementation-plan.md (P0-48): a config literal
 * gets duplicated across files and the copies silently drift apart. Human
 * review has repeatedly missed it even with the correct pattern one line
 * away in the same diff.
 *
 * Two rules:
 *  - no-duplicate-locale-list: flags an array/object literal containing 3+
 *    of the 10 real BCP47 locale codes (as keys OR values, one level into
 *    nested arrays, and through simple same-file spread chains) outside the
 *    two designated files: workers/website/utils/locale.js (Worker runtime)
 *    and scripts/scripts.js (browser runtime). The allowed-code list itself
 *    is hand-typed a third time in this file (see the comment on
 *    ALLOWED_LOCALE_CODES below for why it can't just import one of the
 *    other two), so this file is the one other place exempted from the rule.
 *  - no-inline-env-check: flags re-deriving an environment classification
 *    from a raw hostname/URL string — `.includes()`/`.startsWith()`/
 *    `.endsWith()` calls, `===`/`==`/`!==`/`!=` comparisons, inline regex
 *    `.test()`, `switch` statements, and an env-word array iterated via
 *    `.some()`/`.every()`/`.find()` whose callback re-checks the per-element
 *    param with `.includes()`/`.startsWith()`/`.endsWith()` (the exact shape
 *    of this file's own designated classifier's internal logic, and the
 *    natural way CLAUDE.md's preferred `.some()`/`.every()` house style
 *    would reproduce it) — outside the one designated classifier,
 *    scripts/utils/env.js. It does NOT flag any of these forms when the
 *    other operand is provably the imported binding for that classifier's
 *    default export (e.g. `import ENV from '.../utils/env.js'; ENV ===
 *    'prod'`), which is the normal, correct way callers consume it. That
 *    exemption is based on tracing the import, not just "is it a bare
 *    identifier" — a bare identifier holding an un-traced hostname (e.g.
 *    `host.includes('stage')`, the exact shape of the classifier's own
 *    internal logic) is not exempt and still gets flagged.
 *
 * Known residual gaps (not covered by this pass, flagged here rather than
 * implied to be handled — this is a lint-time-only tool with no
 * runtime/security impact, so these are accepted as honest limitations
 * rather than chased through a further round):
 *  - destructured/renamed re-exports of the env classifier import chained
 *    through an intermediate module;
 *  - INTERPOLATED template-literal-embedded checks (e.g. building a string
 *    with `${host}` and testing the result — only zero-substitution
 *    template literals, used as a plain string, are treated as literals);
 *  - spread chains that cross FILE boundaries (an imported array/object
 *    being spread is not tracked — only same-file bindings, resolved via
 *    scope analysis, are), or that go through anything other than a
 *    plain-identifier VariableDeclarator/AssignmentExpression;
 *  - indirect requires/dynamic imports;
 *  - chained registries built with `Map.set()` / `Set.add()` calls (only
 *    single array/object literals are inspected — this project's own
 *    scripts/behaviors.js, scripts/utils/motion/gsap-loader.js, and
 *    scripts/utils/icons.js all build lookups this way, and none of that
 *    is covered);
 *  - destructuring assignment targets (`[a, b] = [...]`, `{ a, b } = {...}`)
 *    and default parameter values (`(host = ['/de-de', ...]) => {}`);
 *  - values returned from an IIFE or any other function call, since the
 *    binding tracker only records a literal directly assigned via `=` (or
 *    the compound/logical assignment operators) or declared inline;
 *  - arrays/objects built incrementally via `.push()`/bracket-assignment
 *    rather than a single literal — `const a = []; a.push('/de-de'); ...`
 *    is invisible to this rule entirely.
 * If any of these show up in a real diff, treat this rule's silence as
 * "not evaluated," not "confirmed clean."
 *
 * Same-file spread tracking (both list rules) is scope-aware: it resolves
 * each spread argument to its actual eslint-scope Variable object (via
 * `sourceCode.getDeclaredVariables` / reference resolution), not by bare
 * identifier name, and updates that same binding's tracked count on
 * reassignment — including `||=`/`??=`/`&&=`/`+=`, tracked the same as
 * plain `=` rather than modeling their real short-circuit semantics — as
 * well as initial declaration. That means `let a = [...]; a ||= [...];
 * [...a]` uses the latest recorded value, and two unrelated same-named
 * bindings in different scopes (shadowing) don't collide.
 */

import path from 'node:path';

// The 10 real BCP47 locale codes this site serves (9 prefixed + en-us, which
// has no prefix). This CANNOT be imported from workers/website/utils/locale.js
// — that directory is its own separately-deployed package (its own
// package.json, name "website", built/deployed independently via wrangler)
// and a relative import across that boundary is exactly what this repo's
// `import/no-relative-packages` lint rule exists to forbid. It also can't be
// imported from scripts/scripts.js — that module pulls in ak.js, which
// touches browser globals at load time and isn't safe to import under Node.
// So this list is hand-typed a third time, same as the other two keep each
// other in sync: if the real locale list ever changes, update this array too.
const ALLOWED_LOCALE_CODES = new Set([
  'de-de', 'en-us', 'es-es', 'fr-fr', 'it-it', 'ja-jp', 'ko-kr', 'pt-br', 'ru-ru', 'zh-cn',
]);

const ENV_WORD_RE = /^(prod|production|stage|staging|dev|development)$/i;
const ENV_WORD_IN_PATTERN_RE = /\b(prod|production|stage|staging|dev|development)\b/i;
const MIN_LOCALE_MATCHES = 3;

// Posix-relative to the `site/` package root (where eslint.config.js lives).
const LOCALE_SOURCE_FILES = ['workers/website/utils/locale.js', 'scripts/scripts.js'];
const ENV_SOURCE_FILES = ['scripts/utils/env.js'];
// This rule's own allowlist above is the one sanctioned exception to itself —
// see the comment on ALLOWED_LOCALE_CODES for why it can't just import one of
// the two real sources instead.
const RULE_OWN_FILE = 'tools/eslint-rules/config-drift.js';

const toPosixRelative = (filename, cwd) => filename
  .replace(cwd, '')
  .replace(/^[/\\]/, '')
  .split(/[\\/]/)
  .join('/');

const isDesignatedFile = (filename, cwd, allowlist) => {
  const rel = toPosixRelative(filename, cwd);
  return allowlist.some((f) => rel === f || rel.endsWith(`/${f}`));
};

// A plain string Literal, or a TemplateLiteral with zero interpolations
// (e.g. `/de-de`) — which this project's own CLAUDE.md recommends as house
// style ("Template literals for string building"), so a duplicate list
// written that way must not silently evade detection.
const literalStringValue = (node) => {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
};

const isLocaleLiteral = (node) => {
  const value = literalStringValue(node);
  return value !== null && ALLOWED_LOCALE_CODES.has(value.replace(/^\//, '').toLowerCase());
};

const countLocaleLiterals = (nodes) => nodes.filter(isLocaleLiteral).length;

// Recurse exactly one level into nested arrays, so an array-of-pairs shape
// (e.g. [['/de-de', 'German'], ['/es-es', 'Spanish'], ...]) is inspected the
// same as a flat array of locale strings.
const flattenOneLevel = (elements) => elements
  .flatMap((el) => (el?.type === 'ArrayExpression' ? el.elements : [el]));

const noDuplicateLocaleList = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded locale-prefix lists outside the single source of truth.',
    },
    schema: [],
  },
  create: (context) => {
    const cwd = context.cwd ?? process.cwd();
    if (isDesignatedFile(context.filename, cwd, [...LOCALE_SOURCE_FILES, RULE_OWN_FILE])) return {};

    const { sourceCode } = context;

    // Same-file bookkeeping only (see "known residual gaps" at the top of
    // this file for what that excludes). Keyed by the resolved eslint-scope
    // Variable object for a binding — never by bare identifier name — so
    // reassignment updates the same entry instead of leaving it stale, and
    // two unrelated same-named bindings in different scopes don't collide.
    // Shared between arrays and objects: a binding just tracks "how many
    // real locale codes does this literal currently hold."
    const bindingLocaleCounts = new Map();

    const resolveVariable = (identifierNode) => {
      let scope = sourceCode.getScope(identifierNode);
      while (scope) {
        const ref = scope.references.find((r) => r.identifier === identifierNode);
        if (ref) return ref.resolved;
        scope = scope.upper;
      }
      return null;
    };

    const resolveSpreadCount = (argNode) => {
      if (argNode?.type !== 'Identifier') return 0;
      const variable = resolveVariable(argNode);
      return (variable && bindingLocaleCounts.get(variable)) ?? 0;
    };

    const countArrayTotal = (arrayExpr) => {
      const direct = countLocaleLiterals(
        flattenOneLevel(arrayExpr.elements).filter((el) => el?.type !== 'SpreadElement'),
      );
      const spread = arrayExpr.elements
        .filter((el) => el?.type === 'SpreadElement')
        .reduce((sum, el) => sum + resolveSpreadCount(el.argument), 0);
      return { total: direct + spread, viaSpread: spread > 0 };
    };

    const countObjectTotal = (objExpr) => {
      const literalNodes = objExpr.properties
        .filter((p) => p.type === 'Property')
        .flatMap((p) => [p.key, p.value]);
      const direct = countLocaleLiterals(literalNodes);
      const spread = objExpr.properties
        .filter((p) => p.type === 'SpreadElement')
        .reduce((sum, p) => sum + resolveSpreadCount(p.argument), 0);
      return { total: direct + spread, viaSpread: spread > 0 };
    };

    const recordBinding = (variable, valueNode) => {
      if (!variable) return;
      if (valueNode.type === 'ArrayExpression') bindingLocaleCounts.set(variable, countArrayTotal(valueNode).total);
      else if (valueNode.type === 'ObjectExpression') bindingLocaleCounts.set(variable, countObjectTotal(valueNode).total);
    };

    const report = (node, count, viaSpread) => context.report({
      node,
      message: `This literal contains ${count} real locale-code strings${viaSpread ? ' (some reached via a spread of a locally-tracked binding)' : ''} `
        + '— a second hand-maintained locale list. Import LOCALE_PREFIXES from '
        + 'workers/website/utils/locale.js (Worker runtime) or the `locales` config from '
        + 'scripts/scripts.js (browser runtime) instead of hardcoding one here.',
    });

    return {
      VariableDeclarator: (node) => {
        if (node.id.type !== 'Identifier' || !node.init) return;
        const [variable] = sourceCode.getDeclaredVariables(node);
        recordBinding(variable, node.init);
      },
      AssignmentExpression: (node) => {
        // Compound/logical assignment (CLAUDE.md house style: `??=`/`||=`
        // over manual guards) is tracked the same as plain `=` — the RHS
        // literal's count simply overwrites the binding's tracked count.
        // This is a deliberate simplification, not a model of `||=`'s real
        // short-circuit semantics (it may not actually execute at runtime
        // if the LHS is already truthy) — acceptable for a lint-time
        // drift heuristic, not claimed to be exact.
        if (!['=', '||=', '??=', '&&=', '+='].includes(node.operator) || node.left.type !== 'Identifier') return;
        recordBinding(resolveVariable(node.left), node.right);
      },
      ArrayExpression: (node) => {
        const { total, viaSpread } = countArrayTotal(node);
        if (total >= MIN_LOCALE_MATCHES) report(node, total, viaSpread);
      },
      ObjectExpression: (node) => {
        const { total, viaSpread } = countObjectTotal(node);
        if (total >= MIN_LOCALE_MATCHES) report(node, total, viaSpread);
      },
    };
  },
};

const isEnvLiteral = (node) => {
  const value = literalStringValue(node);
  return value !== null && ENV_WORD_RE.test(value);
};

const SUBSTRING_METHODS = ['includes', 'startsWith', 'endsWith'];
const ITERATION_METHODS_WITH_CALLBACK = ['some', 'every', 'find'];

// `['stage', 'staging'].some((marker) => host.includes(marker))` is the same
// shape as scripts/utils/env.js's own real internal logic — the env-word
// literals live in the iterated array, not as the .includes() argument, so
// the direct-literal check above doesn't see them. Only the callback's
// simple, common shapes are inspected (an implicit-return expression, or a
// single top-level `return`, optionally one `||`/`&&` level deep) —
// deliberately not a full body walk; see the "known residual gaps" comment.
const isSubstringCheckOnParam = (expr, paramName, isExemptIdentifier) => expr?.type === 'CallExpression'
  && expr.callee.type === 'MemberExpression'
  && expr.callee.property.type === 'Identifier'
  && SUBSTRING_METHODS.includes(expr.callee.property.name)
  && !isExemptIdentifier(expr.callee.object)
  && expr.arguments.some((a) => a.type === 'Identifier' && a.name === paramName);

const candidateReturnedExpressions = (fn) => (fn.body.type === 'BlockStatement'
  ? fn.body.body.filter((s) => s.type === 'ReturnStatement' && s.argument).map((s) => s.argument)
  : [fn.body]);

const callbackChecksParam = (fn, paramName, isExemptIdentifier) => candidateReturnedExpressions(fn)
  .some((expr) => {
    const candidates = expr?.type === 'LogicalExpression' ? [expr.left, expr.right] : [expr];
    return candidates.some((c) => isSubstringCheckOnParam(c, paramName, isExemptIdentifier));
  });

const noInlineEnvCheck = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow re-deriving environment from a hostname/URL string outside the designated classifier.',
    },
    schema: [],
  },
  create: (context) => {
    const cwd = context.cwd ?? process.cwd();
    if (isDesignatedFile(context.filename, cwd, ENV_SOURCE_FILES)) return {};

    const classifierAbsPaths = new Set(ENV_SOURCE_FILES.map((f) => path.resolve(cwd, f)));
    const filenameAbs = path.resolve(cwd, context.filename);
    const filenameDir = path.dirname(filenameAbs);
    // Local names bound to an import of the designated classifier file in
    // *this* file — e.g. `import ENV from '../../scripts/utils/env.js'`.
    // Comparing/testing against one of these names is the correct, expected
    // way to consume the classifier and is exempt; comparing/testing against
    // anything else (a bare hostname variable, a member/call expression) is
    // exactly the re-derivation bug this rule exists to catch.
    const classifierLocalNames = new Set();

    const isExemptIdentifier = (node) => node?.type === 'Identifier' && classifierLocalNames.has(node.name);

    const message = (literal) => `Comparing against the literal environment name "${literal}" outside a `
      + `designated environment classifier. This project already has one at ${ENV_SOURCE_FILES.join(', ')} — `
      + 'import its export instead of re-deriving the environment from a hostname/URL string here.';

    return {
      ImportDeclaration: (node) => {
        const source = node.source.value;
        if (!source.startsWith('.')) return;
        const resolved = path.resolve(filenameDir, source);
        if (!classifierAbsPaths.has(resolved)) return;
        node.specifiers.forEach((s) => {
          if (s.local) classifierLocalNames.add(s.local.name);
        });
      },

      CallExpression: (node) => {
        const { callee } = node;
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return;
        const methodName = callee.property.name;

        if (SUBSTRING_METHODS.includes(methodName)) {
          if (isExemptIdentifier(callee.object)) return;
          const [arg] = node.arguments;
          if (isEnvLiteral(arg)) {
            context.report({ node, message: message(literalStringValue(arg)) });
          }
          return;
        }

        if (methodName === 'test' && callee.object.type === 'Literal' && callee.object.regex) {
          const [arg] = node.arguments;
          if (isExemptIdentifier(arg)) return;
          if (ENV_WORD_IN_PATTERN_RE.test(callee.object.regex.pattern)) {
            context.report({ node, message: message(callee.object.regex.pattern) });
          }
          return;
        }

        // `[...envWords].some/every/find((param) => obj.includes(param))` —
        // see the comment on callbackChecksParam above.
        if (ITERATION_METHODS_WITH_CALLBACK.includes(methodName) && callee.object.type === 'ArrayExpression') {
          const envLiterals = callee.object.elements.filter(isEnvLiteral);
          if (envLiterals.length === 0) return;
          const [callback] = node.arguments;
          if (!callback || !['ArrowFunctionExpression', 'FunctionExpression'].includes(callback.type)) return;
          const [param] = callback.params;
          if (!param || param.type !== 'Identifier') return;
          if (callbackChecksParam(callback, param.name, isExemptIdentifier)) {
            const words = envLiterals.map(literalStringValue).join('/');
            context.report({ node, message: message(words) });
          }
        }
      },

      BinaryExpression: (node) => {
        if (!['===', '==', '!==', '!='].includes(node.operator)) return;
        const literal = [node.left, node.right].find(isEnvLiteral);
        if (!literal) return;
        const other = node.left === literal ? node.right : node.left;
        if (isExemptIdentifier(other)) return;
        context.report({ node, message: message(literalStringValue(literal)) });
      },

      SwitchStatement: (node) => {
        if (isExemptIdentifier(node.discriminant)) return;
        const envCase = node.cases.find((c) => isEnvLiteral(c.test));
        if (envCase) context.report({ node, message: message(literalStringValue(envCase.test)) });
      },
    };
  },
};

export default {
  rules: {
    'no-duplicate-locale-list': noDuplicateLocaleList,
    'no-inline-env-check': noInlineEnvCheck,
  },
};
