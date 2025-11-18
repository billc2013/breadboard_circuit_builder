/**
 * Circuits Manager
 * Manages multiple circuit JSON panels for loading, editing, and saving circuits
 */

class CircuitsManager {
    constructor() {
        this.circuits = [];
        this.LOCAL_STORAGE_KEY = 'breadboard_circuits';

        // DOM elements
        this.circuitsList = document.getElementById('circuits-list');
        this.addCircuitBtn = document.getElementById('add-circuit-btn');

        this.init();
    }

    init() {
        // Add circuit button
        this.addCircuitBtn.addEventListener('click', () => this.addCircuit());

        // Load circuits from localStorage
        this.loadFromLocalStorage();

        // If no circuits, add a default one
        if (this.circuits.length === 0) {
            this.addCircuit('My Circuit', '', true);
        }

        console.log('Circuits Manager initialized with', this.circuits.length, 'circuits');
    }

    /**
     * Generate unique circuit ID
     */
    generateId() {
        return 'circuit-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Add a new circuit panel
     */
    addCircuit(name = null, json = '', expanded = true) {
        const circuit = {
            id: this.generateId(),
            name: name || `Circuit ${this.circuits.length + 1}`,
            json: json,
            isExpanded: expanded,
            isDirty: false,
            lastModified: Date.now()
        };

        this.circuits.push(circuit);
        this.renderCircuit(circuit);
        this.saveToLocalStorage();

        console.log('Added circuit:', circuit.name);
    }

    /**
     * Render a circuit item in the DOM
     */
    renderCircuit(circuit) {
        const item = document.createElement('div');
        item.className = 'circuit-item';
        item.id = circuit.id;
        if (circuit.isExpanded) {
            item.classList.add('expanded');
        }

        item.innerHTML = `
            <div class="circuit-header">
                <input type="text" class="circuit-name" value="${this.escapeHtml(circuit.name)}" data-id="${circuit.id}">
                <button class="circuit-btn expand-btn" title="Expand/Collapse" data-id="${circuit.id}">▼</button>
                <button class="circuit-btn save-btn" title="Save to file" data-id="${circuit.id}">💾</button>
                <button class="circuit-btn delete-btn" title="Delete circuit" data-id="${circuit.id}">×</button>
            </div>
            <div class="circuit-content">
                <textarea
                    class="circuit-textarea"
                    placeholder='Paste circuit JSON here...\n\n{\n  "circuit": {\n    "metadata": { "name": "My Circuit" },\n    "components": [...],\n    "wires": [...]\n  }\n}'
                    data-id="${circuit.id}"
                    spellcheck="false"
                >${this.escapeHtml(circuit.json)}</textarea>
                <div class="circuit-actions">
                    <button class="circuit-action-btn primary load-btn" data-id="${circuit.id}">
                        ▶ Load Circuit
                    </button>
                    <button class="circuit-action-btn secondary copy-btn" data-id="${circuit.id}">
                        📋 Copy Current
                    </button>
                </div>
            </div>
        `;

        this.circuitsList.appendChild(item);

        // Add event listeners
        this.attachCircuitEvents(circuit.id);
    }

    /**
     * Attach event listeners to a circuit item
     */
    attachCircuitEvents(circuitId) {
        const item = document.getElementById(circuitId);

        // Circuit name change
        const nameInput = item.querySelector('.circuit-name');
        nameInput.addEventListener('input', (e) => {
            this.updateCircuitName(circuitId, e.target.value);
        });

        // Expand/collapse
        const expandBtn = item.querySelector('.expand-btn');
        expandBtn.addEventListener('click', () => {
            this.toggleExpand(circuitId);
        });

        // Save to file
        const saveBtn = item.querySelector('.save-btn');
        saveBtn.addEventListener('click', () => {
            this.saveCircuitToFile(circuitId);
        });

        // Delete
        const deleteBtn = item.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', () => {
            this.deleteCircuit(circuitId);
        });

