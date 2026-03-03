/**
 * Circuit Explorer Mode
 *
 * Provides progressive disclosure visualization for circuit learning.
 * Students control complexity by filtering wire categories and clicking
 * individual wires to highlight and learn about connections.
 *
 * Key features:
 * - Faded breadboard overlay for reduced visual noise
 * - Wire categorization: Pico↔Component, Component↔Component, Power/Ground
 * - Click-to-highlight wire interaction
 * - Spacebar educational tooltips from component JSON connectionGuide
 * - Arrow key tooltip repositioning
 *
 * @author Bill Church with Claude Code
 * @version 1.0.0
 */

class CircuitExplorerManager {
    constructor(app) {
        this.app = app;
        this.isActive = false;
        this.circuitData = null;

        // Wire state
        this.wireCategories = {
            picoToComponent: [],
            componentToComponent: [],
            powerGround: []
        };
        this.highlightedWire = null;
        this.wireFilterState = {
            picoToComponent: true,
            componentToComponent: true,
            powerGround: true
        };

        // Component grouping (Phase 4)
        this.componentGroups = [];

        // Tooltip state
        this.tooltipElement = null;
        this.tooltipPosition = { x: 0, y: 0 };
        this.tooltipOffset = { x: 20, y: -60 };

        // Event handler references (for cleanup)
        this.boundHandleWireClick = this.handleWireClick.bind(this);
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.boundHandleFilterChange = this.handleFilterChange.bind(this);
    }

    // ==================== Lifecycle Methods ====================

    /**
     * Activate Circuit Explorer mode
     * @param {Object} circuitJson - The circuit data to explore
     */
    start(circuitJson) {
        if (this.isActive) {
            console.log('[CircuitExplorer] Already active, stopping first');
            this.stop();
        }

        console.log('[CircuitExplorer] Starting explorer mode');
        this.isActive = true;
        this.circuitData = circuitJson;

        // Add explorer mode class to body for CSS targeting
        document.body.classList.add('explorer-mode');

        // Analyze and categorize wires
        if (circuitJson?.circuit?.wires && circuitJson?.circuit?.components) {
            this.categorizeWires(circuitJson.circuit.wires, circuitJson.circuit.components);
        }

        // Apply visual changes
        this.applyBreadboardFade();
        this.applyWireCategories();
        this.updateWireVisibility();

        // Enable interactions
        this.enableWireInteraction();
        this.setupKeyboardListeners();
        this.setupFilterListeners();

        // Show filter UI
        this.showFilterUI();

        console.log('[CircuitExplorer] Explorer mode active');
    }

    /**
     * Deactivate Circuit Explorer mode
     */
    stop() {
        if (!this.isActive) return;

        console.log('[CircuitExplorer] Stopping explorer mode');
        this.isActive = false;

        // Remove explorer mode class
        document.body.classList.remove('explorer-mode');

        // Hide tooltip
        this.hideConnectionGuide();

        // Remove breadboard fade
        this.removeBreadboardFade();

        // Remove wire category classes and restore normal appearance
        this.removeWireCategories();

        // Disable interactions
        this.disableWireInteraction();
        this.removeKeyboardListeners();
        this.removeFilterListeners();

        // Hide filter UI
        this.hideFilterUI();

        // Clear state
        this.highlightedWire = null;
        this.circuitData = null;

        console.log('[CircuitExplorer] Explorer mode stopped');
    }

    // ==================== Wire Categorization ====================

    /**
     * Categorize all wires into three groups
     * @param {Array} wires - Wire definitions from circuit JSON
     * @param {Array} components - Component definitions from circuit JSON
     */
    categorizeWires(wires, components) {
        // Reset categories
        this.wireCategories = {
            picoToComponent: [],
            componentToComponent: [],
            powerGround: []
        };

        // Build component lookup for quick access
        const componentIds = new Set(components.map(c => c.id));

        for (const wire of wires) {
            const category = this.getWireCategory(wire, componentIds);
            this.wireCategories[category].push(wire.id);
        }

        console.log('[CircuitExplorer] Wire categories:', {
            picoToComponent: this.wireCategories.picoToComponent.length,
            componentToComponent: this.wireCategories.componentToComponent.length,
            powerGround: this.wireCategories.powerGround.length
        });
    }

