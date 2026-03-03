/**
 * Guided Wiring App - Dedicated application for guided wiring mode
 * Separated from Circuit Explorer for clean event handling
 */
class GuidedWiringApp {
    constructor() {
        this.svg = document.getElementById('breadboard-svg');
        this.holesLayer = document.getElementById('holes-layer');
        this.wiresLayer = document.getElementById('wires-layer');
        this.labelsLayer = document.getElementById('labels-layer');
        this.picoPinsLayer = document.getElementById('pico-pins-layer');
        this.infoPanel = document.getElementById('hover-info');
        this.wireCount = document.getElementById('wire-count');

        // Merge breadboard holes and Pico pins into unified connection points
        this.connectablePoints = [
            ...BREADBOARD_HOLES,
            ...PICO_PINS
        ];

        // Build lookup map for fast access
        this.pointsById = new Map();
        this.connectablePoints.forEach(pt => {
            this.pointsById.set(pt.id, pt);
        });

        // Keep separate reference for breadboard-specific operations
        this.holes = BREADBOARD_HOLES;
        this.picoPins = PICO_PINS;

        this.wires = [];
        this.selectedPoint = null;
        this.tempWire = null;
        this.showLabels = false;

        // Component metadata (loaded async)
        this.picoMetadata = null;

        // Guided wiring system (initialized after DOM is ready)
        this.guidedWiring = null;

        this.init();
    }

    async init() {
        await this.loadComponentMetadata();
        this.circuitLoader = new CircuitLoader(this);
        await this.circuitLoader.init();
        this.guidedWiring = new GuidedWiringManager(this);
        console.log('✓ GuidedWiringManager instantiated:', this.guidedWiring);

        this.renderHoles();
        this.renderPicoPins();
        this.attachEventListeners();
        this.updateWireCount();
    }

    async loadComponentMetadata() {
        try {
            const response = await fetch('components/microcontrollers/pico.json');
            if (!response.ok) {
                throw new Error('Failed to load pico.json');
            }
            const data = await response.json();
            this.picoMetadata = data.component;
            console.log('✓ Pico metadata loaded:', Object.keys(this.picoMetadata.pins).length, 'pins');
        } catch (error) {
            console.error('Error loading Pico metadata:', error);
            this.picoMetadata = null;
        }
    }

