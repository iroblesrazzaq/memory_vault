/**
 * Content script for the Semantic History extension
 * This runs in the context of web pages
 */

// CONSTANTS
const DEBUG = false;

// Track user interactions on the page
let pageInteractions = {
  scrollDepth: 0,
  interactionCount: 0,
  timeOnPage: 0,
  startTime: Date.now()
};

// Timer to periodically update interaction metrics
let interactionTimer = null;

// Initialize content script
function initialize() {
  if (DEBUG) console.log('[Semantic History] Content script initialized on', window.location.href);
  
  // Start tracking interactions
  setupInteractionTracking();
  
  // Start timer to send updates
  interactionTimer = setInterval(updateInteractions, 5000);
  
  // Notify background script that page is loaded
  chrome.runtime.sendMessage({
    action: 'pageLoaded',
    url: window.location.href,
    title: document.title,
    timestamp: Date.now()
  });
}

// Set up event listeners to track user interactions
function setupInteractionTracking() {
  // Track scrolling
  window.addEventListener('scroll', () => {
    // Calculate scroll depth as percentage
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
    const windowHeight = window.innerHeight;
    const scrollPercentage = (scrollTop / (scrollHeight - windowHeight)) * 100;
    
    // Update max scroll depth
    pageInteractions.scrollDepth = Math.max(pageInteractions.scrollDepth, Math.min(100, scrollPercentage));
  });
  
  // Track clicks
  document.addEventListener('click', () => {
    pageInteractions.interactionCount++;
  });
  
  // Track key presses
  document.addEventListener('keydown', () => {
    pageInteractions.interactionCount++;
  });
  
  // Listen for page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      // Page is hidden, send final interaction data
      updateInteractions(true);
      clearInterval(interactionTimer);
    } else if (document.visibilityState === 'visible') {
      // Page is visible again, restart timer
      interactionTimer = setInterval(updateInteractions, 5000);
    }
  });
  
  // Listen for unload
  window.addEventListener('beforeunload', () => {
    // Send final interaction data
    updateInteractions(true);
    clearInterval(interactionTimer);
  });
}

// Update and potentially send interaction data to background script
function updateInteractions(isFinal = false) {
  // Update time on page
  pageInteractions.timeOnPage = Math.floor((Date.now() - pageInteractions.startTime) / 1000);
  
  // Send data to background script
  chrome.runtime.sendMessage({
    action: 'updatePageInteractions',
    interactions: pageInteractions,
    url: window.location.href,
    isFinal
  });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    // Extract main content from the page
    const content = extractPageContent();
    sendResponse({ content });
    return true;
  }
});

// Extract main content from the page
function extractPageContent() {
  // Try to find the main content element
  const mainContent = document.querySelector('main') || 
                     document.querySelector('article') || 
                     document.querySelector('div[role="main"]') || 
                     document.querySelector('#main-content') || 
                     document.querySelector('.post-content') || 
                     document.querySelector('#content');
  
  let text = '';
  
  if (mainContent) {
    // Get text from main content
    text = mainContent.innerText;
  } else {
    // Fallback to body text
    text = document.body.innerText;
  }
  
  // Clean up text (remove excessive whitespace)
  text = text.replace(/\s+/g, ' ').trim();
  
  return {
    title: document.title,
    text,
    url: window.location.href,
    timestamp: Date.now()
  };
}

// Start the content script
initialize();