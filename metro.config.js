const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Let Metro bundle the .sql migration files produced by drizzle-kit.
config.resolver.sourceExts.push('sql');

module.exports = config;
