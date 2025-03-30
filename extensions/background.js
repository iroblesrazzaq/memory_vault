const DEBUG_BG = true;
function debugBg(...args) {
  if (DEBUG_BG) {
    console.log("[BACKGROUND DEBUG]", ...args);
  }
}

debugBg("Background script loaded");

// Constants
let semanticEngine = null;

console.log("Background script started");
const MIN_STAY_TIME_MS = 10000; // Only process pages where user spent at least 10 seconds
const HISTORY_BATCH_SIZE = 10; // Number of pages to process in a batch
const MAX_PAGES_TO_PROCESS = 500; // Increased limit for processing history
const SETTINGS_KEY = "semanticHistorySettings"; // Settings storage key
const BATCH_DELAY_MS = 2000; // Delay between batches in ms

// IndexedDB Constants
const DB_NAME = 'semanticHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'pages';
let db = null; // Database connection reference

// Google API Constants
const GOOGLE_API_BASE_URL = "https://generativelanguage.googleapis.com/v1";
const GOOGLE_EMBEDDING_MODEL = "models/embedding-001";
const GOOGLE_TEXT_MODEL = "models/gemini-1.5-flash"; // Use gemini-1.5-flash for summarization
let GOOGLE_API_KEY = ""; // Will be loaded from settings

// State tracking variables
let currentTabId = null;
let tabStartTime = {};
let processedUrls = new Set();

// Initialize the IndexedDB
function initDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      db.onclose = () => { db = null; };
      resolve(db);
    };

    request.onerror = (event) => {
      reject(`IndexedDB error: ${event.target.error}`);
    };
  });
}

// Add page data to IndexedDB
async function storePageData(pageData) {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.add(pageData);
      
      transaction.oncomplete = () => {
        resolve(true);
      };
      
      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });
  } catch (error) {
    debugBg("Error storing page data:", error);
    throw error;
  }
}

// Initialize the extension
chrome.runtime.onInstalled.addListener(async () => {
  debugBg("Extension installed");
  
  // Initialize IndexedDB
  try {
    await initDB();
  } catch (error) {
    debugBg("Error initializing IndexedDB:", error);
  }
  
  // Load settings first to get API key
  const settings = await chrome.storage.local.get(SETTINGS_KEY);
  if (settings[SETTINGS_KEY] && settings[SETTINGS_KEY].googleApiKey) {
    GOOGLE_API_KEY = settings[SETTINGS_KEY].googleApiKey;
    debugBg("Google API key loaded from settings");
  }
  
  // Create default settings if they don't exist
  if (!settings[SETTINGS_KEY]) {
    await chrome.storage.local.set({
      [SETTINGS_KEY]: {
        googleApiKey: GOOGLE_API_KEY,
        minStayTimeSeconds: 10,
        maxHistoryItems: 1000,
        processExisting: true,
        autoProcess: true
      }
    });
    debugBg("Default settings created");
  }
  
  // Process existing history in the background if setting enabled
  if (!settings[SETTINGS_KEY] || settings[SETTINGS_KEY].processExisting !== false) {
    setTimeout(() => {
      processExistingHistory().catch(err => 
        console.error("Failed to process existing history:", err)
      );
    }, 5000);
  }
});

// Listen for tab activation
chrome.tabs.onActivated.addListener(activeInfo => {
  currentTabId = activeInfo.tabId;
  tabStartTime[currentTabId] = Date.now();
});

// Listen for tab updates (including URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    tabStartTime[tabId] = Date.now();
  }
});

// Process page when a user navigates away
chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const startTime = tabStartTime[tabId];
  delete tabStartTime[tabId];
  
  if (!startTime) return;
  
  const stayTimeMs = Date.now() - startTime;
  
  // Only process pages where user spent significant time
  if (stayTimeMs >= MIN_STAY_TIME_MS) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url && shouldProcessUrl(tab.url)) {
        await processPage(tab.url, tab.title);
      }
    } catch (error) {
      console.error("Error processing tab:", error);
    }
  }
});

// Process when a user completes navigation
chrome.webNavigation.onCompleted.addListener(async details => {
  const { tabId, url, timeStamp } = details;
  if (tabId === currentTabId && shouldProcessUrl(url)) {
    tabStartTime[tabId] = timeStamp;
  }
});

