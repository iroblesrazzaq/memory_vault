// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get references to DOM elements
    const pageCountElem = document.getElementById('pageCount');
    const storageSizeElem = document.getElementById('storageSize');
    const pageListElem = document.getElementById('pageList');
    const clearDataBtn = document.getElementById('clearData');
    const openDashboardBtn = document.getElementById('openDashboard');

    // Constants for IndexedDB
    const DB_NAME = 'semanticHistoryDB';
    const STORE_NAME = 'pages';

    // Open dashboard when button is clicked
    openDashboardBtn.addEventListener('click', function() {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    });

    // Check API key status first, then load data
    function checkApiKeyAndLoadData() {
        chrome.storage.local.get('geminiApiKey', function(data) {
            if (!data.geminiApiKey) {
                showApiKeyRequired();
            } else {
                showApiKeyConfigured();
                loadDataFromIndexedDB();
            }
        });
    }

    // Show API key setup required UI
    function showApiKeyRequired() {
        const apiKeyAlert = `
            <div class="api-key-required">
                <h3>🔑 Setup Required</h3>
                <p>Memory Vault needs your Google Gemini API key to enable semantic search. Get your free API key and start building your searchable browsing history!</p>
                <button class="setup-button" id="setupApiKey">Get Started →</button>
            </div>
        `;
        
        // Insert before the content div
        const contentDiv = document.querySelector('.content');
        contentDiv.insertAdjacentHTML('beforebegin', apiKeyAlert);
        
        // Add click handler for setup button
        document.getElementById('setupApiKey').addEventListener('click', function() {
            chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html#setup') });
        });
        
        // Show basic stats but indicate limited functionality
        pageListElem.innerHTML = '<div class="empty-state">Configure API key to start capturing pages</div>';
        updateStats(0);
    }

    // Show API key is configured
    function showApiKeyConfigured() {
        const statusDiv = document.querySelector('.api-key-required');
        if (statusDiv) {
            statusDiv.remove();
        }
        
        // Add small status indicator
        const statusIndicator = '<div class="api-key-status">✅ API Key Configured</div>';
        const header = document.querySelector('.header');
        header.insertAdjacentHTML('afterend', statusIndicator);
    }

    // Load data from IndexedDB
    function loadDataFromIndexedDB() {
        // Display loading state
        pageListElem.innerHTML = '<div class="empty-state">Loading recent pages...</div>';
        
        // Connect to background script to get data
        chrome.runtime.sendMessage({ type: 'getRecentActivity', limit: 5 }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Popup: Error getting recent activity:", chrome.runtime.lastError.message);
                pageListElem.innerHTML = '<div class="empty-state">Error loading recent pages</div>';
                return;
            }

            if (response && response.status === 'success') {
                displayPages(response.data);
                updateStats(response.data.length);
            } else {
                console.error("Popup: Failed to get recent activity:", response?.message);
                pageListElem.innerHTML = '<div class="empty-state">Could not load recent pages</div>';
            }
        });
    }

    // Display pages in the list
    function displayPages(pages) {
        // Clear the list
        pageListElem.innerHTML = '';

        if (!pages || pages.length === 0) {
            pageListElem.innerHTML = '<div class="empty-state">No pages stored yet</div>';
            return;
        }

        // Add each page to the list
        pages.forEach(page => {
            const pageItem = document.createElement('div');
            pageItem.className = 'page-item';

            const title = document.createElement('div');
            title.className = 'page-title';
            title.textContent = page.title || 'Untitled Page';

            const url = document.createElement('div');
            url.className = 'page-url';
            url.textContent = page.url || 'No URL';

            const info = document.createElement('div');
            info.className = 'page-info';
            
            // Format timestamp
            let timestamp = 'Unknown date';
            if (page.timestamp) {
                try {
                    const date = new Date(page.timestamp);
                    timestamp = date.toLocaleString(undefined, { 
                        dateStyle: 'short', 
                        timeStyle: 'short' 
                    });
                } catch (e) {
                    console.error("Error formatting date:", e);
                }
            }
            
            // Add word count if available
            const wordCount = page.originalWordCount ? `${page.originalWordCount} words · ` : '';
            info.textContent = `${wordCount}${timestamp}`;

            // Add elements to page item
            pageItem.appendChild(title);
            pageItem.appendChild(url);
            pageItem.appendChild(info);

            // Open the page when clicked
            pageItem.addEventListener('click', function() {
                chrome.tabs.create({ url: page.url });
            });

            pageListElem.appendChild(pageItem);
        });
    }

    // Update stats display
    function updateStats(pageCount) {
        pageCountElem.textContent = pageCount;
        
        // Request storage size from background script
        chrome.runtime.sendMessage({ type: 'getStorageEstimate' }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Popup: Error requesting storage estimate:", chrome.runtime.lastError.message);
                storageSizeElem.textContent = 'Error'; // Display 'Error'
                return;
            }
    
            if (response && response.status === 'success') {
                const usageBytes = response.usage;
                // Format bytes into KB or MB for display
                let usageFormatted;
                if (usageBytes === undefined || usageBytes === null) {
                     usageFormatted = 'N/A'; // Not Available
                } else if (usageBytes < 1024) {
                    usageFormatted = `${usageBytes} B`; // Bytes
                } else if (usageBytes < 1024 * 1024) {
                    // Show KB with 1 decimal place if not a whole number
                    const kb = usageBytes / 1024;
                    usageFormatted = `${kb % 1 === 0 ? kb : kb.toFixed(1)} KB`; // Kilobytes
                } else {
                    // Show MB with 2 decimal places
                    usageFormatted = `${(usageBytes / (1024 * 1024)).toFixed(2)} MB`; // Megabytes
                }
                // Update the text content of the span element in popup.html
                storageSizeElem.textContent = usageFormatted;
            } else {
                // Handle failure response from background
                console.warn("Popup: Failed to get storage estimate from background:", response?.message);
                storageSizeElem.textContent = 'Unknown'; // Display 'Unknown'
            }
        });
        // *** END: Replacement block ***
    }

    // Clear all stored data
    clearDataBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all stored page data? This cannot be undone.')) {
            chrome.runtime.sendMessage({ type: 'clearAllData' }, (response) => {
                if (response && response.status === 'success') {
                    pageListElem.innerHTML = '<div class="empty-state">All data has been cleared</div>';
                    pageCountElem.textContent = '0';
                    storageSizeElem.textContent = '0 KB';
                } else {
                    alert('Error clearing data: ' + (response?.message || 'Unknown error'));
                }
            });
        }
    });

    // Initial load - check API key first
    checkApiKeyAndLoadData();
});