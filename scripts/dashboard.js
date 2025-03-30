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
        displayStatus("Searching...");
        resultsDiv.innerHTML = '';

        // ** No longer adding search query itself to history **

        // ** TODO: Send SEARCH query to background script **
        console.log(`TODO: Send query "${query}" to background script FOR SEARCH.`);
        setTimeout(() => {
             // --- FIX START ---
             // First, try to find the status message element *inside resultsDiv*
             const statusMessageElement = resultsDiv.querySelector('.status-message');

             // Check if it still exists and says "searching"
             const isStillSearching = statusMessageElement && statusMessageElement.textContent.toLowerCase().includes('searching');

             // Display the "initiated, no results yet" message ONLY IF
             // the results area is currently empty AND it's not displaying the "searching" message.
             // (Or adjust logic if you want different behavior)
             if (resultsDiv.innerHTML.trim() === '' && !isStillSearching) {
                 displayStatus(`Search for "${query}" initiated. No results yet.`);
             }
             // Alternate simpler logic: If nothing happened after 2s (results still empty OR just shows 'searching'), show message.
             // const resultsAreEmpty = resultsDiv.innerHTML.trim() === '';
             // if ((resultsAreEmpty || isStillSearching) && resultsDiv.children.length <= 1) { // Check if only the status msg is there or empty
             //      displayStatus(`Search for "${query}" initiated. No results yet.`);
             // }

             // --- FIX END ---
        }, 2000);
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
    function displayResults(results) { /* ... keep function ... */
        resultsDiv.innerHTML = ''; // Clear previous results or status messages
        if (!results || results.length === 0) { displayStatus("No relevant pages found for your query."); return; }
        results.forEach(item => { /* ... create and append resultItem ... */ });
     }

}); // End of DOMContentLoaded