// Process browser history to build initial index
async function processExistingHistory() {
  debugBg("Starting to process existing history...");
  
  try {
    // Verify we have a Google API key
    if (!GOOGLE_API_KEY) {
      debugBg("No Google API key set");
      throw new Error("Google API key is not set. Please add your API key in the extension settings.");
    }
    
    const historyItems = await chrome.history.search({
      text: '',           // Search all history
      startTime: Date.now() - (30 * 24 * 60 * 60 * 1000), // Last 30 days
      maxResults: MAX_PAGES_TO_PROCESS
    });
    
    // Filter items that should be processed
    const itemsToProcess = historyItems.filter(item => 
      shouldProcessUrl(item.url) && !processedUrls.has(item.url)
    );
    
    if (itemsToProcess.length === 0) {
      debugBg("No items to process after filtering");
      return;
    }
    
    // Group into batches
    const batches = [];
    for (let i = 0; i < itemsToProcess.length; i += HISTORY_BATCH_SIZE) {
      batches.push(itemsToProcess.slice(i, i + HISTORY_BATCH_SIZE));
    }
    
    let successCount = 0;
    let failureCount = 0;
    
    // Process each batch sequentially
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      // Process batch items in parallel
      const results = await Promise.allSettled(batch.map(item => {
        processedUrls.add(item.url);
        return processPage(item.url, item.title).catch(error => {
          console.error(`Error processing ${item.url}:`, error);
          return null;
        });
      }));
      
      // Count successes and failures
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) successCount++;
        else failureCount++;
      });
      
      // Short delay between batches
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }
    
    return { successCount, failureCount };
    
  } catch (error) {
    debugBg("Error processing history:", error);
    throw error;
  }
}

// Check if URL should be processed
function shouldProcessUrl(url) {
  // Skip extension pages, chrome:// URLs, data: URLs, etc.
  if (!url || 
      url.startsWith('chrome://') || 
      url.startsWith('chrome-extension://') || 
      url.startsWith('data:') || 
      url.startsWith('file:') ||
      url.startsWith('about:') ||
      url.startsWith('edge:') ||
      url.startsWith('brave:')) {
    return false;
  }
  
  // Skip common media files
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', 
                          '.mp4', '.webm', '.mp3', '.wav', '.ogg', '.pdf'];
  if (mediaExtensions.some(ext => url.toLowerCase().endsWith(ext))) {
    return false;
  }
  
  return true;
}

// Extract content from a page
async function extractPageContent(tabId, url) {
  try {
    // First try using content script if possible
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        function: () => {
          // Remove unwanted elements
          const elementsToRemove = document.querySelectorAll('script, style, nav, footer, header, aside');
          elementsToRemove.forEach(el => el.remove());
          
          // Try to find main content
          const mainContent = document.querySelector('main') || 
                              document.querySelector('article') || 
                              document.querySelector('div[role="main"]') || 
                              document.querySelector('#main-content') || 
                              document.querySelector('.post-content') || 
                              document.querySelector('#content');
          
          let text = mainContent ? mainContent.innerText : document.body.innerText;
          text = text.replace(/\s+/g, ' ').trim();
          
          return {
            title: document.title,
            text: text,
            url: window.location.href,
            wordCount: text.split(/\s+/).length
          };
        }
      });
      
      if (result && result.result && result.result.text) {
        return result.result;
      }
    } catch (error) {
      debugBg("Could not extract content using script:", error);
    }
    
    // Fallback to fetching the page directly
    const response = await fetch(url);
    const html = await response.text();
    
    // Parse HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove unwanted elements
    const elementsToRemove = doc.querySelectorAll('script, style, nav, footer, header, aside');
    elementsToRemove.forEach(el => el.remove());
    
    // Find main content
    const mainContent = doc.querySelector('main') || 
                        doc.querySelector('article') || 
                        doc.querySelector('div[role="main"]') || 
                        doc.querySelector('#main-content') || 
                        doc.querySelector('.post-content') || 
                        doc.querySelector('#content');
    
    let text = '';
    if (mainContent) text = mainContent.textContent;
    else if (doc.body) text = doc.body.textContent;
    
    // Clean up text
    text = text.replace(/\s+/g, ' ').trim();
    
    return {
      title: doc.title,
      text: text,
      url: url,
      wordCount: text.split(/\s+/).length
    };
  } catch (error) {
    console.error("Error extracting page content:", error);
    return null;
  }
}

