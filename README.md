### Memory Vault 🧠💾 - Semantic Search Chrome Extension

A proof-of-concept Chrome extension (built for a hackathon) demonstrating semantic search capabilities for local browser history.

**Core Functionality:**

*   Leverages a **Content Script** to extract text content from webpages upon visit.
*   Utilizes a **Background Service Worker** (MV3) to orchestrate data processing and storage.
*   Integrates with the **Google Gemini API (`text-embedding-004`)** to generate vector embeddings from page content.
*   Persists embeddings and metadata locally using **IndexedDB**, ensuring user privacy.
*   Implements a search interface where user queries are embedded and compared against stored vectors using basic similarity logic (e.g., cosine similarity concept).

**Tech Stack:**

*   `Chrome Extension Manifest V3`
*   `JavaScript` (ES6+ async/await)
*   `Google Cloud / Gemini API`
*   `IndexedDB API`
*   `HTML / CSS`

This project served as an exercise in working with MV3 constraints, asynchronous messaging, browser storage limitations, and integrating AI embedding models into a browser extension workflow.

---

<img width="1181" alt="Screenshot 2025-03-30 at 15 53 18" src="https://github.com/user-attachments/assets/9ce65a31-7445-4354-ada7-66d97cf6abcb" />



