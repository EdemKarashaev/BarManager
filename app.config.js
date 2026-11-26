const release = require('./src/config/release.json');

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    bmRelease: {
      version: release.version,
      releasedAt: release.releasedAt,
      changelog: release.changelog,
    },
  },
});
