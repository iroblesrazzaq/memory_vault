const DB_NAME = 'semanticHistoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'pages';
const MAX_PAGE_COUNT = 10000; // TODO: reset to 10000 after testing for 600
let db = null;
let keepAliveInterval;



console.log(`Background service worker started. Max entries: ${MAX_PAGE_COUNT}`);


// scripts/background.js - Replace existing initDB function

function initDB() {
    return new Promise((resolve, reject) => {
        // Don't re-initialize if connection already exists and is open
        // Note: Simple check. Real-world might need more robust connection validation.
        if (db) {
            // console.log('IndexedDB connection already exists.'); // Optional log
            resolve(db);
            return;
        }
        console.log('Initializing IndexedDB connection...');
        const request = self.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            console.log('IndexedDB upgrade needed.');
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                console.log(`Creating object store: ${STORE_NAME}`);
                const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('url', 'url', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('Object store and indexes created.');
            }
             // Handle future upgrades here if DB_VERSION increases
        };

        request.onsuccess = (event) => {
            console.log('IndexedDB initialized successfully.');
            db = event.target.result;

            // Handle connection closing unexpectedly
            db.onclose = () => {
                console.warn('IndexedDB connection closed unexpectedly.');
                db = null; // Reset db variable so initDB tries to reopen next time
            };
            db.onerror = (event) => {
                 console.error('IndexedDB database error:', event.target.error);
                 // Potentially try to close and nullify db here?
            }

            console.log('Available object stores:', Array.from(db.objectStoreNames));
            resolve(db);
        };

        request.onerror = (event) => {
            console.error('IndexedDB initialization error:', event.target.error);
            reject(`IndexedDB error: ${event.target.error}`);
        };
    });
}

// Keep the initial call outside listeners
initDB().catch(error => console.error("Initial DB Init failed:", error));

// inserting storage quote estimation logging function

/**
 * Estimates storage usage and quota for the extension origin.
 * Logs the results to the console.
 * @param {string} context - A string describing when/why the check is happening (for logging).
 * @returns {Promise<object|null>} A promise resolving to { usage, quota } in bytes, or null on error/unavailability.
 */
async function estimateAndLogStorage(context = "Generic Check") {
    try {
        // Check if the API is available
        if (navigator.storage && navigator.storage.estimate) {
            const quota = await navigator.storage.estimate();
            const usageBytes = quota.usage;
            const quotaBytes = quota.quota;

            // Format for better readability in logs
            const usageMB = (usageBytes / (1024 * 1024)).toFixed(2);
            const quotaMB = (quotaBytes / (1024 * 1024)).toFixed(2);
            const percentageUsed = quotaBytes > 0 ? ((usageBytes / quotaBytes) * 100).toFixed(1) : 0;

            console.log(`[Storage Estimation - ${context}] Usage: ${usageMB} MB / ${quotaMB} MB (${percentageUsed}%)`);

            return { usage: usageBytes, quota: quotaBytes };
        } else {
            console.warn(`[Storage Estimation - ${context}] navigator.storage.estimate() API not available.`);
            return null; // Indicate unavailability
        }
    } catch (error) {
        console.error(`[Storage Estimation - ${context}] Error getting storage estimate:`, error);
        return null; // Indicate error
    }
}


function addPageData(pageDataObject) {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await initDB();
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Log the data just before adding
            console.log("Attempting to add to IndexedDB:", JSON.stringify(pageDataObject).substring(0, 300) + "..."); 

            const request = store.add(pageDataObject);
            let generatedId = null; // Variable to hold the ID

            request.onsuccess = (event) => {
                generatedId = event.target.result; // Store the ID when request succeeds
                console.log('IndexedDB store.add request successful. ID assigned:', generatedId);
                // DO NOT RESOLVE HERE YET!
            };

            request.onerror = (event) => {
                console.error('Error during store.add request:', event.target.error);
                // Rejecting here will also trigger transaction.onerror usually
                reject(`Error adding data (request.onerror): ${event.target.error}`);
            };

            // **** MOST IMPORTANT LOG ****
            transaction.oncomplete = () => {
                console.log('IndexedDB ADD transaction completed successfully. Data should be saved.');
                // Now we resolve, passing the ID we captured earlier
                resolve(generatedId); 
            };

            transaction.onerror = (event) => {
                console.error('IndexedDB ADD transaction error:', event.target.error);
                reject(`Transaction error (transaction.onerror): ${event.target.error}`);
            };

        } catch (error) {
             console.error('Failed to initiate addPageData transaction:', error);
             reject(error);
        }
    });
}