    /**
     * Determine the category of a single wire
     * @param {Object} wire - Wire definition
     * @param {Set} componentIds - Set of component IDs
     * @returns {string} Category name
     */
    getWireCategory(wire, componentIds) {
        const fromIsPico = this.isPicoPin(wire.from);
        const toIsPico = this.isPicoPin(wire.to);
        const fromIsPowerGround = this.isPowerOrGround(wire.from);
        const toIsPowerGround = this.isPowerOrGround(wire.to);

        // Power/Ground takes precedence
        if (fromIsPowerGround || toIsPowerGround) {
            return 'powerGround';
        }

        // Pico to component
        if (fromIsPico || toIsPico) {
            return 'picoToComponent';
        }

        // Default: component to component
        return 'componentToComponent';
    }

    /**
     * Check if a point ID refers to a Pico pin
     * @param {string} pointId - Point identifier (e.g., "pico1.GP0")
     * @returns {boolean}
     */
    isPicoPin(pointId) {
        if (!pointId) return false;
        const normalized = pointId.toLowerCase();
        return normalized.startsWith('pico') && normalized.includes('.');
    }

    /**
     * Check if a point ID refers to power or ground
     * @param {string} pointId - Point identifier
     * @returns {boolean}
     */
    isPowerOrGround(pointId) {
        if (!pointId) return false;
        const normalized = pointId.toUpperCase();

        // Pico power/ground pins
        if (normalized.includes('GND') ||
            normalized.includes('3V3') ||
            normalized.includes('VBUS') ||
            normalized.includes('VSYS')) {
            return true;
        }

        // Power rail references (W, X, Y, Z rows)
        // Format: W1, X1, Y1, Z1, etc. or just single letter rows
        if (/^[WXYZ]\d+$/i.test(pointId)) {
            return true;
        }

        return false;
    }

    // ==================== Visual Rendering ====================

    /**
     * Apply semi-transparent overlay to fade the breadboard
     */
    applyBreadboardFade() {
        const svg = document.getElementById('breadboard-svg');
        let overlayLayer = document.getElementById('explorer-overlay-layer');

        if (!overlayLayer) {
            // Create the overlay layer if it doesn't exist
            overlayLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            overlayLayer.id = 'explorer-overlay-layer';

            // Insert after breadboard-image
            const breadboardImage = document.getElementById('breadboard-image');
            if (breadboardImage && breadboardImage.nextSibling) {
                svg.insertBefore(overlayLayer, breadboardImage.nextSibling);
            } else {
                svg.appendChild(overlayLayer);
            }
        }

        // Clear any existing overlay
        overlayLayer.innerHTML = '';

        // Get breadboard dimensions from the image
        const breadboardImage = document.getElementById('breadboard-image');
        if (breadboardImage) {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', breadboardImage.getAttribute('x') || '0');
            rect.setAttribute('y', breadboardImage.getAttribute('y') || '0');
            rect.setAttribute('width', breadboardImage.getAttribute('width') || '100%');
            rect.setAttribute('height', breadboardImage.getAttribute('height') || '100%');
            rect.setAttribute('class', 'breadboard-fade-overlay');
            overlayLayer.appendChild(rect);
        }

        overlayLayer.style.display = 'block';
        console.log('[CircuitExplorer] Breadboard fade applied');
    }

    /**
     * Remove the breadboard fade overlay
     */
    removeBreadboardFade() {
        const overlayLayer = document.getElementById('explorer-overlay-layer');
        if (overlayLayer) {
            overlayLayer.style.display = 'none';
            overlayLayer.innerHTML = '';
        }
    }

    /**
     * Apply category classes to all wires
     */
    applyWireCategories() {
        // Apply category class to each wire
        for (const [category, wireIds] of Object.entries(this.wireCategories)) {
            const cssClass = this.getCategoryClass(category);
            for (const wireId of wireIds) {
                const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
                if (wireElement) {
                    wireElement.classList.add(cssClass);
                }
            }
        }
    }

    /**
     * Remove category classes from all wires
     */
    removeWireCategories() {
        const wires = document.querySelectorAll('.wire');
        for (const wire of wires) {
            wire.classList.remove(
                'category-pico-component',
                'category-component-component',
                'category-power-ground',
                'highlighted',
                'hidden'
            );
        }
    }

    /**
     * Get CSS class name for a category
     * @param {string} category - Category name
     * @returns {string} CSS class name
     */
    getCategoryClass(category) {
        const classMap = {
            picoToComponent: 'category-pico-component',
            componentToComponent: 'category-component-component',
            powerGround: 'category-power-ground'
        };
        return classMap[category] || '';
    }

