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

// Execute when the page is fully loaded
window.addEventListener("load", () => {
    // Wait a bit to ensure dynamic content is loaded, and avoid running on trivial frames/iframes
    if (window.self !== window.top) {
        // Don't run in sub-frames, only the main page
        return;
    }

    setTimeout(() => {
        const pageData = extractPageText();

        // Only send if there's a reasonable amount of text content
        if (pageData.wordCount > 10) { // Avoid capturing empty or near-empty pages
            chrome.runtime.sendMessage({ type: 'pageData', data: pageData }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error sending message:", chrome.runtime.lastError.message);
                    // Handle error appropriately - maybe log or display a different badge?
                } else {
                    console.log("Page data sent to background script.", response);
                    // Display the badge upon successful sending
                    displayCaptureBadge(pageData.wordCount);
                }
            });
        } else {
            console.log("Page likely too short, skipping capture:", pageData.url, pageData.wordCount, "words");
        }
    }, 1500); // Delay might still be needed for SPA rendering
});
