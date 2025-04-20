document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const fileInputLabel = document.getElementById('fileInputLabel');
    const passwordInput = document.getElementById('password');
    const processBtn = document.getElementById('processBtn');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const status = document.getElementById('status');
    const processedFiles = document.getElementById('processedFiles');
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const extensionSelect = document.getElementById('extensionSelect');
    const customExtension = document.getElementById('customExtension');
    const extensionGroup = document.getElementById('extensionGroup');

    let filesToProcess = [];
    let processing = false;
    let currentMode = 'encrypt';

    // Mode change handler
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentMode = e.target.value;
            updateUIForMode();
        });
    });

    function updateUIForMode() {
        fileInputLabel.textContent = currentMode === 'encrypt' 
            ? 'Select File to Encrypt:' 
            : 'Select Encrypted File to Decrypt:';
        fileInputLabel.className = currentMode;
        processBtn.textContent = currentMode === 'encrypt' ? 'Encrypt Files' : 'Decrypt Files';
        processBtn.className = `btn ${currentMode === 'encrypt' ? 'primary' : 'secondary'}`;
        
        // Show/hide extension selection based on mode
        extensionGroup.style.display = currentMode === 'encrypt' ? 'block' : 'none';
    }

    // Get selected extension
    function getSelectedExtension() {
        if (customExtension.value.trim()) {
            const ext = customExtension.value.trim();
            return ext.startsWith('.') ? ext : '.' + ext;
        }
        return extensionSelect.value;
    }

    // File input handler
    fileInput.addEventListener('change', (e) => {
        filesToProcess = Array.from(e.target.files);
        if (currentMode === 'decrypt') {
            // Filter for encrypted files when in decrypt mode
            filesToProcess = filesToProcess.filter(file => {
                const ext = file.name.substring(file.name.lastIndexOf('.'));
                return ext === getSelectedExtension();
            });
            if (filesToProcess.length !== e.target.files.length) {
                updateStatus('Note: Only files with the selected extension will be decrypted');
            }
        }
        updateStatus(`Selected ${filesToProcess.length} file(s)`);
    });

    // Encryption function
    async function encryptFile(file, password) {
        try {
            const reader = new FileReader();
            return new Promise((resolve, reject) => {
                reader.onload = async (e) => {
                    try {
                        const fileData = e.target.result;
                        const salt = CryptoJS.lib.WordArray.random(128/8);
                        const key = CryptoJS.PBKDF2(password, salt, {
                            keySize: 256/32,
                            iterations: 100000
                        });
                        const iv = CryptoJS.lib.WordArray.random(128/8);
                        
                        const encrypted = CryptoJS.AES.encrypt(fileData, key, {
                            iv: iv,
                            padding: CryptoJS.pad.Pkcs7,
                            mode: CryptoJS.mode.CBC
                        });

                        // Combine salt, iv, and encrypted data
                        const result = salt.toString() + iv.toString() + encrypted.toString();
                        
                        // Create download link with selected extension
                        const blob = new Blob([result], { type: 'application/octet-stream' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const ext = getSelectedExtension();
                        a.download = file.name.substring(0, file.name.lastIndexOf('.')) + ext;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        resolve(true);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        } catch (error) {
            throw new Error(`Encryption failed: ${error.message}`);
        }
    }

    // Decryption function
    async function decryptFile(file, password) {
        try {
            const reader = new FileReader();
            return new Promise((resolve, reject) => {
                reader.onload = async (e) => {
                    try {
                        const encryptedData = e.target.result;
                        const salt = CryptoJS.enc.Hex.parse(encryptedData.substr(0, 32));
                        const iv = CryptoJS.enc.Hex.parse(encryptedData.substr(32, 32));
                        const encrypted = encryptedData.substring(64);
                        
                        const key = CryptoJS.PBKDF2(password, salt, {
                            keySize: 256/32,
                            iterations: 100000
                        });
                        
                        const decrypted = CryptoJS.AES.decrypt(encrypted, key, {
                            iv: iv,
                            padding: CryptoJS.pad.Pkcs7,
                            mode: CryptoJS.mode.CBC
                        });
                        
                        const decryptedData = decrypted.toString(CryptoJS.enc.Utf8);
                        
                        // Create download link
                        const blob = new Blob([decryptedData], { type: 'application/octet-stream' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = file.name.replace(getSelectedExtension(), '');
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        
                        resolve(true);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = reject;
                reader.readAsText(file);
            });
        } catch (error) {
            throw new Error(`Decryption failed: ${error.message}`);
        }
    }

    // Process files
    async function processFiles() {
        if (processing) return;
        if (filesToProcess.length === 0) {
            updateStatus('Please select files to process');
            return;
        }
        if (!passwordInput.value) {
            updateStatus('Please enter a password');
            return;
        }

        processing = true;
        let processedCount = 0;
        const totalFiles = filesToProcess.length;

        try {
            for (const file of filesToProcess) {
                try {
                    if (currentMode === 'encrypt') {
                        await encryptFile(file, passwordInput.value);
                    } else {
                        await decryptFile(file, passwordInput.value);
                    }
                    
                    processedCount++;
                    const progress = (processedCount / totalFiles) * 100;
                    updateProgress(progress);
                    addProcessedFile(file.name, currentMode);
                } catch (error) {
                    console.error(`Error processing ${file.name}:`, error);
                    addProcessedFile(file.name, currentMode, false, error.message);
                }
            }
            
            updateStatus(`Successfully ${currentMode}ed ${processedCount} file(s)`);
        } catch (error) {
            updateStatus(`Error: ${error.message}`);
        } finally {
            processing = false;
        }
    }

    // Update progress bar
    function updateProgress(percent) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `${Math.round(percent)}%`;
    }

    // Update status message
    function updateStatus(message) {
        status.textContent = message;
    }

    // Add processed file to list
    function addProcessedFile(filename, operation, success = true, error = '') {
        const li = document.createElement('li');
        li.textContent = `${filename} - ${operation}ed ${success ? 'successfully' : 'failed'}`;
        if (!success) {
            li.style.color = 'red';
            li.title = error;
        }
        processedFiles.appendChild(li);
    }

    // Event listener for process button
    processBtn.addEventListener('click', processFiles);

    // Initialize UI
    updateUIForMode();

    // Theme handling
    const themeToggle = document.getElementById('themeToggle');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    // Check for saved theme preference or use system preference
    const currentTheme = localStorage.getItem('theme') || 
        (prefersDarkScheme.matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);

    // Listen for system theme changes
    prefersDarkScheme.addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', newTheme);
            updateThemeIcon(newTheme);
        }
    });

    // Theme toggle click handler
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });

    function updateThemeIcon(theme) {
        const icon = themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}); 