/**
 * Checks if the number of entries exceeds MAX_PAGE_COUNT and deletes the oldest entries if necessary.
 * Logs details of the first and last entry deleted if multiple entries are removed.
 * Logs the final count after deletion.
 * @returns {Promise<number>} A promise that resolves with the number of entries deleted.
 */
async function pruneOldEntriesIfNecessary() {
    console.log('Checking if pruning is necessary...');
    return new Promise(async (resolve, reject) => {
        let deleteCount = 0;
        let firstDeletedDetails = null;
        let lastDeletedDetails = null;
        let actualNumberToDelete = 0;

        try {
            // --- Get database connection ---
            // We need the 'database' variable accessible in the oncomplete scope later
            const database = await initDB();
            // -----------------------------

            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const countRequest = store.count();

            countRequest.onsuccess = () => {
                const currentCount = countRequest.result;
                console.log(`Current entry count: ${currentCount}`);

                if (currentCount <= MAX_PAGE_COUNT) {
                    console.log('Pruning not needed.');
                    transaction.oncomplete = () => resolve(0); // Resolve immediately on completion
                    transaction.onerror = (event) => reject(`Transaction error (no pruning): ${event.target.error}`);
                    return;
                }

                actualNumberToDelete = currentCount - MAX_PAGE_COUNT;
                console.log(`Exceeds limit of ${MAX_PAGE_COUNT}. Need to delete ${actualNumberToDelete} oldest entries.`);

                const timestampIndex = store.index('timestamp');
                const cursorRequest = timestampIndex.openCursor(null, 'next');
                let deletedSoFar = 0;

                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor && deletedSoFar < actualNumberToDelete) {
                        // ... (capture details logic remains the same) ...
                        if (deletedSoFar === 0) { firstDeletedDetails = { title: cursor.value.title, url: cursor.value.url, timestamp: cursor.key }; }
                        if (deletedSoFar === actualNumberToDelete - 1) { lastDeletedDetails = { title: cursor.value.title, url: cursor.value.url, timestamp: cursor.key }; }

                        const deleteRequest = cursor.delete();
                        deleteRequest.onsuccess = () => { deletedSoFar++; };
                        deleteRequest.onerror = (event) => { console.error(`Error deleting entry ID: ${cursor.primaryKey}`, event.target.error); };
                        cursor.continue();
                    } else {
                        console.log(`Finished pruning attempt. Intended: ${actualNumberToDelete}, Actual Deleted: ${deletedSoFar}`);
                        deleteCount = deletedSoFar;

                        // --- Log the captured details (logic remains the same) ---
                        if (firstDeletedDetails) { console.log(` -> Deleted oldest entry: "${firstDeletedDetails.title}" (${firstDeletedDetails.url}), Time: ${new Date(firstDeletedDetails.timestamp).toLocaleString()}`); }
                        if (actualNumberToDelete > 1 && lastDeletedDetails) {
                             if (lastDeletedDetails.timestamp !== firstDeletedDetails.timestamp || lastDeletedDetails.url !== firstDeletedDetails.url) {
                                 console.log(` -> Deleted newest of the pruned batch: "${lastDeletedDetails.title}" (${lastDeletedDetails.url}), Time: ${new Date(lastDeletedDetails.timestamp).toLocaleString()}`);
                             } else { console.log(` -> (Only one or two entries deleted, first/last details are the same or similar)`); }
                        } else if (actualNumberToDelete > 1 && !lastDeletedDetails) { console.warn(" -> Could not capture details for the last deleted item (unexpected)."); }
                        // -----------------------------------------------------------

                        // Resolution happens via transaction.oncomplete
                    }
                };
                cursorRequest.onerror = (event) => { console.error("Error opening cursor for deletion:", event.target.error); };
            };
            countRequest.onerror = (event) => { console.error("Error counting entries:", event.target.error); };

            // --- Modified transaction.oncomplete ---
            transaction.oncomplete = () => {
                console.log(`Pruning transaction completed. ${deleteCount} entries deleted in total.`);

                // --- Add logic to get and log the NEW count ---
                // Only perform the check if deletions actually happened.
                if (deleteCount > 0) {
                    console.log("Verifying new count after pruning...");
                    // Use the 'database' variable obtained earlier to start a new transaction
                    try {
                        const checkTransaction = database.transaction([STORE_NAME], 'readonly');
                        const checkStore = checkTransaction.objectStore(STORE_NAME);
                        const finalCountRequest = checkStore.count();

                        finalCountRequest.onsuccess = () => {
                            console.log(` ---> New database entry count: ${finalCountRequest.result}`);
                        };
                        finalCountRequest.onerror = (event) => {
                            // Log error but don't reject the original promise, as pruning succeeded
                            console.error(" ---> Error verifying count after pruning:", event.target.error);
                        };
                        // Optional: Handle checkTransaction.oncomplete/onerror if needed for debugging
                        checkTransaction.onerror = (event) => {
                             console.error(" ---> Readonly transaction error during final count check:", event.target.error);
                        }
                    } catch(countError) {
                        // Catch potential errors starting the check transaction
                         console.error(" ---> Error initiating final count check transaction:", countError);
                    }

                }
                // --- End new count logic ---

                resolve(deleteCount); // Resolve the original promise with the count deleted
            };
            // --- End modified transaction.oncomplete ---

            transaction.onerror = (event) => {
                console.error('Pruning transaction error:', event.target.error);
                reject(`Pruning transaction failed: ${event.target.error}`);
            };

        } catch (error) {
            console.error("Error setting up pruning operation:", error);
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

const GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"
// TODO: switch to newer free model?

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
                text: `Please provide a concise summary, 150-300 words of the following web page content:\n\n${truncatedText}`
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


async function getEmbedding(apiKey, textToEmbed) {
    // Endpoint without the API key in the query parameter
    const embeddingEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent";

    try {
        console.log("Requesting embedding for text length:", textToEmbed.length);

        const requestBody = {
            model: "models/text-embedding-004", // Specify the model being used
            content: {
                parts: [{ text: textToEmbed }] // Correct structure for embedding content
            }
        };

        const response = await fetch(embeddingEndpoint, {
            method: 'POST',
            headers: {
                // *** Use the specific header for API Keys ***
                'x-goog-api-key': apiKey,
                'Content-Type': 'application/json',
                // Make sure there isn't an 'Authorization: Bearer ...' header here
                // unless your apiKey variable *actually* holds a Bearer token (which is unlikely here)
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text(); // Get the full error response text
            console.error(`Embedding API Error: ${response.status} ${response.statusText}`, errorBody); // Log the full body

            // Try to parse the error for a cleaner message, fallback to raw text
            let detail = errorBody;
            try {
               const errJson = JSON.parse(errorBody);
               // Use the message from the structured error if available
               detail = errJson.error?.message || errorBody;
            } catch(e) { /* ignore json parsing error */ }

            throw new Error(`Embedding API request failed with status ${response.status}: ${detail}`);
        }

        const data = await response.json();

        // Check the expected structure for the embedding result
        if (data.embedding && data.embedding.values) {
             console.log("Embedding received, dimension:", data.embedding.values.length);
             return data.embedding.values; // Return the actual vector array
        } else {
             console.warn("Could not extract embedding from Gemini response structure:", data);
             return null; // Or handle as appropriate
        }

    } catch (error) {
        console.error("Error calling Embedding API:", error);
        return null;
    }
}

function startKeepAlive() {
    // Already running?
    if (keepAliveInterval) {
        // console.log("Keepalive already running."); // Optional log
        return;
    }

    console.log("Starting keepalive mechanism.");
    keepAliveInterval = setInterval(() => {
        // Simple check: if the DB connection is somehow lost, try re-initializing
        if (!db) {
            console.log("Keepalive: DB connection lost, attempting re-init.");
            initDB().catch(err => console.error("Keepalive DB re-init failed:", err));
        } else {
            // Optional: Perform a very lightweight operation like reading version
            // console.log("Keepalive check: DB connection seems okay."); // Can be noisy
        }
        // Or just log a heartbeat
        // console.log(`Keepalive heartbeat - ${new Date().toISOString()}`); // Noisy!
    }, 20 * 1000); // Run every 20 seconds
}

function stopKeepAlive() {
    if (keepAliveInterval) {
        console.log("Stopping keepalive mechanism.");
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
}

// --- End Keepalive logic ---
function getRecentPagesFromDB(limit = 15) {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await initDB();
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('timestamp');

            const results = [];
            const cursorRequest = index.openCursor(null, 'prev');

            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    // Extract only needed fields to send back (excluding both summary and embedding)
                    const { id, url, title, timestamp, originalWordCount } = cursor.value;
                    results.push({ id, url, title, timestamp, originalWordCount });
                    cursor.continue();
                } else {
                    console.log(`BACKGROUND: Retrieved ${results.length} recent pages from DB.`);
                    resolve(results);
                }
            };

            cursorRequest.onerror = (event) => {
                console.error("Error opening timestamp cursor:", event.target.error);
                reject(event.target.error);
            };
        } catch (error) {
            console.error('Failed to initiate getRecentPagesFromDB:', error);
            reject(error);
        }
    });
}



