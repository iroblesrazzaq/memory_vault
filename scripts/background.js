chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'pageData') {
        console.log("Received page data in background:", message.data);
        // Placeholder for future processing:

        // TODO: Implement processPageData(message.data);

        // processPageData(message.data);
        // Indicate success (optional, can be async)
        sendResponse({ status: "received by background" });        
        // Return true if sendResponse will be called asynchronously
        return true; // Uncommented
    }
});

console.log("Background service worker started.");

// Placeholder function (implement later)
// async function processPageData(pageData) {
//   // 1. Store temporarily? (Optional)
//   // 2. Call Summarization API
//   // 3. Call Embedding API / Use Library
//   // 4. Store final data in IndexedDB
// }