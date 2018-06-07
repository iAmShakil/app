/* eslint-disable */

(function directusConfig() {
  const config = {
    api: {
      'https://demo-api.getdirectus.com': 'Directus Demo API'
    },
    allowOtherAPI: false,
    routerMode: "history" // or "hash"
  };

  window.__DirectusConfig__ = config;
}());
