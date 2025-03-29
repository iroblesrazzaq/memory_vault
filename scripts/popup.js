// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Get references to DOM elements
    const pageCountElem = document.getElementById('pageCount');
    const storageSizeElem = document.getElementById('storageSize');
    const pageListElem = document.getElementById('pageList');
    const clearDataBtn = document.getElementById('clearData');
    
    // Load and display stored page data
    function loadStoredPages() {
      chrome.storage.local.get(null, function(items) {
        // Filter for only our page data entries
        const pageEntries = Object.entries(items).filter(([key]) => 
          key.startsWith('page_data_')
        );
        
        // Update stats
        pageCountElem.textContent = pageEntries.length;
        
        // Calculate approximate storage size
        let totalSize = 0;
        pageEntries.forEach(([_, value]) => {
          totalSize += JSON.stringify(value).length;
        });
        storageSizeElem.textContent = `${(totalSize / 1024).toFixed(2)} KB`;
        
        // Sort by timestamp (newest first)
        pageEntries.sort((a, b) => {
          return new Date(b[1].timestamp) - new Date(a[1].timestamp);
        });
        
        // Clear the list
        pageListElem.innerHTML = '';
        
        // Show up to 10 most recent entries
        pageEntries.slice(0, 10).forEach(([key, pageData]) => {
          const pageItem = document.createElement('div');
          pageItem.className = 'page-item';
          
          const title = document.createElement('div');
          title.style.fontWeight = 'bold';
          title.textContent = pageData.title || 'Untitled Page';
          
          const url = document.createElement('div');
          url.style.fontSize = '12px';
          url.style.color = '#666';
          url.textContent = pageData.url;
          
          const info = document.createElement('div');
          info.style.fontSize = '12px';
          info.textContent = `${pageData.wordCount} words - ${new Date(pageData.timestamp).toLocaleString()}`;
          
          pageItem.appendChild(title);
          pageItem.appendChild(url);
          pageItem.appendChild(info);
          
          // Add click handler to show details
          pageItem.addEventListener('click', function() {
            console.log(pageData.textContent.substring(0, 500) + '...');
            alert(`First 100 characters:\n${pageData.textContent.substring(0, 100)}...`);
          });
          
          pageListElem.appendChild(pageItem);
        });
        
        // Show message if no pages stored
        if (pageEntries.length === 0) {
          const emptyMsg = document.createElement('div');
          emptyMsg.style.padding = '10px';
          emptyMsg.style.color = '#666';
          emptyMsg.textContent = 'No pages stored yet. Browse some websites to capture their text.';
          pageListElem.appendChild(emptyMsg);
        }
      });
    }
    
    // Clear all stored data
    clearDataBtn.addEventListener('click', function() {
      if (confirm('Are you sure you want to clear all stored page data?')) {
        chrome.storage.local.clear(function() {
          loadStoredPages();
        });
      }
    });
    
    // Initial load
    loadStoredPages();
  });