// Process a page
async function processPage(url, title, retryCount = 0) {
  debugBg(`Processing page: ${title} (${url})`);
  
  try {
    if (!GOOGLE_API_KEY) {
      throw new Error("Google API key is not set");
    }
    
    // Extract content from the page
    let activeTab;
    try {
      [activeTab] = await chrome.tabs.query({ url: url });
    } catch (error) {
      debugBg("Could not find active tab for URL:", url);
    }
    
    let pageContent;
    if (activeTab && activeTab.id) {
      pageContent = await extractPageContent(activeTab.id, url);
    } else {
      // Fetch directly if we can't get the tab
      try {
        const response = await fetch(url);
        const html = await response.text();
        
        const tempElement = document.createElement('div');
        tempElement.innerHTML = html;
        
        // Remove unwanted elements
        const elementsToRemove = tempElement.querySelectorAll('script, style, nav, footer, header');
        elementsToRemove.forEach(el => el.remove());
        
        const text = tempElement.textContent.replace(/\s+/g, ' ').trim();
        
        pageContent = {
          title: title || tempElement.querySelector('title')?.textContent || url,
          text: text,
          url: url,
          wordCount: text.split(/\s+/).length
        };
      } catch (error) {
        throw new Error("Could not extract content from page");
      }
    }
    
    if (!pageContent || !pageContent.text || pageContent.text.length < 100) {
      debugBg(`Not enough content extracted from ${url}`);
      return false;
    }
    
    // Trim content to a reasonable size
    const trimmedText = pageContent.text.substring(0, 15000);
    
    // Generate summary with Google's Gemini API
    const summary = await generateSummary(trimmedText);
    
    // Generate embedding
    const embedding = await generateEmbedding(summary || trimmedText);
    
    if (!embedding) {
      debugBg(`Failed to generate embedding for ${url}`);
      return false;
    }
    
    // Store the processed data
    await storePageData({
      url,
      title: pageContent.title || title,
      timestamp: Date.now(),
      originalWordCount: pageContent.wordCount,
      embedding: embedding
    });
    
    debugBg(`Successfully processed and stored: ${title}`);
    return true;
    
  } catch (error) {
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
      return processPage(url, title, retryCount + 1);
    }
    debugBg(`Error processing page ${url} after ${retryCount} retries:`, error);
    return false;
  }
}

