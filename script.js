let imageBase64 = null;
let rawImageBase64 = null;
const sendButton = document.getElementById('send-button');
const statusElement = document.getElementById('status');
const debugInfo = document.getElementById('debug-info');

// Function to update UI based on whether an image is present
function updateUI() {
    if (imageBase64) {
        sendButton.disabled = false;
        statusElement.textContent = 'Ready to query Gemma3:4b';
    } else {
        sendButton.disabled = true;
        statusElement.textContent = 'Upload an image to start';
    }
}

// Initial UI update
updateUI();

document.getElementById('send-button').addEventListener('click', async function() {
    const userInput = document.getElementById('user-input').value;
    const responseArea = document.getElementById('response-area');
    
    if (!rawImageBase64) {
        alert('Please upload an image first');
        return;
    }
    
    if (!userInput) {
        alert('Please enter a query message');
        return;
    }
    
    statusElement.textContent = 'Querying Gemma3:4b...';
    responseArea.textContent = '';
    debugInfo.textContent = '';
    
    try {
        // Create the request body with the raw base64 image data
        const requestBody = {
            model: "gemma3:4b",
            prompt: userInput,
            images: [rawImageBase64],
            stream: true
        };
        
        debugInfo.textContent = `Sending request to Ollama API...`;
        
        // Always use the generate endpoint for image queries
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            debugInfo.textContent += `\nError response: ${errorText}`;
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete JSON objects from the buffer
            let jsonStartIndex = 0;
            while (jsonStartIndex < buffer.length) {
                try {
                    // Find the end of the current JSON object
                    let jsonEndIndex = buffer.indexOf('\n', jsonStartIndex);
                    if (jsonEndIndex === -1) break; // Incomplete JSON, wait for more data
                    
                    const jsonStr = buffer.substring(jsonStartIndex, jsonEndIndex);
                    const json = JSON.parse(jsonStr);
                    
                    // Update response area with streaming content
                    if (json.response) {
                        responseArea.textContent += json.response;
                    }
                    
                    // Move index past this JSON object
                    jsonStartIndex = jsonEndIndex + 1;
                } catch (e) {
                    // If we can't parse, it's likely an incomplete JSON object
                    break;
                }
            }
            
            // Keep any remaining incomplete JSON for the next iteration
            buffer = buffer.substring(jsonStartIndex);
        }
        
        statusElement.textContent = 'Response complete';
    } catch (error) {
        statusElement.textContent = 'Error';
        responseArea.textContent = `Error: ${error.message}`;
        console.error(error);
    }
});

document.getElementById('image-upload').addEventListener('change', function(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('image-preview');
    const clearButton = document.getElementById('clear-image');

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Store the full data URL for preview
            imageBase64 = e.target.result;
            
            // Extract just the base64 data by removing the prefix
            const base64Prefix = "base64,";
            const base64Index = imageBase64.indexOf(base64Prefix);
            if (base64Index !== -1) {
                rawImageBase64 = imageBase64.substring(base64Index + base64Prefix.length);
                debugInfo.textContent = `Image converted to base64 successfully (${Math.round(rawImageBase64.length / 1024)} KB)`;
            } else {
                debugInfo.textContent = "Warning: Could not extract base64 data correctly";
                rawImageBase64 = null;
            }
            
            // Update UI
            preview.src = imageBase64;
            preview.style.display = 'block';
            clearButton.style.display = 'block';
            updateUI();
        };
        reader.readAsDataURL(file);
    } else {
        clearImage();
    }
});

document.getElementById('clear-image').addEventListener('click', clearImage);

function clearImage() {
    const preview = document.getElementById('image-preview');
    const clearButton = document.getElementById('clear-image');
    const fileInput = document.getElementById('image-upload');
    
    preview.src = '';
    preview.style.display = 'none';
    clearButton.style.display = 'none';
    fileInput.value = '';
    imageBase64 = null;
    rawImageBase64 = null;
    debugInfo.textContent = '';
    updateUI();
}