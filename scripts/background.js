const DB_NAME = 'semanticHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'pages';
let db = null; // Database connection reference


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

const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta2/models/gemini-2.0-flash-thinking-exp-01-21:generate"
// check to ensure this is correct api endpoint


async function getSummary(apiKey, textContent) {
    if (!apiKey) {
        console.error("Gemini API Key is missing.");
        return null;
    }
    // Reduce text size to fit within potential token limits and speed up processing
    // You might adjust this limit based on testing and model requirements
    const MAX_TEXT_LENGTH = 15000; // Example limit (characters)
    const truncatedText = textContent.length > MAX_TEXT_LENGTH
        ? textContent.substring(0, MAX_TEXT_LENGTH) + "..." // Indicate truncation
        : textContent;

    const requestBody = {
        contents: [{
            parts: [{
                text: `Please provide a concise summary (around 100-150 words) of the following web page content:\n\n${truncatedText}`
            }]
        }],
        // Optional: Add safetySettings, generationConfig if needed
        // generationConfig: {
        //   temperature: 0.7,
        //   topK: 40,
        //   // ... other params
        // }
    };

    console.log("Requesting summary from Gemini for text length:", truncatedText.length);

    try {
        const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Gemini API Error: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (data.candidates && data.candidates.length > 0 &&
            data.candidates[0].content && data.candidates[0].content.parts &&
            data.candidates[0].content.parts.length > 0 && data.candidates[0].content.parts[0].text)
        {
            const summary = data.candidates[0].content.parts[0].text.trim();
            console.log("Summary received from Gemini:", summary.substring(0, 100) + "...");
            return summary;
        } else {
            console.warn("Could not extract summary from Gemini response structure:", data);
            return null; // Or a default message like "Summary unavailable"
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return null;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle page data capture
    if (message.type === 'pageData') {
        console.log("Received page data message, processing asynchronously...");

        // Process asynchronously
        (async () => {
            try {
                const storage = await chrome.storage.local.get('geminiApiKey');
                const apiKey = storage.geminiApiKey;

                if (!apiKey) {
                    console.error("Cannot process page: Gemini API Key not found in storage.");
                    sendResponse({ status: "error", message: "API key not configured" });
                    return; // Stop processing this message
                }

                // 1. Get Summary
                const summary = await getSummary(apiKey, message.data.textContent);

                if (!summary) {
                    console.warn("Failed to get summary for:", message.data.url);
                     // Decide: Store anyway with null summary, or skip? Let's store basic info.
                     const pageDataObject = {
                        url: message.data.url,
                        title: message.data.title,
                        timestamp: message.data.timestamp,
                        summary: null, // Explicitly null
                        embedding: null, // Embedding not yet implemented
                        originalWordCount: message.data.wordCount // Keep original count
                    };
                    await addPageData(pageDataObject);
                    sendResponse({ status: "warning", message: "Stored basic info, but summarization failed" });
                    return;
                }

                // 2. Prepare data for storage (embedding is null for now)
                 const pageDataObject = {
                    url: message.data.url,
                    title: message.data.title,
                    timestamp: message.data.timestamp,
                    summary: summary,
                    embedding: null, // Placeholder for Phase 1 Embedding task
                    originalWordCount: message.data.wordCount
                };

                // 3. Store in IndexedDB
                const storedItemId = await addPageData(pageDataObject);
                console.log(`Successfully processed and stored page data (ID: ${storedItemId}) for:`, message.data.url);
                sendResponse({ status: "success", message: `Data stored with ID ${storedItemId}` });

            } catch (error) {
                console.error("Error processing page data in background:", error);
                sendResponse({ status: "error", message: error.message || "Unknown processing error" });
            }
        })(); // Immediately invoke the async function

        // Return true IMMEDIATELY to indicate that sendResponse will be called asynchronously.
        return true;
    }

    // Handle search queries (Phase 2)
    else if (message.type === 'searchQuery') {
        console.log("Received search query:", message.query);
        // TODO: Implement search logic in Phase 2
        sendResponse({ status: "pending", results: [] }); // Placeholder response
        return true; // Indicate async response
    }

    // Handle other message types if needed
    // else { ... }

}); // End of addListener

// Call initDB when the service worker starts
initDB().catch(console.error);

console.log("Background service worker started (v3 with DB & Summary Integration).");



// Placeholder function (will be integrated into the listener)
// async function processPageData(pageData) {
//   // 1. Call Summarization API - done
//   // 2. Call Embedding API / Use Library
//   // 3. Store final data in IndexedDB using addPageData()
// }