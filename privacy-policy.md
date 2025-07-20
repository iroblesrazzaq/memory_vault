# Privacy Policy for Memory Vault

**Last updated:** [DATE]

## Overview

Memory Vault ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how our Chrome extension collects, uses, and safeguards your information.

## Information We Collect

### **Local Data Collection**
- **Webpage Content**: We extract and process text content from webpages you visit for semantic search functionality
- **Browsing Metadata**: URLs, page titles, timestamps, and word counts of processed pages
- **User Preferences**: Your Google Gemini API key and model preferences

### **What We DON'T Collect**
- We do not collect personal information
- We do not track your browsing outside of content processing
- We do not collect passwords, financial information, or sensitive personal data
- We do not use cookies or tracking technologies

## How We Use Your Information

### **Local Processing Only**
- All data is stored locally on your device using Chrome's secure storage APIs
- Webpage content is processed locally and used only for generating semantic search embeddings
- Your browsing history never leaves your device except for AI processing (see below)

### **Third-Party Services**
- **Google Gemini API**: Webpage summaries and search queries are sent to Google's Gemini AI service to generate semantic embeddings
- This is necessary for the core functionality of semantic search
- Google's privacy policy applies to this data: https://policies.google.com/privacy

## Data Storage and Security

### **Local Storage**
- All processed data is stored in your Chrome browser's local storage (IndexedDB)
- Data is encrypted by Chrome's built-in security mechanisms
- You can delete all data at any time using the extension's "Clear Data" function

### **API Key Security**
- Your Google Gemini API key is stored securely in Chrome's local storage
- The API key is only used to authenticate requests to Google's AI services
- We never log, transmit, or store your API key on our servers

## Your Rights and Choices

### **Data Control**
- **Access**: View your stored data through the extension's dashboard
- **Delete**: Clear all stored data using the "Clear Data" button
- **Export**: No export feature currently available (data remains local)

### **Extension Permissions**
We request the following Chrome permissions:
- **`storage` & `unlimitedStorage`**: Store processed webpage data locally for search
- **`alarms`**: Manage background processing tasks
- **`host_permissions` for googleapis.com**: Connect to Google Gemini AI for semantic search

## Data Sharing

### **No Data Sharing**
- We do not sell, rent, or share your personal data with third parties
- We do not have access to your data (it's stored locally on your device)
- Only Google Gemini AI receives webpage summaries for processing (as described above)

## Children's Privacy

Memory Vault is not intended for children under 13. We do not knowingly collect personal information from children under 13.

## Changes to This Policy

We may update this Privacy Policy occasionally. We will notify users of significant changes through the extension's update notifications.

## Contact Us

If you have questions about this Privacy Policy or our practices, please contact us at:
- Email: [YOUR EMAIL]
- GitHub: [YOUR GITHUB REPO]

---

**Note**: This privacy policy complies with Chrome Web Store requirements and general privacy regulations. You should host this on a publicly accessible website (GitHub Pages, your personal site, etc.) and link to it in your Chrome Web Store listing. 