module.exports = {
    extends: ['react-app', 'react-app/jest'],
    plugins: ['jest'],
    env: {
      browser: true,
      es2021: true,
      'jest/globals': true
    },
    rules: {
      // Add any custom rules here
    }
  };