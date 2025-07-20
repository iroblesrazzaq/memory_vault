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
*   **🤖 AI-Powered Embeddings:** Uses Google Gemini (latest available models) for state-of-the-art content understanding.
*   **🧹 Automatic Content Extraction:** Leverages `@mozilla/readability` to capture the essential text, ignoring clutter.
*   **🔒 Local-First Storage:** All data (embeddings, metadata) stored securely in your browser's IndexedDB.
*   **📈 Efficient & Scalable:** Uses IndexedDB cursors for memory-efficient searching and automatic pruning to manage storage.
*   **📊 User Dashboard:** Dedicated interface for searching, viewing results, and managing settings.

---

## Technology Stack

*   **Browser Extension:** Chrome Manifest V3 (Service Worker)
*   **Frontend:** HTML, CSS, JavaScript (ES6+, async/await)
*   **AI:** Google Gemini API (flexible model configuration with automatic updates)
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

## Real-World Example: "The Forgotten Theorem"

This example demonstrates how Memory Vault helps a developer solve a common, high-stakes problem that standard browser history fails to address.

### The Article
Let's say a developer is casually browsing one afternoon and spends five minutes reading this excellent, in-depth article from IBM's blog:

**Article Link:** [What is CAP Theorem?](https://www.ibm.com/topics/cap-theorem) on the IBM Blog.

This article explains a fundamental concept in distributed systems: the trade-off between Consistency, Availability, and Partition Tolerance. It's dense, valuable, and easy to forget the exact name of.

### The Step-by-Step Scenario

#### Part 1: The Casual Encounter (The "Saving")

On a Tuesday, a software developer named Alex follows a link from a tech newsletter. She lands on the IBM article about the CAP Theorem. She finds it insightful, skims the main points about how you can only pick two of the three guarantees (Consistency, Availability, Partition Tolerance), and thinks, "Huh, that's interesting."

Then, she gets a Slack message, switches tasks, and completely forgets about the article.

**In the background, Memory Vault does its job:**

1. It detects she's on a page with significant content.
2. It uses `@mozilla/readability` to extract the core text, ignoring the IBM header, footer, and ads. The extracted text contains rich concepts like "distributed database systems," "trade-offs between consistency and availability," and "network failures."
3. It sends this text to the Gemini API to generate a vector embedding—a numerical representation of the article's meaning.
4. It stores this embedding locally along with the URL, the title ("What is CAP Theorem?"), and the timestamp.

#### Part 2: The Urgent Need (The "Problem")

Two weeks later, Alex is in a critical system design meeting. The team is deciding on a database for a new microservice that needs to be highly scalable.

A senior architect says, **"The key issue is whether we prioritize perfect data consistency or 100% uptime during a network partition. We can't have both."**

Alex's mind clicks. She remembers reading something about this exact trade-off. It was a formal concept, a "theorem" or a "principle." But she can't remember the name.

#### Part 3: The Search (The "Solution")

**Attempt #1: Standard Browser History (Failure)**

Alex discreetly opens her browser history (Ctrl+H).
- She searches for `database tradeoff`. The IBM article doesn't appear in the top results because those exact words aren't in the title.
- She tries `consistency vs availability`. Her history is flooded with dozens of results from Stack Overflow, other documentation, and articles about different topics. It's too much noise.
- She can't search for "CAP Theorem" because she has forgotten the name.

The standard keyword-based history is useless.

![Chrome History Search Failure](images/chromehistory.jpg)
*Chrome's keyword-based history search fails to find the CAP Theorem article with conceptual queries*

**Attempt #2: Memory Vault (Success)**

Frustrated, she opens her Memory Vault dashboard. Instead of guessing keywords, she types in the concept she's trying to remember:

**Search Query:** `The principle that says a database has to choose between consistency and availability during a network failure`

**This is where the magic happens:**

1. Memory Vault takes her natural language query and generates a new vector embedding from it.
2. It efficiently scans the embeddings of her past browsing history, calculating the "semantic distance" between her query and every page she's visited.
3. The result is immediate and clear. The top hit, with the highest relevance score, is the page she skimmed two weeks ago:

**Result:** `What is CAP Theorem?` (from ibm.com)

![Memory Vault Search Success](images/memoryvault.jpg)
*Memory Vault immediately finds the CAP Theorem article using semantic search with natural language*

She clicks the link, instantly refreshes her memory on the details, and confidently contributes to the meeting: *"I think you're referring to the CAP Theorem. The article I read suggests that for our use case, prioritizing Availability and Partition Tolerance with a system like Cassandra might be better than a traditional relational database that prioritizes Consistency."*

### Why This is a Great Example

- **It's Realistic:** Developers constantly absorb information passively and need to recall it later under pressure.
- **It Highlights the Core Flaw of Keywords:** You can't search for something if you've forgotten the specific name or title.
- **It Showcases the Power of Semantics:** The user searched for a description of a concept, and the tool found the page that defined that concept.
- **It Demonstrates Clear ROI:** It transforms a forgotten, passive browsing moment into actionable knowledge that solves a real-world problem.

---

## Installation

**From Chrome Web Store:** [Link coming soon - currently under review]

**Manual Installation (Developer):**
1.  Download the latest release from GitHub
2.  Open Chrome and navigate to `chrome://extensions`
3.  Enable "Developer mode" (top-right toggle)
4.  Click "Load unpacked" and select the project folder

## Setup Your Google Gemini API Key

Memory Vault requires your own Google Gemini API key (free) to power the AI features:

### 1. Get Your Free API Key
- Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
- Sign in with your Google account
- Click "Create API Key" → "Create API key in new project"
- Copy your API key (starts with "AI...")

### 2. Configure in Extension
- Click the Memory Vault extension icon in Chrome
- Click "Get Started →" in the setup prompt
- Paste your API key and click "Save API Key"
- The extension will test and validate your key

### 3. Start Browsing!
Your browsing history will now be automatically processed and made searchable. Visit interesting pages, then use the Search Dashboard to find them by meaning, not just keywords.

---

## Usage

*   **Browse:** The extension captures pages automatically in the background.
*   **Search:** Open the Dashboard (Popup -> "Open Search Dashboard"), enter your query, and click "Search" to find relevant pages from your history.
*   **Stats:** Click the extension icon for page count and storage estimates.
