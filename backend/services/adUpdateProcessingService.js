const { PAGINATION, JOB_FETCH_LIMIT } = require("../config/constants");
const { getQueueRedis, getGlobalRedis } = require("../utils/redisSelector");
const logger = require("../utils/logger");
const { Op } = require("sequelize");
const { 
  getQueueCache, 
  setQueueCache, 
  getQueueETag, 
  setQueueETag, 
  generateETag
} = require("./utils/cacheUtils");
// Dynamic model imports to handle environment switches
const getModels = () => require("../models");

// Pipeline-style caching for queue APIs (same as pipeline status page)
const QUEUE_CACHE_TTL = 30; // 30 seconds for faster updates

// Pre-computed job index for ultra-fast pagination
let adUpdateJobIndex = {
  regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
  watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
};

// Pre-computed brand cache for ultra-fast database lookups
let brandCache = new Map(); // brandId -> brandData
let brandCacheLastUpdated = 0;

// Cache refresh intervals - optimized for speed
const JOB_INDEX_REFRESH_INTERVAL = 30000; // 30 seconds for faster updates
const BRAND_CACHE_REFRESH_INTERVAL = 60000; // 1 minute for brand data

// Get cached queue data with ETag support (pipeline-style)
async function getCachedAdUpdateQueueData(queueType, page, limit, sortBy, sortOrder, ifNoneMatch) {
  const cacheKey = `queue:ad-update:${queueType}:p${page}:l${limit}:s${sortBy}:o${sortOrder}`;
  
  try {
    // Check ETag first
    if (ifNoneMatch) {
      const cachedETag = await getQueueETag('ad-update', page, limit, sortBy, sortOrder);
      if (cachedETag === ifNoneMatch) {
        return { status: 304, etag: cachedETag };
      }
    }
    
    // Try to get cached data
    const cachedData = await getQueueCache('ad-update', page, limit, sortBy, sortOrder);
    if (cachedData) {
      const etag = await getQueueETag('ad-update', page, limit, sortBy, sortOrder) || generateETag(cachedData);
      return { data: cachedData, etag, status: 200 };
    }
    
    return null;
  } catch (error) {
    logger.error('Error in cache lookup:', error);
    return null;
  }
}

// Get pre-computed queue counters for ad-update
async function getPreComputedAdUpdateQueueCounters(redis, queueType) {
  const counterKey = `queue:ad-update:${queueType}:counters`;
  
  try {
    // Try to get cached counters first
    const counters = await redis.hgetall(counterKey);
    if (Object.keys(counters).length > 0) {
      return {
        waiting: parseInt(counters.waiting) || 0,
        active: parseInt(counters.active) || 0,
        prioritized: parseInt(counters.prioritized) || 0,
        delayed: parseInt(counters.delayed) || 0,
        completed: parseInt(counters.completed) || 0,
        failed: parseInt(counters.failed) || 0,
        total: parseInt(counters.total) || 0
      };
    }
    
    // Fallback: Read directly from BullMQ queue data structures
    const [waitingJobs, waitJobs, activeJobs, prioritizedCount, completedCount, failedCount, delayedCount] = await Promise.all([
      redis.lrange(`bull:ad-update:waiting`, 0, -1).catch(() => []),
      redis.lrange(`bull:ad-update:wait`, 0, -1).catch(() => []), // Handle both wait and waiting
      redis.lrange(`bull:ad-update:active`, 0, -1).catch(() => []),
      // Prioritized, completed, failed, and delayed are stored as sorted sets
      redis.zcard(`bull:ad-update:prioritized`).catch(() => 0),
      redis.zcard(`bull:ad-update:completed`).catch(() => 0),
      redis.zcard(`bull:ad-update:failed`).catch(() => 0),
      redis.zcard(`bull:ad-update:delayed`).catch(() => 0)
    ]);
    
    // Combine waiting and wait lists
    const allWaitingJobs = [...new Set([...waitingJobs, ...waitJobs])];
    
    const realCounters = {
      waiting: allWaitingJobs.length,
      active: activeJobs.length,
      prioritized: prioritizedCount,
      delayed: delayedCount,
      completed: completedCount,
      failed: failedCount,
      total: allWaitingJobs.length + activeJobs.length + prioritizedCount + delayedCount + completedCount + failedCount
    };
    
    // Cache the real counters for future use
    try {
      await redis.hset(counterKey, realCounters);
      await redis.expire(counterKey, 10); // Cache for 10 seconds
    } catch (cacheError) {
      logger.warn(`Failed to cache counters: ${cacheError.message}`);
    }
    
    return realCounters;
  } catch (error) {
    logger.error(`Error getting pre-computed counters for ${queueType}:`, error);
    return {
      waiting: 0, active: 0, prioritized: 0, delayed: 0, completed: 0, failed: 0, total: 0
    };
  }
}

