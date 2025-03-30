// Dashboard.js - JavaScript for the dashboard page

// Debug flag - set to true to see detailed debugging
const DEBUG = true;


function debug(...args) {
  if (DEBUG) {
    console.log("[DEBUG]", ...args);
    // Also write to debug output div if it exists
    const debugOutput = document.getElementById('debug-output');
    if (debugOutput) {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      debugOutput.innerHTML += `<div>${message}</div>`;
      debugOutput.scrollTop = debugOutput.scrollHeight;
    }
  }
}

// DOM Elements
const pagesCount = document.getElementById('pages-count');
const lastProcessed = document.getElementById('last-processed');
const apiStatus = document.getElementById('api-status');
const apiModel = document.getElementById('api-model');
const storageSize = document.getElementById('storage-size');
const storageBar = document.getElementById('storage-bar');
const storagePercent = document.getElementById('storage-percent');
const recentPages = document.getElementById('recent-pages');
const actionStatus = document.getElementById('action-status');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchButton;

// Constants
const VECTOR_DB_KEY = "semanticHistoryVectors";
const SETTINGS_KEY = "semanticHistorySettings";
// Size of typical browser extension storage in bytes (approx 5MB)
const ESTIMATED_STORAGE_LIMIT = 5 * 1024 * 1024;

// Debug initialization
debug("Dashboard script file loaded");

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
  debug("DOM Content Loaded event fired");
  
  // Get button references
  const processHistoryBtn = document.getElementById('process-history');
  const testGoogleApiBtn = document.getElementById('test-google-api');
  const clearDataBtn = document.getElementById('clear-data');
  const goToSettingsBtn = document.getElementById('go-to-settings');
  searchButton = document.getElementById('search-button');
  const testSimpleBtn = document.getElementById('test-simple');
  
  // Debug element references
  debug("Button elements:", {
    processHistoryBtn: processHistoryBtn ? "Found" : "Not found",
    testGoogleApiBtn: testGoogleApiBtn ? "Found" : "Not found",
    clearDataBtn: clearDataBtn ? "Found" : "Not found",
    goToSettingsBtn: goToSettingsBtn ? "Found" : "Not found",
    searchButton: searchButton ? "Found" : "Not found",
    testSimpleBtn: testSimpleBtn ? "Found" : "Not found"
  });
  
  // Load initial data
  try {
    debug("Attempting to update dashboard...");
    await updateDashboard();
    debug("Dashboard updated successfully");
  } catch (error) {
    console.error("Error during dashboard update:", error);
    debug("Dashboard update error:", error.message);
  }
  
  // Debug event listener setup
  debug("Setting up event listeners...");
  
  // Set up event listeners with error handling
  try {
    if (testSimpleBtn) {
      debug("Adding click listener to Simple Test button");
      testSimpleBtn.addEventListener('click', function() {
        debug("Simple test button clicked!");
        alert("Simple test button works!");
      });
    }
    
    if (processHistoryBtn) {
      debug("Adding click listener to Process History button");
      processHistoryBtn.addEventListener('click', function() {
        debug("Process History button clicked!");
        triggerHistoryProcessing();
      });
    } else {
      console.error("Process History button not found in DOM");
      debug("ERROR: Process History button not found");
    }
    
    if (testGoogleApiBtn) {
      debug("Adding click listener to Test Google API button");
      testGoogleApiBtn.addEventListener('click', function() {
        debug("Test Google API button clicked!");
        testGoogleApiConnection();
      });
    } else {
      console.error("Test Google API button not found in DOM");
      debug("ERROR: Test Google API button not found");
    }
    
    if (clearDataBtn) {
      debug("Adding click listener to Clear Data button");
      clearDataBtn.addEventListener('click', function() {
        debug("Clear Data button clicked!");
        clearAllData();
      });
    } else {
      console.error("Clear Data button not found in DOM");
      debug("ERROR: Clear Data button not found");
    }
    
    if (goToSettingsBtn) {
      debug("Adding click listener to Settings button");
      goToSettingsBtn.addEventListener('click', function() {
        debug("Settings button clicked!");
        openSettings();
      });
    } else {
      console.error("Settings button not found in DOM");
      debug("ERROR: Settings button not found");
    }
    
    if (searchButton) {
      debug("Adding click listener to Search button");
      searchButton.addEventListener('click', function() {
        debug("Search button clicked!");
        testSearch();
      });
    } else {
      console.error("Search button not found in DOM");
      debug("ERROR: Search button not found");
    }
    
    if (searchInput) {
      debug("Adding keyup listener to Search input");
      searchInput.addEventListener('keyup', e => {
        if (e.key === 'Enter') {
          debug("Enter key pressed in search input");
          testSearch();
        }
      });
    } else {
      console.error("Search input not found in DOM");
      debug("ERROR: Search input not found");
    }
    
    debug("Event listeners set up successfully");
  } catch (error) {
    console.error("Error setting up event listeners:", error);
    debug("ERROR setting up event listeners:", error.message);
  }
  
  // Auto-refresh every 30 seconds
  debug("Setting up auto-refresh");
  setInterval(updateDashboard, 30000);
  debug("Dashboard initialization complete");
});

