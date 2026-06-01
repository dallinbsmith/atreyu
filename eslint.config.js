import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import preferArrow from 'eslint-plugin-prefer-arrow-functions';
import { recommended, source, test } from '@adobe/eslint-config-helix';

export default defineConfig([
  globalIgnores([
    '**/deps',
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
    },
    plugins: {
      import: recommended.plugins.import,
      'prefer-arrow-functions': preferArrow,
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
]);
