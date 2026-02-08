/**
 * Metro config to blacklist @react-pdf from native bundling.
 * Use a plain RegExp to avoid requiring metro-config internals on Windows.
 */
const blacklistRE = /node_modules\/@react-pdf\/.*/;

module.exports = {
  resolver: {
    blacklistRE,
  },
};