// Update all dashboard data
async function updateDashboard() {
  try {
    debug("Updating dashboard...");
    await Promise.all([
      updateStorageStats(),
      updateGoogleApiStatus(),
      updateRecentPages()
    ]);
    debug("Dashboard update complete");
  } catch (error) {
    console.error("Error updating dashboard:", error);
    debug("Error updating dashboard:", error.message);
    showActionStatus('error', 'Failed to update dashboard: ' + error.message);
  }
}

// Update storage statistics
async function updateStorageStats() {
  try {
    debug("Updating storage stats...");
    const storage = await chrome.storage.local.get(VECTOR_DB_KEY);
    const db = storage[VECTOR_DB_KEY] || { entries: [], lastProcessed: null };
    
    // Update pages count
    pagesCount.textContent = db.entries.length;
    
    // Update last processed time
    if (db.lastProcessed) {
      const date = new Date(db.lastProcessed);
      lastProcessed.textContent = `Last processed: ${date.toLocaleString()}`;
    } else {
      lastProcessed.textContent = 'Last processed: Never';
    }
    
    // Calculate storage size
    const jsonString = JSON.stringify(db);
    const storageSizeBytes = new Blob([jsonString]).size;
    const storageSizeKB = (storageSizeBytes / 1024).toFixed(2);
    
    // Update storage display
    storageSize.textContent = storageSizeKB;
    
    // Calculate percentage of quota
    const percentUsed = Math.min(100, Math.round((storageSizeBytes / ESTIMATED_STORAGE_LIMIT) * 100));
    storageBar.style.width = `${percentUsed}%`;
    storagePercent.textContent = `${percentUsed}%`;
    
    // Change color based on usage
    if (percentUsed > 80) {
      storageBar.classList.remove('bg-blue-600', 'bg-yellow-500');
      storageBar.classList.add('bg-red-600');
    } else if (percentUsed > 60) {
      storageBar.classList.remove('bg-blue-600', 'bg-red-600');
      storageBar.classList.add('bg-yellow-500');
    } else {
      storageBar.classList.remove('bg-yellow-500', 'bg-red-600');
      storageBar.classList.add('bg-blue-600');
    }
    
    debug("Storage stats updated successfully");
  } catch (error) {
    console.error("Error updating storage stats:", error);
    debug("Error updating storage stats:", error.message);
    throw error;
  }
}

// Update Google API connection status
async function updateGoogleApiStatus() {
  try {
    debug("Updating Google API status...");
    
    // Get API key from settings
    const settings = await chrome.storage.local.get(SETTINGS_KEY);
    const googleApiKey = settings[SETTINGS_KEY]?.googleApiKey || '';
    debug("Retrieved API key from settings", googleApiKey ? "API key found" : "No API key found");
    
    // Update API status display
    if (!googleApiKey) {
      debug("No API key configured");
      apiStatus.textContent = 'No API Key';
      apiStatus.className = 'text-red-500';
      apiModel.textContent = 'Model: Not configured';
      return;
    }
    
    // Send test API connection message
    debug("Sending testApiConnection message to background script...");
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testApiConnection' });
      debug("Received testApiConnection response:", response);
      
      if (response && response.success) {
        debug("API connection successful");
        apiStatus.textContent = response.result.status || 'Connected';
        apiStatus.className = 'text-green-500';
        apiModel.textContent = `Model: ${response.result.model || 'models/embedding-001'}`;
      } else {
        debug("API connection failed", response?.error);
        apiStatus.textContent = 'Disconnected';
        apiStatus.className = 'text-red-500';
        apiModel.textContent = `Model: Unknown`;
      }
    } catch (msgError) {
      debug("Error sending message to background script:", msgError.message);
      apiStatus.textContent = 'Error';
      apiStatus.className = 'text-red-500';
      apiModel.textContent = `Error: ${msgError.message}`;
    }
    
  } catch (error) {
    console.error("Error updating API status:", error);
    debug("Error updating API status:", error.message);
    apiStatus.textContent = 'Error';
    apiStatus.className = 'text-red-500';
    apiModel.textContent = `Error: ${error.message}`;
  }
}

