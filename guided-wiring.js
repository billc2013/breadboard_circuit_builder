// guided-wiring.js
// Guided Wiring System for Educational Circuit Assembly
// Implements step-by-step wire placement with visual prompts

/**
 * GuidedWiringManager - Manages guided wire placement workflow
 *
 * Workflow:
 * 1. Load wires from circuit JSON into queue
 * 2. Display pulsing endpoints for current wire
 * 3. User clicks first endpoint
 * 4. User places waypoints ('M' for Manhattan, 'S' for straight)
 * 5. User clicks second endpoint to complete
 * 6. Visual + audio feedback
 * 7. Move to next wire
 */
class GuidedWiringManager {
    constructor(app) {
        this.app = app;
        this.wireQueue = [];          // Wires from circuit JSON to be placed
        this.currentWireIndex = 0;    // Current wire being placed
        this.isActive = false;         // Is guided mode active?
        this.routingMode = 'straight'; // 'straight' or 'manhattan'
        this.waypoints = [];           // Waypoints for current wire
        this.startPoint = null;        // First clicked endpoint
        this.isPulsingActive = false;  // Controls pulsing animation
        this.previewPolyline = null;   // Preview polyline during wire building
        this.previewMarkers = [];      // Preview waypoint markers
        this.cursorMarker = null;      // Orange circle following cursor
        this.livePreviewLine = null;   // Preview line from last point to cursor

        // Alternate waypoint grid configuration
        // Offset by half-spacing to sit "between" breadboard holes
        this.waypointGrid = {
            spacing: 8.982,              // Same as breadboard hole spacing
            offset: 8.982 / 2            // Half spacing offset (~4.491 pixels)
        };

        this.initKeyboardHandlers();
        this.initAudioFeedback();
    }

    /**
     * Initialize keyboard handlers for routing modes
     */
    initKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            if (!this.isActive || !this.startPoint) return;

