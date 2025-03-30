// scripts/dashboard.js

document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsDiv = document.getElementById('results');
    const recentActivityList = document.getElementById('recentActivityList');
    
    // API Key Modal Elements
    const settingsButton = document.getElementById('settingsButton');
    const apiKeyModal = document.getElementById('apiKeyModal');
    const closeModal = document.getElementById('closeModal');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveApiKeyButton = document.getElementById('saveApiKey');
    const apiKeyStatus = document.getElementById('apiKeyStatus');

    // --- Initial Load ---
    fetchAndDisplayRecentActivity();
    checkApiKeyStatus();

    // --- Event Listeners ---
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            performSearch();
        }
    });

    // API Key Modal Event Listeners
    settingsButton.addEventListener('click', function() {
        loadApiKey();
        apiKeyModal.style.display = 'block';
    });

    closeModal.addEventListener('click', function() {
        apiKeyModal.style.display = 'none';
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', function(event) {
        if (event.target === apiKeyModal) {
            apiKeyModal.style.display = 'none';
        }
    });

    saveApiKeyButton.addEventListener('click', saveApiKey);

    // --- API Key Functions ---
    function loadApiKey() {
        // Load API key from storage
        chrome.storage.local.get('geminiApiKey', function(data) {
            if (data.geminiApiKey) {
                // Show masked API key
                const maskedKey = maskApiKey(data.geminiApiKey);
                apiKeyInput.value = maskedKey;
                apiKeyInput.dataset.masked = 'true';
            } else {
                apiKeyInput.value = '';
                apiKeyInput.dataset.masked = 'false';
            }
        });
    }

    // When user focuses on masked API key, clear it so they can enter a new one
    apiKeyInput.addEventListener('focus', function() {
        if (apiKeyInput.dataset.masked === 'true') {
            apiKeyInput.value = '';
            apiKeyInput.dataset.masked = 'false';
        }
    });

    function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();

        // Don't save if the input is masked or empty
        if (apiKeyInput.dataset.masked === 'true' || !apiKey) {
            apiKeyStatus.textContent = 'No changes made';
            apiKeyStatus.style.color = '#666';
            setTimeout(() => { apiKeyStatus.textContent = ''; }, 3000);
            return;
        }

        // Validate API key format (basic check)
        if (!validateApiKeyFormat(apiKey)) {
            apiKeyStatus.textContent = 'Invalid API key format';
            apiKeyStatus.style.color = 'red';
            return;
        }

        // Save API key and show success message
        chrome.storage.local.set({ 'geminiApiKey': apiKey }, function() {
            apiKeyStatus.textContent = 'API key saved successfully';
            apiKeyStatus.style.color = 'green';
            
            // Mask the displayed API key
            const maskedKey = maskApiKey(apiKey);
            apiKeyInput.value = maskedKey;
            apiKeyInput.dataset.masked = 'true';
            
            // Clear message after a delay
            setTimeout(() => { apiKeyStatus.textContent = ''; }, 3000);
            
            // Optionally test API key
            testApiKey(apiKey);
        });
    }

    function validateApiKeyFormat(apiKey) {
        // Basic check for Google API key format
        // Most Google API keys start with 'AI' followed by alphanumeric chars
        // This is a simple check, adjust as needed for actual Gemini API keys
        return apiKey.length > 10 && /^[A-Za-z0-9\-_]+$/.test(apiKey);
    }

    function maskApiKey(apiKey) {
        // Show the first 4 and last 4 characters, mask the rest
        if (apiKey.length <= 8) {
            return '*'.repeat(apiKey.length);
        }
        return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
    }

    async function testApiKey(apiKey) {
        // This is a placeholder for testing if the API key is valid
        // Implement actual validation with a simple request to the Gemini API
        displayStatus('Testing API key...');
        
        // Example with text-embedding-004 model
        const testEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";
        
        try {
            const response = await fetch(testEndpoint, {
                method: 'POST',
                headers: {
                    'x-goog-api-key': apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "models/text-embedding-004",
                    content: {
                        parts: [{ text: "Hello world" }]
                    }
                })
            });
            
            if (response.ok) {
                apiKeyStatus.textContent = 'API key validated successfully';
                apiKeyStatus.style.color = 'green';
                // Update any UI elements that depend on API key status
                checkApiKeyStatus();
            } else {
                const errorData = await response.json();
                apiKeyStatus.textContent = `API key validation failed: ${errorData.error?.message || 'Unknown error'}`;
                apiKeyStatus.style.color = 'red';
            }
        } catch (error) {
            apiKeyStatus.textContent = `Error testing API key: ${error.message}`;
            apiKeyStatus.style.color = 'red';
        }
    }

    function checkApiKeyStatus() {
        chrome.storage.local.get('geminiApiKey', function(data) {
            if (!data.geminiApiKey) {
                // If no API key is set, show a message and possibly highlight the settings button
                displayStatus('No API key configured. Please click the ⚙️ button to set up your API key.');
                settingsButton.classList.add('highlight');
            } else {
                // API key is set
                settingsButton.classList.remove('highlight');
            }
        });
    }

    // --- Search Function ---
    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            displayStatus("Please enter a search query.");
            return;
        }

        // Check for API key first
        chrome.storage.local.get('geminiApiKey', function(data) {
            if (!data.geminiApiKey) {
                displayStatus("API key not configured. Please click the ⚙️ button to set up your API key.");
                settingsButton.classList.add('highlight');
                return;
            }
            
            // Continue with search if API key exists
            console.log(`Search button clicked. Query: "${query}"`);
            displayStatus("Searching for semantically similar content...", true);
            resultsDiv.innerHTML = '';
        
            // Send search query to background script
            chrome.runtime.sendMessage({ type: 'searchQuery', query: query }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error sending search query:", chrome.runtime.lastError.message);
                    displayStatus(`Search error: ${chrome.runtime.lastError.message}`);
                    return;
                }
        
                console.log("Search response received:", response);
                
                if (response && response.status === 'success') {
                    displayResults(response.results);
                } else {
                    const errorMsg = response?.message || "Unknown error";
                    displayStatus(`Search failed: ${errorMsg}`);
                }
            });
        });
    }

    // --- Recent Activity Functions ---
    function fetchAndDisplayRecentActivity(limit = 15) {
        console.log("DASHBOARD: Requesting recent activity from background script...");
        recentActivityList.innerHTML = `<li class="status-message" style="font-size: 0.9em; padding: 10px;">Loading recent activity...</li>`;

        chrome.runtime.sendMessage({ type: 'getRecentActivity', limit: limit }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("DASHBOARD: Error sending/receiving 'getRecentActivity' message:", chrome.runtime.lastError.message);
                displayRecentActivityError("Error communicating with background.");
                return;
            }

            if (response && response.status === 'success') {
                console.log("DASHBOARD: Received recent activity data:", response.data);
                displayRecentActivity(response.data);
            } else {
                console.error("DASHBOARD: Failed to get recent activity.", response?.message);
                displayRecentActivityError(response?.message || "Unknown error fetching activity.");
            }
        });
    }

    function displayRecentActivity(activityItems) {
        recentActivityList.innerHTML = '';
    
        if (!activityItems || activityItems.length === 0) {
            const li = document.createElement('li');
            li.className = 'status-message';
            li.style.fontSize = '0.9em';
            li.style.padding = '10px';
            li.textContent = 'No recent activity found in database.';
            recentActivityList.appendChild(li);
            return;
        }
    
        activityItems.forEach(item => {
            const li = document.createElement('li');
            li.title = `Visited: ${item.url}`;
    
            const titleSpan = document.createElement('span');
            titleSpan.className = 'item-title';
            titleSpan.textContent = item.title || 'Untitled Page';
    
            const urlSpan = document.createElement('span');
            urlSpan.className = 'item-url';
            // Optionally shorten URL display
            try {
                 const urlObj = new URL(item.url);
                 urlSpan.textContent = urlObj.hostname + (urlObj.pathname.length > 1 ? urlObj.pathname.substring(0, 20) + '...' : '');
            } catch {
                 urlSpan.textContent = item.url.substring(0, 30) + '...';
            }
    
            const timestampSpan = document.createElement('span');
            timestampSpan.className = 'item-timestamp';
            try {
                 timestampSpan.textContent = new Date(item.timestamp).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
            } catch {
                 timestampSpan.textContent = 'Invalid date';
            }
    
            li.appendChild(titleSpan);
            li.appendChild(urlSpan);
            li.appendChild(timestampSpan);
    
            // Add click listener to simply open the URL when clicked
            li.addEventListener('click', () => {
                window.open(item.url, '_blank');
            });
    
            recentActivityList.appendChild(li);
        });
    }

     function displayRecentActivityError(errorMessage) {
         recentActivityList.innerHTML = '';
         const li = document.createElement('li');
         li.className = 'status-message';
         li.style.color = 'red';
         li.style.fontSize = '0.9em';
         li.style.padding = '10px';
         li.textContent = `Error loading activity: ${errorMessage}`;
         recentActivityList.appendChild(li);
     }

    // --- Utility Functions ---
    function displayStatus(message, isSearching = false) {
         resultsDiv.innerHTML = `<div class="status-message ${isSearching ? 'searching' : ''}">${message}</div>`;
     }
     
     function displayResults(results) {
        resultsDiv.innerHTML = '';
        
        if (!results || results.length === 0) { 
            displayStatus("No semantically similar pages found for your query."); 
            return; 
        }
        
        // Create a header for the results
        const header = document.createElement('h3');
        header.textContent = `Found ${results.length} relevant pages`;
        header.style.marginBottom = '20px';
        resultsDiv.appendChild(header);
        
        // Display each result
        results.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            // Title with link
            const titleElem = document.createElement('h3');
            const titleLink = document.createElement('a');
            titleLink.href = item.url;
            titleLink.textContent = item.title || 'Untitled Page';
            titleLink.target = '_blank';
            titleElem.appendChild(titleLink);
            
            // URL display
            const urlElem = document.createElement('div');
            urlElem.className = 'url';
            urlElem.textContent = item.url;
            
            // Information about page
            const infoElem = document.createElement('div');
            infoElem.className = 'info';
            
            // Word count if available
            if (item.originalWordCount) {
                const wordCountElem = document.createElement('span');
                wordCountElem.className = 'word-count';
                wordCountElem.textContent = `${item.originalWordCount} words`;
                infoElem.appendChild(wordCountElem);
            }
            
            // Similarity score
            const scoreElem = document.createElement('div');
            scoreElem.className = 'score';
            const scorePercentage = Math.round(item.similarity * 100);
            scoreElem.textContent = `Relevance: ${scorePercentage}%`;
            
            // Timestamp
            const timestampElem = document.createElement('div');
            timestampElem.className = 'timestamp';
            try {
                const date = new Date(item.timestamp);
                timestampElem.textContent = `Visited: ${date.toLocaleString()}`;
            } catch {
                timestampElem.textContent = 'Unknown date';
            }
            
            // Assemble the result item
            resultItem.appendChild(titleElem);
            resultItem.appendChild(urlElem);
            resultItem.appendChild(infoElem);
            resultItem.appendChild(scoreElem);
            resultItem.appendChild(timestampElem);
            
            resultsDiv.appendChild(resultItem);
        });
    }
});