        // Textarea changes
        const textarea = item.querySelector('.circuit-textarea');
        let saveTimeout;
        textarea.addEventListener('input', (e) => {
            this.markDirty(circuitId, true);

            // Auto-save to localStorage (debounced)
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.updateCircuitJSON(circuitId, e.target.value);
            }, 1000);
        });

        // Tab key handling
        textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const value = textarea.value;

                // Insert 2 spaces
                textarea.value = value.substring(0, start) + '  ' + value.substring(end);
                textarea.selectionStart = textarea.selectionEnd = start + 2;
            }
        });

        // Load circuit button
        const loadBtn = item.querySelector('.load-btn');
        loadBtn.addEventListener('click', () => {
            this.loadCircuitToBoard(circuitId);
        });

        // Copy current circuit button
        const copyBtn = item.querySelector('.copy-btn');
        copyBtn.addEventListener('click', () => {
            this.copyCurrentCircuit(circuitId);
        });
    }

    /**
     * Toggle expand/collapse
     */
    toggleExpand(circuitId) {
        const circuit = this.circuits.find(c => c.id === circuitId);
        if (!circuit) return;

        circuit.isExpanded = !circuit.isExpanded;

        const item = document.getElementById(circuitId);
        item.classList.toggle('expanded');

        this.saveToLocalStorage();
    }

    /**
     * Update circuit name
     */
    updateCircuitName(circuitId, newName) {
        const circuit = this.circuits.find(c => c.id === circuitId);
        if (!circuit) return;

        circuit.name = newName;
        circuit.lastModified = Date.now();
        this.saveToLocalStorage();
    }

    /**
     * Update circuit JSON
     */
    updateCircuitJSON(circuitId, json) {
        const circuit = this.circuits.find(c => c.id === circuitId);
        if (!circuit) return;

        circuit.json = json;
        circuit.lastModified = Date.now();
        this.saveToLocalStorage();
    }

    /**
     * Mark circuit as dirty (unsaved changes)
     */
    markDirty(circuitId, isDirty) {
        const circuit = this.circuits.find(c => c.id === circuitId);
        if (!circuit) return;

        circuit.isDirty = isDirty;

        const item = document.getElementById(circuitId);
        if (isDirty) {
            item.classList.add('unsaved');
        } else {
            item.classList.remove('unsaved');
        }
    }

    /**
     * Load circuit to breadboard
     */
    async loadCircuitToBoard(circuitId) {
        const circuit = this.circuits.find(c => c.id === circuitId);
        if (!circuit) return;

        const item = document.getElementById(circuitId);
        const textarea = item.querySelector('.circuit-textarea');
        const jsonText = textarea.value.trim();

        if (!jsonText) {
            this.showCircuitError(circuitId, 'Please paste circuit JSON first.');
            return;
        }

        // Remove previous errors
        this.hideCircuitError(circuitId);

        // Parse JSON
        let circuitData;
        try {
            circuitData = JSON.parse(jsonText);
        } catch (error) {
            this.showCircuitError(circuitId, `JSON Syntax Error: ${error.message}`);
            return;
        }

        // Validate structure
        if (!circuitData.circuit) {
            this.showCircuitError(circuitId, 'Invalid circuit JSON: Missing "circuit" root object.');
            return;
        }

        console.log('Loading circuit to board:', circuit.name, circuitData);

        // Use existing circuit loader
        const circuitLoader = window.breadboardApp?.circuitLoader || window.circuitLoader;

        if (circuitLoader && typeof circuitLoader.loadCircuit === 'function') {
            try {
                const result = await circuitLoader.loadCircuit(circuitData);

                if (result.success) {
                    this.showSuccess(circuitId);
                    this.markDirty(circuitId, false);
                    console.log('Circuit loaded successfully:', circuit.name);
                } else {
                    this.showCircuitError(circuitId, `Loading failed:\n${result.errors.join('\n')}`);
                }
            } catch (error) {
                console.error('Circuit loading error:', error);
                this.showCircuitError(circuitId, `Error: ${error.message}`);
            }
        } else {
            console.error('Circuit loader not found');
            this.showCircuitError(circuitId, 'Circuit loader not initialized.');
        }
    }

    /**
     * Copy current circuit from breadboard
     */
    copyCurrentCircuit(circuitId) {
        const circuit = this.circuits.find(c => c.id === circuitId);
        if (!circuit) return;

        const circuitLoader = window.breadboardApp?.circuitLoader || window.circuitLoader;

        if (circuitLoader && typeof circuitLoader.exportCircuit === 'function') {
            const circuitJSON = circuitLoader.exportCircuit();

            if (circuitJSON) {
                const prettyJSON = JSON.stringify(circuitJSON, null, 2);

                const item = document.getElementById(circuitId);
                const textarea = item.querySelector('.circuit-textarea');
                textarea.value = prettyJSON;

                this.updateCircuitJSON(circuitId, prettyJSON);
                this.showSuccess(circuitId);

                console.log('Current circuit copied to:', circuit.name);
            } else {
                this.showCircuitError(circuitId, 'No circuit to export.');
            }
        } else {
            this.showCircuitError(circuitId, 'Export functionality not available.');
        }
    }

    /**
     * Save circuit to file
     */
    saveCircuitToFile(circuitId) {
        const circuit = this.circuits.find(c => c.id === circuitId);
        if (!circuit) return;

        const item = document.getElementById(circuitId);
        const textarea = item.querySelector('.circuit-textarea');
        const jsonText = textarea.value.trim();

        if (!jsonText) {
            this.showCircuitError(circuitId, 'Nothing to save. Textarea is empty.');
            return;
        }

        // Validate JSON before saving
        try {
            JSON.parse(jsonText);
        } catch (error) {
            if (confirm(`JSON has syntax errors. Save anyway?\n\nError: ${error.message}`)) {
                // Continue to save
            } else {
                return;
            }
        }

        // Create download
        const blob = new Blob([jsonText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Clean filename from circuit name
        const filename = circuit.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        a.download = `${filename || 'circuit'}_${Date.now()}.json`;

        a.click();
        URL.revokeObjectURL(url);

        this.markDirty(circuitId, false);
        this.showSuccess(circuitId);

        console.log('Circuit saved to file:', a.download);
    }

    /**
     * Delete circuit
     */
    deleteCircuit(circuitId) {
        const circuit = this.circuits.find(c => c.id === circuitId);
        if (!circuit) return;

        // Confirm if dirty
        if (circuit.isDirty) {
            if (!confirm(`"${circuit.name}" has unsaved changes. Delete anyway?`)) {
                return;
            }
        } else {
            if (!confirm(`Delete "${circuit.name}"?`)) {
                return;
            }
        }

        // Remove from array
        this.circuits = this.circuits.filter(c => c.id !== circuitId);

        // Remove from DOM
        const item = document.getElementById(circuitId);
        if (item) {
            item.remove();
        }

        this.saveToLocalStorage();

        console.log('Deleted circuit:', circuit.name);

        // Add a circuit if list is empty
        if (this.circuits.length === 0) {
            this.addCircuit('My Circuit', '', true);
        }
    }

    /**
     * Show error in circuit item
     */
    showCircuitError(circuitId, message) {
        const item = document.getElementById(circuitId);
        const content = item.querySelector('.circuit-content');

        // Remove existing error
        const existingError = content.querySelector('.circuit-error');
        if (existingError) {
            existingError.remove();
        }

        // Add new error
        const errorDiv = document.createElement('div');
        errorDiv.className = 'circuit-error';
        errorDiv.innerHTML = `
            <div class="error-title">⚠️ Error</div>
            ${this.escapeHtml(message)}
        `;

        content.appendChild(errorDiv);
    }

    /**
     * Hide error in circuit item
     */
    hideCircuitError(circuitId) {
        const item = document.getElementById(circuitId);
        const existingError = item.querySelector('.circuit-error');
        if (existingError) {
            existingError.remove();
        }
    }

    /**
     * Show success feedback
     */
    showSuccess(circuitId) {
        const item = document.getElementById(circuitId);
        item.classList.add('success');
        setTimeout(() => {
            item.classList.remove('success');
        }, 500);
    }

    /**
     * Save all circuits to localStorage
     */
    saveToLocalStorage() {
        try {
            // Save circuits data (without DOM references)
            const data = this.circuits.map(c => ({
                id: c.id,
                name: c.name,
                json: c.json,
                isExpanded: c.isExpanded,
                isDirty: c.isDirty,
                lastModified: c.lastModified
            }));

            localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to save circuits to localStorage:', error);
        }
    }

    /**
     * Load circuits from localStorage
     */
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(this.LOCAL_STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);

                // Render each circuit
                data.forEach(circuit => {
                    this.circuits.push(circuit);
                    this.renderCircuit(circuit);
                });

                console.log('Loaded', data.length, 'circuits from localStorage');
            }
        } catch (error) {
            console.warn('Failed to load circuits from localStorage:', error);
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.circuitsManager = new CircuitsManager();
});
