const proxyCRUD = require("./proxy/proxyCRUDService");
const proxyQuery = require("./proxy/proxyQueryService");
const proxyHealth = require("./proxy/proxyHealthService");
const proxySwitch = require("./proxy/proxySwitchService");


module.exports = {
  // CRUD Operations
  addProxy: proxyCRUD.addProxy,
  removeProxy: proxyCRUD.removeProxy,
  updateProxy: proxyCRUD.updateProxy,
  clearAllProxies: proxyCRUD.clearAllProxies,
  
  // Query Operations
  getProxies: proxyQuery.getProxies,
  getAvailableProxies: proxyQuery.getAvailableProxies,
  getLastMonthProxies: proxyQuery.getLastMonthProxies,
  getNextProxy: proxyQuery.getNextProxy,
  getProxyStats: proxyQuery.getProxyStats,
  getProxyManagementStats: proxyQuery.getProxyManagementStats, // ✅ NEW: Added this
  searchProxies: proxyQuery.searchProxies,
  
  // Health Operations
  updateProxyStatus: proxyHealth.updateProxyStatus,
  checkProxyHealth: proxyHealth.checkProxyHealth,
  getSystemHealth: proxyHealth.getSystemHealth,
  bulkUpdateStatus: proxyHealth.bulkUpdateStatus,
  getPerformanceMetrics: proxyHealth.getPerformanceMetrics,
  
  // NEW: Scraper Proxy Health Functions
  markProxyAsFailed: proxyHealth.markProxyAsFailed,      // ← Scraper calls this
  markProxyAsWorking: proxyHealth.markProxyAsWorking,    // ← Scraper calls this  
  getNextWorkingProxy: proxyHealth.getNextWorkingProxy,  // ← Scraper calls this
  
  // Switch Operations
  switchToNextWorkingProxy: proxySwitch.switchToNextWorkingProxy,
  getNextAvailableProxy: proxySwitch.getNextAvailableProxy,
  getProxyRotationHistory: proxySwitch.getProxyRotationHistory,
  forceRotateToProxy: proxySwitch.forceRotateToProxy,
  getFailoverRecommendations: proxySwitch.getFailoverRecommendations
};