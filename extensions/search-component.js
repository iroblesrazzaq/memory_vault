/**
 * Enhanced semantic search functionality for the browser history extension
 * This component handles semantic queries via lightweight methods and API calls
 */

class SemanticSearchEngine {
  constructor() {
    // Core configuration
    this.MIN_RELEVANCE_SCORE = 0.35; // Slightly more inclusive than before
    this.MAX_RESULTS = 20;
    this.VECTOR_CACHE_KEY = "semanticVectorCache"; // Cache for recent query embeddings
    
    // Intent recognition patterns for common search types
    this.QUERY_INTENTS = {
      FUNNY: {
        keywords: ['funny', 'humor', 'comedy', 'laugh', 'hilarious', 'joke', 'meme', 'amusing'],
        domains: ['youtube.com', 'tiktok.com', 'reddit.com', 'imgur.com', 'giphy.com', 'vimeo.com', 'dailymotion.com'],
        boost: 0.25 // Higher boost for this category
      },
      SHOPPING: {
        keywords: ['buy', 'purchase', 'shop', 'product', 'price', 'discount', 'deal', 'store', 'cart', 'checkout'],
        domains: ['amazon.com', 'ebay.com', 'walmart.com', 'etsy.com', 'shopify.com', 'bestbuy.com', 'target.com'],
        boost: 0.20
      },
      NEWS: {
        keywords: ['news', 'article', 'report', 'current', 'event', 'update', 'latest', 'breaking', 'headline'],
        domains: ['cnn.com', 'bbc.com', 'nytimes.com', 'wsj.com', 'reuters.com', 'apnews.com', 'washingtonpost.com'],
        boost: 0.20
      },
      RECIPE: {
        keywords: ['recipe', 'cook', 'food', 'meal', 'dish', 'ingredient', 'bake', 'kitchen', 'dinner', 'breakfast'],
        domains: ['allrecipes.com', 'foodnetwork.com', 'epicurious.com', 'simplyrecipes.com', 'tasty.co', 'bonappetit.com'],
        boost: 0.20
      },
      TECH: {
        keywords: ['technology', 'software', 'program', 'code', 'app', 'device', 'tech', 'computer', 'developer', 'github'],
        domains: ['github.com', 'stackoverflow.com', 'techcrunch.com', 'wired.com', 'theverge.com', 'arstechnica.com'],
        boost: 0.20
      },
      LEARN: {
        keywords: ['learn', 'course', 'tutorial', 'education', 'study', 'guide', 'how to', 'lesson', 'training'],
        domains: ['udemy.com', 'coursera.org', 'khanacademy.org', 'edx.org', 'youtube.com', 'linkedin.com/learning'],
        boost: 0.18
      }
    };
    
    // Initialize vector cache
    this._initVectorCache();
  }
  
  /**
   * Initialize or load the vector cache for recently used queries
   * This reduces redundant API calls for common searches
   */
  async _initVectorCache() {
    try {
      const storage = await chrome.storage.local.get(this.VECTOR_CACHE_KEY);
      this.vectorCache = storage[this.VECTOR_CACHE_KEY] || {
        queries: {},        // Map query text to embedding vectors
        lastCleaned: null,  // Timestamp of last cache cleanup
        maxEntries: 50      // Maximum cache entries
      };
    } catch (error) {
      console.error("Error initializing vector cache:", error);
      this.vectorCache = { queries: {}, lastCleaned: null, maxEntries: 50 };
    }
  }
  
