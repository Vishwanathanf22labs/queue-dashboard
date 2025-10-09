const proxyCRUD = require("./proxy/proxyCRUDService");
const proxyQuery = require("./proxy/proxyQueryService");
const proxyHealth = require("./proxy/proxyHealthService");
const proxySwitch = require("./proxy/proxySwitchService");


module.exports = {
  // CRUD Operations
  addProxy: (ip, port, country, username, password, type, namespace, userAgent, viewport, version, environment = 'production') => 
    proxyCRUD.addProxy(ip, port, country, username, password, type, namespace, userAgent, viewport, version, environment),
  removeProxy: (proxyKey, environment = 'production') => proxyCRUD.removeProxy(proxyKey, environment),
  updateProxy: (proxyKey, updates, environment = 'production') => proxyCRUD.updateProxy(proxyKey, updates, environment),
  clearAllProxies: proxyCRUD.clearAllProxies,
  
  // Query Operations
  getProxies: (page, limit, filter, search, environment = 'production') => proxyQuery.getProxies(page, limit, filter, search, environment),
  getAvailableProxies: proxyQuery.getAvailableProxies,
  getLastMonthProxies: proxyQuery.getLastMonthProxies,
  getNextProxy: proxyQuery.getNextProxy,
  getProxyStats: proxyQuery.getProxyStats,
  getProxyManagementStats: proxyQuery.getProxyManagementStats, // ✅ NEW: Added this
  searchProxies: proxyQuery.searchProxies,
  
  // Health Operations
  updateProxyStatus: (proxyKey, isWorking, environment = 'production') => proxyHealth.updateProxyStatus(proxyKey, isWorking, environment),
  checkProxyHealth: proxyHealth.checkProxyHealth,
  getSystemHealth: proxyHealth.getSystemHealth,
  bulkUpdateStatus: proxyHealth.bulkUpdateStatus,
  getPerformanceMetrics: proxyHealth.getPerformanceMetrics,
  
  // NEW: Scraper Proxy Health Functions
  markProxyAsFailed: proxyHealth.markProxyAsFailed,      // ← Scraper calls this
  markProxyAsWorking: proxyHealth.markProxyAsWorking,    // ← Scraper calls this  
  getNextWorkingProxy: proxyHealth.getNextWorkingProxy,  // ← Scraper calls this
  
  // NEW: Proxy Lock Functions
  lockProxy: proxyHealth.lockProxy,                       // ← Lock proxy functionality
  unlockProxy: proxyHealth.unlockProxy,                   // ← Unlock proxy functionality
  
  // Switch Operations
  switchToNextWorkingProxy: proxySwitch.switchToNextWorkingProxy,
  getNextAvailableProxy: proxySwitch.getNextAvailableProxy,
  getProxyRotationHistory: proxySwitch.getProxyRotationHistory,
  forceRotateToProxy: proxySwitch.forceRotateToProxy,
  getFailoverRecommendations: proxySwitch.getFailoverRecommendations
};