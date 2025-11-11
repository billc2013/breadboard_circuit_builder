       // Validator Panel Logic
        let validator;
        let loadedCircuit = null;
        let loadedFileName = '';
        
        // Toggle validator panel
        function toggleValidatorPanel() {
            const panel = document.getElementById('validator-panel');
            const toggle = document.getElementById('validator-toggle');
            
            panel.classList.toggle('open');
            toggle.classList.toggle('panel-open');
        }
        
        document.getElementById('validator-toggle').addEventListener('click', toggleValidatorPanel);
        
        // Initialize validator
        async function initValidator() {
            if (!validator) {
                validator = new CircuitValidator(BREADBOARD_HOLES);
                await validator.init();
                console.log('✓ Validator initialized');
            }
            return validator;
        }
        
        // File input handler
        document.getElementById('file-input').addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                handleFile(file);
            }
        });
        
        // Drag and drop handlers
        const uploadZone = document.getElementById('upload-zone');
        
        uploadZone.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.add('drag-over');
        });
        
        uploadZone.addEventListener('dragleave', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.remove('drag-over');
        });
        
        uploadZone.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            uploadZone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFile(files[0]);
            }
        });
        
        // FIXED: Only trigger on uploadZone div, not on label clicks
        uploadZone.addEventListener('click', function(e) {
            // Don't trigger if clicking on the label (let label handle it naturally)
            if (e.target.tagName === 'LABEL' || e.target.closest('label')) {
                return;
            }
            document.getElementById('file-input').click();
        });
        
        // Handle file loading
        function handleFile(file) {
            if (!file.name.endsWith('.json')) {
                alert('Please select a JSON file');
                return;
            }
            
            loadedFileName = file.name;
            console.log (loadedFileName);
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    loadedCircuit = JSON.parse(e.target.result);
                    
                    document.getElementById('file-info').innerHTML = `
                        <div class="file-info">
                            ✅ <strong>${loadedFileName}</strong><br>
                            ${loadedCircuit.circuit?.metadata?.name || 'Unknown Circuit'}<br>
                            <small>Components: ${loadedCircuit.circuit?.components?.length || 0}, 
                            Wires: ${loadedCircuit.circuit?.wires?.length || 0}</small>
                        </div>
                    `;
                    
                    document.getElementById('validate-btn').disabled = false;
                } catch (error) {
                    document.getElementById('file-info').innerHTML = `
                        <div class="error-item">
                            ❌ Error parsing JSON: ${error.message}
                        </div>
                    `;
                    loadedCircuit = null;
                    document.getElementById('validate-btn').disabled = true;
                }
            };
            
            reader.readAsText(file);
        }
        
        // Validate loaded circuit
        async function validateLoadedCircuit() {
            if (!loadedCircuit) {
                alert('No circuit loaded');
                return;
            }
            
            const btn = document.getElementById('validate-btn');
            btn.disabled = true;
            btn.textContent = '⏳ Validating...';
            
            try {
                const v = await initValidator();
                const result = await v.validate(loadedCircuit);
                displayResults(result, loadedFileName);
            } catch (error) {
                document.getElementById('file-info').innerHTML += `
                    <div class="error-item">
                        ❌ Validation error: ${error.message}
                    </div>
                `;
            } finally {
                btn.disabled = false;
                btn.textContent = '🔍 Validate';
            }
        }
        
        // Display validation results
        function displayResults(result, filename) {
            document.getElementById('results-section').style.display = 'block';
            
            // Status
            const statusDiv = document.getElementById('status-display');
            if (result.valid) {
                statusDiv.innerHTML = `
                    <div class="status pass">✅ VALID CIRCUIT</div>
                `;
            } else {
                statusDiv.innerHTML = `
                    <div class="status fail">❌ INVALID - ${result.errors.length} Error(s)</div>
                `;
            }
            
            // Stats
            document.getElementById('stats-display').innerHTML = `
                <div class="stat-box">
                    <div class="stat-label">Components</div>
                    <div class="stat-number" style="color: #4ec9b0;">
                        ${loadedCircuit.circuit.components.length}
                    </div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Wires</div>
                    <div class="stat-number" style="color: #569cd6;">
                        ${loadedCircuit.circuit.wires.length}
                    </div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Errors</div>
                    <div class="stat-number" style="color: ${result.errors.length > 0 ? '#f48771' : '#4ec9b0'};">
                        ${result.errors.length}
                    </div>
                </div>
                <div class="stat-box">
                    <div class="stat-label">Warnings</div>
                    <div class="stat-number" style="color: ${result.warnings.length > 0 ? '#dcdcaa' : '#4ec9b0'};">
                        ${result.warnings.length}
                    </div>
                </div>
            `;
            
            // Errors
            const errorsDiv = document.getElementById('errors-display');
            if (result.errors.length > 0) {
                let html = '<h3>🚫 Errors:</h3>';
                result.errors.forEach((err, i) => {
                    html += `
                        <div class="error-item">
                            <strong>${i + 1}. [${err.type}] ${err.location}</strong>
                            <div>${err.message}</div>
                        </div>
                    `;
                });
                errorsDiv.innerHTML = html;
            } else {
                errorsDiv.innerHTML = '';
            }
            
            // Warnings
            const warningsDiv = document.getElementById('warnings-display');
            if (result.warnings.length > 0) {
                let html = '<h3>⚠️ Warnings:</h3>';
                result.warnings.forEach((warn, i) => {
                    html += `
                        <div class="warning-item">
                            <strong>${i + 1}. [${warn.type}] ${warn.location}</strong>
                            <div>${warn.message}</div>
                        </div>
                    `;
                });
                warningsDiv.innerHTML = html;
            } else {
                warningsDiv.innerHTML = '';
            }
            
            // Full report
            const report = validator.generateReport(result);
            document.getElementById('full-report').textContent = report;
        }
        
        // Clear results
        function clearResults() {
            document.getElementById('results-section').style.display = 'none';
            document.getElementById('file-info').innerHTML = '';
            loadedCircuit = null;
            loadedFileName = '';
            document.getElementById('validate-btn').disabled = true;
            document.getElementById('file-input').value = '';
        }
        
        // Load test files
        async function loadTestFile(type) {
            const filename = type === 'valid' 
                ? 'circuits/test-valid-led-circuit.json'
                : 'circuits/test-invalid-led-circuit.json';
            
            try {
                const response = await fetch(filename);
                if (!response.ok) {
                    throw new Error(`File not found: ${filename}`);
                }
                loadedCircuit = await response.json();
                loadedFileName = filename.split('/').pop();
                
                document.getElementById('file-info').innerHTML = `
                    <div class="file-info">
                        ✅ <strong>${loadedFileName}</strong><br>
                        ${loadedCircuit.circuit?.metadata?.name || 'Test Circuit'}<br>
                        <small>Components: ${loadedCircuit.circuit?.components?.length || 0}, 
                        Wires: ${loadedCircuit.circuit?.wires?.length || 0}</small>
                    </div>
                `;
                
                document.getElementById('validate-btn').disabled = false;
            } catch (error) {
                document.getElementById('file-info').innerHTML = `
                    <div class="error-item">
                        ❌ ${error.message}<br>
                        <small>Make sure test files exist in circuits/ folder</small>
                    </div>
                `;
            }
        }
        
        // Initialize validator on load
        initValidator();
        console.log('Validator UI script loaded.')