function calculateCosineSimilarity(vector1, vector2) {
    if (!vector1 || !vector2 || vector1.length !== vector2.length) {
        console.error("Invalid vectors for similarity calculation");
        return 0;
    }
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
        dotProduct += vector1[i] * vector2[i];
        magnitude1 += vector1[i] * vector1[i];
        magnitude2 += vector2[i] * vector2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
        return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
}

// Function to search pages based on query embedding using a cursor
async function searchPages(queryEmbedding, threshold = 0.5, maxResults = 10) {
    // Validate queryEmbedding early
    if (!queryEmbedding || !Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
        console.error("Invalid query embedding provided to searchPages.");
        // Return an empty array or throw an error, depending on desired behavior
        return Promise.resolve([]); // Return empty array for consistency
    }

    console.log(`Starting semantic search with cursor. Embedding Dim: ${queryEmbedding.length}, Threshold: ${threshold}, Max Results: ${maxResults}`);

    return new Promise(async (resolve, reject) => {
        try {
            const database = await initDB();
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const cursorRequest = store.openCursor(); // Request a cursor

            const potentialResults = []; // Array to hold pages meeting the threshold

            cursorRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // --- Processing Logic for Each Record ---
                    const page = cursor.value;

                    // Check if the page has a valid embedding
                    if (page.embedding && Array.isArray(page.embedding) && page.embedding.length === queryEmbedding.length) {
                        // Calculate similarity
                        const similarity = calculateCosineSimilarity(queryEmbedding, page.embedding);

                        // Check if similarity meets the threshold
                        if (similarity >= threshold) {
                            // Store the relevant data for potential inclusion in final results
                            // Make sure to include all fields needed by the dashboard
                            potentialResults.push({
                                id: page.id,
                                url: page.url,
                                title: page.title,
                                // summary: page.summary, // Not stored, so keep commented out
                                timestamp: page.timestamp,
                                similarity: similarity,
                                originalWordCount: page.originalWordCount // Include if dashboard uses it
                            });
                        }
                    } else if (page.embedding) {
                        // Log a warning if embedding exists but is invalid/mismatched
                        console.warn(`Page ID ${page.id} has an invalid or mismatched dimension embedding. Skipping comparison.`);
                    }
                    // --- End Processing Logic ---

                    cursor.continue(); // Move to the next record
                } else {
                    // --- No more records: Cursor iteration finished ---
                    console.log(`Cursor finished iteration. Found ${potentialResults.length} candidate pages above threshold ${threshold}.`);

                    // Sort the potential results by similarity (highest first)
                    const sortedResults = potentialResults.sort((a, b) => b.similarity - a.similarity);

                    // Slice to get only the top N results
                    const finalResults = sortedResults.slice(0, maxResults);

                    console.log(`Returning top ${finalResults.length} results.`);
                    resolve(finalResults); // Resolve the promise with the final list
                }
            };

            cursorRequest.onerror = (event) => {
                console.error("Error opening cursor for search:", event.target.error);
                reject(event.target.error); // Reject the promise on cursor error
            };

        } catch (error) {
            // Catch errors from initDB() or transaction creation
            console.error("Error during semantic search setup:", error);
            reject(error);
        }
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle page data capture
    if (message.type === 'pageData') {
        console.log("BACKGROUND: Received 'pageData' message type from:", sender.tab ? sender.tab.url : "Unknown Sender");

        // Process asynchronously
        (async () => {
            console.log("BACKGROUND: Async processing started for", message.data.url);

            try {
                const geminiApiKey = await chrome.storage.local.get('geminiApiKey');

                if (!geminiApiKey.geminiApiKey) {
                    console.error("Cannot process page: API Keys not found in storage.");
                    sendResponse({ status: "error", message: "API keys not configured" });
                    return;
                }

                // 1. Get Summary (TEMPORARY - only used for embedding, not storage)
                const summary = await getSummary(geminiApiKey.geminiApiKey, message.data.textContent);

                // Handling case where summary fails BUT we still store basic info
                if (!summary) {
                    console.warn("Failed to get summary for:", message.data.url);
                    // Store basic info without embedding
                    const pageDataObjectBasic = {
                        url: message.data.url,
                        title: message.data.title,
                        timestamp: message.data.timestamp,
                        embedding: null, // No embedding without summary
                        originalWordCount: message.data.wordCount
                    };
                    const storedItemIdBasic = await addPageData(pageDataObjectBasic); // Store basic data
                    console.log(`Stored basic page data (ID: ${storedItemIdBasic}, no summary/embedding) for:`, message.data.url);
                    

                    await pruneOldEntriesIfNecessary();

                    // Still log storage after this basic add
                    await estimateAndLogStorage(`After Basic Add (ID ${storedItemIdBasic})`);

                    sendResponse({ status: "warning", message: "Stored basic info, but summarization failed" });
                    return; // Stop further processing for this page
                }

                // 2. Generate embedding from the summary (only if summary was successful)
                const embedding = await getEmbedding(geminiApiKey.geminiApiKey, summary);

                // 3. Prepare data for storage (with embedding)
                const pageDataObject = {
                    url: message.data.url,
                    title: message.data.title,
                    timestamp: message.data.timestamp,
                    embedding: embedding, // Store the embedding if successful
                    originalWordCount: message.data.wordCount
                    // summary field is intentionally omitted
                };

                // 4. Store in IndexedDB
                const storedItemId = await addPageData(pageDataObject);
                console.log(`Successfully processed and stored page data (ID: ${storedItemId}) for:`, message.data.url);

                await pruneOldEntriesIfNecessary();

                // 5. Log storage AFTER successful full add
                // Added context including the ID for better tracking
                await estimateAndLogStorage(`After Full Add (ID ${storedItemId})`);

                // 6. Send success response
                sendResponse({ status: "success", message: `Data stored with ID ${storedItemId}` });

            } catch (error) {
                console.error("Error processing page data in background:", error);
                // Also log storage on error to see if usage changed before failure
                await estimateAndLogStorage("After Error in pageData");
                sendResponse({ status: "error", message: error.message || "Unknown processing error" });
            }
        })(); // Immediately invoke the async function

        // Return true IMMEDIATELY to indicate that sendResponse will be called asynchronously.
        return true;
    }

    // Handle search queries
    else if (message.type === 'searchQuery') {
        console.log("BACKGROUND: Received search query:", message.query);

        (async () => {
            try {
                // 1. Get the API key
                const geminiApiKey = await chrome.storage.local.get('geminiApiKey');

                if (!geminiApiKey.geminiApiKey) {
                    console.error("Cannot process search: API Keys not found in storage.");
                    sendResponse({
                        status: "error",
                        message: "API keys not configured"
                    });
                    return;
                }

                // 2. Get embedding for the query
                const queryEmbedding = await getEmbedding(geminiApiKey.geminiApiKey, message.query);

                if (!queryEmbedding) {
                    console.error("Failed to get embedding for search query");
                    sendResponse({
                        status: "error",
                        message: "Failed to process search query"
                    });
                    return;
                }

                // 3. Search pages using the embedding
                const searchResults = await searchPages(queryEmbedding, 0.4); // 0.4 threshold

                // 4. Send back results
                sendResponse({
                    status: "success",
                    results: searchResults
                });

            } catch (error) {
                console.error("Error processing search query:", error);
                sendResponse({
                    status: "error",
                    message: error.message || "Unknown search error"
                });
            }
        })();

        return true; // Indicate async response
    }

    // Handle requests for recent activity
    else if (message.type === 'getRecentActivity') {
        console.log("BACKGROUND: Received 'getRecentActivity' message.");
        (async () => {
            try {
                const recentPages = await getRecentPagesFromDB(message.limit || 15); // Use limit from message or default
                console.log("BACKGROUND: Sending recent activity response.");
                sendResponse({ status: 'success', data: recentPages });
            } catch (error) {
                console.error("BACKGROUND: Error getting recent activity:", error);
                sendResponse({ status: 'error', message: error.message || 'Failed to retrieve recent activity' });
            }
        })();
        return true; // Need return true because getRecentPagesFromDB is async
    }

    // *** NEW: Handle requests for storage estimate ***
    else if (message.type === 'getStorageEstimate') {
        console.log("BACKGROUND: Received 'getStorageEstimate' message.");
        (async () => {
            // Call the estimation function (it logs internally too)
            const estimate = await estimateAndLogStorage("UI Request");
            if (estimate) {
                // Send back the raw usage and quota bytes
                sendResponse({ status: 'success', usage: estimate.usage, quota: estimate.quota });
            } else {
                // Handle cases where estimation failed or API not available
                sendResponse({ status: 'error', message: 'Could not estimate storage.' });
            }
        })();
        return true; // Indicate async response
    }

    // Handle unknown message types
    else {
         console.warn("BACKGROUND: Received unknown message type:", message.type);
         // Optional: Send a generic error response if needed, but often just logging is fine.
         // sendResponse({status: 'error', message: `Unknown message type: ${message.type}`});
         // If you send a response here, you might need to return false or true depending
         // on whether the response is synchronous or asynchronous (usually false if sync).
         // For just logging, no return true is needed.
    }

}); // End of addListener

// Call initDB when the service worker starts
initDB().catch(console.error);

console.log("Background service worker started (v3 with DB & Summary Integration).");


self.addEventListener('install', (event) => {
    // ... install logic - TODO: implement? idk if necessary but have skeleton
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        clients.claim()
        .then(() => initDB())
        .then(() => estimateAndLogStorage("Activation")) // <-- Add this call
        // .then(() => startKeepAlive()) // Keep if needed
        .catch(err => console.error("Activation error:", err))
    );
});


// 4. Log that script setup is complete (Top Level)
console.log("Background script listeners attached.");