module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    // Code style
    'indent': ['error', 2],
    'quotes': ['error', 'single'],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'always-multiline'],
    
    // Best practices
    'no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    'no-console': 'off', // Allow console for debugging
    'no-debugger': 'warn',
    'no-alert': 'warn',
    
    // Error prevention
    'no-undef': 'error',
    'no-redeclare': 'error',
    'no-duplicate-case': 'error',
    'no-unreachable': 'error',
    
    // Code quality
    'prefer-const': 'warn',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    
    // Spacing and formatting
    'space-before-blocks': 'error',
    'keyword-spacing': 'error',
    'space-infix-ops': 'error',
    'comma-spacing': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    
    // Function formatting
    'space-before-function-paren': ['error', {
      'anonymous': 'never',
      'named': 'never',
      'asyncArrow': 'always'
    }],
    
    // Line length
    'max-len': ['warn', { 
      'code': 120, 
      'ignoreUrls': true,
      'ignoreStrings': true,
      'ignoreTemplateLiterals': true
    }],
  },
  globals: {
    // Browser globals
    'window': 'readonly',
    'document': 'readonly',
    'console': 'readonly',
    'alert': 'readonly',
    'confirm': 'readonly',
    'fetch': 'readonly',
    'localStorage': 'readonly',
    'URL': 'readonly',
    
    // Application globals (to be reduced in future steps)
    'currentTab': 'writable',
    'people': 'writable',
    'tags': 'writable',
    'HOST_CONFIG': 'writable',
    'ApiService': 'readonly',
    'Modal': 'readonly',
    'FormValidator': 'readonly',
    'MultiSelectManager': 'readonly',
    'BulkActionBar': 'readonly',
    'CheckboxColumn': 'readonly',
  },
};