    /**
     * Update wire visibility based on filter state
     */
    updateWireVisibility() {
        for (const [category, wireIds] of Object.entries(this.wireCategories)) {
            const isVisible = this.wireFilterState[category];
            for (const wireId of wireIds) {
                const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
                if (wireElement) {
                    if (isVisible) {
                        wireElement.classList.remove('hidden');
                    } else {
                        wireElement.classList.add('hidden');
                    }
                }
            }
        }
    }

    // ==================== Wire Interaction ====================

    /**
     * Enable click interaction on wires
     */
    enableWireInteraction() {
        const wiresLayer = document.getElementById('wires-layer');
        if (wiresLayer) {
            wiresLayer.addEventListener('click', this.boundHandleWireClick);
        }
    }

    /**
     * Disable click interaction on wires
     */
    disableWireInteraction() {
        const wiresLayer = document.getElementById('wires-layer');
        if (wiresLayer) {
            wiresLayer.removeEventListener('click', this.boundHandleWireClick);
        }
    }

    /**
     * Handle click on a wire element
     * @param {Event} event - Click event
     */
    handleWireClick(event) {
        const wireElement = event.target.closest('.wire');
        if (!wireElement) return;

        const wireId = wireElement.getAttribute('data-wire-id');
        if (!wireId) return;

        console.log('[CircuitExplorer] Wire clicked:', wireId);

        // Unhighlight previous wire
        if (this.highlightedWire && this.highlightedWire !== wireId) {
            this.unhighlightWire(this.highlightedWire);
        }

        // Toggle highlight on clicked wire
        if (this.highlightedWire === wireId) {
            this.unhighlightWire(wireId);
            this.highlightedWire = null;
            this.hideConnectionGuide();
        } else {
            this.highlightWire(wireId);
            this.highlightedWire = wireId;
        }
    }

