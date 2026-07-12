// Metro configuré pour le monorepo npm workspaces.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Surveiller toute la racine du monorepo (pour @moodly/shared).
config.watchFolders = [workspaceRoot];
// Résoudre les modules depuis le paquet local puis la racine hoistée.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