// Generate summary using Google's Gemini API
async function generateSummary(text) {
  try {
    if (!text || text.length < 100) return null;
    
    const prompt = `Please provide a concise summary (2-4 sentences) of the following content:\n\n${text}`;
    
    const response = await fetch(`${GOOGLE_API_BASE_URL}/${GOOGLE_TEXT_MODEL}:generateContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 200
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Summary API returned error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the summary from the response
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    
    return null;
  } catch (error) {
    debugBg("Error generating summary:", error);
    return null;
  }
}

// Generate embedding using Google's Embedding API
async function generateEmbedding(text) {
  try {
    if (!text) return null;
    
    const response = await fetch(`${GOOGLE_API_BASE_URL}/${GOOGLE_EMBEDDING_MODEL}:embedContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GOOGLE_EMBEDDING_MODEL,
        content: {
          parts: [{ text: text }]
        },
        taskType: "RETRIEVAL_DOCUMENT"
      })
    });
    
    if (!response.ok) {
      throw new Error(`Embedding API returned error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Extract the embedding vector
    if (data.embedding && data.embedding.values) {
      return data.embedding.values;
    }
    
    return null;
  } catch (error) {
    debugBg("Error generating embedding:", error);
    return null;
  }
}

// Calculate cosine similarity
function calculateCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
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
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

// Search for pages using embedding
async function searchHistory(query) {
  try {
    debugBg(`Searching for: ${query}`);
    
    if (!GOOGLE_API_KEY) {
      return performLocalSearch(query);
    }
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    if (!queryEmbedding) {
      return performLocalSearch(query);
    }
    
    // Get all pages from IndexedDB
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        const allPages = event.target.result;
        
        // Filter pages with valid embeddings
        const pagesWithEmbeddings = allPages.filter(page => page.embedding);
        
        // Calculate similarity for each page
        const results = pagesWithEmbeddings.map(page => {
          const similarity = calculateCosineSimilarity(queryEmbedding, page.embedding);
          return {
            ...page,
            score: similarity
          };
        })
        .filter(result => result.score > 0.3)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
        
        debugBg(`Found ${results.length} semantic search results`);
        resolve(results);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
    
  } catch (error) {
    debugBg("Search error:", error);
    return performLocalSearch(query);
  }
}

// Fallback text search when semantic search fails
async function performLocalSearch(query) {
  debugBg("Using fallback local search for:", query);
  
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = (event) => {
        const allPages = event.target.result;
        
        if (allPages.length === 0) {
          resolve([]);
          return;
        }
        
        // Simple keyword matching
        const normalizedQuery = query.toLowerCase();
        const results = allPages.map(entry => {
          let score = 0;
          
          if (entry.title && entry.title.toLowerCase().includes(normalizedQuery)) {
            score += 0.7;
          }
          
          // Check URL for matches
          if (entry.url && entry.url.toLowerCase().includes(normalizedQuery)) {
            score += 0.3;
          }
          
          return {
            ...entry,
            score: score
          };
        })
        .filter(result => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
        
        debugBg(`Found ${results.length} keyword search results`);
        resolve(results);
      };
      
      request.onerror = (event) => {
        reject(event.target.error);
      };
    });
  } catch (error) {
    debugBg("Error in fallback search:", error);
    return [];
  }
}

// Get storage stats
async function getStats() {
  try {
    const database = await initDB();
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const countRequest = store.count();
      
      countRequest.onsuccess = (event) => {
        const totalPages = event.target.result;
        
        // Get first item to check last processed timestamp
        const cursorRequest = store.index('timestamp').openCursor(null, 'prev');
        
        cursorRequest.onsuccess = (event) => {
          const cursor = event.target.result;
          const lastProcessed = cursor ? cursor.value.timestamp : null;
          
          resolve({
            totalPages,
            lastProcessed,
            apiStatus: GOOGLE_API_KEY ? "Configured" : "Not Configured"
          });
        };
        
        cursorRequest.onerror = (event) => {
          reject(event.target.error);
        };
      };
      
      countRequest.onerror = (event) => {
        reject(event.target.error);
      };
    });
  } catch (error) {
    debugBg("Error getting stats:", error);
    throw error;
  }
}

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  debugBg(`Received message: ${request.action || request.type}`);
  
  // Handle searchHistory request
  if (request.action === "searchHistory") {
    searchHistory(request.query)
      .then(results => {
        sendResponse({ success: true, results });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // Handle getStats request
  if (request.action === "getStats") {
    getStats()
      .then(stats => {
        sendResponse({ success: true, stats });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // Handle manualIndexing request
  if (request.action === "manualIndexing") {
    processExistingHistory()
      .then((result) => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  // Handle settingsUpdated
  if (request.action === "settingsUpdated" && request.settings) {
    if (request.settings.googleApiKey) {
      GOOGLE_API_KEY = request.settings.googleApiKey;
      debugBg("Google API key updated from settings");
    }
    sendResponse({ success: true });
    return true;
  }
  
  // Handle testApiConnection
  if (request.action === "testApiConnection") {
    testGoogleApiConnection()
      .then(result => {
        sendResponse({ success: true, result });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  return false;
});

// Test Google API connection
async function testGoogleApiConnection() {
  try {
    if (!GOOGLE_API_KEY) {
      throw new Error("Google API key is not set");
    }
    
    const response = await fetch(`${GOOGLE_API_BASE_URL}/${GOOGLE_EMBEDDING_MODEL}:embedContent?key=${GOOGLE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GOOGLE_EMBEDDING_MODEL,
        content: {
          parts: [{ text: "Test connection" }]
        },
        taskType: "RETRIEVAL_QUERY"
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API test failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      status: "Connected",
      model: GOOGLE_EMBEDDING_MODEL,
      embeddingDimension: data.embedding?.values?.length || 0
    };
  } catch (error) {
    throw error;
  }
}

// Initialize the database on script load
initDB().catch(err => {
  debugBg("Error initializing IndexedDB on script load:", err);
});