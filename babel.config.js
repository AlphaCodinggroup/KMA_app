module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['.'],
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
          alias: {
            '@shared': './src/shared',
            '@entities': './src/entities',
            '@features': './src/features',
            '@processes': './src/processes',
            '@core': './src/core',
            '@app': './app',
          },
        },
      ],
    ],
  }
}
