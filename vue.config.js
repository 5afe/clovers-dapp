// var BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const path = require('path');
const webpack = require('webpack');
const { defineConfig } = require('@vue/cli-service');
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

const production = process.env.NODE_ENV === 'production';

module.exports = {
  lintOnSave: false,
  devServer: {
    allowedHosts: 'all',
    // https: true
  },
  transpileDependencies: true,
  configureWebpack: {
    optimization: {
      splitChunks: {
        chunks: 'all',
      },
    },
    devtool: 'source-map',
    plugins: [
      new NodePolyfillPlugin(),
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/locale$/,
        contextRegExp: /moment$/,
      }),
    ],
    output: {
      globalObject: 'this',
    },
    resolve: {
      alias: {
        'bn.js': path.resolve(__dirname, 'node_modules/bn.js'),
        underscore: path.resolve(__dirname, 'node_modules/underscore'),
      },
    },
  },
  // (dev) force Safari not to cache
  chainWebpack: (config) => {
    if (process.env.NODE_ENV === 'development') {
      config.output.filename('[name].[hash].js').end();
    }
  },
};
