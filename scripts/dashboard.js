// scripts/dashboard.js

document.addEventListener('DOMContentLoaded', function() {
    // --- DOM Elements ---
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsDiv = document.getElementById('results');
    const recentActivityList = document.getElementById('recentActivityList'); // Updated ID
    // const clearHistoryButton = document.getElementById('clearHistoryButton'); // Not used now

    // --- Initial Load ---
    fetchAndDisplayRecentActivity(); // Request data from background script

    // --- Event Listeners ---
    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            performSearch();
        }
    });
    // clearHistoryButton event listener removed


    // --- Search Function ---
    function performSearch() {
        const query = searchInput.value.trim();
        if (!query) {
            displayStatus("Please enter a search query.");
            return;
        }
        
        console.log(`Search button clicked. Query: "${query}"`);
        displayStatus("Searching for semantically similar content...");
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
    }
    


    // --- Recent Activity Functions ---

    function fetchAndDisplayRecentActivity(limit = 15) {
        console.log("DASHBOARD: Requesting recent activity from background script...");
        recentActivityList.innerHTML = `<li class="status-message" style="font-size: 0.9em; padding: 10px;">Loading recent activity...</li>`; // Show loading message

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
        recentActivityList.innerHTML = ''; // Clear loading/error message

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
            li.title = `Visited: ${item.url}\nClick to view stored details`; // Tooltip

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
                 urlSpan.textContent = item.url.substring(0, 30) + '...'; // Fallback
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

            // Add click listener - maybe show summary or navigate?
            li.addEventListener('click', () => {
                // Option 1: Navigate to the original URL
                // window.open(item.url, '_blank');

                // Option 2: Show the stored summary in an alert (or modal)
                alert(`Stored Summary for: ${item.title}\n\n${item.summary || '(No summary stored)'}`);

                // Option 3: Future - Integrate with search results display?
            });

            recentActivityList.appendChild(li);
        });
    }

     function displayRecentActivityError(errorMessage) {
         recentActivityList.innerHTML = ''; // Clear loading message
         const li = document.createElement('li');
         li.className = 'status-message';
         li.style.color = 'red'; // Indicate error
         li.style.fontSize = '0.9em';
         li.style.padding = '10px';
         li.textContent = `Error loading activity: ${errorMessage}`;
         recentActivityList.appendChild(li);
     }


    // --- Utility Functions --- (Keep displayStatus and displayResults)
    function displayStatus(message) { /* ... keep function ... */
         resultsDiv.innerHTML = `<div class="status-message">${message}</div>`;
     }
     function displayResults(results) {
        resultsDiv.innerHTML = ''; // Clear previous results or status messages
        
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
            titleLink.target = '_blank'; // Open in new tab
            titleElem.appendChild(titleLink);
            
            // URL display
            const urlElem = document.createElement('div');
            urlElem.className = 'url';
            urlElem.textContent = item.url;
            
            // Summary
            const summaryElem = document.createElement('div');
            summaryElem.className = 'summary';
            summaryElem.textContent = item.summary || 'No summary available';
            
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
            resultItem.appendChild(summaryElem);
            resultItem.appendChild(scoreElem);
            resultItem.appendChild(timestampElem);
            
            resultsDiv.appendChild(resultItem);
        });
    }
    
}); // End of DOMContentLoaded