    /**
     * Apply highlight styling to a wire
     * @param {string} wireId - Wire identifier
     */
    highlightWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (wireElement) {
            wireElement.classList.add('highlighted');
            console.log('[CircuitExplorer] Wire highlighted:', wireId);
        }
    }

    /**
     * Remove highlight styling from a wire
     * @param {string} wireId - Wire identifier
     */
    unhighlightWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (wireElement) {
            wireElement.classList.remove('highlighted');
        }
    }

    // ==================== Educational Tooltips ====================

    /**
     * Show educational tooltip for the highlighted wire
     * @param {string} wireId - Wire identifier
     */
    showConnectionGuide(wireId) {
        if (!wireId || !this.circuitData) return;

        // Find the wire data
        const wire = this.circuitData.circuit.wires.find(w => w.id === wireId);
        if (!wire) {
            console.log('[CircuitExplorer] Wire not found:', wireId);
            return;
        }

        // Get connection guide from component JSON
        const guideContent = this.getConnectionGuideContent(wire);

        // Get or create tooltip element
        this.tooltipElement = document.getElementById('explorer-tooltip');
        if (!this.tooltipElement) {
            console.log('[CircuitExplorer] Tooltip element not found');
            return;
        }

        // Populate tooltip content
        const titleEl = this.tooltipElement.querySelector('.tooltip-title');
        const purposeEl = this.tooltipElement.querySelector('.tooltip-purpose');
        const warningsEl = this.tooltipElement.querySelector('.tooltip-warnings');
        const troubleshootingEl = this.tooltipElement.querySelector('.tooltip-troubleshooting');

        if (titleEl) titleEl.textContent = guideContent.title || 'Connection Info';
        if (purposeEl) purposeEl.textContent = guideContent.purpose || '';
        if (warningsEl) {
            warningsEl.innerHTML = guideContent.warnings?.length
                ? '<strong>⚠️ Warnings:</strong><ul>' +
                  guideContent.warnings.map(w => `<li>${w}</li>`).join('') + '</ul>'
                : '';
        }
        if (troubleshootingEl) {
            troubleshootingEl.innerHTML = guideContent.troubleshooting?.length
                ? '<strong>🔧 Troubleshooting:</strong><ul>' +
                  guideContent.troubleshooting.map(t => `<li>${t}</li>`).join('') + '</ul>'
                : '';
        }

        // Position tooltip near wire endpoint
        this.positionTooltipNearWire(wireId);

        // Show tooltip
        this.tooltipElement.style.display = 'block';
        console.log('[CircuitExplorer] Tooltip shown for wire:', wireId);
    }

    /**
     * Get connection guide content for a wire
     * @param {Object} wire - Wire definition
     * @returns {Object} Guide content { title, purpose, warnings, troubleshooting }
     */
    getConnectionGuideContent(wire) {
        // Try to find connection guide from component metadata
        // For now, return wire description as fallback
        // In Phase 3, this will pull from component JSON connectionGuide

        const content = {
            title: `Wire: ${wire.from} → ${wire.to}`,
            purpose: wire.description || 'Connection between circuit elements',
            warnings: [],
            troubleshooting: []
        };

        // Try to get component-specific guide
        const componentGuide = this.findComponentConnectionGuide(wire);
        if (componentGuide) {
            content.purpose = componentGuide.purpose || content.purpose;
            content.warnings = componentGuide.warnings || [];
            content.troubleshooting = componentGuide.troubleshooting || [];
        }

        return content;
    }

    /**
     * Find connection guide from component JSON for a wire endpoint
     * @param {Object} wire - Wire definition
     * @returns {Object|null} Connection guide or null
     */
    findComponentConnectionGuide(wire) {
        // This will be fully implemented in Phase 3
        // For now, check if the app has component metadata with connectionGuide

        if (!this.app?.circuitLoader?.renderedComponents) return null;

        // Check both endpoints
        for (const endpoint of [wire.from, wire.to]) {
            // Try to extract component ID and pin from endpoint
            // Format could be: "componentId.pinName" or "BusXX" or "holeId"
            if (endpoint.includes('.')) {
                const [componentId, pinName] = endpoint.split('.');
                const componentData = this.app.circuitLoader.renderedComponents.get(componentId);

                if (componentData?.metadata?.pins?.[pinName]?.connectionGuide) {
                    return componentData.metadata.pins[pinName].connectionGuide;
                }
            }
        }

        return null;
    }

    /**
     * Position tooltip near the wire endpoint
     * @param {string} wireId - Wire identifier
     */
    positionTooltipNearWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (!wireElement || !this.tooltipElement) return;

        // Get wire endpoint coordinates
        let x, y;
        if (wireElement.tagName === 'line') {
            x = parseFloat(wireElement.getAttribute('x2'));
            y = parseFloat(wireElement.getAttribute('y2'));
        } else if (wireElement.tagName === 'polyline') {
            const points = wireElement.getAttribute('points').split(' ');
            const lastPoint = points[points.length - 1].split(',');
            x = parseFloat(lastPoint[0]);
            y = parseFloat(lastPoint[1]);
        }

        // Convert SVG coordinates to screen coordinates
        const svg = document.getElementById('breadboard-svg');
        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;

        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;

        const screenX = svgRect.left + (x * scaleX) + this.tooltipOffset.x;
        const screenY = svgRect.top + (y * scaleY) + this.tooltipOffset.y;

        this.tooltipPosition = { x: screenX, y: screenY };
        this.tooltipElement.style.left = `${screenX}px`;
        this.tooltipElement.style.top = `${screenY}px`;
    }

    /**
     * Hide the educational tooltip
     */
    hideConnectionGuide() {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
    }

    /**
     * Move tooltip by offset (for arrow key repositioning)
     * @param {number} dx - X offset
     * @param {number} dy - Y offset
     */
    moveTooltip(dx, dy) {
        if (!this.tooltipElement) return;

        this.tooltipPosition.x += dx;
        this.tooltipPosition.y += dy;
        this.tooltipElement.style.left = `${this.tooltipPosition.x}px`;
        this.tooltipElement.style.top = `${this.tooltipPosition.y}px`;
    }

    // ==================== Keyboard Handling ====================

    /**
     * Set up keyboard event listeners
     */
    setupKeyboardListeners() {
        document.addEventListener('keydown', this.boundHandleKeydown);
    }

    /**
     * Remove keyboard event listeners
     */
    removeKeyboardListeners() {
        document.removeEventListener('keydown', this.boundHandleKeydown);
    }

    /**
     * Handle keyboard events
     * @param {KeyboardEvent} event
     */
    handleKeydown(event) {
        if (!this.isActive) return;

        // Spacebar - toggle tooltip for highlighted wire
        if (event.code === 'Space' && this.highlightedWire) {
            event.preventDefault();
            if (this.tooltipElement?.style.display === 'block') {
                this.hideConnectionGuide();
            } else {
                this.showConnectionGuide(this.highlightedWire);
            }
            return;
        }

        // Arrow keys - reposition tooltip
        if (this.tooltipElement?.style.display === 'block') {
            const moveAmount = event.shiftKey ? 50 : 20;
            switch (event.code) {
                case 'ArrowUp':
                    event.preventDefault();
                    this.moveTooltip(0, -moveAmount);
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    this.moveTooltip(0, moveAmount);
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    this.moveTooltip(-moveAmount, 0);
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    this.moveTooltip(moveAmount, 0);
                    break;
            }
        }
    }

    // ==================== Filter UI ====================

    /**
     * Set up filter checkbox event listeners
     */
    setupFilterListeners() {
        const checkboxes = [
            { id: 'filter-pico-component', category: 'picoToComponent' },
            { id: 'filter-component-component', category: 'componentToComponent' },
            { id: 'filter-power-ground', category: 'powerGround' }
        ];

        for (const { id, category } of checkboxes) {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.checked = this.wireFilterState[category];
                checkbox.addEventListener('change', this.boundHandleFilterChange);
            }
        }
    }

    /**
     * Remove filter checkbox event listeners
     */
    removeFilterListeners() {
        const checkboxIds = ['filter-pico-component', 'filter-component-component', 'filter-power-ground'];
        for (const id of checkboxIds) {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                checkbox.removeEventListener('change', this.boundHandleFilterChange);
            }
        }
    }

    /**
     * Handle filter checkbox change
     * @param {Event} event
     */
    handleFilterChange(event) {
        const checkbox = event.target;
        const categoryMap = {
            'filter-pico-component': 'picoToComponent',
            'filter-component-component': 'componentToComponent',
            'filter-power-ground': 'powerGround'
        };

        const category = categoryMap[checkbox.id];
        if (category) {
            this.wireFilterState[category] = checkbox.checked;
            this.updateWireVisibility();
            console.log('[CircuitExplorer] Filter changed:', category, checkbox.checked);
        }
    }

    /**
     * Show the wire filter UI
     */
    showFilterUI() {
        const filterUI = document.getElementById('wire-filters');
        if (filterUI) {
            filterUI.style.display = 'flex';
        }
    }

    /**
     * Hide the wire filter UI
     */
    hideFilterUI() {
        const filterUI = document.getElementById('wire-filters');
        if (filterUI) {
            filterUI.style.display = 'none';
        }
    }

    // ==================== Component Grouping (Phase 4) ====================

    /**
     * Infer component groups based on connections and validation rules
     * @param {Array} components - Component definitions
     * @param {Array} wires - Wire definitions
     * @returns {Array} Component groups
     */
    inferComponentGroups(components, wires) {
        // TODO: Implement in Phase 4
        // 1. Build connection graph
        // 2. Check validation.rules for each component
        // 3. Group components that belong together
        console.log('[CircuitExplorer] Component grouping not yet implemented');
        return [];
    }

    /**
     * Build a connection graph from wires
     * @param {Array} components - Component definitions
     * @param {Array} wires - Wire definitions
     * @returns {Map} Connection graph
     */
    buildConnectionGraph(components, wires) {
        // TODO: Implement in Phase 4
        return new Map();
    }

    // ==================== Abstract Layout (Phase 4) ====================

    /**
     * Calculate abstract positions for signal-flow layout
     */
    calculateAbstractPositions() {
        // TODO: Implement in Phase 4
        console.log('[CircuitExplorer] Abstract layout not yet implemented');
    }

    /**
     * Layout components in signal-flow arrangement
     */
    layoutSignalFlow() {
        // TODO: Implement in Phase 4
    }

    // ==================== Public API for External Integration ====================

    /**
     * Get current explorer state (for external sync)
     * @returns {Object} State object
     */
    getState() {
        return {
            isActive: this.isActive,
            highlightedWire: this.highlightedWire,
            filterState: { ...this.wireFilterState },
            componentGroups: [...this.componentGroups]
        };
    }

    /**
     * Set explorer state (from external source)
     * @param {Object} state - State to apply
     */
    setState(state) {
        if (state.filterState) {
            this.wireFilterState = { ...state.filterState };
            this.updateWireVisibility();
        }
        if (state.highlightedWire !== undefined) {
            if (this.highlightedWire) {
                this.unhighlightWire(this.highlightedWire);
            }
            if (state.highlightedWire) {
                this.highlightWire(state.highlightedWire);
            }
            this.highlightedWire = state.highlightedWire;
        }
    }

    /**
     * Programmatically highlight a specific wire
     * @param {string} wireId - Wire to highlight
     */
    highlightWireById(wireId) {
        if (this.highlightedWire) {
            this.unhighlightWire(this.highlightedWire);
        }
        this.highlightWire(wireId);
        this.highlightedWire = wireId;
    }

    // Event callbacks for external integration
    onWireHighlighted = null;    // callback(wireId, wireData)
    onFilterChanged = null;       // callback(filterState)
    onTooltipShown = null;        // callback(wireId, content)
}

// Export for use in app.js
window.CircuitExplorerManager = CircuitExplorerManager;
