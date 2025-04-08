let imageBase64 = null;
let rawImageBase64 = null;
const sendButton = document.getElementById('send-button');
const statusElement = document.getElementById('status');
const uploadBox = document.getElementById('upload-box');

function updateUI() {
    if (imageBase64) {
        sendButton.disabled = false;
        statusElement.textContent = 'Ready to Generate';
        uploadBox.classList.add('has-image');
    } else {
        sendButton.disabled = true;
        statusElement.textContent = 'Upload an Image To Start';
        uploadBox.classList.remove('has-image');
    }
}

updateUI();

document.getElementById('send-button').addEventListener('click', async function() {
    const userInput = "Describe the cloth in the image in point form, include the following: 1. Brand (if it is visible); 2. Name (e.g., Nike hoodie); 3. Primary Colors; 4. Condition (New, Worn, etc); Estimated Resell Price in CAD (very cheap, it is second-hand, between $3 and $40); 6. Estimated Size (XS, S, M, L, XL); 7. Primary Materials. If there are multiple pieces of clothes, provide description for each of them. Do not provide any extraneous information. Respond right away. Do NOT start with a introductory sentence like 'Heres a description in point form:'.";
    const responseArea = document.getElementById('response-area');
    
    if (!rawImageBase64) {
        alert('Please upload an image first');
        return;
    }
    
    if (!userInput) {
        alert('Please enter a query message');
        return;
    }
    
    statusElement.textContent = 'Loading...';
    responseArea.textContent = '';
    
    try {
        const requestBody = {
            model: "gemma3:4b",
            prompt: userInput,
            images: [rawImageBase64],
            stream: true
        };
        
        const response = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, details: ${errorText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = '';
        let accumulatedMarkdown = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            let jsonStartIndex = 0;
            while (jsonStartIndex < buffer.length) {
                try {
                    let jsonEndIndex = buffer.indexOf('\n', jsonStartIndex);
                    if (jsonEndIndex === -1) break;
                    
                    const jsonStr = buffer.substring(jsonStartIndex, jsonEndIndex);
                    const json = JSON.parse(jsonStr);
                    
                    if (json.response) {
                        accumulatedMarkdown += json.response;
                        
                        responseArea.innerHTML = '';
                        
                        const formattedResponse = accumulatedMarkdown
                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                            .replace(/\n/g, '<br>');
                            
                        responseArea.innerHTML = formattedResponse;
                    }
                    
                    jsonStartIndex = jsonEndIndex + 1;
                } catch (e) {
                    break;
                }
            }
            
            buffer = buffer.substring(jsonStartIndex);
        }
        
        if (accumulatedMarkdown) {
            const finalFormattedResponse = accumulatedMarkdown
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
                
            responseArea.innerHTML = finalFormattedResponse;
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

    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            imageBase64 = e.target.result;
            
            const base64Prefix = "base64,";
            const base64Index = imageBase64.indexOf(base64Prefix);
            if (base64Index !== -1) {
                rawImageBase64 = imageBase64.substring(base64Index + base64Prefix.length);
            } else {
                rawImageBase64 = null;
            }
            
            preview.src = imageBase64;
            preview.style.display = 'block';
            updateUI();
        };
        reader.readAsDataURL(file);
    } else {
        clearImage();
    }
});

function clearImage() {
    const preview = document.getElementById('image-preview');
    const fileInput = document.getElementById('image-upload');
    
    preview.src = '';
    preview.style.display = 'none';
    fileInput.value = '';
    imageBase64 = null;
    rawImageBase64 = null;
    updateUI();
}

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    uploadBox.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
    uploadBox.addEventListener(eventName, unhighlight, false);
});

function highlight() {
    uploadBox.style.borderColor = 'var(--l-blue)';
    uploadBox.style.backgroundColor = '#f0f7ff';
}

function unhighlight() {
    uploadBox.style.borderColor = 'var(--d-blue)';
    uploadBox.style.backgroundColor = 'var(--white2)';
}

uploadBox.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    const dt = e.dataTransfer;
    const file = dt.files[0];
    
    if (file && file.type.startsWith('image/')) {
        const fileInput = document.getElementById('image-upload');
        fileInput.files = dt.files;
        
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
    }
}