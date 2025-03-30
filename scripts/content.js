
window.addEventListener("load", () => {
    // Don't run in sub-frames
    if (window.self !== window.top) {
        console.log("Content script: Skipping execution in sub-frame.");
        return;
    }

    console.log("Content script: 'load' event fired for top frame:", window.location.href);

    // INCREASED DELAY FOR TESTING DYNAMIC SITES LIKE GITHUB
    const executionDelay = 3000; // Try 3 seconds first, maybe increase to 5000 (5s) if needed

    setTimeout(() => {
        console.log(`Content script: ${executionDelay}ms timeout executing...`);
        try {
            const pageData = extractPageText(); // Assumes extractPageText() exists elsewhere in the file

            // *** DETAILED LOGGING ADDED HERE ***
            console.log("Content script: Extracted pageData object:", pageData);
            console.log("Content script: Calculated wordCount:", pageData.wordCount);
            if (pageData.textContent) {
                 console.log("Content script: First 500 chars extracted:", pageData.textContent.substring(0, 500));
            } else {
                 console.log("Content script: textContent seems empty.");
            }
            // *** END OF DETAILED LOGGING ***


            // Only send if there's a reasonable amount of text content
            if (pageData.wordCount > 10) {
                console.log("Content script: Word count > 10. Attempting to send message...");
                chrome.runtime.sendMessage({ type: 'pageData', data: pageData }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error("Content script: Error sending message:", chrome.runtime.lastError.message);
                    } else {
                        console.log("Content script: Page data sent successfully to background script. Response:", response);
                        // Assumes displayCaptureBadge() exists elsewhere in the file
                        displayCaptureBadge(pageData.wordCount);
                    }
                });
            } else {
                console.log(`Content script: Page likely too short (wordCount: ${pageData.wordCount}). Skipping capture for URL:`, pageData.url);
            }
        } catch (error) {
             console.error("Content script: Error during extraction or sending:", error);
        }

    }, executionDelay);
});

// --- END OF BLOCK TO PASTE ---

// Make sure your existing extractPageText and displayCaptureBadge functions remain below this block
// function extractPageText() { ... }
// function displayCaptureBadge(wordCount) { ... }


function extractPageText() {
    // Get text from the body, excluding scripts, styles, etc.
    const bodyText = document.body.innerText || "";

    // Log the text to console for debugging
    console.log("Extracted page text:", bodyText.substring(0, 500) + "...");

    // Return the text and metadata
    return {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        textContent: bodyText,
        wordCount: bodyText.split(/\s+/).filter(Boolean).length
    };
}

// Function to display a temporary badge on the page
function displayCaptureBadge(wordCount) {
    // Check if document.body exists before proceeding
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
    badge.style.zIndex = "9999"; // Ensure it's on top
    badge.style.opacity = "1"; // Start fully visible
    badge.style.transition = "opacity 0.5s ease-in-out"; // Smooth fade-out
    badge.textContent = `📝 ${wordCount} words captured`;

    document.body.appendChild(badge);

    // Start fade out after 2.5 seconds, remove after 3 seconds total
    setTimeout(() => {
        badge.style.opacity = "0";
        setTimeout(() => {
            // Check if the badge is still attached before trying to remove
            if (badge.parentNode) {
                badge.remove();
            }
        }, 500); // Corresponds to the transition duration
    }, 2500); // Start fading slightly earlier
}
