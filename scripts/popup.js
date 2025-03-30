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
        chrome.runtime.sendMessage({ type: 'getStorageSize' }, (response) => {
            if (response && response.status === 'success') {
                storageSizeElem.textContent = response.size;
            } else {
                storageSizeElem.textContent = 'Unknown';
            }
        });
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

    // Initial load
    loadDataFromIndexedDB();
});