// Ultra-fast brand fetching using pre-computed cache
async function getBrandsFromCache(brandIds) {
  const startTime = process.hrtime.bigint();
  
  try {
    const now = Date.now();
    
    // Check if brand cache needs refresh
    if (brandCache.size === 0 || (now - brandCacheLastUpdated) > BRAND_CACHE_REFRESH_INTERVAL) {
      logger.info('Refreshing brand cache...');
      await refreshBrandCache();
    }
    
    // Get brands from cache (O(1) lookups)
    const brandMap = new Map();
    const missingBrandIds = [];
    
    brandIds.forEach(brandId => {
      const intBrandId = parseInt(brandId);
      if (brandCache.has(intBrandId)) {
        brandMap.set(brandId, brandCache.get(intBrandId));
      } else {
        missingBrandIds.push(intBrandId);
      }
    });
    
    // If we have missing brands, fetch them from DB and update cache
    if (missingBrandIds.length > 0) {
      logger.info(`Fetching ${missingBrandIds.length} missing brands from DB`);
      // Require Brand model dynamically to get the latest version
      const { Brand } = require("../models");
      const missingBrands = await Brand.findAll({
        where: { id: { [Op.in]: missingBrandIds } },
        attributes: ["id", "actual_name", "page_id", "category"],
        raw: true,
      });
      
      // Update cache and map
      missingBrands.forEach(brand => {
        brandCache.set(brand.id, brand);
        brandMap.set(brand.id, brand);
      });
    }
    
    const cacheDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Brand cache lookup completed in ${cacheDuration}ms: ${brandMap.size}/${brandIds.length} brands found`);
    
    return brandMap;
  } catch (error) {
    logger.error('Error in brand cache lookup:', error);
    return new Map();
  }
}

// Get brands by ad IDs (for ad-update jobs)
async function getBrandsByAdIds(adIds) {
  const startTime = process.hrtime.bigint();
  
  try {
    if (!adIds || adIds.length === 0) {
      return new Map();
    }
    
    logger.info(`Looking up brands for ${adIds.length} ad IDs`);
    
    // Query ads table to get brand_ids for the given ad IDs
    const { Ad } = getModels();
    const adsWithBrands = await Ad.findAll({
      where: { 
        id: { [Op.in]: adIds } 
      },
      attributes: ["id", "brand_id"],
      raw: true,
    });
    
    const brandIds = [...new Set(adsWithBrands.map(ad => ad.brand_id))];
    logger.info(`Found ${brandIds.length} unique brand IDs from ${adsWithBrands.length} ads`);
    
    if (brandIds.length === 0) {
      return new Map();
    }
    
    // Get brand details
    const { Brand } = getModels();
    const brands = await Brand.findAll({
      where: { id: { [Op.in]: brandIds } },
      attributes: ["id", "actual_name", "page_id", "category"],
      raw: true,
    });
    
    // Create mapping: adId -> brand data
    const adToBrandMap = new Map();
    adsWithBrands.forEach(ad => {
      const brand = brands.find(b => b.id === ad.brand_id);
      if (brand) {
        adToBrandMap.set(ad.id, brand);
      }
    });
    
    const cacheDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Brand lookup by ad IDs completed in ${cacheDuration}ms: ${adToBrandMap.size}/${adIds.length} ads mapped to brands`);
    
    return adToBrandMap;
  } catch (error) {
    logger.error('Error in brand lookup by ad IDs:', error);
    return new Map();
  }
}

