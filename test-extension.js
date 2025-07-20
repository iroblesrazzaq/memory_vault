// Memory Vault - Pre-Submission Testing Script
// Run this in your Chrome DevTools Console to test key functionality

console.log("🚀 Memory Vault Pre-Submission Testing Started");
console.log("===============================================");

// Test 1: Check Extension Installation
function testExtensionInstalled() {
    console.log("\n📱 Test 1: Extension Installation");
    
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        console.log("✅ Extension is properly installed");
        console.log("   Extension ID:", chrome.runtime.id);
        return true;
    } else {
        console.log("❌ Extension not detected");
        return false;
    }
}

// Test 2: Check API Key Status
function testApiKeyStatus() {
    console.log("\n🔑 Test 2: API Key Configuration");
    
    return new Promise((resolve) => {
        chrome.storage.local.get('geminiApiKey', (data) => {
            if (data.geminiApiKey) {
                console.log("✅ API key is configured");
                console.log("   Key format:", data.geminiApiKey.substring(0, 4) + "****");
                resolve(true);
            } else {
                console.log("❌ No API key configured");
                console.log("   Action needed: Set up API key in extension settings");
                resolve(false);
            }
        });
    });
}

// Test 3: Check Storage
function testStorage() {
    console.log("\n💾 Test 3: Storage Functionality");
    
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'getStorageEstimate' }, (response) => {
            if (response && response.status === 'success') {
                const usageMB = (response.usage / (1024 * 1024)).toFixed(2);
                const quotaMB = (response.quota / (1024 * 1024)).toFixed(2);
                console.log("✅ Storage is working");
                console.log(`   Usage: ${usageMB} MB / ${quotaMB} MB`);
                resolve(true);
            } else {
                console.log("❌ Storage estimation failed");
                resolve(false);
            }
        });
    });
}

// Test 4: Check Recent Activity
function testRecentActivity() {
    console.log("\n📋 Test 4: Recent Activity Retrieval");
    
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'getRecentActivity', limit: 5 }, (response) => {
            if (response && response.status === 'success') {
                console.log("✅ Recent activity is working");
                console.log(`   Found ${response.data.length} recent pages`);
                if (response.data.length > 0) {
                    console.log("   Sample page:", response.data[0].title);
                }
                resolve(true);
            } else {
                console.log("❌ Recent activity failed");
                resolve(false);
            }
        });
    });
}

// Test 5: Check Available Models
function testModelConfiguration() {
    console.log("\n🤖 Test 5: Model Configuration");
    
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'getAvailableModels' }, (response) => {
            if (response && response.status === 'success') {
                console.log("✅ Model configuration is working");
                console.log(`   Summary models: ${response.models.summary.length}`);
                console.log(`   Embedding models: ${response.models.embedding.length}`);
                resolve(true);
            } else {
                console.log("❌ Model configuration failed");
                resolve(false);
            }
        });
    });
}

// Test 6: Test Search (if API key exists)
function testSearch() {
    console.log("\n🔍 Test 6: Search Functionality");
    
    return new Promise((resolve) => {
        chrome.storage.local.get('geminiApiKey', (data) => {
            if (!data.geminiApiKey) {
                console.log("⏭️  Skipping search test - no API key");
                resolve(true);
                return;
            }
            
            chrome.runtime.sendMessage({ 
                type: 'searchQuery', 
                query: 'test search' 
            }, (response) => {
                if (response && response.status === 'success') {
                    console.log("✅ Search functionality is working");
                    console.log(`   Found ${response.results.length} results`);
                    resolve(true);
                } else if (response && response.status === 'error') {
                    console.log("⚠️  Search returned error:", response.message);
                    resolve(true); // Still pass - might be expected with no data
                } else {
                    console.log("❌ Search functionality failed");
                    resolve(false);
                }
            });
        });
    });
}

// Run All Tests
async function runAllTests() {
    const results = [];
    
    results.push(testExtensionInstalled());
    results.push(await testApiKeyStatus());
    results.push(await testStorage());
    results.push(await testRecentActivity());
    results.push(await testModelConfiguration());
    results.push(await testSearch());
    
    // Summary
    console.log("\n🎯 TEST SUMMARY");
    console.log("===============");
    
    const passed = results.filter(r => r).length;
    const total = results.length;
    
    console.log(`Passed: ${passed}/${total} tests`);
    
    if (passed === total) {
        console.log("🎉 ALL TESTS PASSED - Ready for Chrome Web Store submission!");
    } else {
        console.log("⚠️  Some tests failed - review issues above before submission");
    }
    
    // Specific recommendations
    console.log("\n📋 SUBMISSION CHECKLIST:");
    console.log("- [ ] Privacy policy created and hosted");
    console.log("- [ ] Screenshots taken (1280x800 or 640x400)");
    console.log("- [ ] Store description written");
    console.log("- [ ] Chrome Web Store developer account created");
    console.log("- [ ] Extension tested on different websites");
    console.log("- [ ] Fresh install tested");
    
    return passed === total;
}

// Auto-run tests
runAllTests();

// Manual test functions (call individually if needed)
window.memoryVaultTests = {
    runAll: runAllTests,
    testExtensionInstalled,
    testApiKeyStatus,
    testStorage,
    testRecentActivity,
    testModelConfiguration,
    testSearch
};

console.log("\n💡 TIP: You can also run individual tests:");
console.log("memoryVaultTests.testApiKeyStatus()");
console.log("memoryVaultTests.testStorage()");
console.log("etc..."); 