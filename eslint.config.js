import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import preferArrow from 'eslint-plugin-prefer-arrow-functions';
import { recommended, source, test } from '@adobe/eslint-config-helix';
import configDrift from './tools/eslint-rules/config-drift.js';

export default defineConfig([
  globalIgnores([
    '**/vendor',
  ]),
  {
    languageOptions: {
      ...recommended.languageOptions,
      ecmaVersion: 2025,
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
        ...globals.mocha,
        ...globals.es6,
        __rootdir: true,
      },
    },
    settings: {
      'import/core-modules': ['eslint/config'],
    },
    rules: {
      'no-await-in-loop': 0,

      'object-curly-newline': ['error', {
        multiline: true,
        minProperties: 6,
        consistent: true,
      }],

      'import/no-cycle': 'off',

      'max-statements-per-line': ['error', { max: 2 }],

      'header/header': 0,

      'class-methods-use-this': 0,

      'import/no-unresolved': ['error', {
        ignore: ['^https?://'],
      }],

      // scripts.md: "Utilities should not import from blocks — dependency
      // flows one direction: blocks -> utils." True by convention only until
      // now (an architect-agent audit found zero violations today, but
      // nothing would have caught one) — same rationale as the config-drift
      // rules below: this project already writes enforcement for invariants
      // it cares about rather than leaving them as prose alone.
      'import/no-restricted-paths': ['error', {
        zones: [{
          target: './scripts/utils',
          from: './blocks',
          message: 'scripts/utils/ must not import from blocks/ — dependency flows one direction: blocks -> utils (see .claude/rules/scripts.md).',
        }],
      }],

      indent: ['error', 2, {
        ignoredNodes: ['TemplateLiteral *'],
        SwitchCase: 1,
      }],

      'no-param-reassign': ['error', { props: false }],

      // arrow-only: all function declarations/expressions → arrow functions
      'prefer-arrow-functions/prefer-arrow-functions': ['error', {
        allowNamedFunctions: false,
        classPropertiesAllowed: false,
        disallowPrototype: true,
        returnStyle: 'implicit',
        singleReturnOnly: false,
      }],

      'prefer-arrow-callback': ['error', { allowNamedFunctions: false }],
      'arrow-body-style': ['error', 'as-needed'],
      'func-style': ['error', 'expression'],

      // terse expressions: prefer modern array methods over manual loops
      'no-restricted-syntax': ['error',
        {
          selector: 'ForInStatement',
          message: 'Use Object.keys/values/entries with for...of or array methods.',
        },
      ],

      // no nested ternaries (inherited from Helix, enforced here explicitly)
      'no-nested-ternary': 'error',

      // config-drift guard (P0-48): catch a locale-prefix list or an
      // environment/hostname classification re-implemented outside this
      // project's designated single-source files.
      'config-drift/no-duplicate-locale-list': 'error',
      'config-drift/no-inline-env-check': 'error',
    },
    plugins: {
      import: recommended.plugins.import,
      'prefer-arrow-functions': preferArrow,
      'config-drift': configDrift,
    },
    extends: [recommended],
  },
  source,
  test,
  {
    files: ['test/**/*.js'],
    rules: {
      'max-classes-per-file': 0,
      'no-console': 'off',
      'no-underscore-dangle': 0,
      'no-unused-expressions': 0,
    },
  },
  {
    // blocks.md: "Keep block JS under 100 lines; extract helpers to
    // scripts/utils/ if larger" — documented since the beginning but never
    // actually enforced, which let 5 files exceed it silently before this
    // was noticed in an audit. Five pre-existing overages are grandfathered
    // via a file-level eslint-disable comment (each explaining why forcing
    // a split was judged premature-abstraction risk rather than fixed) —
    // this rule exists to stop a sixth from landing unnoticed, not to force
    // those five under the limit retroactively.
    files: ['blocks/**/*.js'],
    rules: {
      'max-lines': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
    },
  },
]);
