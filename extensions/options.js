// DOM Elements
const googleApiKeyInput = document.getElementById('google-api-key');
const testApiKeyBtn = document.getElementById('test-api-key');
const apiKeyStatus = document.getElementById('api-key-status');
const minTimeInput = document.getElementById('min-time');
const maxHistoryInput = document.getElementById('max-history');
const processExistingCheckbox = document.getElementById('process-existing');
const autoProcessCheckbox = document.getElementById('auto-process');
const storageUsage = document.getElementById('storage-usage');
const storageBar = document.getElementById('storage-bar');
const clearStorageBtn = document.getElementById('clear-storage');
const exportDataBtn = document.getElementById('export-data');
const importDataBtn = document.getElementById('import-data');
const saveSettingsBtn = document.getElementById('save-settings');

// Constants
const SETTINGS_KEY = "semanticHistorySettings";
const VECTOR_DB_KEY = "semanticHistoryVectors";
const DEFAULT_SETTINGS = {
  googleApiKey: "",
  minStayTimeSeconds: 10,
  maxHistoryItems: 1000,
  processExisting: true,
  autoProcess: true
};

// Initialize settings page
document.addEventListener('DOMContentLoaded', async () => {
  console.log("DOM loaded, initializing options page");
  
  // Debug element references
  console.log({
    googleApiKeyInput: Boolean(googleApiKeyInput),
    testApiKeyBtn: Boolean(testApiKeyBtn),
    apiKeyStatus: Boolean(apiKeyStatus)
  });
  
  // Load current settings
  await loadSettings();
  
  // Update storage usage display
  await updateStorageUsage();
  
  // Set up event listeners
  if (testApiKeyBtn) {
    testApiKeyBtn.addEventListener('click', testApiKey);
  } else {
    console.error("Test API Key button not found");
  }
  
  if (clearStorageBtn) {
    clearStorageBtn.addEventListener('click', clearAllData);
  }
  
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', exportData);
  }
  
  if (importDataBtn) {
    importDataBtn.addEventListener('click', importData);
  }
  
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
});

// Load settings from storage
async function loadSettings() {
  try {
    // Get settings from storage
    const storage = await chrome.storage.local.get(SETTINGS_KEY);
    const settings = storage[SETTINGS_KEY] || DEFAULT_SETTINGS;
    
    // Apply settings to form
    if (googleApiKeyInput) googleApiKeyInput.value = settings.googleApiKey || '';
    if (minTimeInput) minTimeInput.value = settings.minStayTimeSeconds || DEFAULT_SETTINGS.minStayTimeSeconds;
    if (maxHistoryInput) maxHistoryInput.value = settings.maxHistoryItems || DEFAULT_SETTINGS.maxHistoryItems;
    if (processExistingCheckbox) processExistingCheckbox.checked = settings.processExisting !== undefined ? 
      settings.processExisting : DEFAULT_SETTINGS.processExisting;
    if (autoProcessCheckbox) autoProcessCheckbox.checked = settings.autoProcess !== undefined ? 
      settings.autoProcess : DEFAULT_SETTINGS.autoProcess;
    
  } catch (error) {
    console.error("Error loading settings:", error);
    showErrorNotification("Failed to load settings. Using defaults.");
  }
}

// Save settings to storage
async function saveSettings() {
  try {
    // Validate inputs
    const googleApiKey = googleApiKeyInput ? googleApiKeyInput.value.trim() : '';
    const minStayTimeSeconds = minTimeInput ? parseInt(minTimeInput.value, 10) : DEFAULT_SETTINGS.minStayTimeSeconds;
    const maxHistoryItems = maxHistoryInput ? parseInt(maxHistoryInput.value, 10) : DEFAULT_SETTINGS.maxHistoryItems;
    
    if (isNaN(minStayTimeSeconds) || minStayTimeSeconds < 5) {
      showErrorNotification("Minimum stay time must be at least 5 seconds");
      return;
    }
    
    if (isNaN(maxHistoryItems) || maxHistoryItems < 50) {
      showErrorNotification("Maximum history items must be at least 50");
      return;
    }
    
    // Create settings object
    const settings = {
      googleApiKey,
      minStayTimeSeconds,
      maxHistoryItems,
      processExisting: processExistingCheckbox ? processExistingCheckbox.checked : DEFAULT_SETTINGS.processExisting,
      autoProcess: autoProcessCheckbox ? autoProcessCheckbox.checked : DEFAULT_SETTINGS.autoProcess
    };
    
    // Save settings to storage
    await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
    
    // Notify background script about settings change
    await chrome.runtime.sendMessage({
      action: "settingsUpdated",
      settings
    });
    
    showSuccessNotification("Settings saved successfully");
    
  } catch (error) {
    console.error("Error saving settings:", error);
    showErrorNotification("Failed to save settings");
  }
}

