// scripts/onboarding.js - Onboarding page functionality

function openExtension() {
    // Show helpful instructions on how to access the extension
    const instructions = `
✅ Memory Vault is installed! Here's how to get started:

🔍 FIND THE EXTENSION:
• Look for the Memory Vault icon (🧠) in your Chrome toolbar (top-right)
• If you don't see it, click the puzzle piece icon (🧩) to pin it

🚀 GET STARTED:
• Click the Memory Vault icon to open the popup
• Click "Get Started" to set up your free API key
• Or right-click the icon → "Open Dashboard"

💡 TIP: After setting up your API key, just browse normally. Memory Vault will automatically capture interesting pages for you to search later!
    `.trim();
    
    // Create a better-styled modal instead of alert
    showInstructionsModal(instructions);
}

function showInstructionsModal(instructions) {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.7); display: flex; align-items: center;
        justify-content: center; z-index: 10000; font-family: inherit;
    `;
    
    // Create modal content
    const content = document.createElement('div');
    content.style.cssText = `
        background: white; border-radius: 12px; padding: 30px;
        max-width: 500px; margin: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    `;
    
    content.innerHTML = `
        <h3 style="color: #4285f4; margin: 0 0 20px 0;">🎉 Ready to Get Started!</h3>
        <pre style="white-space: pre-wrap; line-height: 1.5; margin: 0 0 20px 0; font-family: inherit;">${instructions}</pre>
        <button id="modalCloseButton" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; float: right;">Got it!</button>
        <div style="clear: both;"></div>
    `;
    
    modal.setAttribute('data-modal', 'true');
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Add event listener to close button
    const closeButton = content.querySelector('#modalCloseButton');
    closeButton.addEventListener('click', () => {
        modal.remove();
    });
    
    // Close on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Update button text and add event listener
    const button = document.querySelector('.cta-button');
    if (button) {
        button.textContent = '🚀 How to Access Memory Vault';
        button.addEventListener('click', openExtension);
    }
}); 