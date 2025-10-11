const proxyCRUD = require("./proxy/proxyCRUDService");
const proxyQuery = require("./proxy/proxyQueryService");
const proxyHealth = require("./proxy/proxyHealthService");
const proxySwitch = require("./proxy/proxySwitchService");


module.exports = {
  addProxy: (ip, port, country, username, password, type, namespace, userAgent, viewport, version, environment = 'production') =>
    proxyCRUD.addProxy(ip, port, country, username, password, type, namespace, userAgent, viewport, version, environment),
  removeProxy: (proxyKey, environment = 'production') => proxyCRUD.removeProxy(proxyKey, environment),
  updateProxy: (proxyKey, updates, environment = 'production') => proxyCRUD.updateProxy(proxyKey, updates, environment),
  clearAllProxies: proxyCRUD.clearAllProxies,

  getProxies: (page, limit, filter, search, environment = 'production') => proxyQuery.getProxies(page, limit, filter, search, environment),
  getAvailableProxies: proxyQuery.getAvailableProxies,
  getLastMonthProxies: proxyQuery.getLastMonthProxies,
  getNextProxy: proxyQuery.getNextProxy,
  getProxyStats: proxyQuery.getProxyStats,
  getProxyManagementStats: proxyQuery.getProxyManagementStats,
  searchProxies: proxyQuery.searchProxies,

  updateProxyStatus: (proxyKey, isWorking, environment = 'production') => proxyHealth.updateProxyStatus(proxyKey, isWorking, environment),
  checkProxyHealth: proxyHealth.checkProxyHealth,
  getSystemHealth: proxyHealth.getSystemHealth,
  bulkUpdateStatus: proxyHealth.bulkUpdateStatus,
  getPerformanceMetrics: proxyHealth.getPerformanceMetrics,

  markProxyAsFailed: proxyHealth.markProxyAsFailed,
  markProxyAsWorking: proxyHealth.markProxyAsWorking,
  getNextWorkingProxy: proxyHealth.getNextWorkingProxy,

  lockProxy: proxyHealth.lockProxy,
  unlockProxy: proxyHealth.unlockProxy,

  switchToNextWorkingProxy: proxySwitch.switchToNextWorkingProxy,
  getNextAvailableProxy: proxySwitch.getNextAvailableProxy,
  getProxyRotationHistory: proxySwitch.getProxyRotationHistory,
  forceRotateToProxy: proxySwitch.forceRotateToProxy,
  getFailoverRecommendations: proxySwitch.getFailoverRecommendations
};