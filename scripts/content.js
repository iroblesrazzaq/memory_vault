// scripts/content.js

// --- Configuration ---
const MIN_WORD_COUNT_THRESHOLD = 50; // Increased threshold slightly, as main content should be richer
const MAX_WORDS_TO_SEND = 500; // Max words to send to background for processing
const EXECUTION_DELAY = 10000; // Reduced delay slightly as Readability might be faster/more reliable

// --- Event Listener ---
window.addEventListener("load", () => {
    // Don't run in sub-frames
    if (window.self !== window.top) {
        console.log("Content script: Skipping execution in sub-frame.");
        return;
    }

    console.log("Content script: 'load' event fired for top frame:", window.location.href);

    setTimeout(() => {
        console.log(`Content script: ${EXECUTION_DELAY}ms timeout executing...`);
        try {
            const pageData = extractAndProcessPageContent();

            if (!pageData) {
                console.log("Content script: Could not extract sufficient content using Readability.");
                return; // Stop if extraction failed
            }

            // Log extracted/processed data
            console.log("Content script: Extracted pageData details:");
            console.log("  - Title:", pageData.title);
            console.log("  - URL:", pageData.url);
            console.log("  - Original Word Count:", pageData.originalWordCount);
            console.log("  - Word Count Sent:", pageData.processedText.split(/\s+/).filter(Boolean).length);
            // console.log("  - Text Sent (first 300 chars):", pageData.processedText.substring(0, 300) + "..."); // Uncomment for debugging text

            // Check original word count against threshold
            if (pageData.originalWordCount > MIN_WORD_COUNT_THRESHOLD) {
                console.log(`Content script: Original word count (${pageData.originalWordCount}) > ${MIN_WORD_COUNT_THRESHOLD}. Attempting to send message...`);

                // Prepare data for sending (exclude full original text if not needed)
                const dataToSend = {
                    url: pageData.url,
                    title: pageData.title,
                    timestamp: pageData.timestamp,
                    textContent: pageData.processedText, // Send the potentially truncated text
                    wordCount: pageData.originalWordCount // Send the original word count for metadata
                };

                chrome.runtime.sendMessage({ type: 'pageData', data: dataToSend }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Content script: Error sending message:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Content script: Page data sent successfully to background script. Response:", response);
                        displayCaptureBadge(pageData.originalWordCount); // Show original word count in badge
                    }
                });
            } else {
                console.log(`Content script: Page content too short after Readability extraction (originalWordCount: ${pageData.originalWordCount}). Skipping capture for URL:`, pageData.url);
            }
        } catch (error) {
             console.error("Content script: Error during extraction or sending:", error);
        }

    }, EXECUTION_DELAY);
});


// --- Core Content Extraction and Processing Function ---
function extractAndProcessPageContent() {
    // Use Readability.js to extract the main content
    // Clone the document as Readability modifies it
    const documentClone = document.cloneNode(true);
    const reader = new Readability(documentClone);
    const article = reader.parse();

    if (!article || !article.textContent) {
        console.warn("Content script: Readability could not parse article or extract text content.");
        // Optional Fallback (consider if needed):
        // console.log("Content script: Falling back to document.body.innerText");
        // const bodyText = document.body.innerText || "";
        // if (!bodyText) return null; // If fallback also fails
        // article = { textContent: bodyText, title: document.title }; // Create a similar structure
        return null; // Strict: If Readability fails, don't process
    }

    const extractedText = article.textContent.trim();
    const originalWords = extractedText.split(/\s+/).filter(Boolean);
    const originalWordCount = originalWords.length;
    console.log("Readability filtered successfully.");

    // --- Truncation Logic ---
    let processedText = extractedText;
    if (originalWordCount > MAX_WORDS_TO_SEND) {
        console.log(`Content script: Truncating content from ${originalWordCount} words to ${MAX_WORDS_TO_SEND} words.`);
        processedText = originalWords.slice(0, MAX_WORDS_TO_SEND).join(' ') + "..."; // Add ellipsis indicate truncation
    }

    // Return the processed text and metadata
    return {
        url: window.location.href,
        title: article.title || document.title, // Use Readability's title, fallback to document's
        timestamp: new Date().toISOString(),
        processedText: processedText, // The text to be sent (potentially truncated)
        originalWordCount: originalWordCount // The word count *before* truncation
    };
}

// --- Display Badge Function (Unchanged) ---
function displayCaptureBadge(wordCount) {
    if (!document.body) {
        console.warn("Cannot display capture badge: document.body not available.");
        return;
    }
    const badge = document.createElement("div");
    badge.style.position = "fixed";
    badge.style.bottom = "10px";
    badge.style.right = "10px";
    badge.style.padding = "5px 10px";
    badge.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    badge.style.color = "white";
    badge.style.borderRadius = "4px";
    badge.style.fontSize = "12px";
    badge.style.zIndex = "9999";
    badge.style.opacity = "1";
    badge.style.transition = "opacity 0.5s ease-in-out";
    badge.textContent = `📝 ${wordCount} words captured`; // Shows original word count
    document.body.appendChild(badge);
    setTimeout(() => {
        badge.style.opacity = "0";
        setTimeout(() => {
            if (badge.parentNode) {
                badge.remove();
            }
        }, 500);
    }, 2500);
}