    renderHoles() {
        this.holes.forEach(hole => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('hole');
            group.setAttribute('data-hole-id', hole.id);

            // Add type-specific class
            if (hole.type === 'power') {
                group.classList.add('power-rail');
            } else if (hole.type === 'ground') {
                group.classList.add('ground-rail');
            }

            // Create circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', hole.x);
            circle.setAttribute('cy', hole.y);
            circle.setAttribute('r', BREADBOARD_CONFIG.grid.hole_radius);
            group.appendChild(circle);

            // Create label (initially hidden)
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.classList.add('label');
            label.setAttribute('x', hole.x);
            label.setAttribute('y', hole.y - 2);
            label.setAttribute('text-anchor', 'middle');
            label.textContent = hole.id;
            label.style.display = 'none';
            this.labelsLayer.appendChild(label);

            // Store reference
            group._holeData = hole;
            group._label = label;

            this.holesLayer.appendChild(group);
        });
    }

    renderPicoPins() {
        if (!this.picoPinsLayer) {
            console.error('Pico pins layer not found in DOM');
            return;
        }

        this.picoPins.forEach(pinPos => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('pin');
            group.setAttribute('data-pin-id', pinPos.id);

            // Get metadata from pico.json
            const pinMeta = this.picoMetadata?.pins[pinPos.pinKey];

            // Add type-specific class for styling
            if (pinMeta) {
                group.classList.add(`pin-${pinMeta.electricalType}`);
                if (pinMeta.pwmCapable) {
                    group.classList.add('pwm-capable');
                }
            }

            // Create SQUARE overlay
            const square = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            square.setAttribute('x', pinPos.x - 1.5);
            square.setAttribute('y', pinPos.y - 1.5);
            square.setAttribute('width', 3);
            square.setAttribute('height', 3);
            square.setAttribute('rx', 0.3);
            group.appendChild(square);

            // Create label (initially hidden)
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.classList.add('label');
            label.setAttribute('x', pinPos.x);
            label.setAttribute('y', pinPos.y - 3);
            label.setAttribute('text-anchor', 'middle');
            label.textContent = pinMeta ? pinMeta.name : pinPos.pinKey;
            label.style.display = 'none';
            this.labelsLayer.appendChild(label);

            // Store references
            group._pinData = {
                ...pinPos,
                metadata: pinMeta
            };
            group._label = label;

            this.picoPinsLayer.appendChild(group);
        });

        console.log('✓ Rendered', this.picoPins.length, 'Pico pins');
    }

    attachEventListeners() {
        // Hole interactions
        this.holesLayer.addEventListener('mouseenter', (e) => {
            if (e.target.closest('.hole')) {
                this.handleHoleHover(e.target.closest('.hole'));
            }
        }, true);

        this.holesLayer.addEventListener('click', (e) => {
            if (e.target.closest('.hole')) {
                this.handleHoleClick(e.target.closest('.hole'));
            }
        });

        // Pico pin interactions
        this.picoPinsLayer.addEventListener('mouseenter', (e) => {
            if (e.target.closest('.pin')) {
                this.handlePinHover(e.target.closest('.pin'));
            }
        }, true);

        this.picoPinsLayer.addEventListener('click', (e) => {
            if (e.target.closest('.pin')) {
                this.handlePinClick(e.target.closest('.pin'));
            }
        });

        // Mouse move for temporary wire
        this.svg.addEventListener('mousemove', (e) => {
            if (this.selectedPoint) {
                this.updateTempWire(e);
            }
        });

        // SVG click handler - handles guided wiring waypoints or background click
        this.svg.addEventListener('click', (e) => {
            // Check if guided wiring is active and wire has been started
            if (this.guidedWiring && this.guidedWiring.isActive && this.guidedWiring.startPoint) {
                // Don't handle if clicking on a hole or pin
                if (!e.target.closest('.hole') && !e.target.closest('.pin')) {
                    // Get SVG coordinates from click event
                    const pt = this.svg.createSVGPoint();
                    pt.x = e.clientX;
                    pt.y = e.clientY;
                    const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());

                    // Snap to waypoint grid
                    const snapped = this.guidedWiring.snapToWaypointGrid(svgP.x, svgP.y);

                    // Add waypoint at snapped position
                    this.guidedWiring.addWaypoint(snapped);
                    return;
                }
            }

            // Original behavior - clear selection on background click
            if (e.target === this.svg) {
                this.clearSelection();
            }
        });

        // Control buttons
        document.getElementById('clear-wires').addEventListener('click', () => {
            this.clearAllWires();
        });

        document.getElementById('toggle-labels').addEventListener('click', () => {
            this.toggleLabels();
        });
    }

    handleHoleHover(holeElement) {
        const hole = holeElement._holeData;
        const typeInfo = hole.type === 'main' ? 'Main Grid' :
                        hole.type === 'power' ? 'Power Rail (+)' : 'Ground Rail (-)';
        this.infoPanel.textContent =
            `Hole: ${hole.id} | Type: ${typeInfo} | Position: (${hole.x.toFixed(2)}, ${hole.y.toFixed(2)}) | Bus: ${hole.bus}`;
    }

    handlePinHover(pinElement) {
        const pin = pinElement._pinData;
        const meta = pin.metadata;

        if (meta) {
            const typeInfo = meta.electricalType === 'gpio' ? 'GPIO' :
                            meta.electricalType === 'ground' ? 'Ground' :
                            meta.electricalType === 'power' ? 'Power' :
                            meta.electricalType === 'input' ? 'Input' :
                            meta.electricalType;

            const pwmInfo = meta.pwmCapable ? ` | PWM: ${meta.pwmChannel}` : '';

            this.infoPanel.textContent =
                `Pin: ${meta.name} (${meta.number}) | ${typeInfo}${pwmInfo} | ${meta.description}`;
        } else {
            this.infoPanel.textContent =
                `Pin: ${pin.id} | Position: (${pin.x.toFixed(2)}, ${pin.y.toFixed(2)})`;
        }
    }

    handleHoleClick(holeElement) {
        this.handleConnectionPointClick(holeElement, holeElement._holeData);
    }

    handlePinClick(pinElement) {
        this.handleConnectionPointClick(pinElement, pinElement._pinData);
    }

    handleConnectionPointClick(element, pointData) {
        // Check if guided wiring mode is active
        if (this.guidedWiring && this.guidedWiring.isActive) {
            const handled = this.guidedWiring.handlePointClick(pointData);
            if (handled) {
                return; // Guided wiring handled the click
            }
        }

        if (!this.selectedPoint) {
            // First click - check if starting point is available
            if (!pointData.id.includes('.')) {  // Breadboard hole
                if (!isHoleAvailable(pointData.id)) {
                    const alternatives = suggestAlternativeHoles(pointData.id);

                    if (alternatives.length > 0) {
                        highlightAlternativeHoles(alternatives.map(h => h.id));
                        this.infoPanel.textContent =
                            `❌ Hole ${pointData.id} is occupied. Try nearby holes on same bus: ${alternatives.slice(0, 3).map(h => h.id).join(', ')}${alternatives.length > 3 ? '...' : ''}`;
                    } else {
                        this.infoPanel.textContent =
                            `❌ Hole ${pointData.id} is occupied and entire bus is full!`;
                    }
                    return;
                }
            }

            // Point is available - select it
            this.selectedPoint = pointData;
            this.selectedElement = element;
            element.classList.add('selected');

            clearAlternativeHighlights();

            const displayName = pointData.metadata ?
                `${pointData.metadata.name} (Pin ${pointData.metadata.number})` :
                pointData.id;

            this.infoPanel.textContent = `Selected: ${displayName} - Click another point to connect`;

        } else {
            // Second click - check if destination is available
            if (!pointData.id.includes('.')) {
                if (!isHoleAvailable(pointData.id)) {
                    const alternatives = suggestAlternativeHoles(pointData.id);

                    if (alternatives.length > 0) {
                        highlightAlternativeHoles(alternatives.map(h => h.id));
                        this.infoPanel.textContent =
                            `❌ Hole ${pointData.id} is occupied. Try: ${alternatives.slice(0, 3).map(h => h.id).join(', ')}`;
                    } else {
                        this.infoPanel.textContent =
                            `❌ Hole ${pointData.id} is occupied and bus is full!`;
                    }
                    return;
                }
            }

            // Both points available - create wire
            if (this.selectedPoint.id !== pointData.id) {
                this.createWire(this.selectedPoint, pointData);
            }

            this.clearSelection();
            clearAlternativeHighlights();
        }
    }

    updateTempWire(e) {
        if (!this.selectedPoint) return;

        const pt = this.svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(this.svg.getScreenCTM().inverse());

        if (!this.tempWire) {
            this.tempWire = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            this.tempWire.classList.add('wire-temp');
            this.wiresLayer.appendChild(this.tempWire);
        }

        this.tempWire.setAttribute('x1', this.selectedPoint.x);
        this.tempWire.setAttribute('y1', this.selectedPoint.y);
        this.tempWire.setAttribute('x2', svgP.x);
        this.tempWire.setAttribute('y2', svgP.y);
    }

    createWire(startPoint, endPoint, options = {}) {
        const wire = {
            id: options.id || `wire-${this.wires.length + 1}`,
            from: startPoint.id,
            to: endPoint.id,
            fromCoords: { x: startPoint.x, y: startPoint.y },
            toCoords: { x: endPoint.x, y: endPoint.y },
            waypoints: options.waypoints || [],
            routingMode: options.routingMode || 'straight',
            description: options.description || null
        };

        this.wires.push(wire);
        this.renderWire(wire);
        this.updateWireCount();

        // Mark connection points as connected
        const fromElement = this.getConnectionElement(startPoint.id);
        const toElement = this.getConnectionElement(endPoint.id);

        if (fromElement) fromElement.classList.add('connected');
        if (toElement) toElement.classList.add('connected');

        // Mark breadboard holes as physically occupied
        if (!startPoint.id.includes('.')) {
            markHoleOccupied(startPoint.id, 'wire', wire.id);
        }
        if (!endPoint.id.includes('.')) {
            markHoleOccupied(endPoint.id, 'wire', wire.id);
        }

        console.log('Wire created:', wire);
    }

    getConnectionElement(pointId) {
        let element = this.holesLayer.querySelector(`[data-hole-id="${pointId}"]`);
        if (element) return element;

        element = this.picoPinsLayer.querySelector(`[data-pin-id="${pointId}"]`);
        return element;
    }

    renderWire(wire) {
        if (wire.waypoints && wire.waypoints.length > 0) {
            const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
            polyline.classList.add('wire');
            polyline.setAttribute('data-wire-id', wire.id);

            let points = `${wire.fromCoords.x},${wire.fromCoords.y}`;
            wire.waypoints.forEach(waypoint => {
                points += ` ${waypoint.x},${waypoint.y}`;
            });
            points += ` ${wire.toCoords.x},${wire.toCoords.y}`;
            polyline.setAttribute('points', points);

            this.wiresLayer.appendChild(polyline);
            this.renderWaypointMarkers(wire);
        } else {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.classList.add('wire');
            line.setAttribute('x1', wire.fromCoords.x);
            line.setAttribute('y1', wire.fromCoords.y);
            line.setAttribute('x2', wire.toCoords.x);
            line.setAttribute('y2', wire.toCoords.y);
            line.setAttribute('data-wire-id', wire.id);
            this.wiresLayer.appendChild(line);
        }
    }

    renderWaypointMarkers(wire) {
        wire.waypoints.forEach((waypoint, index) => {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            marker.classList.add('waypoint-marker');
            marker.setAttribute('cx', waypoint.x);
            marker.setAttribute('cy', waypoint.y);
            marker.setAttribute('r', '3');
            marker.setAttribute('data-wire-id', wire.id);
            marker.setAttribute('data-waypoint-index', index);
            this.wiresLayer.appendChild(marker);
        });
    }

    clearSelection() {
        if (this.selectedPoint && this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.selectedPoint = null;
            this.selectedElement = null;
        }

        if (this.tempWire) {
            this.tempWire.remove();
            this.tempWire = null;
        }

        this.infoPanel.textContent = 'Hover over connection points to see info';
    }

    clearAllWires() {
        document.querySelectorAll('.hole.occupied[data-occupant-type="wire"]').forEach(holeElement => {
            const holeId = holeElement.getAttribute('data-hole-id');
            clearHoleOccupation(holeId);
        });

        this.wires = [];
        this.wiresLayer.innerHTML = '';

        document.querySelectorAll('.hole.connected, .pin.connected').forEach(element => {
            element.classList.remove('connected');
        });

        clearAlternativeHighlights();
        this.updateWireCount();
        console.log('All wires cleared');
    }

    toggleLabels() {
        this.showLabels = !this.showLabels;
        document.querySelectorAll('.label').forEach(label => {
            label.style.display = this.showLabels ? 'block' : 'none';
        });
    }

    updateWireCount() {
        this.wireCount.textContent = `Wires: ${this.wires.length}`;
    }

    exportCircuit() {
        return {
            breadboard: BREADBOARD_CONFIG,
            wires: this.wires,
            timestamp: new Date().toISOString()
        };
    }

    showComponentInfo(componentId, metadata, placement, position) {
        const infoBox = document.getElementById('component-info-box');
        const infoTitle = document.getElementById('info-box-title');
        const infoDetails = document.getElementById('info-box-details');

        infoTitle.textContent = `${componentId.toUpperCase()}`;

        let detailsHTML = '';

        if (metadata && metadata.name) {
            detailsHTML += `<div class="info-section">
                <span class="info-label">Type:</span>
                <span class="info-value">${metadata.name}</span>
            </div>`;
        }

        if (metadata && metadata.description) {
            detailsHTML += `<div class="info-section">
                <span class="info-label">Description:</span>
                <span class="info-value">${metadata.description}</span>
            </div>`;
        }

        if (placement) {
            detailsHTML += `<div class="info-section">
                <span class="info-label">Placement:</span>
                <ul>`;
            for (const [pin, location] of Object.entries(placement)) {
                if (pin !== 'position') {
                    detailsHTML += `<li>${pin}: ${location}</li>`;
                }
            }
            detailsHTML += `</ul></div>`;
        }

        if (metadata && metadata.properties) {
            const props = metadata.properties;
            detailsHTML += `<div class="info-section">
                <span class="info-label">Electrical:</span>
                <ul>`;

            if (props.forward_voltage) {
                detailsHTML += `<li>Forward voltage: ${props.forward_voltage}</li>`;
            }
            if (props.max_current) {
                detailsHTML += `<li>Max current: ${props.max_current}</li>`;
            }
            if (props.resistance) {
                detailsHTML += `<li>Resistance: ${props.resistance}</li>`;
            }
            if (props.power_rating) {
                detailsHTML += `<li>Power rating: ${props.power_rating}</li>`;
            }
            if (props.color) {
                detailsHTML += `<li>Color: ${props.color}</li>`;
            }

            detailsHTML += `</ul></div>`;
        }

        infoDetails.innerHTML = detailsHTML;

        if (position) {
            const svg = this.svg;
            const svgRect = svg.getBoundingClientRect();
            const container = document.getElementById('breadboard-container');
            const containerRect = container.getBoundingClientRect();

            const viewBox = svg.viewBox.baseVal;
            const scaleX = svgRect.width / viewBox.width;
            const scaleY = svgRect.height / viewBox.height;

            const screenX = containerRect.left + (position.centerX * scaleX) + 30;
            const screenY = containerRect.top + (position.centerY * scaleY) - 20;

            infoBox.style.left = `${screenX}px`;
            infoBox.style.top = `${screenY}px`;
        }

        infoBox.style.display = 'block';
    }

    hideComponentInfo() {
        const infoBox = document.getElementById('component-info-box');
        infoBox.style.display = 'none';
    }
}

