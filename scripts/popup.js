// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get references to DOM elements
    const pageCountElem = document.getElementById('pageCount');
    const storageSizeElem = document.getElementById('storageSize');
    const pageListElem = document.getElementById('pageList');
    const clearDataBtn = document.getElementById('clearData');
    const openDashboardBtn = document.getElementById('openDashboard'); // Get the new button

    // --- Event listener for opening the dashboard ---
    openDashboardBtn.addEventListener('click', function() {
        chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
    });

    // Load and display stored page data
    function loadStoredPages() {
      // **** IMPORTANT: This function needs to be updated later ****
      // It currently uses chrome.storage.local which is WRONG now.
      // For now, we leave it, but it will show outdated/incorrect info
      // until we implement Step 3 from the plan (update popup).
      console.warn("Popup display uses outdated storage method. Needs update in Step 3.");

      chrome.storage.local.get(null, function(items) {
        // Filter for only our old page data entries (This logic is now incorrect for IndexedDB!)
        const pageEntries = Object.entries(items).filter(([key]) =>
          key.startsWith('page_data_') // This prefix likely doesn't match IndexedDB items
        );

        pageCountElem.textContent = pageEntries.length; // This count is likely WRONG

        let totalSize = 0;
        pageEntries.forEach(([_, value]) => {
          totalSize += JSON.stringify(value).length;
        });
        storageSizeElem.textContent = `${(totalSize / 1024).toFixed(2)} KB`; // This size is likely WRONG

        pageEntries.sort((a, b) => {
          // Assuming old structure had timestamp
          return new Date(b[1]?.timestamp || 0) - new Date(a[1]?.timestamp || 0);
        });

        pageListElem.innerHTML = '';

        if (pageEntries.length === 0) {
           const emptyMsg = document.createElement('div');
           emptyMsg.style.padding = '10px';
           emptyMsg.style.color = '#666';
           emptyMsg.textContent = 'No pages stored (or using outdated display). Open Dashboard to search.';
           pageListElem.appendChild(emptyMsg);
           return; // Exit early
        }


        pageEntries.slice(0, 10).forEach(([key, pageData]) => {
            // This rendering part also assumes the OLD data structure
            const pageItem = document.createElement('div');
            pageItem.className = 'page-item';

            const title = document.createElement('div');
            title.style.fontWeight = 'bold';
            title.textContent = pageData.title || 'Untitled Page (Old Data?)';

            const url = document.createElement('div');
            url.style.fontSize = '12px';
            url.style.color = '#666';
            url.textContent = pageData.url || 'No URL';

            const info = document.createElement('div');
            info.style.fontSize = '12px';
             // Adapt to new structure IF possible from old data, otherwise show placeholder
            const wordCount = pageData.wordCount || pageData.originalWordCount;
            const timestamp = pageData.timestamp ? new Date(pageData.timestamp).toLocaleString() : 'No Date';
            info.textContent = `${wordCount ? wordCount + ' words - ' : ''}${timestamp}`;

            pageItem.appendChild(title);
            pageItem.appendChild(url);
            pageItem.appendChild(info);

            // Update click handler? Maybe just disable it for now.
            pageItem.style.cursor = 'default'; // Indicate non-clickable for now
            // pageItem.addEventListener('click', function() {
            //     alert(`Data stored using old method. Please use search dashboard.`);
            // });

            pageListElem.appendChild(pageItem);
        });

      });
    }

    // Clear all stored data (This clears chrome.storage.local, NOT IndexedDB!)
    clearDataBtn.addEventListener('click', function() {
        // **** IMPORTANT: This needs to be updated later ****
        // It should clear IndexedDB, not chrome.storage.local
        console.warn("Clear Data button uses outdated storage method. Needs update in Step 3.");
        if (confirm('Are you sure you want to clear all OLD (chrome.storage.local) page data? This will NOT clear the main IndexedDB data.')) {
            chrome.storage.local.clear(function() {
                console.log("chrome.storage.local cleared.");
                loadStoredPages(); // Reload the (likely empty) old data list
            });
        }
    });

    // Initial load
    loadStoredPages();
}); // End DOMContentLoaded