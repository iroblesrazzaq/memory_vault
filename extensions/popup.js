// DOM Elements
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const resultsContainer = document.getElementById('results-container');
const initialState = document.getElementById('initial-state');
const loadingIndicator = document.getElementById('loading-indicator');
const noResults = document.getElementById('no-results');
const resultsList = document.getElementById('results-list');
const statusContainer = document.getElementById('status-container');
const statusMessage = document.getElementById('status-message');
const statusDetail = document.getElementById('status-detail');
const pagesCount = document.getElementById('pages-count');
const suggestionTags = document.querySelectorAll('.suggestion-tag');
const settingsButton = document.getElementById('settings-button');

// Constants
const VECTOR_DB_KEY = "semanticHistoryVectors";
const MAX_SUMMARY_LENGTH = 120;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load stats
  await updateStats();
  
  // Set up event listeners
  searchButton.addEventListener('click', performSearch);
  searchInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') performSearch();
  });
  
  // Set up suggestion tags
  suggestionTags.forEach(tag => {
    tag.addEventListener('click', () => {
      searchInput.value = tag.textContent;
      performSearch();
    });
  });
  
  // Settings button
  settingsButton.addEventListener('click', openSettings);
});

// Update statistics display
async function updateStats() {
  try {
    const response = await chrome.runtime.sendMessage({
      action: "getStats"
    });
    
    if (response.success) {
      const { stats } = response;
      pagesCount.textContent = stats.totalPages;
      
      // Show status message if indexing is very recent (within the last minute)
      const isRecentlyIndexed = stats.lastProcessed && 
                               (Date.now() - stats.lastProcessed < 60000);
      
      if (isRecentlyIndexed) {
        statusContainer.classList.remove('hidden');
        statusMessage.textContent = "Recently indexed new pages";
        statusDetail.textContent = `${stats.totalPages} pages in database`;
      } else {
        statusContainer.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error("Error updating stats:", error);
  }
}

// Perform search
async function performSearch() {
  const query = searchInput.value.trim();
  
  if (!query) return;
  
  // Update UI state to loading
  setUIState('loading');
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: "searchHistory",
      query: query
    });
    
    if (response.success) {
      displayResults(response.results, query);
    } else {
      console.error("Search error:", response.error);
      setUIState('no-results');
    }
  } catch (error) {
    console.error("Error performing search:", error);
    setUIState('no-results');
  }
}

// Display search results
function displayResults(results, query) {
  if (!results || results.length === 0) {
    setUIState('no-results');
    return;
  }
  
  // Clear previous results
  resultsList.innerHTML = '';
  
  // Create result items
  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item bg-white rounded-lg shadow-sm p-3 mb-3 border border-gray-200';
    
    // Format date
    const visitDate = new Date(result.timestamp);
    const dateStr = visitDate.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric',
      year: visitDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
    
    // Truncate summary if needed
    let summary = result.summary;
    if (summary.length > MAX_SUMMARY_LENGTH) {
      summary = summary.substring(0, MAX_SUMMARY_LENGTH) + '...';
    }
    
    // Calculate score indicator width
    const scoreWidth = Math.round(result.score * 100);
    
    resultItem.innerHTML = `
      <div class="flex justify-between items-start mb-1">
        <a href="${result.url}" target="_blank" class="font-medium text-blue-600 hover:underline">${result.title}</a>
        <div class="text-xs text-gray-500">${dateStr}</div>
      </div>
      <div class="text-sm text-gray-700 mb-2">${summary}</div>
      <div class="flex justify-between items-center">
        <a href="${result.url}" class="text-xs text-gray-500 hover:text-gray-700 truncate max-w-xs">${result.url}</a>
        <div class="flex items-center">
          <div class="text-xs text-gray-500 mr-1">Match:</div>
          <div class="score-indicator" style="background: linear-gradient(to right, #f3f4f6 0%, #60a5fa ${scoreWidth}%)"></div>
        </div>
      </div>
    `;
    
    // Add click event for the whole card
    resultItem.addEventListener('click', (e) => {
      // Don't open if they clicked on the link already
      if (e.target.tagName !== 'A') {
        chrome.tabs.create({ url: result.url });
      }
    });
    
    resultsList.appendChild(resultItem);
  });
  
  setUIState('results');
}

// Set UI state
function setUIState(state) {
  // Hide all states first
  initialState.classList.add('hidden');
  loadingIndicator.classList.add('hidden');
  noResults.classList.add('hidden');
  resultsList.classList.add('hidden');
  
  // Show the requested state
  switch (state) {
    case 'initial':
      initialState.classList.remove('hidden');
      break;
    case 'loading':
      loadingIndicator.classList.remove('hidden');
      break;
    case 'no-results':
      noResults.classList.remove('hidden');
      break;
    case 'results':
      resultsList.classList.remove('hidden');
      break;
  }
}

// Open settings
// In popup.js, update the openSettings function

// Open settings
function openSettings() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    // Fallback for browsers that don't support openOptionsPage
    chrome.tabs.create({ url: 'options.html' });
  }
}

// Add a function to open the dashboard
function openDashboard() {
  chrome.tabs.create({ url: 'dashboard.html' });
}

// Update the DOM elements and event listeners section
document.addEventListener('DOMContentLoaded', async () => {
  // Add a dashboard button
  const dashboardButton = document.createElement('button');
  dashboardButton.textContent = 'Dashboard';
  dashboardButton.className = 'text-blue-500 hover:text-blue-700 mr-2';
  dashboardButton.addEventListener('click', openDashboard);
  
  // Insert it before the settings button
  const footer = document.querySelector('footer');
  const settingsButton = document.getElementById('settings-button');
  footer.insertBefore(dashboardButton, settingsButton);
  
  // Rest of the initialization code...
  await updateStats();
  
  searchButton.addEventListener('click', performSearch);
  searchInput.addEventListener('keyup', e => {
    if (e.key === 'Enter') performSearch();
  });
  
  suggestionTags.forEach(tag => {
    tag.addEventListener('click', () => {
      searchInput.value = tag.textContent;
      performSearch();
    });
  });
  
  settingsButton.addEventListener('click', openSettings);
});