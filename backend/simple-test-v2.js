require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const key = process.env.GEMINI_API_KEY;
if (!key) {
    console.error("❌ No API Key found!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(key);

async function testModel(modelName) {
    console.log(`\n🧪 Testing Model: "${modelName}"...`);
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Say 'AI is working' if you can hear me.");
        const response = await result.response;
        console.log(`✅ SUCCESS [${modelName}]:`, response.text());
        return true;
    } catch (error) {
        console.error(`❌ FAILED [${modelName}]:`);
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Body: ${JSON.stringify(error.response, null, 2)}`); // Try to see body
        } else {
             console.error(`   Error: ${error.message}`);
        }
        return false;
    }
}

async function runDiagnostics() {
    console.log("🔍 Starting Gemini Diagnostics...");
    
    // Try reliable models in order
    const candidates = ["gemini-1.5-flash", "gemini-pro", "gemini-1.5-pro-latest"];
    
    for (const m of candidates) {
        const success = await testModel(m);
        if (success) {
            console.log(`\n🎉 WE FOUND A WORKING MODEL: "${m}"`);
            console.log("Recommend updating backend/index.js to use this model.");
            return;
        }
    }
    
    console.log("\n❌ ALL MODELS FAILED. The API Key might be invalid, or the project lacks permissions.");
}

runDiagnostics();
