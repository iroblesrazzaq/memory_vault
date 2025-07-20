# Developer Notes: Model Management

## 🚀 Quick Model Updates

When Google releases new Gemini models, update them easily:

### 1. Add New Model to Configuration

Edit `scripts/background.js` and find the `MODEL_CONFIG` object:

```javascript
// Add new model to the appropriate array (summary or embedding)
summary: [
    {
        name: "Gemini 2.5 Flash Lite", // <- Add new model here
        modelId: "gemini-2.5-flash-lite",
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
        available: true, // <- Set to true when ready
        maxTokens: 8192
    },
    // ... existing models
]
```

### 2. Enable New Model

In browser console (with extension loaded):
```javascript
// Enable the new model
enableNewModel('summary', 'gemini-2.5-flash-lite');

// Or for embeddings
enableNewModel('embedding', 'text-embedding-005');
```

### 3. Test New Model

Users can test models in Advanced Settings, or programmatically:
```javascript
// Test if model works with current API key
testModelAccess(apiKey, 'summary', 'gemini-2.5-flash-lite');
```

## 🔧 Common Model Operations

### Update Model Availability
```javascript
// Disable preview model when stable releases
updateModelAvailability('summary', 'gemini-2.5-flash-lite-preview-06-17', false);
// Enable stable model  
updateModelAvailability('summary', 'gemini-2.5-flash-lite', true);
```

### Check Current Models
```javascript
// See what models are currently being used
chrome.runtime.sendMessage({ type: 'getCurrentModels' }, console.log);
```

### Get Available Models
```javascript
// See all available models
chrome.runtime.sendMessage({ type: 'getAvailableModels' }, console.log);
```

## 📋 Release Checklist

When updating for a new Google model release:

- [ ] Add new model to `MODEL_CONFIG` in `background.js`
- [ ] Set `available: true` for the new model
- [ ] Test with a valid API key
- [ ] Update model ordering (newest first)
- [ ] Consider deprecating old preview models
- [ ] Update `manifest.json` version number
- [ ] Test extension functionality
- [ ] Update Chrome Web Store listing

## ⚡ Quick Commands

### Developer Console Commands
```javascript
// Enable Gemini 2.5 Flash Lite when it exits preview
enableNewModel('summary', 'gemini-2.5-flash-lite');

// Disable old preview model
updateModelAvailability('summary', 'gemini-2.5-flash-lite-preview-06-17', false);

// Check what's currently being used
getModelConfig('summary');
getModelConfig('embedding');
```

## 🎯 Model Selection Logic

1. **Auto Mode** (default): Uses first available model in the array
2. **User Preference**: If user selected specific model, uses that
3. **Fallback**: If preferred model unavailable, falls back to auto mode
4. **Error Handling**: Graceful degradation if no models available

## 🔄 Future-Proofing

The system is designed to:
- ✅ Handle new Google model releases easily
- ✅ Support model deprecations gracefully  
- ✅ Allow user choice for advanced users
- ✅ Provide automatic model selection for regular users
- ✅ Test model compatibility automatically
- ✅ Maintain backward compatibility

## 📝 Notes

- Models are ordered by preference (newest first)
- Preview models should come before stable models in priority
- Always test new models before enabling in production
- Users in auto mode get the best available model automatically
- Model preferences are stored locally per user 