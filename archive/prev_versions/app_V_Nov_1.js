class BreadboardApp {
    constructor() {
        this.svg = document.getElementById('breadboard-svg');
        this.holesLayer = document.getElementById('holes-layer');
        this.wiresLayer = document.getElementById('wires-layer');
        this.labelsLayer = document.getElementById('labels-layer');
        this.picoPinsLayer = document.getElementById('pico-pins-layer'); // NEW
        this.infoPanel = document.getElementById('hover-info');
        this.wireCount = document.getElementById('wire-count');
        
        // Merge breadboard holes and Pico pins into unified connection points
        this.connectablePoints = [
            ...BREADBOARD_HOLES,
            ...PICO_PINS  // NEW
        ];
        
        // Build lookup map for fast access
        this.pointsById = new Map();
        this.connectablePoints.forEach(pt => {
            this.pointsById.set(pt.id, pt);
        });
        
        // Keep separate reference for breadboard-specific operations
        this.holes = BREADBOARD_HOLES;
        this.picoPins = PICO_PINS; // NEW
        
        this.wires = [];
        this.selectedPoint = null; // Renamed from selectedHole
        this.tempWire = null;
        this.showLabels = false;
        
        // Component metadata (loaded async)
        this.picoMetadata = null; // NEW
        
        this.init();
    }
    
async init() {
    await this.loadComponentMetadata(); // NEW - Load pico.json
    this.circuitLoader = new CircuitLoader(this);
    await this.circuitLoader.init();
    this.renderHoles();
    this.renderPicoPins(); // NEW
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
            
            // Create SQUARE overlay (not circle, per your request)
            const square = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            square.setAttribute('x', pinPos.x - 1.5);  // Center the 3x3 square
            square.setAttribute('y', pinPos.y - 1.5);
            square.setAttribute('width', 3);
            square.setAttribute('height', 3);
            square.setAttribute('rx', 0.3);  // Slight corner rounding
            group.appendChild(square);
            
            // Create label (initially hidden)
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.classList.add('label');
            label.setAttribute('x', pinPos.x);
            label.setAttribute('y', pinPos.y - 3);  // Slightly above pin
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

        // Pico pin interactions (NEW)
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
            if (this.selectedPoint) {  // ✅ FIXED
                this.updateTempWire(e);
            }
        });
        
        // Clear selection on background click
        this.svg.addEventListener('click', (e) => {
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

        // Circuit import/export buttons
    document.getElementById('load-circuit-btn')?.addEventListener('click', () => {
        document.getElementById('circuit-file-input').click();
    });

    document.getElementById('circuit-file-input')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const text = await file.text();
                const json = JSON.parse(text);
                
                console.log('📁 Loading circuit from file:', file.name);
                const result = await this.circuitLoader.loadCircuit(json);
                
                if (result.success) {
                    this.infoPanel.textContent = `✅ Circuit loaded: ${result.components} components, ${result.wires} wires`;
                } else {
                    this.infoPanel.textContent = `❌ Circuit loaded with ${result.errors.length} errors`;
                }
            } catch (error) {
                this.infoPanel.textContent = `❌ Error loading circuit: ${error.message}`;
                console.error('Circuit load error:', error);
            }
        }
        // Clear file input so same file can be loaded again
        e.target.value = '';
    });

    document.getElementById('export-circuit-btn')?.addEventListener('click', () => {
        const circuit = this.circuitLoader.exportCircuit();
        const json = JSON.stringify(circuit, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `circuit-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.infoPanel.textContent = '✅ Circuit exported';
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
        if (!this.selectedPoint) {
            // First click - check if starting point is available
            
            // Breadboard holes must be unoccupied
            if (!pointData.id.includes('.')) {  // It's a breadboard hole (not pico pin)
                if (!isHoleAvailable(pointData.id)) {
                    const alternatives = suggestAlternativeHoles(pointData.id);
                    
                    if (alternatives.length > 0) {
                        // Highlight available holes on same bus
                        highlightAlternativeHoles(alternatives.map(h => h.id));
                        
                        this.infoPanel.textContent = 
                            `❌ Hole ${pointData.id} is occupied. Try nearby holes on same bus: ${alternatives.slice(0, 3).map(h => h.id).join(', ')}${alternatives.length > 3 ? '...' : ''}`;
                    } else {
                        this.infoPanel.textContent = 
                            `❌ Hole ${pointData.id} is occupied and entire bus is full!`;
                    }
                    
                    return;  // Block selection
                }
            }
            
            // Point is available - select it
            this.selectedPoint = pointData;
            this.selectedElement = element;
            element.classList.add('selected');
            
            // Clear any alternative highlights from previous attempt
            clearAlternativeHighlights();
            
            const displayName = pointData.metadata ? 
                `${pointData.metadata.name} (Pin ${pointData.metadata.number})` : 
                pointData.id;
            
            this.infoPanel.textContent = `Selected: ${displayName} - Click another point to connect`;
            
        } else {
            // Second click - check if destination is available
            
            // Breadboard holes must be unoccupied
            if (!pointData.id.includes('.')) {  // It's a breadboard hole
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
                    
                    // Don't clear selection - let user try another hole
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

    
    createWire(startPoint, endPoint) {
        const wire = {
            id: `wire-${this.wires.length + 1}`,
            from: startPoint.id,
            to: endPoint.id,
            fromCoords: { x: startPoint.x, y: startPoint.y },
            toCoords: { x: endPoint.x, y: endPoint.y }
        };
        
        this.wires.push(wire);
        this.renderWire(wire);
        this.updateWireCount();
        
        // Mark connection points as connected (visual indicator)
        const fromElement = this.getConnectionElement(startPoint.id);
        const toElement = this.getConnectionElement(endPoint.id);
        
        if (fromElement) fromElement.classList.add('connected');
        if (toElement) toElement.classList.add('connected');
        
        // Mark breadboard holes as physically occupied by this wire
        if (!startPoint.id.includes('.')) {  // Breadboard hole (not Pico pin)
            markHoleOccupied(startPoint.id, 'wire', wire.id);
        }
        if (!endPoint.id.includes('.')) {  // Breadboard hole (not Pico pin)
            markHoleOccupied(endPoint.id, 'wire', wire.id);
        }
        
        console.log('Wire created:', wire);
    }


// Helper to find connection point element (NEW METHOD)
getConnectionElement(pointId) {
    // Try breadboard holes first
    let element = this.holesLayer.querySelector(`[data-hole-id="${pointId}"]`);
    if (element) return element;
    
    // Try Pico pins
    element = this.picoPinsLayer.querySelector(`[data-pin-id="${pointId}"]`);
    return element;
}

    
    renderWire(wire) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('wire');
        line.setAttribute('x1', wire.fromCoords.x);
        line.setAttribute('y1', wire.fromCoords.y);
        line.setAttribute('x2', wire.toCoords.x);
        line.setAttribute('y2', wire.toCoords.y);
        line.setAttribute('data-wire-id', wire.id);
        this.wiresLayer.appendChild(line);
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
        // Clear occupation for all wire-occupied holes
        document.querySelectorAll('.hole.occupied[data-occupant-type="wire"]').forEach(holeElement => {
            const holeId = holeElement.getAttribute('data-hole-id');
            clearHoleOccupation(holeId);
        });
        
        this.wires = [];
        this.wiresLayer.innerHTML = '';
        
        // Remove connected class from all connection points
        document.querySelectorAll('.hole.connected, .pin.connected').forEach(element => {
            element.classList.remove('connected');
        });
        
        // Clear any alternative highlights
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
    
    // Export circuit data as JSON
    exportCircuit() {
        return {
            breadboard: BREADBOARD_CONFIG,
            wires: this.wires,
            timestamp: new Date().toISOString()
        };
    }
}

async function testComponentRendering() {
    console.log('\n=== Testing Manual Component Rendering ===');
    
    // Load component metadata
    const ledResponse = await fetch('components/basic/led-red-5mm.json');
    const ledData = await ledResponse.json();
    const ledMeta = ledData.component;
    
    const resistorResponse = await fetch('components/basic/resistor-220.json');
    const resistorData = await resistorResponse.json();
    const resistorMeta = resistorData.component;
    
    console.log('✓ Component metadata loaded');
    
    // Test LED placement
    const ledPlacement = {
        cathode: "6J",
        anode: "7J"
    };
    
    // Test resistor placement
    const resistorPlacement = {
        pin0: "1H",
        pin1: "6H"
    };
    
    // SKIP VALIDATION FOR NOW - just calculate positions
    console.log('\n--- Calculating positions (validation skipped) ---');
    
    const ledPosition = calculateLEDPosition(ledPlacement, BREADBOARD_HOLES);
    const resistorPosition = calculateResistorPosition(resistorPlacement, BREADBOARD_HOLES);
    
    console.log('LED position:', ledPosition);
    console.log('Resistor position:', resistorPosition);
    
    if (!ledPosition || !resistorPosition) {
        console.error('❌ Position calculation failed');
        return;
    }
    
    // Render components
    await renderLEDFromSVG(ledPosition, ledMeta);
    await renderResistorFromSVG(resistorPosition, resistorMeta);
    
    console.log('\n✓ Test rendering complete');
}

// LED Rendering Function - Uses actual SVG but removes legs and adds stubs to improve rendering look -- inserted into breadboard
async function renderLEDFromSVG(position, metadata) {
    const componentsLayer = document.getElementById('components-layer');
    
    if (!componentsLayer) {
        console.error('Components layer not found');
        return;
    }
    
    // Load the LED SVG file
    const svgPath = 'components_svg/LED-5mm-red-leg.svg';
    const response = await fetch(svgPath);
    const svgText = await response.text();
    
    // Parse SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    
    if (!svgElement) {
        console.error('Failed to parse LED SVG');
        return;
    }
    
    // Extract the breadboard view
    const breadboardGroup = svgElement.querySelector('#breadboard');
    
    if (!breadboardGroup) {
        console.error('No breadboard group found in LED SVG');
        return;
    }
    
    // Create wrapper group
    const ledGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    ledGroup.classList.add('component', 'led');
    ledGroup.setAttribute('data-component-id', 'led-test');
    ledGroup.setAttribute('data-component-type', 'led-red-5mm');
    
    // Clone content
    const clonedContent = breadboardGroup.cloneNode(true);
    
    // REMOVE THE LONG LEGS - they're visual noise
    const connector0leg = clonedContent.querySelector('#connector0leg');
    const connector1leg = clonedContent.querySelector('#connector1leg');
    
    if (connector0leg) connector0leg.remove();
    if (connector1leg) connector1leg.remove();
    
    // Calculate positioning
    const scale = 0.8;  // Slightly smaller for better fit

    // LED dimensions from SVG
    const ledBodyCenterX = 11.29;   // Horizontal center of LED lens
    const ledBaseY = 40.565;         // Y position where legs start (base of lens)

    // Position LED to appear "inserted" into breadboard
    const insertionOffset = -8;  // Push LED up so base is above holes

    // Calculate transform
    const translateX = position.centerX - (ledBodyCenterX * scale);
    const translateY = position.centerY - (ledBaseY * scale) + insertionOffset;

    // Apply transform
    ledGroup.setAttribute('transform', 
        `translate(${translateX}, ${translateY}) scale(${scale})`
    );

    // Append cloned content (without legs)
    ledGroup.appendChild(clonedContent);

    // Add SHORT stub legs from holes up to LED base
    const stubLength = Math.abs(insertionOffset) + 3;  // Match insertion offset + a bit extra

    // Anode stub (from hole UP to LED body)
    const anodeStub = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    anodeStub.setAttribute('x1', position.anodeCoords.x);
    anodeStub.setAttribute('y1', position.anodeCoords.y);
    anodeStub.setAttribute('x2', position.anodeCoords.x);
    anodeStub.setAttribute('y2', position.anodeCoords.y + insertionOffset);
    anodeStub.setAttribute('stroke', '#8C8C8C');
    anodeStub.setAttribute('stroke-width', '1.5');
    anodeStub.setAttribute('stroke-linecap', 'round');

    // Cathode stub (from hole UP to LED body) - slightly darker for polarity indication
    const cathodeStub = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    cathodeStub.setAttribute('x1', position.cathodeCoords.x);
    cathodeStub.setAttribute('y1', position.cathodeCoords.y);
    cathodeStub.setAttribute('x2', position.cathodeCoords.x);
    cathodeStub.setAttribute('y2', position.cathodeCoords.y + insertionOffset);
    cathodeStub.setAttribute('stroke', '#6C6C6C');  // Darker grey for cathode
    cathodeStub.setAttribute('stroke-width', '1.5');
    cathodeStub.setAttribute('stroke-linecap', 'round');

    
    // Add stubs BEFORE the LED body (so they appear behind)
    componentsLayer.appendChild(anodeStub);
    componentsLayer.appendChild(cathodeStub);
    
    // Add LED body
    componentsLayer.appendChild(ledGroup);
    
    // Add label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', position.centerX);
    label.setAttribute('y', position.centerY - 15);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '8');
    label.setAttribute('fill', '#333');
    label.setAttribute('font-weight', 'bold');
    label.textContent = 'LED1';
    componentsLayer.appendChild(label);
    
    // Store metadata
    ledGroup._componentData = {
        position,
        metadata
    };
    
    // Mark holes as occupied
    markHoleOccupied(position.anodeHoleId, 'component', 'led-test');
    markHoleOccupied(position.cathodeHoleId, 'component', 'led-test');
    
    console.log('✓ LED SVG rendered at', position.centerX, position.centerY);
}


// Resistor Rendering Function - Uses actual SVG
async function renderResistorFromSVG(position, metadata) {
    const componentsLayer = document.getElementById('components-layer');
    
    if (!componentsLayer) {
        console.error('Components layer not found');
        return;
    }
    
    // Load the resistor SVG file
    const svgPath = 'components_svg/resistor_220.svg';
    const response = await fetch(svgPath);
    const svgText = await response.text();
    
    // Parse SVG
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    
    if (!svgElement) {
        console.error('Failed to parse resistor SVG');
        return;
    }
    
    // Extract the breadboard view
    const breadboardGroup = svgElement.querySelector('#breadboard');
    
    if (!breadboardGroup) {
        console.error('No breadboard group found in resistor SVG');
        return;
    }
    
    // Create wrapper group
    const resistorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    resistorGroup.classList.add('component', 'resistor');
    resistorGroup.setAttribute('data-component-id', 'resistor-test');
    resistorGroup.setAttribute('data-component-type', 'resistor-220');
    
    // Clone content
    const clonedContent = breadboardGroup.cloneNode(true);
    
    // Get SVG dimensions
    const viewBox = svgElement.getAttribute('viewBox').split(' ');
    const svgWidth = parseFloat(viewBox[2]);
    const svgHeight = parseFloat(viewBox[3]);
    
    // From resistor-data.js: connector positions
    const pin0X = 1.455;   // connector0leg x in SVG
    const pin1X = 41.462;  // connector1leg x in SVG
    const pinsY = 5.045;   // connector legs y in SVG (center)
    
    const svgPinSpacing = pin1X - pin0X;  // ~40mm in SVG
    const actualPinSpacing = position.actualSpacing;  // Actual spacing on breadboard
    
    // Calculate scale to match breadboard spacing
    const scale = actualPinSpacing / svgPinSpacing;
    
    // Calculate translation to center resistor between pins
    let translateX, translateY, rotation;
    
    if (position.orientation === 'horizontal') {
        // Horizontal placement
        translateX = position.pin0Coords.x - (pin0X * scale);
        translateY = position.pin0Coords.y - (pinsY * scale);
        rotation = 0;
    } else {
        // Vertical placement
        translateX = position.centerX;
        translateY = position.centerY;
        rotation = 90;
    }
    
    // Apply transform
    resistorGroup.setAttribute('transform', 
        `translate(${translateX}, ${translateY}) scale(${scale}) rotate(${rotation})`
    );
    
    // Append cloned content
    resistorGroup.appendChild(clonedContent);
    
    // Add label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', position.centerX);
    label.setAttribute('y', position.centerY - 8);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('font-size', '8');
    label.setAttribute('fill', '#333');
    label.setAttribute('font-weight', 'bold');
    label.textContent = '220Ω';
    
    // Store metadata
    resistorGroup._componentData = {
        position,
        metadata
    };
    
    componentsLayer.appendChild(resistorGroup);
    componentsLayer.appendChild(label);
    
    // Mark holes as occupied
    markHoleOccupied(position.pin0HoleId, 'component', 'resistor-test');
    markHoleOccupied(position.pin1HoleId, 'component', 'resistor-test');

    
    console.log('✓ Resistor SVG rendered at', position.centerX, position.centerY);
}

// Helper: Mark hole as physically occupied
function markHoleOccupied(holeId, occupantType, occupantId) {
    const holeElement = document.querySelector(`[data-hole-id="${holeId}"]`);
    if (holeElement) {
        holeElement.classList.add('occupied');
        holeElement.setAttribute('data-occupied-by', occupantId);
        holeElement.setAttribute('data-occupant-type', occupantType); // 'component' or 'wire'
        console.log(`  Hole ${holeId} occupied by ${occupantType}: ${occupantId}`);
    }
}

// Helper: Check if hole is physically available
function isHoleAvailable(holeId) {
    const holeElement = document.querySelector(`[data-hole-id="${holeId}"]`);
    if (!holeElement) {
        console.warn(`Hole ${holeId} not found`);
        return false;
    }
    
    const isOccupied = holeElement.classList.contains('occupied');
    return !isOccupied;
}

// Helper: Clear hole occupation (for wire deletion)
function clearHoleOccupation(holeId) {
    const holeElement = document.querySelector(`[data-hole-id="${holeId}"]`);
    if (holeElement) {
        holeElement.classList.remove('occupied');
        holeElement.removeAttribute('data-occupied-by');
        holeElement.removeAttribute('data-occupant-type');
        console.log(`  Hole ${holeId} cleared`);
    }
}

// Helper: Find available holes on same bus
function suggestAlternativeHoles(occupiedHoleId) {
    const hole = BREADBOARD_HOLES.find(h => h.id === occupiedHoleId);
    if (!hole || !hole.bus) {
        return [];
    }
    
    // Find all holes on same bus that are available
    const alternatives = BREADBOARD_HOLES.filter(h => 
        h.bus === hole.bus && 
        h.id !== occupiedHoleId &&
        isHoleAvailable(h.id)
    );
    
    return alternatives;
}

// Helper: Highlight alternative holes visually
function highlightAlternativeHoles(holeIds) {
    // Clear previous highlights
    document.querySelectorAll('.bus-neighbor').forEach(el => {
        el.classList.remove('bus-neighbor');
    });
    
    // Highlight new alternatives
    holeIds.forEach(holeId => {
        const element = document.querySelector(`[data-hole-id="${holeId}"]`);
        if (element) {
            element.classList.add('bus-neighbor');
        }
    });
}

// Helper: Clear alternative hole highlights
function clearAlternativeHighlights() {
    document.querySelectorAll('.bus-neighbor').forEach(el => {
        el.classList.remove('bus-neighbor');
    });
}


// Run test after app initializes
window.addEventListener('load', () => {
    setTimeout(() => {
        testComponentRendering();
    }, 500);  // Wait for app to fully initialize
});

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.breadboardApp = new BreadboardApp();
    console.log('Breadboard app initialized');
    console.log('Total holes:', BREADBOARD_HOLES.length);
});