  /**
   * Main search method that combines vector similarity with heuristic techniques
   * @param {string} query - User's search query
   * @param {Array} historyItems - Array of browser history items
   * @param {Array} queryEmbedding - Vector embedding of the query (if available)
   * @returns {Array} - Sorted array of relevant results
   */
  async search(query, historyItems, queryEmbedding) {
    if (!query || !historyItems || historyItems.length === 0) {
      return [];
    }
    
    try {
      // Clean and normalize query
      const normalizedQuery = query.toLowerCase().trim();
      
      // Analyze query to detect intent and entities
      const queryAnalysis = this._analyzeQuery(normalizedQuery);
      
      // Get embedding vector from cache if available
      if (!queryEmbedding && this.vectorCache.queries[normalizedQuery]) {
        queryEmbedding = this.vectorCache.queries[normalizedQuery].vector;
        console.log("Using cached embedding for query:", normalizedQuery);
      }
      
      // Score all history items using multiple techniques
      const scoredResults = historyItems.map(item => {
        // Start with zero score - we'll build it up
        let score = 0;
        
        // 1. Vector similarity if embeddings are available (heaviest weight)
        if (queryEmbedding && item.fullEmbedding) {
          const similarity = this._calculateVectorSimilarity(queryEmbedding, item.fullEmbedding);
          score += similarity * 0.6; // 60% of score comes from vector similarity
        }
        
        // 2. Apply intent and domain boosting
        score = this._applyIntentBoosting(item, score, queryAnalysis);
        
        // 3. Apply text matching (for cases where vector similarity isn't available)
        score = this._applyTextMatching(item, score, normalizedQuery, queryAnalysis);
        
        // 4. Apply recency boost (small factor)
        score = this._applyRecencyBoost(item, score);
        
        return {
          ...item,
          score: Math.min(1.0, score) // Cap score at 1.0
        };
      });
      
      // Cache the query embedding if it's new
      if (queryEmbedding && !this.vectorCache.queries[normalizedQuery]) {
        this._cacheQueryEmbedding(normalizedQuery, queryEmbedding);
      }
      
      // Filter by minimum relevance and sort by score
      return scoredResults
        .filter(item => item.score >= this.MIN_RELEVANCE_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.MAX_RESULTS);
        
    } catch (error) {
      console.error("Error in semantic search:", error);
      // Fall back to basic text search
      return this._fallbackSearch(query, historyItems);
    }
  }
  
