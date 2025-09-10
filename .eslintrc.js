module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
    node: true,
  },
  extends: [
    '@eslint/js/configs/recommended',
    'standard',
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  env: {
    'browser': true,
    'amd': true,
    'es6': true,
  },
  ignorePatterns: ['**/vendor/*.js', '**/vendor/path-to-regexp/*.js'],
  rules: {
    'comma-dangle': ['error', 'always-multiline'],
    'no-extra-parens': ['error', 'all'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'object-shorthand': 'off',
  }
}