// Update recent pages
async function updateRecentPages() {
  try {
    debug("Updating recent pages...");
    const storage = await chrome.storage.local.get(VECTOR_DB_KEY);
    const db = storage[VECTOR_DB_KEY] || { entries: [] };
    
    // Get most recent 10 pages
    const recentEntries = [...db.entries]
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 10);
    
    debug(`Found ${recentEntries.length} recent entries`);
    
    // Clear table
    recentPages.innerHTML = '';
    
    if (recentEntries.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td class="px-6 py-4 text-sm text-gray-500" colspan="4">No pages processed yet</td>`;
      recentPages.appendChild(row);
      debug("No recent entries to display");
      return;
    }
    
    // Add rows for each entry
    recentEntries.forEach(entry => {
      const date = entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Unknown';
      
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50';
      row.innerHTML = `
        <td class="px-6 py-4">
          <div class="text-sm font-medium text-gray-900 truncate max-w-xs">${entry.title || 'Unknown title'}</div>
        </td>
        <td class="px-6 py-4">
          <div class="text-sm text-gray-500 truncate max-w-xs">
            <a href="${entry.url}" target="_blank" class="hover:text-blue-500">${entry.url}</a>
          </div>
        </td>
        <td class="px-6 py-4">
          <div class="text-sm text-gray-500">${date}</div>
        </td>
        <td class="px-6 py-4">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            entry.fullEmbedding ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }">
            ${entry.fullEmbedding ? 'Yes' : 'No'}
          </span>
        </td>
      `;
      recentPages.appendChild(row);
    });
    
    debug("Recent pages updated successfully");
  } catch (error) {
    console.error("Error updating recent pages:", error);
    debug("Error updating recent pages:", error.message);
    throw error;
  }
}

// Trigger history processing
async function triggerHistoryProcessing() {
  debug("triggerHistoryProcessing function called");
  try {
    showActionStatus('info', 'Starting history processing...');
    debug("Sending manualIndexing message to background script...");
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'manualIndexing' });
      debug("Received manualIndexing response:", response);
      
      if (response && response.success) {
        debug("History processing started successfully");
        showActionStatus('success', 'History processing started successfully. This may take several minutes.');
      } else {
        debug("History processing failed", response?.error);
        showActionStatus('error', `Failed to start history processing: ${response ? response.error : 'Unknown error'}`);
      }
    } catch (msgError) {
      debug("Error sending message to background script:", msgError.message);
      showActionStatus('error', `Message error: ${msgError.message}`);
    }
    
    // Update dashboard after a delay to show initial progress
    debug("Scheduling dashboard update in 3 seconds");
    setTimeout(updateDashboard, 3000);
    
  } catch (error) {
    console.error("Error triggering history processing:", error);
    debug("Error triggering history processing:", error.message);
    showActionStatus('error', 'Error triggering history processing: ' + error.message);
  }
}

// Test Google API connection
async function testGoogleApiConnection() {
  debug("testGoogleApiConnection function called");
  try {
    showActionStatus('info', 'Testing Google API connection...');
    debug("Sending testApiConnection message to background script...");
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testApiConnection' });
      debug("Received testApiConnection response:", response);
      
      if (response && response.success) {
        debug("Google API connection successful");
        showActionStatus('success', `Google API connection successful! Model: ${response.result.model || 'models/embedding-001'}`);
        await updateGoogleApiStatus();
      } else {
        debug("Google API connection failed", response?.error);
        showActionStatus('error', `Google API connection failed: ${response ? response.error : 'Unknown error'}`);
      }
    } catch (msgError) {
      debug("Error sending message to background script:", msgError.message);
      showActionStatus('error', `Message error: ${msgError.message}`);
    }
  } catch (error) {
    console.error("Error testing Google API connection:", error);
    debug("Error testing Google API connection:", error.message);
    showActionStatus('error', 'Error testing Google API connection: ' + error.message);
  }
}

// Clear all data
async function clearAllData() {
  debug("clearAllData function called");
  try {
    if (!confirm("Are you sure you want to clear all stored data? This action cannot be undone.")) {
      debug("User canceled clear data operation");
      return;
    }
    
    showActionStatus('info', 'Clearing all data...');
    debug("Removing vector database from storage...");
    
    // Clear the vector database
    await chrome.storage.local.remove(VECTOR_DB_KEY);
    
    // Initialize empty database
    debug("Initializing empty database...");
    await chrome.storage.local.set({
      [VECTOR_DB_KEY]: {
        version: "1.0",
        entries: [],
        lastProcessed: null
      }
    });
    
    debug("Data cleared successfully");
    showActionStatus('success', 'All data cleared successfully.');
    
    // Update dashboard
    await updateDashboard();
    
  } catch (error) {
    console.error("Error clearing data:", error);
    debug("Error clearing data:", error.message);
    showActionStatus('error', 'Error clearing data: ' + error.message);
  }
}

// Open settings
function openSettings() {
  debug("openSettings function called");
  
  try {
    debug("Attempting to open options page...");
    chrome.runtime.openOptionsPage();
  } catch (error) {
    console.error("Error opening settings:", error);
    debug("Error opening settings:", error.message);
    // Fallback for older Chrome versions
    debug("Trying fallback method to open options page...");
    window.open(chrome.runtime.getURL('options.html'));
  }
}

// Test search
async function testSearch() {
  debug("testSearch function called");
  try {
    const query = searchInput.value.trim();
    debug(`Search query: "${query}"`);
    
    if (!query) {
      debug("Empty search query");
      searchResults.innerHTML = '<p class="text-sm text-red-500">Please enter a search query</p>';
      return;
    }
    
    searchButton.disabled = true;
    searchResults.innerHTML = '<p class="text-sm text-blue-500">Searching...</p>';
    debug("Sending searchHistory message to background script...");
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: "searchHistory",
        query: query
      });
      
      debug("Received searchHistory response:", response);
      searchButton.disabled = false;
      
      if (response && response.success) {
        debug(`Search successful, found ${response.results.length} results`);
        displaySearchResults(response.results);
      } else {
        debug("Search failed", response?.error);
        searchResults.innerHTML = `<p class="text-sm text-red-500">Search failed: ${response ? response.error : 'Unknown error'}</p>`;
      }
    } catch (msgError) {
      debug("Error sending message to background script:", msgError.message);
      searchResults.innerHTML = `<p class="text-sm text-red-500">Message error: ${msgError.message}</p>`;
      searchButton.disabled = false;
    }
  } catch (error) {
    console.error("Error testing search:", error);
    debug("Error testing search:", error.message);
    searchResults.innerHTML = `<p class="text-sm text-red-500">Search error: ${error.message}</p>`;
    searchButton.disabled = false;
  }
}

// Display search results
function displaySearchResults(results) {
  debug("Displaying search results");
  if (!results || results.length === 0) {
    debug("No results found");
    searchResults.innerHTML = '<p class="text-sm text-gray-500">No results found</p>';
    return;
  }
  
  debug(`Rendering ${results.length} search results`);
  let html = '';
  
  results.forEach(result => {
    const scorePercentage = Math.round(result.score * 100);
    const date = result.timestamp ? new Date(result.timestamp).toLocaleDateString() : 'Unknown date';
    
    html += `
      <div class="mb-3 p-2 border-b border-gray-200">
        <div class="flex justify-between items-start">
          <a href="${result.url}" target="_blank" class="font-medium text-blue-600 hover:underline">${result.title || 'Unknown title'}</a>
          <span class="text-xs text-gray-500">${date}</span>
        </div>
        <p class="text-sm text-gray-700 my-1">${result.summary || 'No summary available'}</p>
        <div class="flex justify-between items-center text-xs">
          <span class="text-gray-500">${new URL(result.url).hostname}</span>
          <span class="text-green-600">Match: ${scorePercentage}%</span>
        </div>
      </div>
    `;
  });
  
  searchResults.innerHTML = html;
  debug("Search results displayed successfully");
}

// Show action status
function showActionStatus(type, message) {
  debug(`Showing action status: ${type} - ${message}`);
  actionStatus.innerHTML = message;
  actionStatus.classList.remove('hidden', 'bg-blue-100', 'bg-green-100', 'bg-red-100', 'text-blue-800', 'text-green-800', 'text-red-800');
  
  switch (type) {
    case 'info':
      actionStatus.classList.add('bg-blue-100', 'text-blue-800');
      break;
    case 'success':
      actionStatus.classList.add('bg-green-100', 'text-green-800');
      break;
    case 'error':
      actionStatus.classList.add('bg-red-100', 'text-red-800');
      break;
  }
  
  actionStatus.classList.remove('hidden');
  
  // Auto-hide success messages after 5 seconds
  if (type === 'success') {
    debug("Setting auto-hide timer for success message");
    setTimeout(() => {
      actionStatus.classList.add('hidden');
      debug("Success message hidden");
    }, 5000);
  }
}