            if (e.key === 'M' || e.key === 'm') {
                this.routingMode = 'manhattan';
                this.updateRoutingModeDisplay();
                console.log('📐 Routing mode: Manhattan (90° angles)');
            } else if (e.key === 'S' || e.key === 's') {
                this.routingMode = 'straight';
                this.updateRoutingModeDisplay();
                console.log('📏 Routing mode: Straight line');
            }
        });
    }

    /**
     * Initialize audio feedback for wire completion
     */
    initAudioFeedback() {
        // Create audio context for success sound
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Audio feedback not available:', e);
            this.audioContext = null;
        }
    }

    /**
     * Play start sound when wire is initiated
     */
    playStartSound() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Single pleasant tone - E5
        oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime);

        gainNode.gain.setValueAtTime(0.08, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.15);
    }

    /**
     * Play success sound when wire is completed
     */
    playSuccessSound() {
        if (!this.audioContext) return;

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Pleasant ascending tone
        oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5

        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }

    /**
     * Load wires from circuit JSON
     * @param {Array} wires - Array of wire objects from circuit JSON
     */
    loadWires(wires) {
        if (!wires || wires.length === 0) {
            console.warn('No wires to load for guided wiring');
            return;
        }

        // Sort wires: ground/power connections first
        this.wireQueue = this.prioritizeWires(wires);
        this.currentWireIndex = 0;

        console.log(`\n🎯 Guided Wiring Mode Activated`);
        console.log(`   Total wires: ${this.wireQueue.length}`);
        console.log(`   Priority: Ground/Power connections first`);
    }

    /**
     * Prioritize wires: ground and power rail connections first
     * @param {Array} wires - Wires to prioritize
     * @returns {Array} Sorted wires
     */
    prioritizeWires(wires) {
        const prioritized = [...wires];

        prioritized.sort((a, b) => {
            const aScore = this.calculateWirePriority(a);
            const bScore = this.calculateWirePriority(b);
            return bScore - aScore; // Higher score first
        });

        return prioritized;
    }

    /**
     * Calculate priority score for a wire
     * @param {Object} wire - Wire object
     * @returns {number} Priority score (higher = more important)
     */
    calculateWirePriority(wire) {
        let score = 0;

        // Check if wire connects to ground
        if (wire.from.includes('GND') || wire.to.includes('GND')) {
            score += 100;
        }

        // Check if wire connects to power
        if (wire.from.includes('3V3') || wire.to.includes('3V3') ||
            wire.from.includes('VBUS') || wire.to.includes('VBUS')) {
            score += 90;
        }

        // Check if wire connects to power rails
        if (this.isRailConnection(wire.from) || this.isRailConnection(wire.to)) {
            score += 80;
        }

        return score;
    }

    /**
     * Check if a point ID is a power rail
     * @param {string} pointId - Connection point ID
     * @returns {boolean} True if rail connection
     */
    isRailConnection(pointId) {
        return /[WXY Z]$/.test(pointId); // Rails end with W, X, Y, or Z
    }

    /**
     * Start guided wiring mode
     */
    start() {
        console.log('DEBUG: start() called');
        console.log('DEBUG: wireQueue.length:', this.wireQueue.length);

        if (this.wireQueue.length === 0) {
            console.warn('No wires loaded. Call loadWires() first.');
            return;
        }

        this.isActive = true;
        this.currentWireIndex = 0;

        console.log('DEBUG: About to call showCurrentWire()');
        this.showCurrentWire();

        console.log('\n▶️  Guided Wiring Started');
        console.log('   Press M for Manhattan routing, S for Straight');
    }

    /**
     * Stop guided wiring mode
     */
    stop() {
        this.isActive = false;
        this.stopPulsing();
        this.clearWaypoints();
        this.startPoint = null;

        console.log('⏸️  Guided Wiring Stopped');
    }

    /**
     * Show pulsing endpoints for current wire
     */
    showCurrentWire() {
        console.log('DEBUG: showCurrentWire() called');
        console.log('DEBUG: currentWireIndex:', this.currentWireIndex);
        console.log('DEBUG: wireQueue.length:', this.wireQueue.length);

        if (this.currentWireIndex >= this.wireQueue.length) {
            this.onAllWiresComplete();
            return;
        }

        const wire = this.wireQueue[this.currentWireIndex];
        console.log('DEBUG: current wire:', wire);

        console.log(`\n📍 Wire ${this.currentWireIndex + 1}/${this.wireQueue.length}`);
        console.log(`   From: ${wire.from}`);
        console.log(`   To: ${wire.to}`);
        if (wire.description) {
            console.log(`   ${wire.description}`);
        }

        // Update wire instruction display
        this.updateWireInstruction(wire);

        // Start pulsing animation on both endpoints
        console.log('DEBUG: About to call startPulsing()');
        this.startPulsing(wire.from, wire.to);
    }

    /**
     * Start pulsing animation on endpoints
     * @param {string} fromId - From endpoint ID
     * @param {string} toId - To endpoint ID
     */
    startPulsing(fromId, toId) {
        console.log('DEBUG: startPulsing() called');
        console.log('DEBUG: fromId:', fromId);
        console.log('DEBUG: toId:', toId);

        this.stopPulsing(); // Clear any existing pulses

        const fromElement = this.getConnectionElement(fromId);
        const toElement = this.getConnectionElement(toId);

        console.log('DEBUG: fromElement:', fromElement);
        console.log('DEBUG: toElement:', toElement);

        if (fromElement) {
            fromElement.classList.add('pulse-endpoint');
            console.log('DEBUG: Added pulse-endpoint class to fromElement');
        } else {
            console.warn(`Could not find element for ${fromId}`);
        }

        if (toElement) {
            toElement.classList.add('pulse-endpoint');
            console.log('DEBUG: Added pulse-endpoint class to toElement');
        } else {
            console.warn(`Could not find element for ${toId}`);
        }

        this.isPulsingActive = true;
        console.log('DEBUG: Pulsing activated. isPulsingActive:', this.isPulsingActive);
    }

    /**
     * Stop pulsing animation
     */
    stopPulsing() {
        if (!this.isPulsingActive) return;

        // Remove pulse class from all elements
        document.querySelectorAll('.pulse-endpoint').forEach(el => {
            el.classList.remove('pulse-endpoint');
        });

        this.isPulsingActive = false;
    }

    /**
     * Get DOM element for a connection point ID
     * @param {string} pointId - Connection point ID
     * @returns {Element|null} DOM element
     */
    getConnectionElement(pointId) {
        // Check if it's a Pico pin (contains dot)
        if (pointId.includes('.')) {
            return document.querySelector(`[data-pin-id="${pointId}"]`);
        } else {
            return document.querySelector(`[data-hole-id="${pointId}"]`);
        }
    }

    /**
     * Handle user clicking on a connection point during guided wiring
     * @param {Object} pointData - Connection point data
     * @returns {boolean} True if click was handled by guided wiring
     */
    handlePointClick(pointData) {
        if (!this.isActive) return false;

        const currentWire = this.wireQueue[this.currentWireIndex];
        if (!currentWire) return false;

        // Check if clicked point is one of the valid endpoints
        const isValidEndpoint = (pointData.id === currentWire.from ||
                                 pointData.id === currentWire.to);

        if (!this.startPoint) {
            // First click - must be a valid endpoint
            if (!isValidEndpoint) {
                console.warn(`⚠️  Please click on ${currentWire.from} or ${currentWire.to}`);
                return true; // Block the click
            }

            this.startPoint = pointData;
            console.log(`✓ Starting from ${pointData.id}`);

            // Audio feedback - wire initiated
            this.playStartSound();

            // Visual feedback - brief flash on start point
            this.showStartFeedback(pointData);

            // Start live preview - show cursor and preview line
            this.startLivePreview();

            // Show info panel
            this.app.infoPanel.textContent = `Routing mode: ${this.routingMode.toUpperCase()} (Press M/S to change). Click to add waypoints.`;

            return true; // Handled
        } else {
            // Second click - must be the OTHER endpoint
            const otherEndpoint = (this.startPoint.id === currentWire.from) ?
                                  currentWire.to : currentWire.from;

            if (pointData.id === otherEndpoint) {
                // Valid completion!
                this.completeCurrentWire(this.startPoint, pointData);
                return true;
            } else if (isValidEndpoint) {
                // Clicked same endpoint again
                console.warn(`⚠️  Please click on ${otherEndpoint} to complete the wire`);
                return true;
            } else {
                // Clicked somewhere else - add waypoint
                this.addWaypoint(pointData);
                return true;
            }
        }
    }

    /**
     * Add a waypoint to the current wire path
     * @param {Object} pointData - Waypoint position
     */
    addWaypoint(pointData) {
        this.waypoints.push(pointData);
        console.log(`  + Waypoint added at ${pointData.id || `(${pointData.x}, ${pointData.y})`}`);

        // Update preview to show path so far
        this.updatePreview();
    }

    /**
     * Update preview visualization showing path from start through waypoints
     */
    updatePreview() {
        if (!this.startPoint) return;

        // Clear existing preview
        this.clearPreview();

        // Create preview polyline
        this.previewPolyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        this.previewPolyline.classList.add('wire-temp', 'wire-preview');

        // Build points string: start -> waypoint1 -> waypoint2 -> ...
        let points = `${this.startPoint.x},${this.startPoint.y}`;

        this.waypoints.forEach(waypoint => {
            points += ` ${waypoint.x},${waypoint.y}`;
        });

        this.previewPolyline.setAttribute('points', points);
        this.app.wiresLayer.appendChild(this.previewPolyline);

        // Add preview markers for waypoints
        this.waypoints.forEach((waypoint, index) => {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            marker.classList.add('waypoint-marker', 'waypoint-preview');
            marker.setAttribute('cx', waypoint.x);
            marker.setAttribute('cy', waypoint.y);
            marker.setAttribute('r', '3');
            this.app.wiresLayer.appendChild(marker);
            this.previewMarkers.push(marker);
        });
    }

    /**
     * Clear preview visualization
     */
    clearPreview() {
        if (this.previewPolyline) {
            this.previewPolyline.remove();
            this.previewPolyline = null;
        }

        this.previewMarkers.forEach(marker => marker.remove());
        this.previewMarkers = [];
    }

    /**
     * Snap coordinates to the alternate waypoint grid
     * Grid is offset by half-spacing to sit "between" breadboard holes
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @returns {Object} Snapped coordinates {x, y}
     */
    snapToWaypointGrid(x, y) {
        const { spacing, offset } = this.waypointGrid;

        // Snap to grid points offset from breadboard holes
        const snappedX = Math.round((x - offset) / spacing) * spacing + offset;
        const snappedY = Math.round((y - offset) / spacing) * spacing + offset;

        return { x: snappedX, y: snappedY };
    }

    /**
     * Start live preview - shows preview line and cursor marker following mouse
     */
    startLivePreview() {
        // Add mousemove listener
        this.mousemoveHandler = (e) => this.updateLivePreview(e);
        document.getElementById('breadboard-svg').addEventListener('mousemove', this.mousemoveHandler);
    }

    /**
     * Update live preview on mouse move
     * Shows preview line from last point to cursor + orange circle at cursor
     */
    updateLivePreview(e) {
        if (!this.startPoint) return;

        // Get SVG coordinates from mouse event
        const svg = document.getElementById('breadboard-svg');
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

        // Snap to waypoint grid
        const snapped = this.snapToWaypointGrid(svgP.x, svgP.y);

        // Get last point (either startPoint or last waypoint)
        const lastPoint = this.waypoints.length > 0 ?
                          this.waypoints[this.waypoints.length - 1] :
                          this.startPoint;

        // Update or create live preview line
        if (!this.livePreviewLine) {
            this.livePreviewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            this.livePreviewLine.classList.add('wire-temp', 'wire-live-preview');
            this.app.wiresLayer.appendChild(this.livePreviewLine);
        }

        this.livePreviewLine.setAttribute('x1', lastPoint.x);
        this.livePreviewLine.setAttribute('y1', lastPoint.y);
        this.livePreviewLine.setAttribute('x2', snapped.x);
        this.livePreviewLine.setAttribute('y2', snapped.y);

        // Update or create cursor marker
        if (!this.cursorMarker) {
            this.cursorMarker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            this.cursorMarker.classList.add('waypoint-marker', 'cursor-marker');
            this.cursorMarker.setAttribute('r', '4');  // Slightly larger than waypoint markers
            this.app.wiresLayer.appendChild(this.cursorMarker);
        }

        this.cursorMarker.setAttribute('cx', snapped.x);
        this.cursorMarker.setAttribute('cy', snapped.y);
    }

    /**
     * Stop live preview - removes preview line and cursor marker
     */
    stopLivePreview() {
        // Remove mousemove listener
        if (this.mousemoveHandler) {
            document.getElementById('breadboard-svg').removeEventListener('mousemove', this.mousemoveHandler);
            this.mousemoveHandler = null;
        }

        // Remove live preview elements
        if (this.livePreviewLine) {
            this.livePreviewLine.remove();
            this.livePreviewLine = null;
        }

        if (this.cursorMarker) {
            this.cursorMarker.remove();
            this.cursorMarker = null;
        }
    }

    /**
     * Complete the current wire
     * @param {Object} fromPoint - Starting point
     * @param {Object} toPoint - Ending point
     */
    completeCurrentWire(fromPoint, toPoint) {
        const wire = this.wireQueue[this.currentWireIndex];

        // Create the wire using app's createWire method
        // but with our waypoints if any
        this.app.createWire(fromPoint, toPoint, {
            waypoints: this.waypoints,
            routingMode: this.routingMode,
            id: wire.id,
            description: wire.description
        });

        // Stop pulsing
        this.stopPulsing();

        // Visual feedback
        this.showCompletionFeedback(toPoint);

        // Audio feedback
        this.playSuccessSound();

        // Clear preview and state
        this.clearPreview();
        this.stopLivePreview();  // Stop cursor tracking and live preview
        this.startPoint = null;
        this.waypoints = [];

        // Move to next wire
        this.currentWireIndex++;

        // Update info
        this.app.infoPanel.textContent = `Wire ${this.currentWireIndex}/${this.wireQueue.length} completed! ✓`;

        // Show next wire after brief delay
        setTimeout(() => {
            if (this.currentWireIndex < this.wireQueue.length) {
                this.showCurrentWire();
            } else {
                this.onAllWiresComplete();
            }
        }, 1000);
    }

    /**
     * Show visual feedback when wire is started
     * @param {Object} point - Starting point
     */
    showStartFeedback(point) {
        // Create temporary star/spark at starting point
        const svg = document.getElementById('breadboard-svg');
        const star = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        star.setAttribute('x', point.x);
        star.setAttribute('y', point.y);
        star.setAttribute('text-anchor', 'middle');
        star.setAttribute('font-size', '20');
        star.setAttribute('fill', '#ffaa00');  // Orange to match preview color
        star.setAttribute('font-weight', 'bold');
        star.textContent = '◆';  // Diamond/spark symbol
        star.style.opacity = '1';

        svg.appendChild(star);

        // Fade out and remove
        setTimeout(() => {
            star.style.transition = 'opacity 0.3s';
            star.style.opacity = '0';
            setTimeout(() => star.remove(), 300);
        }, 300);
    }

    /**
     * Show visual feedback when wire is completed
     * @param {Object} point - Completion point
     */
    showCompletionFeedback(point) {
        // Create temporary checkmark at completion point
        const svg = document.getElementById('breadboard-svg');
        const checkmark = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        checkmark.setAttribute('x', point.x);
        checkmark.setAttribute('y', point.y);
        checkmark.setAttribute('text-anchor', 'middle');
        checkmark.setAttribute('font-size', '24');
        checkmark.setAttribute('fill', '#4CAF50');
        checkmark.setAttribute('font-weight', 'bold');
        checkmark.textContent = '✓';
        checkmark.style.opacity = '1';

        svg.appendChild(checkmark);

        // Fade out and remove
        setTimeout(() => {
            checkmark.style.transition = 'opacity 0.5s';
            checkmark.style.opacity = '0';
            setTimeout(() => checkmark.remove(), 500);
        }, 500);
    }

    /**
     * Called when all wires are completed
     */
    onAllWiresComplete() {
        this.isActive = false;

        console.log('\n🎉 All Wires Completed!');
        console.log(`   Total wires placed: ${this.wireQueue.length}`);

        this.app.infoPanel.textContent = `All wires completed! Circuit ready. 🎉`;

        // Clear wire instruction display
        this.clearWireInstruction();

        // Play completion fanfare
        this.playCompletionFanfare();
    }

    /**
     * Play fanfare sound for completing all wires
     */
    playCompletionFanfare() {
        if (!this.audioContext) return;

        const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C chord
        notes.forEach((freq, i) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);

                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
            }, i * 100);
        });
    }

    /**
     * Clear all waypoints
     */
    clearWaypoints() {
        this.waypoints = [];
        // TODO: Clear visual waypoint markers
    }

    /**
     * Update routing mode display in UI
     */
    updateRoutingModeDisplay() {
        const modeText = this.routingMode === 'manhattan' ?
                         '📐 Manhattan (90°)' : '📏 Straight';
        this.app.infoPanel.textContent = `Routing: ${modeText} (Press M/S to change)`;
    }

    /**
     * Update wire instruction display
     * Shows the current wire information and description in the info panel
     * @param {Object} wire - Current wire to display
     */
    updateWireInstruction(wire) {
        const wireInstructionDiv = document.getElementById('wire-instruction');

        if (!wireInstructionDiv) {
            console.warn('wire-instruction element not found in DOM');
            return;
        }

        // Build instruction text
        const wireNumber = `Wire ${this.currentWireIndex + 1}/${this.wireQueue.length}`;
        const connection = `${wire.from} → ${wire.to}`;
        const description = wire.description || 'Connect the pulsing endpoints';

        // Update the display
        wireInstructionDiv.innerHTML = `
            <strong>${wireNumber}:</strong> ${connection}<br>
            <span class="wire-desc">${description}</span>
        `;
        wireInstructionDiv.style.display = 'block';
    }

    /**
     * Clear wire instruction display
     */
    clearWireInstruction() {
        const wireInstructionDiv = document.getElementById('wire-instruction');
        if (wireInstructionDiv) {
            wireInstructionDiv.style.display = 'none';
            wireInstructionDiv.innerHTML = '';
        }
    }

    /**
     * Get current wire being placed
     * @returns {Object|null} Current wire or null
     */
    getCurrentWire() {
        if (this.currentWireIndex >= this.wireQueue.length) {
            return null;
        }
        return this.wireQueue[this.currentWireIndex];
    }

    /**
     * Get progress info
     * @returns {Object} { current, total, percentage }
     */
    getProgress() {
        return {
            current: this.currentWireIndex,
            total: this.wireQueue.length,
            percentage: this.wireQueue.length > 0 ?
                       (this.currentWireIndex / this.wireQueue.length * 100).toFixed(1) : 0
        };
    }
}

// Export for use in app.js
console.log('GuidedWiringManager loaded');