// Refresh brand cache with all active brands
async function refreshBrandCache() {
  const startTime = process.hrtime.bigint();
  
  try {
    // Require Brand model dynamically to get the latest version
    const { Brand } = require("../models");
    const brands = await Brand.findAll({
      attributes: ["id", "actual_name", "page_id", "category"],
      raw: true,
    });
    
    // Clear and rebuild cache
    brandCache.clear();
    brands.forEach(brand => {
      brandCache.set(brand.id, brand);
    });
    
    brandCacheLastUpdated = Date.now();
    
    const cacheDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Brand cache refreshed in ${cacheDuration}ms: ${brands.length} brands cached`);
  } catch (error) {
    logger.error('Error refreshing brand cache:', error);
  }
}

// Refresh job index for ad-update queues
async function refreshAdUpdateJobIndex(redis, queueType) {
  const startTime = process.hrtime.bigint();
  
  try {
    logger.info(`Refreshing ad-update job index for ${queueType}...`);
    
    // Get all job IDs from BullMQ data structures
    let waitingJobs = [], waitJobs = [], activeJobs = [], prioritizedJobs = [], completedJobs = [], failedJobs = [], delayedJobs = [];
    
    try {
      [waitingJobs, waitJobs, activeJobs, prioritizedJobs, completedJobs, failedJobs, delayedJobs] = await Promise.all([
        redis.lrange(`bull:ad-update:waiting`, 0, -1).catch(() => []),
        redis.lrange(`bull:ad-update:wait`, 0, -1).catch(() => []), // Handle both wait and waiting
        redis.lrange(`bull:ad-update:active`, 0, -1).catch(() => []),
        redis.zrange(`bull:ad-update:prioritized`, 0, -1).catch(() => []),
        redis.zrange(`bull:ad-update:completed`, 0, -1).catch(() => []),
        redis.zrange(`bull:ad-update:failed`, 0, -1).catch(() => []),
        redis.zrange(`bull:ad-update:delayed`, 0, -1).catch(() => [])
      ]);
      
      // Combine waiting and wait lists
      const allWaitingJobs = [...new Set([...waitingJobs, ...waitJobs])];
      waitingJobs = allWaitingJobs;
      
    } catch (error) {
      logger.error(`Error reading BullMQ data for ${queueType}:`, error);
    }
    
    // Build job states map with precedence (active > waiting > prioritized > completed > failed > delayed)
    const jobStates = new Map();
    
    // Process in order of precedence (lowest to highest)
    delayedJobs.forEach(jobId => jobStates.set(jobId, 'delayed'));
    failedJobs.forEach(jobId => jobStates.set(jobId, 'failed'));
    completedJobs.forEach(jobId => jobStates.set(jobId, 'completed'));
    prioritizedJobs.forEach(jobId => jobStates.set(jobId, 'prioritized'));
    waitingJobs.forEach(jobId => jobStates.set(jobId, 'waiting'));
    activeJobs.forEach(jobId => jobStates.set(jobId, 'active')); // Highest priority - overwrites others
    
    // Get all unique job IDs
    const allJobIds = new Set();
    waitingJobs.forEach(jobId => allJobIds.add(jobId));
    activeJobs.forEach(jobId => allJobIds.add(jobId));
    prioritizedJobs.forEach(jobId => allJobIds.add(jobId));
    completedJobs.forEach(jobId => allJobIds.add(jobId));
    failedJobs.forEach(jobId => allJobIds.add(jobId));
    delayedJobs.forEach(jobId => allJobIds.add(jobId));
    
    // Get job data from Redis using hgetall for each job
    const jobs = [];
    const brandIds = new Set();
    
    for (const jobId of allJobIds) {
      try {
        const jobData = await redis.hgetall(`bull:ad-update:${jobId}`);
        
        if (!jobData || !jobData.data) continue;
        
        try {
          const parsedJob = JSON.parse(jobData.data);
          const status = jobStates.get(jobId) || 'unknown';
          
          jobs.push({
            id: jobId,
            status: status,
            data: parsedJob,
            timestamp: parseInt(jobData.timestamp) || Date.now()
          });
          
          // Extract ad IDs for brand lookup (production format: {"adIds": [...]})
          if (parsedJob.adIds && Array.isArray(parsedJob.adIds)) {
            parsedJob.adIds.forEach(adId => {
              if (adId && !isNaN(adId)) {
                brandIds.add(adId.toString());
              }
            });
          }
        } catch (parseError) {
          logger.warn(`Failed to parse job data for ${jobId}:`, parseError);
        }
      } catch (error) {
        logger.warn(`Failed to get job data for ${jobId}:`, error);
      }
    }
    
    // Update job index
    adUpdateJobIndex[queueType] = {
      jobs: jobs.sort((a, b) => b.timestamp - a.timestamp),
      lastUpdated: Date.now(),
      brandIds: brandIds
    };
    
    const cacheDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`Ad-update job index refreshed for ${queueType} in ${cacheDuration}ms: ${jobs.length} jobs, ${brandIds.size} brands`);
    
  } catch (error) {
    logger.error(`Error refreshing ad-update job index for ${queueType}:`, error);
  }
}

// Get ad-update processing queue (paginated)
async function getAdUpdateQueue(
  page = PAGINATION.DEFAULT_PAGE,
  limit = PAGINATION.DEFAULT_LIMIT,
  queueType = "regular",
  sortBy = "normal",
  sortOrder = "desc",
  ifNoneMatch = null,
  search = null,
  environment = 'production'
) {
  const startTime = process.hrtime.bigint();
  
  try {
    const validPage = Math.max(1, parseInt(page));
    const validLimit = Math.min(
      Math.max(1, parseInt(limit)),
      PAGINATION.MAX_LIMIT
    );

    const redis = getQueueRedis(queueType, environment);
    
    if (!redis) {
      logger.error(`Redis not available for ${queueType}`);
      throw new Error(`Redis not available for ${queueType}`);
    }

    // CACHE CHECK: Skip cache if searching (search results shouldn't be cached)
    if (!search || !search.trim()) {
      const cachedResult = await getCachedAdUpdateQueueData(queueType, validPage, validLimit, sortBy, sortOrder, ifNoneMatch);
      if (cachedResult) {
        const cacheDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
        logger.info(`Cache HIT for ${queueType} ad-update queue in ${cacheDuration}ms`);
        
        if (cachedResult.status === 304) {
          return { status: 304, etag: cachedResult.etag };
        }
        
        return {
          ...cachedResult.data,
          fromCache: true,
          cache_time_ms: Math.round(cacheDuration)
        };
      }
    }

    // OPTIMIZATION: Use pre-computed counters for O(1) access
    const preComputedCounters = await getPreComputedAdUpdateQueueCounters(redis, queueType);
    logger.info(`Pre-computed counters for ${queueType}:`, preComputedCounters);

    // ULTRA-OPTIMIZED: Use pre-computed index directly (no Redis calls)
    let allJobs = [];
    
    try {
      // Get jobs directly from pre-computed index (ultra-fast)
      const indexData = adUpdateJobIndex[queueType];
      
      if (indexData && indexData.jobs.length > 0) {
        allJobs = indexData.jobs;
        logger.info(`Ultra-fast job fetching from index: ${allJobs.length} jobs`);
      } else {
        // Fallback: refresh index if empty
        logger.info(`Index empty, refreshing for ${queueType}...`);
        await refreshAdUpdateJobIndex(redis, queueType);
        allJobs = adUpdateJobIndex[queueType]?.jobs || [];
        logger.info(`Job index refreshed: ${allJobs.length} jobs`);
      }
    } catch (error) {
      logger.error(`Error in ultra-fast job fetching:`, error);
      allJobs = [];
    }

    // Remove duplicates based on job ID
    const uniqueJobs = allJobs
      .filter((job, index, self) => index === self.findIndex((j) => j.id === job.id));

    // Extract all ad IDs from jobs for brand lookup
    const allAdIds = [];
    uniqueJobs.forEach(job => {
      if (job.data?.adIds && Array.isArray(job.data.adIds)) {
        allAdIds.push(...job.data.adIds.filter(adId => !isNaN(adId)));
      }
    });
    
    // Get brand data by ad IDs
    const adToBrandMap = await getBrandsByAdIds(allAdIds);

    // Build processing data
    const brandProcessingData = uniqueJobs.map(job => {
      // Get the first ad ID to determine the brand (all ads in a job belong to same brand)
      const firstAdId = job.data?.adIds && job.data.adIds.length > 0 ? job.data.adIds[0] : null;
      const brandData = firstAdId ? adToBrandMap.get(firstAdId) : null;
      
      return {
        brand_id: brandData?.id || job.id,
        page_id: brandData?.page_id || 'N/A',
        page_name: brandData?.actual_name || `Brand ${job.id}`,
        brand_name: brandData?.actual_name || `Brand ${job.id}`,
        total_ads: job.data?.adIds?.length || 0,
        page_category: brandData?.category || 'Unknown',
        created_at: new Date(job.timestamp).toISOString(),
        is_watchlist: queueType === 'watchlist',
        queue_type: queueType,
        job_status: job.status,
        job_id: job.id
      };
    });

    // SEARCH FILTERING: Apply search if provided (same pattern as brand processing queue)
    let filteredBrands = brandProcessingData;
    
    if (search && search.trim()) {
      const searchTerm = search.toLowerCase().trim();
      const normalizedSearchTerm = searchTerm.replace(/\s+/g, '');
      
      logger.info(`Searching ${queueType} ad-update queue for: "${searchTerm}"`);
      
      filteredBrands = brandProcessingData.filter(brand => {
        const brandName = brand.page_name?.toLowerCase() || '';
        const normalizedBrandName = brandName.replace(/\s+/g, '');
        
        return (
          // Original search (with spaces)
          brandName.includes(searchTerm) ||
          // Space-insensitive search
          normalizedBrandName.includes(normalizedSearchTerm) ||
          // ID searches
          brand.brand_id?.toString().includes(searchTerm) ||
          brand.page_id?.toString().includes(searchTerm)
        );
      });
      
      logger.info(`Search results: ${filteredBrands.length} brands found for "${searchTerm}"`);
    }

    // Apply sorting
    if (sortBy === 'total_ads') {
      filteredBrands.sort((a, b) => {
        const result = a.total_ads - b.total_ads;
        return sortOrder === 'desc' ? -result : result;
      });
    } else if (sortBy === 'created_at') {
      filteredBrands.sort((a, b) => {
        const result = new Date(a.created_at) - new Date(b.created_at);
        return sortOrder === 'desc' ? -result : result;
      });
    }

    // Apply pagination
    const totalItems = filteredBrands.length;
    const totalPages = Math.ceil(totalItems / validLimit);
    const startIndex = (validPage - 1) * validLimit;
    const endIndex = startIndex + validLimit;
    const currentPageBrands = filteredBrands.slice(startIndex, endIndex);

    // Calculate current page total ads
    const currentPageTotalAds = currentPageBrands.reduce((sum, brand) => sum + (brand.total_ads || 0), 0);
    
    // IMPORTANT: Always calculate totalAds from ORIGINAL unfiltered data
    const totalAdsAllBrands = brandProcessingData.reduce((sum, brand) => sum + (brand.total_ads || 0), 0);


    // Build response
    const response = {
      brands: currentPageBrands,
      pagination: {
        current_page: validPage,
        per_page: validLimit,
        total_items: totalItems,
        total_pages: totalPages
      },
      queue_type: queueType,
      analytics: {
        current_page_total_ads: currentPageTotalAds,
        processing_time_ms: Math.round(Number(process.hrtime.bigint() - startTime) / 1000000),
        pre_computed_counters: preComputedCounters,
        performance_metrics: {
          requestCount: 1,
          totalResponseTime: Number(process.hrtime.bigint() - startTime) / 1000000,
          cacheHits: 0,
          cacheMisses: 1,
          averageResponseTime: Number(process.hrtime.bigint() - startTime) / 1000000,
          lastReset: Date.now(),
          cacheHitRate: 0,
          uptime: process.uptime() * 1000
        }
      },
      [`total_ads_${queueType}`]: totalAdsAllBrands
    };

    // Generate ETag and cache the response (only if not searching)
    let etag = null;
    if (!search || !search.trim()) {
      etag = generateETag(response);
      await setQueueCache('ad-update', validPage, validLimit, response, sortBy, sortOrder, QUEUE_CACHE_TTL);
      await setQueueETag('ad-update', validPage, validLimit, etag, sortBy, sortOrder, QUEUE_CACHE_TTL);
    }

    const totalDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`getAdUpdateQueue (${queueType}) completed in ${totalDuration}ms - ${brandProcessingData.length} brands processed`);

    return {
      ...response,
      etag
    };

  } catch (error) {
    const errorDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.error(`Error in getAdUpdateQueue (${queueType}) after ${errorDuration}ms:`, error);
    throw error;
  }
}

// Get watchlist ad-update queue
async function getWatchlistAdUpdateQueue(page, limit, sortBy, sortOrder, ifNoneMatch, search = null, environment = 'production') {
  try {
    // Use the new getAdUpdateQueue function with watchlist queue type
    return await getAdUpdateQueue(page, limit, 'watchlist', sortBy, sortOrder, ifNoneMatch, search, environment);
  } catch (error) {
    logger.error("Error in getWatchlistAdUpdateQueue:", error);
    throw error;
  }
}

// Get ALL ad-update processing jobs without pagination (for dashboard cards)
async function getAllAdUpdateJobs(queueType = 'regular', ifNoneMatch = null, environment = 'production') {
  try {
    const startTime = process.hrtime.bigint();
    
    // Generate cache key for all jobs
    const cacheKey = `all_ad_update_jobs:${queueType}:${environment}`;
    
    // Check cache first
    if (ifNoneMatch) {
      const cachedETag = await getQueueETag(cacheKey);
      if (cachedETag === ifNoneMatch) {
        return { status: 304, etag: cachedETag };
      }
    }
    
    const cachedData = await getQueueCache(cacheKey);
    if (cachedData) {
      const etag = await getQueueETag(cacheKey) || generateETag(cachedData);
      return { ...cachedData, etag, fromCache: true };
    }
    
    // Get Redis instance
    const redis = getQueueRedis(queueType, environment);
    if (!redis) {
      throw new Error(`Redis instance not available for queue type: ${queueType}`);
    }
    
    // Get all job IDs from all BullMQ data structures
    const [waitingJobs, waitJobs, activeJobs, prioritizedJobsCount, completedJobs, failedJobs, delayedJobsCount] = await Promise.all([
      redis.lrange(`bull:ad-update:waiting`, 0, -1).catch(() => []),
      redis.lrange(`bull:ad-update:wait`, 0, -1).catch(() => []), // Handle both wait and waiting
      redis.lrange(`bull:ad-update:active`, 0, -1).catch(() => []),
      // Get prioritized jobs count (for counter)
      redis.zcard(`bull:ad-update:prioritized`).catch(() => 0),
      redis.zrange(`bull:ad-update:completed`, 0, -1).catch(() => []),
      redis.zrange(`bull:ad-update:failed`, 0, -1).catch(() => []),
      // Get delayed jobs count from sorted set
      redis.zcard(`bull:ad-update:delayed`).catch(() => 0)
    ]);
    
    // Combine waiting and wait lists
    const allWaitingJobs = [...new Set([...waitingJobs, ...waitJobs])];
    
    // Get highest priority jobs (lowest scores = highest priority) - only top 3 like delayed
    const highestPriorityJobs = await redis.zrange(`bull:ad-update:prioritized`, 0, 2).catch(() => []);
    logger.info(`Prioritized jobs: count=${prioritizedJobsCount}, highest priority 3 jobs=${highestPriorityJobs.join(', ')}`);
    
    // Get latest 2 delayed jobs (highest scores = most recent timestamps) for detailed data
    const delayedJobsWithScores = await redis.zrevrange(`bull:ad-update:delayed`, 0, 1, 'WITHSCORES').catch(() => []);
    const delayedJobs = [];
    const delayedTimestamps = {};
    
    // Process delayed jobs with their scores (timestamps)
    for (let i = 0; i < delayedJobsWithScores.length; i += 2) {
      const jobId = delayedJobsWithScores[i];
      const score = delayedJobsWithScores[i + 1];
      
      delayedJobs.push(jobId);
      
      // Convert BullMQ score to actual timestamp
      const timestamp = Number(BigInt(score) >> 12n);
      delayedTimestamps[jobId] = new Date(timestamp).toISOString();
      
      logger.info(`Delayed job ${jobId} scheduled for: ${delayedTimestamps[jobId]}`);
    }
    
    logger.info(`Delayed jobs: count=${delayedJobsCount}, latest 2 jobs=${delayedJobs.join(', ')}`);
    
    // Helper function to get job data from Redis
    const getJobData = async (jobId, status) => {
      try {
        const jobData = await redis.hgetall(`bull:ad-update:${jobId}`);
        
        // Parse job data the same way as the existing API
        let totalAds = 0;
        let brandId = jobId;
        let pageCategory = null;
        let createdAt = new Date().toISOString();
        let delayedUntil = null;
        let statusTimestamp = new Date().toISOString();
        
        if (jobData.data) {
          try {
            const parsedJob = JSON.parse(jobData.data);
            
            // Handle production format: {"adIds": [...]}
            if (parsedJob.adIds && Array.isArray(parsedJob.adIds)) {
              totalAds = parsedJob.adIds.length;
              // Use first ad ID as brand identifier for now
              brandId = parsedJob.adIds.length > 0 ? parsedJob.adIds[0] : jobId;
            } else {
              // Fallback for other formats
              brandId = parsedJob.brandId || jobId;
              totalAds = parsedJob.totalAds?.length || 0;
            }
            
            createdAt = new Date(parseInt(jobData.timestamp) || Date.now()).toISOString();
            
            // Set appropriate timestamp based on job status
            if (status === 'active') {
              statusTimestamp = jobData.processedOn ? new Date(parseInt(jobData.processedOn)).toISOString() : createdAt;
            } else if (status === 'completed' || status === 'failed') {
              statusTimestamp = jobData.finishedOn ? new Date(parseInt(jobData.finishedOn)).toISOString() : createdAt;
            } else {
              statusTimestamp = createdAt;
            }
            
            // Set delayed until for delayed jobs
            if (status === 'delayed' && delayedTimestamps[jobId]) {
              delayedUntil = delayedTimestamps[jobId];
            }
          } catch (parseError) {
            logger.warn(`Failed to parse job data for ${jobId}:`, parseError);
          }
        }
        
        return {
          brand_id: brandId,
          page_id: 'N/A', // Will be filled from brand cache
          page_name: `Brand ${brandId}`,
          brand_name: `Brand ${brandId}`,
          total_ads: totalAds,
          page_category: pageCategory || 'Unknown',
          created_at: createdAt,
          status_timestamp: statusTimestamp,
          delayed_until: delayedUntil,
          is_watchlist: queueType === 'watchlist',
          queue_type: queueType,
          job_status: status,
          job_id: jobId,
          adIds: jobData.data ? JSON.parse(jobData.data).adIds : null // Include adIds for brand lookup
        };
      } catch (error) {
        logger.warn(`Error getting job data for ${jobId}:`, error);
        return {
          brand_id: jobId,
          page_id: 'N/A',
          page_name: `Brand ${jobId}`,
          brand_name: `Brand ${jobId}`,
          total_ads: 0,
          page_category: 'Unknown',
          created_at: new Date().toISOString(),
          status_timestamp: new Date().toISOString(),
          delayed_until: null,
          is_watchlist: queueType === 'watchlist',
          queue_type: queueType,
          job_status: status,
          job_id: jobId
        };
      }
    };
    
    // Get all job data
    const allJobs = [];
    
    // Process active jobs
    for (const jobId of activeJobs) {
      const jobData = await getJobData(jobId, 'active');
      allJobs.push(jobData);
    }
    
    // Process waiting jobs
    for (const jobId of allWaitingJobs) {
      const jobData = await getJobData(jobId, 'waiting');
      allJobs.push(jobData);
    }
    
    // Process delayed jobs (only the latest 2 for detailed data)
    for (const jobId of delayedJobs) {
      const jobData = await getJobData(jobId, 'delayed');
      allJobs.push(jobData);
    }
    
    // Process prioritized jobs (only top 3 highest priority)
    for (const jobId of highestPriorityJobs) {
      const jobData = await getJobData(jobId, 'prioritized');
      allJobs.push(jobData);
    }
    
    // Process completed jobs (sample)
    const completedSample = completedJobs.slice(0, 3);
    for (const jobId of completedSample) {
      const jobData = await getJobData(jobId, 'completed');
      allJobs.push(jobData);
    }
    
    // Process failed jobs (sample)
    const failedSample = failedJobs.slice(0, 3);
    for (const jobId of failedSample) {
      const jobData = await getJobData(jobId, 'failed');
      allJobs.push(jobData);
    }
    
    // Extract all ad IDs from jobs for brand lookup
    const allAdIds = [];
    allJobs.forEach(job => {
      // Get ad IDs from the job data (stored in Redis)
      if (job.adIds && Array.isArray(job.adIds)) {
        allAdIds.push(...job.adIds.filter(adId => !isNaN(adId)));
      }
    });
    
    // Get brand data by ad IDs
    const adToBrandMap = await getBrandsByAdIds(allAdIds);
    
    // Update jobs with brand data
    allJobs.forEach(job => {
      // Get the first ad ID to determine the brand
      const firstAdId = job.adIds && job.adIds.length > 0 ? job.adIds[0] : null;
      const brandData = firstAdId ? adToBrandMap.get(firstAdId) : null;
      
      if (brandData) {
        job.brand_id = brandData.id;
        job.page_id = brandData.page_id || 'N/A';
        job.page_name = brandData.actual_name || job.page_name;
        job.brand_name = brandData.actual_name || job.brand_name;
        job.page_category = brandData.category || job.page_category;
      }
    });
    
    // Update counters with accurate counts
    const updatedCounters = {
      waiting: allWaitingJobs.length,
      active: activeJobs.length,
      prioritized: prioritizedJobsCount,
      delayed: delayedJobsCount,
      completed: completedJobs.length,
      failed: failedJobs.length,
      total: allWaitingJobs.length + activeJobs.length + prioritizedJobsCount + delayedJobsCount + completedJobs.length + failedJobs.length
    };
    
    const response = {
      brands: allJobs,
      queue_type: queueType,
      analytics: {
        current_page_total_ads: allJobs.reduce((sum, job) => sum + (job.total_ads || 0), 0),
        processing_time_ms: Math.round(Number(process.hrtime.bigint() - startTime) / 1000000),
        pre_computed_counters: updatedCounters,
        performance_metrics: {
          requestCount: 1,
          totalResponseTime: Number(process.hrtime.bigint() - startTime) / 1000000,
          cacheHits: 0,
          cacheMisses: 1,
          averageResponseTime: Number(process.hrtime.bigint() - startTime) / 1000000,
          lastReset: Date.now(),
          cacheHitRate: 0,
          uptime: process.uptime() * 1000
        }
      },
      [`total_ads_${queueType}`]: allJobs.reduce((sum, job) => sum + (job.total_ads || 0), 0)
    };
    
    // Cache the response
    const etag = generateETag(response);
    await setQueueCache(cacheKey, response, 300); // Cache for 5 minutes
    await setQueueETag(cacheKey, etag, 300);
    
    const totalDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.info(`getAllAdUpdateJobs (${queueType}) completed in ${totalDuration}ms - ${allJobs.length} jobs processed`);
    
    return {
      ...response,
      etag
    };
    
  } catch (error) {
    const errorDuration = Number(process.hrtime.bigint() - startTime) / 1000000;
    logger.error(`Error in getAllAdUpdateJobs for ${queueType} after ${errorDuration}ms:`, error);
    throw error;
  }
}

// Function to clear all caches (useful for environment switches)
function clearAdUpdateCache() {
  try {
    // Clear job indexes
    adUpdateJobIndex = {
      regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
      watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
    };
    
    // Clear brand cache
    brandCache.clear();
    
    logger.info("Ad update processing cache cleared");
  } catch (error) {
    logger.error("Error clearing ad update cache:", error);
  }
}

// Clear all in-memory caches
function clearInMemoryCaches() {
  try {
    // Clear job index
    adUpdateJobIndex = {
      regular: { jobs: [], lastUpdated: 0, brandIds: new Set() },
      watchlist: { jobs: [], lastUpdated: 0, brandIds: new Set() }
    };
    
    // Clear brand cache
    brandCache.clear();
    brandCacheLastUpdated = 0;
    
    console.log('AdUpdateProcessingService in-memory caches cleared');
  } catch (error) {
    console.error('Error clearing AdUpdateProcessingService caches:', error);
  }
}

const serviceExports = {
  getAdUpdateQueue,
  getWatchlistAdUpdateQueue,
  getAllAdUpdateJobs,
  refreshAdUpdateJobIndex,
  getPreComputedAdUpdateQueueCounters,
  clearAdUpdateCache,
  clearInMemoryCaches
};

// Set global reference for cache clearing
global.adUpdateProcessingService = serviceExports;

module.exports = serviceExports;

