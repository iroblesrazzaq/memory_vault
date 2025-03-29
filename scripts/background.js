const DB_NAME = 'semanticHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'pages';
let db = null; // Database connection reference


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


function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }
        console.log('Initializing IndexedDB...');
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            console.log('IndexedDB upgrade needed.');
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                console.log(`Creating object store: ${STORE_NAME}`);
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                // Create indexes for searching/lookup
                store.createIndex('url', 'url', { unique: false }); // URL might not be unique if visited multiple times
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('hasEmbedding', 'embedding', { unique: false, multiEntry: false }); // Index based on whether embedding exists (not the value itself)
                console.log('Object store and indexes created.');
            }
        };

        request.onsuccess = (event) => {
            console.log('IndexedDB initialized successfully.');
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB initialization error:', event.target.error);
            reject(`IndexedDB error: ${event.target.error}`);
        };
    });
}


function addPageData(pageDataObject) {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await initDB(); // Ensure DB is initialized
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Add the data - IndexedDB handles the auto-incrementing ID
            const request = store.add(pageDataObject);

            request.onsuccess = (event) => {
                console.log('Page data added to IndexedDB with ID:', event.target.result);
                resolve(event.target.result); // Resolve with the new ID
            };

            request.onerror = (event) => {
                console.error('Error adding page data to IndexedDB:', event.target.error);
                reject(`Error adding data: ${event.target.error}`);
            };

            transaction.oncomplete = () => {
                 // Transaction completed successfully (data implicitly saved)
                 // Resolve was already called by request.onsuccess
            };

            transaction.onerror = (event) => {
                console.error('IndexedDB transaction error:', event.target.error);
                reject(`Transaction error: ${event.target.error}`);
            };
        } catch (error) {
             console.error('Failed to initiate addPageData transaction:', error);
             reject(error);
        }
    });
}


async function getAllPagesWithEmbeddings() {
    console.warn("getAllPagesWithEmbeddings() not fully implemented yet.");
    // TODO: Implement actual retrieval logic in Phase 2
    // For now, return an empty array to avoid errors later
    return Promise.resolve([]); 
}

initDB().catch(console.error);

console.log("Background service worker started (v2 with DB init).");


// Placeholder function (will be integrated into the listener)
// async function processPageData(pageData) {
//   // 1. Call Summarization API
//   // 2. Call Embedding API / Use Library
//   // 3. Store final data in IndexedDB using addPageData()
// }