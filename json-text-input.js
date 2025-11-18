/**
 * JSON Text Input Handler
 * Allows users to paste circuit JSON directly from LLMs without file upload
 */

class JSONTextInputHandler {
    constructor() {
        this.textarea = document.getElementById('circuit-json-input');
        this.toggleBtn = document.getElementById('toggle-json-input');
        this.container = document.getElementById('json-input-container');
        this.loadBtn = document.getElementById('load-from-text-btn');
        this.copyBtn = document.getElementById('copy-current-circuit-btn');
        this.clearBtn = document.getElementById('clear-json-input-btn');
        this.errorDisplay = document.getElementById('json-error-display');
        this.errorContent = document.getElementById('json-error-content');
        this.closeErrorBtn = document.getElementById('close-json-error');

        this.LOCAL_STORAGE_KEY = 'breadboard_circuit_json_draft';

        this.init();
    }

    init() {
        // Toggle section expand/collapse
        this.toggleBtn.addEventListener('click', () => this.toggleSection());

        // Load circuit from text
        this.loadBtn.addEventListener('click', () => this.loadCircuitFromText());

        // Copy current circuit to textarea
        this.copyBtn.addEventListener('click', () => this.copyCurrentCircuit());

        // Clear textarea
        this.clearBtn.addEventListener('click', () => this.clearTextarea());

        // Close error message
        this.closeErrorBtn.addEventListener('click', () => this.hideError());

        // Tab key handling - insert tabs instead of changing focus
        this.textarea.addEventListener('keydown', (e) => this.handleTabKey(e));

        // Auto-save to localStorage on input (debounced)
        let saveTimeout;
        this.textarea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => this.saveToLocalStorage(), 1000);
        });

        // Load from localStorage on init
        this.loadFromLocalStorage();

        console.log('JSON Text Input Handler initialized');
    }

    toggleSection() {
        this.container.classList.toggle('collapsed');
        const isCollapsed = this.container.classList.contains('collapsed');

        // Update toggle button text
        this.toggleBtn.textContent = isCollapsed
            ? '▼ Paste Circuit JSON'
            : '▲ Paste Circuit JSON';
    }

    async loadCircuitFromText() {
        const jsonText = this.textarea.value.trim();

        if (!jsonText) {
            this.showError('Please paste circuit JSON into the text area first.');
            return;
        }

        // Hide any previous errors
        this.hideError();
        this.textarea.classList.remove('has-error');

        // Parse JSON
        let circuitData;
        try {
            circuitData = JSON.parse(jsonText);
        } catch (error) {
            this.showJSONParseError(error, jsonText);
            return;
        }

        // Validate structure
        if (!circuitData.circuit) {
            this.showError('Invalid circuit JSON: Missing "circuit" root object.');
            return;
        }

        console.log('Loading circuit from text input:', circuitData);

        // Use existing circuit loader
        if (typeof window.circuitLoader !== 'undefined') {
            try {
                const result = await window.circuitLoader.loadCircuit(circuitData);

                if (result.success) {
                    this.showSuccess();
                    console.log('Circuit loaded successfully from text input');
                } else {
                    this.showError(`Circuit loading failed:\n${result.errors.join('\n')}`);
                }
            } catch (error) {
                console.error('Circuit loading error:', error);
                this.showError(`Error loading circuit: ${error.message}`);
            }
        } else {
            console.error('Circuit loader not found');
            this.showError('Circuit loader not initialized. Please check console for errors.');
        }
    }

    copyCurrentCircuit() {
        // Export current circuit state
        // Try to get circuit loader from app
        const circuitLoader = window.app?.circuitLoader || window.circuitLoader;

        if (circuitLoader && typeof circuitLoader.exportCircuit === 'function') {
            const circuitJSON = circuitLoader.exportCircuit();

            if (circuitJSON) {
                // Pretty-print JSON
                const prettyJSON = JSON.stringify(circuitJSON, null, 2);
                this.textarea.value = prettyJSON;

                // Save to localStorage
                this.saveToLocalStorage();

                // Show success feedback
                this.textarea.classList.add('success');
                setTimeout(() => {
                    this.textarea.classList.remove('success');
                }, 500);

                console.log('Current circuit copied to text input');
            } else {
                this.showError('No circuit to export. Please create a circuit first.');
            }
        } else {
            this.showError('Export functionality not available. Circuit loader not found.');
            console.error('Circuit loader not available:', { app: window.app, circuitLoader: window.circuitLoader });
        }
    }

    clearTextarea() {
        if (confirm('Clear JSON input? This will remove unsaved content.')) {
            this.textarea.value = '';
            this.hideError();
            this.textarea.classList.remove('has-error', 'success');
            this.saveToLocalStorage();
            console.log('JSON input cleared');
        }
    }

    handleTabKey(e) {
        if (e.key === 'Tab') {
            e.preventDefault();

            const start = this.textarea.selectionStart;
            const end = this.textarea.selectionEnd;
            const value = this.textarea.value;

            // Insert tab (2 spaces)
            this.textarea.value = value.substring(0, start) + '  ' + value.substring(end);

            // Move cursor after inserted tab
            this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
        }
    }

    showJSONParseError(error, jsonText) {
        // Extract line number from error message
        let lineNumber = null;
        const lineMatch = error.message.match(/line (\d+)/i) ||
                         error.message.match(/position (\d+)/i);

        if (lineMatch) {
            lineNumber = parseInt(lineMatch[1]);
        }

        // Calculate approximate line number from position if available
        if (!lineNumber && error.message.includes('position')) {
            const posMatch = error.message.match(/position (\d+)/);
            if (posMatch) {
                const position = parseInt(posMatch[1]);
                const textUpToPosition = jsonText.substring(0, position);
                lineNumber = textUpToPosition.split('\n').length;
            }
        }

        let errorHTML = `<div class="error-line">JSON Syntax Error</div>`;
        errorHTML += `<div class="error-detail">${error.message}</div>`;

        if (lineNumber) {
            errorHTML += `<div class="error-detail">Error near line ${lineNumber}</div>`;
            this.highlightErrorLine(lineNumber);
        }

        this.errorContent.innerHTML = errorHTML;
        this.errorDisplay.style.display = 'block';
        this.textarea.classList.add('has-error');

        console.error('JSON parse error:', error);
    }

    showError(message) {
        this.errorContent.innerHTML = `<div class="error-detail">${message}</div>`;
        this.errorDisplay.style.display = 'block';
        this.textarea.classList.add('has-error');
    }

    hideError() {
        this.errorDisplay.style.display = 'none';
        this.textarea.classList.remove('has-error');
    }

    showSuccess() {
        this.hideError();
        this.textarea.classList.add('success');
        setTimeout(() => {
            this.textarea.classList.remove('success');
        }, 500);
    }

    highlightErrorLine(lineNumber) {
        // Scroll textarea to show the error line
        const lines = this.textarea.value.split('\n');
        const errorLineStart = lines.slice(0, lineNumber - 1).join('\n').length;

        this.textarea.focus();
        this.textarea.setSelectionRange(errorLineStart, errorLineStart + lines[lineNumber - 1].length);
        this.textarea.scrollTop = (lineNumber - 5) * 20; // Approximate scroll
    }

    saveToLocalStorage() {
        try {
            localStorage.setItem(this.LOCAL_STORAGE_KEY, this.textarea.value);
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem(this.LOCAL_STORAGE_KEY);
            if (saved) {
                this.textarea.value = saved;
                console.log('Loaded draft from localStorage');
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.jsonTextInputHandler = new JSONTextInputHandler();
});
