/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    '@react-native',
    'plugin:@typescript-eslint/recommended',
    'prettier', // desactiva reglas que chocan con Prettier
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'jest'],
  env: { es2021: true },
  ignorePatterns: ['node_modules/', 'dist/', '.expo/', 'coverage/'],
  rules: {
    'no-console': 'warn',
    '@typescript-eslint/consistent-type-imports': 'warn',
  },
  overrides: [
    {
      files: ['**/*.test.{ts,tsx}', '**/__tests__/**/*.{ts,tsx,js,jsx}'],
      plugins: ['jest'],
      env: { 'jest/globals': true },
    },
  ],
}