  /**
   * Analyze the query to detect intent, keywords, and entities
   * @param {string} query - The normalized query string
   * @returns {Object} - Analysis results
   */
  _analyzeQuery(query) {
    const analysis = {
      detectedIntents: [],
      keywords: new Set(),
      entities: new Set()
    };
    
    // Detect intents based on keyword matching
    for (const [intentName, intentData] of Object.entries(this.QUERY_INTENTS)) {
      // Check if query contains any intent keywords
      const matchedKeywords = intentData.keywords.filter(keyword => {
        // Handle multi-word keywords and standalone words
        if (keyword.includes(' ')) {
          return query.includes(keyword);
        } else {
          // For single words, match whole words only (prevent partial matches)
          const regex = new RegExp(`\\b${keyword}\\b`, 'i');
          return regex.test(query);
        }
      });
      
      if (matchedKeywords.length > 0) {
        analysis.detectedIntents.push({
          intent: intentName,
          strength: matchedKeywords.length / intentData.keywords.length,
          matches: matchedKeywords
        });
        
        // Add keywords to the set
        matchedKeywords.forEach(kw => analysis.keywords.add(kw));
      }
    }
    
    // Extract potential entities (proper nouns, quoted phrases, etc.)
    // Look for phrases in quotes
    const quotedMatches = query.match(/"([^"]*)"|'([^']*)'/g);
    if (quotedMatches) {
      quotedMatches.forEach(match => {
        const clean = match.replace(/['"]/g, '').trim();
        if (clean) analysis.entities.add(clean);
      });
    }
    
    // Extract capitalized words that might be entities (proper nouns)
    const words = query.split(/\s+/);
    words.forEach(word => {
      if (word.length > 1 && word[0] === word[0].toUpperCase() && word[1] === word[1].toLowerCase()) {
        analysis.entities.add(word);
      }
    });
    
    return analysis;
  }
  
  /**
   * Apply boosting based on detected intents and domain relevance
   * @param {Object} item - History item
   * @param {number} baseScore - Current score
   * @param {Object} queryAnalysis - Query analysis results
   * @returns {number} - Updated score
   */
  _applyIntentBoosting(item, baseScore, queryAnalysis) {
    let score = baseScore;
    const { detectedIntents } = queryAnalysis;
    
    if (detectedIntents.length === 0) {
      return score;
    }
    
    // Extract domain from URL
    const domain = this._extractDomain(item.url);
    
    // For each detected intent, check domain and content matches
    detectedIntents.forEach(detectedIntent => {
      const intentName = detectedIntent.intent;
      const intentData = this.QUERY_INTENTS[intentName];
      
      // Domain boosting
      if (intentData.domains.some(d => domain.includes(d))) {
        score += intentData.boost * detectedIntent.strength;
      }
      
      // Content relevance boosting
      const title = item.title ? item.title.toLowerCase() : '';
      const summary = item.summary ? item.summary.toLowerCase() : '';
      
      // Check for intent keywords in title and summary
      const hasKeywordInTitle = intentData.keywords.some(keyword => title.includes(keyword));
      const hasKeywordInSummary = intentData.keywords.some(keyword => summary.includes(keyword));
      
      if (hasKeywordInTitle) {
        score += intentData.boost * 0.5 * detectedIntent.strength;
      }
      
      if (hasKeywordInSummary) {
        score += intentData.boost * 0.3 * detectedIntent.strength;
      }
    });
    
    return score;
  }
  
  /**
   * Apply text matching for cases where vector similarity isn't available
   * @param {Object} item - History item
   * @param {number} baseScore - Current score
   * @param {string} query - Normalized query
   * @param {Object} queryAnalysis - Query analysis results
   * @returns {number} - Updated score
   */
  _applyTextMatching(item, baseScore, query, queryAnalysis) {
    let score = baseScore;
    
    // Get item text fields
    const title = item.title ? item.title.toLowerCase() : '';
    const summary = item.summary ? item.summary.toLowerCase() : '';
    const url = item.url.toLowerCase();
    
    // Direct query matches
    if (title.includes(query)) {
      score += 0.35; // Strong boost for exact title match
    } else if (summary.includes(query)) {
      score += 0.25; // Medium boost for summary match
    }
    
    // Entity matches
    queryAnalysis.entities.forEach(entity => {
      const entityLower = entity.toLowerCase();
      if (title.includes(entityLower)) {
        score += 0.15; // Boost for entity in title
      } else if (summary.includes(entityLower)) {
        score += 0.10; // Boost for entity in summary
      }
    });
    
    // URL pattern matching (for specific queries about sites)
    if (query.includes('site:') || query.includes('website')) {
      const domains = Array.from(queryAnalysis.keywords)
        .filter(kw => kw.endsWith('.com') || kw.endsWith('.org') || kw.endsWith('.net'));
      
      domains.forEach(domain => {
        if (url.includes(domain)) {
          score += 0.30; // Strong boost for matching domains when user is looking for specific sites
        }
      });
    }
    
    // Handle time-based queries
    if (query.includes('today') || query.includes('yesterday') || query.includes('recent')) {
      // This will work in conjunction with the recency boost
      score += 0.15;
    }
    
    return score;
  }
  
  /**
   * Apply a recency boost to favor more recent items
   * @param {Object} item - History item
   * @param {number} baseScore - Current score
   * @returns {number} - Updated score
   */
  _applyRecencyBoost(item, baseScore) {
    let score = baseScore;
    
    // Calculate days since the visit
    const nowMs = Date.now();
    const itemMs = item.timestamp || nowMs;
    const daysSince = (nowMs - itemMs) / (1000 * 60 * 60 * 24);
    
    // Apply a decreasing boost based on recency
    // Maximum boost is 0.15 for items from today
    // Decays to 0 for items older than 30 days
    if (daysSince < 30) {
      score += 0.15 * (1 - (daysSince / 30));
    }
    
    return score;
  }
  
  /**
   * Calculate vector similarity between two vectors using cosine similarity
   * @param {Array<number>} vecA - First embedding vector
   * @param {Array<number>} vecB - Second embedding vector
   * @returns {number} - Similarity score (0 to 1)
   */
  _calculateVectorSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    // Convert to a value between 0 and 1 (where 1 is identical)
    return (dotProduct / (normA * normB) + 1) / 2;
  }
  
  /**
   * Cache a query embedding for future use
   * @param {string} query - The query text
   * @param {Array} embedding - The embedding vector
   */
  async _cacheQueryEmbedding(query, embedding) {
    if (!query || !embedding || embedding.length === 0) return;
    
    try {
      // Add to in-memory cache
      this.vectorCache.queries[query] = {
        vector: embedding,
        timestamp: Date.now()
      };
      
      // Periodically clean the cache if it gets too large
      if (Object.keys(this.vectorCache.queries).length > this.vectorCache.maxEntries || 
          !this.vectorCache.lastCleaned || 
          (Date.now() - this.vectorCache.lastCleaned > 86400000)) { // Clean daily
          
        this._cleanVectorCache();
      }
      
      // Update persistent cache
      await chrome.storage.local.set({
        [this.VECTOR_CACHE_KEY]: this.vectorCache
      });
      
    } catch (error) {
      console.error("Error caching query embedding:", error);
    }
  }
  