// Test Google API Key
async function testApiKey() {
  console.log("Testing API key");
  
  // Use googleApiKeyInput instead of apiKeyInput
  const apiKey = googleApiKeyInput.value.trim();
  
  if (!apiKey) {
    updateApiKeyStatus('error', 'API key cannot be empty');
    return;
  }
  
  updateApiKeyStatus('testing', 'Testing API key...');
  
  try {
    // Test with the Gemini API endpoint
    const embeddingEndpoint = "https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent";
    
    const response = await fetch(`${embeddingEndpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "models/embedding-001",
        content: {
          parts: [{ text: "Test connection" }]
        },
        taskType: "RETRIEVAL_QUERY"
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      updateApiKeyStatus('success', 'API key is valid!');
      console.log("API test successful:", data);
    } else {
      const errorData = await response.json();
      updateApiKeyStatus('error', `Invalid API key: ${errorData.error?.message || response.statusText}`);
      console.error("API test failed:", errorData);
    }
  } catch (error) {
    console.error("API key test failed:", error);
    updateApiKeyStatus('error', `Connection failed: ${error.message}`);
  }
}

// Update API key status display
function updateApiKeyStatus(status, message) {
  if (!apiKeyStatus) {
    console.error("API key status element not found");
    return;
  }
  
  apiKeyStatus.textContent = message;
  
  // Reset classes
  apiKeyStatus.classList.remove('text-green-500', 'text-red-500', 'text-blue-500');
  
  // Add appropriate class
  switch (status) {
    case 'success':
      apiKeyStatus.classList.add('text-green-500');
      break;
    case 'error':
      apiKeyStatus.classList.add('text-red-500');
      break;
    case 'testing':
      apiKeyStatus.classList.add('text-blue-500');
      break;
  }
}

// Update storage usage display
async function updateStorageUsage() {
  try {
    if (!storageUsage || !storageBar) {
      console.error("Storage usage elements not found");
      return;
    }
    
    // First try to get usage from background script
    try {
      const response = await chrome.runtime.sendMessage({ action: "checkStorage" });
      if (response && response.success) {
        const { usageData } = response;
        
        // Update display
        storageUsage.textContent = `${usageData.sizeInKB} KB (${usageData.percentUsed}%)`;
        storageBar.style.width = `${Math.min(100, parseFloat(usageData.percentUsed))}%`;
        
        // Change color based on usage
        updateStorageBarColor(parseFloat(usageData.percentUsed));
        return;
      }
    } catch (msgError) {
      console.warn("Failed to get storage usage from background script:", msgError);
    }
    
    // Fallback: Get storage usage directly
    const storage = await chrome.storage.local.get([VECTOR_DB_KEY]);
    const db = storage[VECTOR_DB_KEY] || { entries: [] };
    
    // Calculate size
    const storageSize = JSON.stringify(db).length;
    const storageSizeKB = (storageSize / 1024).toFixed(2);
    
    // Estimate percent of quota
    // Extension storage limit is typically 5MB
    const estimatedLimit = 5 * 1024 * 1024;
    const percentUsed = Math.min(100, Math.round((storageSize / estimatedLimit) * 100));
    
    // Update display
    storageUsage.textContent = `${storageSizeKB} KB (${percentUsed}%)`;
    storageBar.style.width = `${percentUsed}%`;
    
    // Change color based on usage
    updateStorageBarColor(percentUsed);
    
  } catch (error) {
    console.error("Error updating storage usage:", error);
    if (storageUsage) storageUsage.textContent = "Error calculating";
  }
}

// Update storage bar color based on usage level
function updateStorageBarColor(percentUsed) {
  if (!storageBar) return;
  
  storageBar.classList.remove('bg-blue-600', 'bg-yellow-500', 'bg-red-600');
  
  if (percentUsed > 80) {
    storageBar.classList.add('bg-red-600');
  } else if (percentUsed > 60) {
    storageBar.classList.add('bg-yellow-500');
  } else {
    storageBar.classList.add('bg-blue-600');
  }
}

// Clear all stored data
async function clearAllData() {
  if (!confirm("Are you sure you want to clear all stored data? This action cannot be undone.")) {
    return;
  }
  
  try {
    // Try to clear via background script
    try {
      await chrome.runtime.sendMessage({ action: "clearAllData" });
    } catch (msgError) {
      console.warn("Failed to clear data via background script:", msgError);
      
      // Fallback: Clear directly
      await chrome.storage.local.remove(VECTOR_DB_KEY);
      
      // Initialize empty database
      await chrome.storage.local.set({
        [VECTOR_DB_KEY]: {
          version: "1.0",
          entries: [],
          lastProcessed: null
        }
      });
    }
    
    // Update storage display
    await updateStorageUsage();
    
    showSuccessNotification("All data cleared successfully");
    
  } catch (error) {
    console.error("Error clearing data:", error);
    showErrorNotification("Failed to clear data");
  }
}

// Export data to JSON file
async function exportData() {
  try {
    // Get all data
    const storage = await chrome.storage.local.get([
      VECTOR_DB_KEY,
      SETTINGS_KEY
    ]);
    
    // Create export object
    const exportData = {
      vectorDb: storage[VECTOR_DB_KEY] || { entries: [] },
      settings: storage[SETTINGS_KEY] || DEFAULT_SETTINGS,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };
    
    // Remove API key from exported settings
    if (exportData.settings.googleApiKey) {
      exportData.settings.googleApiKey = ""; // Don't export API key
    }
    
    // Convert to JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    
    // Create download
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create link and click it
    const a = document.createElement('a');
    a.href = url;
    a.download = `semantic-history-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    
    showSuccessNotification("Data exported successfully");
    
  } catch (error) {
    console.error("Error exporting data:", error);
    showErrorNotification("Failed to export data");
  }
}

// Import data from JSON file
async function importData() {
  try {
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/json';
    
    // Handle file selection
    fileInput.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          // Parse JSON
          const importData = JSON.parse(e.target.result);
          
          // Validate import data
          if (!importData.vectorDb || !importData.settings) {
            showErrorNotification("Invalid import file format");
            return;
          }
          
          // Confirm import
          if (!confirm(`Import ${importData.vectorDb.entries.length} history items? This will replace your current data.`)) {
            return;
          }
          
          // Get current settings to preserve API key
          const currentSettings = await chrome.storage.local.get(SETTINGS_KEY);
          const mergedSettings = {
            ...importData.settings,
            // Keep current API key if it exists
            googleApiKey: currentSettings[SETTINGS_KEY]?.googleApiKey || importData.settings.googleApiKey || ""
          };
          
          // Save imported data
          await chrome.storage.local.set({
            [VECTOR_DB_KEY]: importData.vectorDb,
            [SETTINGS_KEY]: mergedSettings
          });
          
          // Reload settings and update display
          await loadSettings();
          await updateStorageUsage();
          
          showSuccessNotification("Data imported successfully");
          
        } catch (error) {
          console.error("Error parsing import file:", error);
          showErrorNotification("Failed to parse import file");
        }
      };
      
      reader.readAsText(file);
    };
    
    // Trigger file selection
    fileInput.click();
    
  } catch (error) {
    console.error("Error importing data:", error);
    showErrorNotification("Failed to import data");
  }
}

// Show success notification
function showSuccessNotification(message) {
  // In a real implementation, you would show a toast notification
  // For simplicity, we'll use alert
  alert(message);
}

// Show error notification
function showErrorNotification(message) {
  // In a real implementation, you would show a toast notification
  // For simplicity, we'll use alert
  alert(`Error: ${message}`);
}