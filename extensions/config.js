// Configuration file for the Semantic History extension

const CONFIG = {
  // API Constants
  API: {
    // Google API Constants
    GOOGLE_API_BASE_URL: "https://generativelanguage.googleapis.com/v1",
    GOOGLE_EMBEDDING_MODEL: "models/embedding-001",
    GOOGLE_TEXT_MODEL: "models/gemini-1.5-flash",
    
    // Request timeout in milliseconds
    TIMEOUT_MS: 30000
  },
  
  // Storage settings
  STORAGE: {
    // Key for the vector database in local storage
    VECTOR_DB_KEY: "semanticHistoryVectors",
    
    // Key for extension settings
    SETTINGS_KEY: "semanticHistorySettings",
    
    // Current storage schema version
    VERSION: "1.0",
    
    // Maximum number of entries to store
    // Adjust based on storage limitations and performance needs
    MAX_ENTRIES: 1000
  },
  
  // Processing settings
  PROCESSING: {
    // Minimum time (in milliseconds) a user must spend on a page for it to be processed
    MIN_STAY_TIME_MS: 10000,
    
    // Minimum length of extracted text to be processed
    MIN_TEXT_LENGTH: 100,
    
    // Maximum number of pages to process in a batch
    BATCH_SIZE: 10,
    
    // Maximum number of pages to process for initial indexing
    MAX_INITIAL_PAGES: 100,
    
    // Delay between processing batches (in milliseconds)
    BATCH_DELAY_MS: 2000
  },
  
  // Search settings
  SEARCH: {
    // Maximum number of results to return
    MAX_RESULTS: 10,
    
    // Minimum relevance score for a result to be included
    MIN_SCORE: 0.3
  }
};

// Export the configuration
if (typeof module !== 'undefined') {
  module.exports = CONFIG;
} else {
  // For direct usage in browser extensions
  // This will be accessible as window.CONFIG
}