  /**
   * Clean up the vector cache to remove old entries
   */
  _cleanVectorCache() {
    const queries = Object.keys(this.vectorCache.queries);
    
    if (queries.length <= this.vectorCache.maxEntries) {
      return;
    }
    
    // Sort by timestamp (oldest first)
    const sortedQueries = queries.sort((a, b) => 
      this.vectorCache.queries[a].timestamp - this.vectorCache.queries[b].timestamp
    );
    
    // Remove oldest entries
    const entriesToRemove = sortedQueries.slice(0, queries.length - this.vectorCache.maxEntries);
    entriesToRemove.forEach(query => {
      delete this.vectorCache.queries[query];
    });
    
    this.vectorCache.lastCleaned = Date.now();
    console.log(`Cleaned vector cache, removed ${entriesToRemove.length} old entries`);
  }
  
  /**
   * Extract domain from a URL
   * @param {string} url - The URL
   * @returns {string} - The domain
   */
  _extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return '';
    }
  }
  
  /**
   * Fallback search when semantic search fails
   * @param {string} query - The search query
   * @param {Array} historyItems - Array of history items
   * @returns {Array} - Filtered and sorted results
   */
  _fallbackSearch(query, historyItems) {
    console.log("Using fallback search for query:", query);
    
    const normalizedQuery = query.toLowerCase().trim();
    
    // Simple keyword matching
    const scoredResults = historyItems.map(item => {
      let score = 0;
      const title = item.title ? item.title.toLowerCase() : '';
      const summary = item.summary ? item.summary.toLowerCase() : '';
      
      // Title match (highest weight)
      if (title.includes(normalizedQuery)) {
        score += 0.7;
      }
      
      // Summary match
      if (summary.includes(normalizedQuery)) {
        score += 0.5;
      }
      
      // Special-case handling for common query types
      if (this._isSpecialQueryType(normalizedQuery, title, summary, item.url)) {
        score += 0.4;
      }
      
      // Recency boost
      const nowMs = Date.now();
      const itemMs = item.timestamp || nowMs;
      const daysSince = (nowMs - itemMs) / (1000 * 60 * 60 * 24);
      
      if (daysSince < 7) {
        score += 0.2 * (1 - (daysSince / 7));
      }
      
      return {
        ...item,
        score
      };
    });
    
    // Filter and sort
    return scoredResults
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.MAX_RESULTS);
  }
  
  /**
   * Check if a query is a special case (funny, recipes, tech, etc.)
   * @param {string} query - The normalized query
   * @param {string} title - The item title
   * @param {string} summary - The item summary
   * @param {string} url - The item URL
   * @returns {boolean} - Whether it's a special query type
   */
  _isSpecialQueryType(query, title, summary, url) {
    // Convert to lowercase for safer comparisons
    const lcQuery = query.toLowerCase();
    const lcTitle = title.toLowerCase();
    const lcSummary = summary ? summary.toLowerCase() : '';
    const lcUrl = url.toLowerCase();
    
    // Check for funny/entertainment content
    if (lcQuery.includes('funny') || lcQuery.includes('comedy') || lcQuery.includes('laugh')) {
      if (lcTitle.includes('funny') || 
          lcTitle.includes('comedy') ||
          lcSummary.includes('laugh') ||
          lcSummary.includes('humor') ||
          lcSummary.includes('joke') ||
          lcUrl.includes('youtube.com') ||
          lcUrl.includes('tiktok.com') ||
          lcUrl.includes('reddit.com')) {
        return true;
      }
    }
    
    // Check for recipes
    if (lcQuery.includes('recipe') || lcQuery.includes('food') || lcQuery.includes('cook')) {
      if (lcTitle.includes('recipe') ||
          lcTitle.includes('food') ||
          lcTitle.includes('cook') ||
          lcSummary.includes('ingredient') ||
          lcUrl.includes('allrecipes.com') ||
          lcUrl.includes('food') ||
          lcUrl.includes('recipe')) {
        return true;
      }
    }
    
    // Check for tech content
    if (lcQuery.includes('tech') || lcQuery.includes('code') || lcQuery.includes('program')) {
      if (lcTitle.includes('tech') ||
          lcTitle.includes('code') ||
          lcTitle.includes('program') ||
          lcUrl.includes('github.com') ||
          lcUrl.includes('stackoverflow.com')) {
        return true;
      }
    }
    
    return false;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined') {
  module.exports = { SemanticSearchEngine };
}