// Helper functions (same as before)
function markHoleOccupied(holeId, occupantType, occupantId) {
    const holeElement = document.querySelector(`[data-hole-id="${holeId}"]`);
    if (holeElement) {
        holeElement.classList.add('occupied');
        holeElement.setAttribute('data-occupied-by', occupantId);
        holeElement.setAttribute('data-occupant-type', occupantType);
        console.log(`  Hole ${holeId} occupied by ${occupantType}: ${occupantId}`);
    }
}

function isHoleAvailable(holeId) {
    const holeElement = document.querySelector(`[data-hole-id="${holeId}"]`);
    if (!holeElement) {
        console.warn(`Hole ${holeId} not found`);
        return false;
    }
    return !holeElement.classList.contains('occupied');
}

function clearHoleOccupation(holeId) {
    const holeElement = document.querySelector(`[data-hole-id="${holeId}"]`);
    if (holeElement) {
        holeElement.classList.remove('occupied');
        holeElement.removeAttribute('data-occupied-by');
        holeElement.removeAttribute('data-occupant-type');
        console.log(`  Hole ${holeId} cleared`);
    }
}

function suggestAlternativeHoles(occupiedHoleId) {
    const hole = BREADBOARD_HOLES.find(h => h.id === occupiedHoleId);
    if (!hole || !hole.bus) {
        return [];
    }

    const alternatives = BREADBOARD_HOLES.filter(h =>
        h.bus === hole.bus &&
        h.id !== occupiedHoleId &&
        isHoleAvailable(h.id)
    );

    return alternatives;
}

function highlightAlternativeHoles(holeIds) {
    document.querySelectorAll('.bus-neighbor').forEach(el => {
        el.classList.remove('bus-neighbor');
    });

    holeIds.forEach(holeId => {
        const element = document.querySelector(`[data-hole-id="${holeId}"]`);
        if (element) {
            element.classList.add('bus-neighbor');
        }
    });
}

function clearAlternativeHighlights() {
    document.querySelectorAll('.bus-neighbor').forEach(el => {
        el.classList.remove('bus-neighbor');
    });
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.breadboardApp = new GuidedWiringApp();
    console.log('Guided Wiring app initialized');
    console.log('Total holes:', BREADBOARD_HOLES.length);
});
