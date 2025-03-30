/**
 * Utility functions for the Semantic History extension
 */

// Vector operations for semantic search
const VectorUtils = {
    /**
     * Calculate cosine similarity between two vectors
     * @param {Array<number>} vecA - First vector
     * @param {Array<number>} vecB - Second vector
     * @returns {number} - Cosine similarity (between -1 and 1)
     */
    cosineSimilarity: function(vecA, vecB) {
      if (!vecA || !vecB || vecA.length !== vecB.length) {
        console.error('Invalid vectors for similarity calculation');
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
      
      return dotProduct / (normA * normB);
    },
    
    /**
     * Euclidean distance between two vectors
     * @param {Array<number>} vecA - First vector
     * @param {Array<number>} vecB - Second vector
     * @returns {number} - Euclidean distance
     */
    euclideanDistance: function(vecA, vecB) {
      if (!vecA || !vecB || vecA.length !== vecB.length) {
        console.error('Invalid vectors for distance calculation');
        return Infinity;
      }
      
      let sum = 0;
      for (let i = 0; i < vecA.length; i++) {
        const diff = vecA[i] - vecB[i];
        sum += diff * diff;
      }
      
      return Math.sqrt(sum);
    }
  };
  
  // URL utility functions
  const UrlUtils = {
    /**
     * Extracts the domain from a URL
     * @param {string} url - The URL to extract from
     * @returns {string} - The domain name
     */
    extractDomain: function(url) {
      if (!url) return '';
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch (e) {
        console.error('Invalid URL:', url);
        return '';
      }
    },
    
    /**
     * Checks if a URL is a valid web URL (http or https)
     * @param {string} url - URL to check
     * @returns {boolean} - Whether URL is valid
     */
    isValidUrl: function(url) {
      if (!url) return false;
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
      } catch (e) {
        return false;
      }
    },
    
    /**
     * Returns a clean/displayable version of the URL
     * (removes protocol, trailing slashes, etc)
     * @param {string} url - The URL to clean
     * @returns {string} - Cleaned URL for display
     */
    getDisplayUrl: function(url) {
      if (!url) return '';
      try {
        const urlObj = new URL(url);
        let result = urlObj.hostname + urlObj.pathname;
        if (result.endsWith('/')) {
          result = result.slice(0, -1);
        }
        return result;
      } catch (e) {
        return url;
      }
    }
  };
  
  // Text utility functions
  const TextUtils = {
    /**
     * Truncates text to specified length, adding ellipsis if needed
     * @param {string} text - The text to truncate
     * @param {number} length - Maximum length
     * @returns {string} - Truncated text
     */
    truncate: function(text, length) {
      if (!text) return '';
      if (text.length <= length) return text;
      return text.slice(0, length) + '...';
    },
    
    /**
     * Removes HTML tags from a string
     * @param {string} html - The HTML string
     * @returns {string} - Plain text without HTML tags
     */
    stripHtml: function(html) {
      if (!html) return '';
      const temp = document.createElement('div');
      temp.innerHTML = html;
      return temp.textContent || temp.innerText || '';
    },
    
    /**
     * Extracts keywords from text
     * @param {string} text - The input text
     * @param {number} maxKeywords - Maximum number of keywords to extract
     * @returns {Array<string>} - Array of keywords
     */
    extractKeywords: function(text, maxKeywords = 5) {
      if (!text) return [];
      
      // Common English stop words to filter out
      const stopWords = new Set([
        'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with',
        'by', 'about', 'as', 'into', 'like', 'through', 'after', 'over', 'between',
        'out', 'of', 'from', 'up', 'down', 'is', 'are', 'was', 'were', 'be', 'been',
        'have', 'has', 'had', 'do', 'does', 'did', 'could', 'would', 'should', 'will',
        'this', 'that', 'these', 'those', 'it', 'they', 'them', 'their', 'he', 'she', 
        'him', 'her', 'his', 'we', 'us', 'you', 'your', 'my', 'mine', 'our', 'ours'
      ]);
      
      // Simple keyword extraction - count word frequencies after filtering
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/) // Split on whitespace
        .filter(word => 
          word.length > 3 && // Only consider words longer than 3 chars
          !stopWords.has(word) && // Filter out stop words
          !(/^\d+$/.test(word)) // Filter out numbers
        );
      
      // Count frequencies
      const frequencies = {};
      for (const word of words) {
        frequencies[word] = (frequencies[word] || 0) + 1;
      }
      
      // Sort by frequency
      const sortedWords = Object.keys(frequencies).sort((a, b) => 
        frequencies[b] - frequencies[a]
      );
      
      // Return top keywords
      return sortedWords.slice(0, maxKeywords);
    }
  };
  
  // Date utility functions
  const DateUtils = {
    /**
     * Formats a date as a relative time string (e.g., "2 days ago")
     * @param {number|Date} date - Date to format (timestamp or Date object)
     * @returns {string} - Relative time string
     */
    getRelativeTimeString: function(date) {
      if (!date) return '';
      
      const now = new Date();
      const dateObj = typeof date === 'number' ? new Date(date) : date;
      const diffMs = now - dateObj;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);
      
      if (diffSec < 60) {
        return 'just now';
      } else if (diffMin < 60) {
        return `${diffMin} ${diffMin === 1 ? 'minute' : 'minutes'} ago`;
      } else if (diffHour < 24) {
        return `${diffHour} ${diffHour === 1 ? 'hour' : 'hours'} ago`;
      } else if (diffDay < 30) {
        return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
      } else {
        // Format as date for older entries
        return dateObj.toLocaleDateString();
      }
    },
    
    /**
     * Formats a date as a friendly string
     * @param {number|Date} date - Date to format
     * @returns {string} - Formatted date string
     */
    formatDate: function(date) {
      if (!date) return '';
      
      const dateObj = typeof date === 'number' ? new Date(date) : date;
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Check if date is today or yesterday
      if (dateObj.toDateString() === today.toDateString()) {
        return `Today at ${dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      } else if (dateObj.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        // Format as date + time for older dates
        return dateObj.toLocaleDateString(undefined, { 
          month: 'short', 
          day: 'numeric',
          year: dateObj.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
        }) + ` at ${dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
  };
  
  // Export utilities
  if (typeof module !== 'undefined') {
    module.exports = {
      VectorUtils,
      UrlUtils,
      TextUtils,
      DateUtils
    };
  }