# Memory Vault: Semantic History Search Chrome Extension

**A Chrome extension that builds a searchable, semantic history of your browsing, allowing you to find pages based on concepts and meaning, not just keywords.**

<!-- Optional but Recommended: Insert a compelling screenshot or GIF here -->
<!-- ![Semantic Memory Vault Dashboard Search](link/to/your/screenshot.png) -->

---

## Overview

Tired of losing track of interesting articles or important pages in your browser history? Semantic Memory Vault automatically captures the core content of pages you visit, generates semantic vector embeddings using the Google Gemini API, and stores them locally.

This allows you to **search your browsing history using natural language queries**. Instead of guessing keywords or URLs, you can search for *concepts* like "information about vector databases" and find relevant pages you've visited, even if the exact words aren't in the title. It transforms your browsing history into a powerful, searchable personal knowledge base.

---

## Key Features

*   **🧠 Semantic Search:** Find pages based on meaning, not just keywords.
*   **🤖 AI-Powered Embeddings:** Uses Google Gemini (`text-embedding-004`) for state-of-the-art content understanding.
*   **🧹 Automatic Content Extraction:** Leverages `@mozilla/readability` to capture the essential text, ignoring clutter.
*   **🔒 Local-First Storage:** All data (embeddings, metadata) stored securely in your browser's IndexedDB.
*   **📈 Efficient & Scalable:** Uses IndexedDB cursors for memory-efficient searching and automatic pruning to manage storage.
*   **📊 User Dashboard:** Dedicated interface for searching, viewing results, and managing settings.

---

## Technology Stack

*   **Browser Extension:** Chrome Manifest V3 (Service Worker)
*   **Frontend:** HTML, CSS, JavaScript (ES6+, async/await)
*   **AI:** Google Gemini API (`text-embedding-004`, `gemini-1.5-flash`)
*   **Libraries:** `@mozilla/readability`
*   **Storage:** IndexedDB

---

## How It Works (Simplified)

1.  **Capture & Extract:** Reads main content from visited pages.
2.  **Embed:** Generates a semantic vector embedding via the Gemini API.
3.  **Store:** Saves embedding + metadata (URL, title, timestamp) locally in IndexedDB.
4.  **Prune:** Automatically removes oldest entries if a storage limit (by count) is exceeded.
5.  **Search:** Embeds your search query, then efficiently compares it (using cosine similarity & IndexedDB cursors) against stored page embeddings to find the most relevant results.

---

## Setup & Installation (for Local Testing)

*(This extension is not yet on the Chrome Web Store)*

1.  Clone or download the source code.
2.  Open Chrome and navigate to `chrome://extensions`.
3.  Enable "Developer mode" (top-right toggle).
4.  Click "Load unpacked" and select the project folder (containing `manifest.json`).

**API Key Required:** This extension needs a Google Gemini API key.
1.  Get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Open the extension's Dashboard (via the popup), click the Settings (⚙️) button, paste your key, and save.

---

## Usage

*   **Browse:** The extension captures pages automatically in the background.
*   **Search:** Open the Dashboard (Popup -> "Open Search Dashboard"), enter your query, and click "Search" to find relevant pages from your history.
*   **Stats:** Click the extension icon for page count and storage estimates.
