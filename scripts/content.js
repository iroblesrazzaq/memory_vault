// Function to extract all text content from the page
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
  
  // Store the extracted text in local storage
  function storePageData(pageData) {
    // Use the URL as a key
    const key = `page_data_${btoa(pageData.url)}`;
    
    chrome.storage.local.set({ [key]: pageData }, () => {
      console.log("Page data stored successfully");
      
      // Optional: Add a visual indicator that text was extracted
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
      badge.textContent = `📝 ${pageData.wordCount} words captured`;
      
      document.body.appendChild(badge);
      
      // Remove the badge after 3 seconds
      setTimeout(() => {
        badge.style.opacity = "0";
        badge.style.transition = "opacity 0.5s";
        setTimeout(() => badge.remove(), 500);
      }, 3000);
    });
  }
  
  // Execute when the page is fully loaded
  window.addEventListener("load", () => {
    // Wait a bit to ensure dynamic content is loaded
    setTimeout(() => {
      const pageData = extractPageText();
      storePageData(pageData);
    }, 1500);
  });