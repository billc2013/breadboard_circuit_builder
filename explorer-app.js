/**
 * Explorer App - Unified Circuit Explorer
 *
 * Single unified view combining:
 * - Physical breadboard with faded background
 * - Physical Pico with real pins
 * - Bezier curve wires for visual clarity
 * - Always-visible wire labels near Pico pins
 * - Component click → highlight all connected wires + Pico pins
 * - Wire click → highlight individual wire
 */
class ExplorerApp {
    constructor() {
        this.svg = document.getElementById('breadboard-svg');
        this.holesLayer = document.getElementById('holes-layer');
        this.wiresLayer = document.getElementById('wires-layer');
        this.labelsLayer = document.getElementById('labels-layer');
        this.wireLabelsLayer = document.getElementById('wire-labels-layer');
        this.picoPinsLayer = document.getElementById('pico-pins-layer');
        this.componentsLayer = document.getElementById('components-layer');
        this.infoPanel = document.getElementById('hover-info');

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

        // Keep separate references
        this.holes = BREADBOARD_HOLES;
        this.picoPins = PICO_PINS;

        // Component metadata (loaded async)
        this.picoMetadata = null;

        // Circuit state
        this.circuitData = null;
        this.circuitLoader = null;

        // Interaction state
        this.highlightedWire = null;
        this.highlightedComponent = null;  // Currently selected component

        // Wire categorization
        this.wireCategories = {
            picoToComponent: [],
            componentToComponent: [],
            powerGround: []
        };

        // Functional groups (populated when circuit loads)
        this.functionalGroups = [];

        // Wires array (needed for CircuitLoader compatibility)
        this.wires = [];

        // Wire-to-component mapping (which wires connect to which components)
        this.wireToComponents = new Map();  // wireId -> [componentIds]
        this.componentToWires = new Map();  // componentId -> [wireIds]

        // Tooltip state
        this.tooltipElement = null;

        // Event handler references (for cleanup)
        this.boundHandleWireClick = this.handleWireClick.bind(this);
        this.boundHandleComponentClick = this.handleComponentClick.bind(this);
        this.boundHandleKeydown = this.handleKeydown.bind(this);

        this.init();
    }

    async init() {
        await this.loadComponentMetadata();
        this.circuitLoader = new CircuitLoader(this);
        await this.circuitLoader.init();

        this.renderHoles();
        this.renderPicoPins();
        this.attachEventListeners();
        this.setupKeyboardListeners();

        console.log('[Explorer] Unified explorer initialized');
    }

    async loadComponentMetadata() {
        try {
            const response = await fetch('components/microcontrollers/pico.json');
            if (!response.ok) {
                throw new Error('Failed to load pico.json');
            }
            const data = await response.json();
            this.picoMetadata = data.component;
            console.log('Pico metadata loaded:', Object.keys(this.picoMetadata.pins).length, 'pins');
        } catch (error) {
            console.error('Error loading Pico metadata:', error);
            this.picoMetadata = null;
        }
    }

    // ==================== Rendering ====================

    renderHoles() {
        this.holes.forEach(hole => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('hole');
            group.setAttribute('data-hole-id', hole.id);

            if (hole.type === 'power') {
                group.classList.add('power-rail');
            } else if (hole.type === 'ground') {
                group.classList.add('ground-rail');
            }

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', hole.x);
            circle.setAttribute('cy', hole.y);
            circle.setAttribute('r', BREADBOARD_CONFIG.grid.hole_radius);
            group.appendChild(circle);

            group._holeData = hole;
            this.holesLayer.appendChild(group);
        });
    }

    renderPicoPins() {
        if (!this.picoPinsLayer) {
            console.error('Pico pins layer not found');
            return;
        }

        this.picoPins.forEach(pinPos => {
            const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            group.classList.add('pin');
            group.setAttribute('data-pin-id', pinPos.id);

            const pinMeta = this.picoMetadata?.pins[pinPos.pinKey];

            if (pinMeta) {
                group.classList.add(`pin-${pinMeta.electricalType}`);
            }

            const square = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            square.setAttribute('x', pinPos.x - 1.5);
            square.setAttribute('y', pinPos.y - 1.5);
            square.setAttribute('width', 3);
            square.setAttribute('height', 3);
            square.setAttribute('rx', 0.3);
            group.appendChild(square);

            group._pinData = {
                ...pinPos,
                metadata: pinMeta
            };

            this.picoPinsLayer.appendChild(group);
        });

        console.log('Rendered', this.picoPins.length, 'Pico pins');
    }

    // ==================== Wire Management (CircuitLoader compatibility) ====================

    /**
     * Create a wire between two points (called by CircuitLoader)
     */
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

        console.log('[Explorer] Wire created:', wire.id);
    }

    /**
     * Render a single wire to the SVG
     */
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

    /**
     * Clear all wires (called by CircuitLoader before loading new circuit)
     */
    clearAllWires() {
        this.wires = [];
        this.wiresLayer.innerHTML = '';
        this.clearWireLabels();
        this.clearHighlights();
        this.updateWireCount();
        console.log('[Explorer] All wires cleared');
    }

    // ==================== Circuit Loading ====================

    /**
     * Load and display a circuit (called by CircuitsManager)
     * @param {Object} circuitJson - The circuit data
     */
    loadCircuit(circuitJson) {
        console.log('[Explorer] Loading circuit:', circuitJson?.circuit?.metadata?.name);

        this.circuitData = circuitJson;

        // Clear previous state
        this.clearHighlights();
        this.hideTooltip();

        // Categorize wires and build component mappings
        if (circuitJson?.circuit?.wires && circuitJson?.circuit?.components) {
            this.categorizeWires(circuitJson.circuit.wires, circuitJson.circuit.components);
            this.buildWireComponentMappings(circuitJson.circuit.wires, circuitJson.circuit.components);
            this.detectFunctionalGroups(circuitJson.circuit.components, circuitJson.circuit.wires);
        }

        // Apply visual styles
        this.applyBreadboardFade();
        this.applyWireCategories();

        // Render wire labels (always visible in unified view)
        this.renderWireLabels();

        // Enable interactions
        this.enableWireInteraction();
        this.enableComponentInteraction();

        console.log('[Explorer] Circuit loaded with', circuitJson?.circuit?.wires?.length, 'wires');
    }

    /**
     * Build mappings between wires and components
     * Used for component-click highlighting
     */
    buildWireComponentMappings(wires, components) {
        this.wireToComponents.clear();
        this.componentToWires.clear();

        // Build hole-to-component lookup
        const holeToComponent = new Map();
        for (const comp of components) {
            if (comp.placement) {
                for (const [pinName, holeId] of Object.entries(comp.placement)) {
                    if (holeId) {
                        holeToComponent.set(holeId.toUpperCase(), comp.id);
                        // Also add same-bus holes
                        this.addBusHoles(holeId, comp.id, holeToComponent);
                    }
                }
            }
        }

        // Map wires to their connected components
        for (const wire of wires) {
            const connectedComponents = new Set();

            // Check 'from' endpoint
            const fromCompId = this.findComponentForEndpoint(wire.from, holeToComponent);
            if (fromCompId) connectedComponents.add(fromCompId);

            // Check 'to' endpoint
            const toCompId = this.findComponentForEndpoint(wire.to, holeToComponent);
            if (toCompId) connectedComponents.add(toCompId);

            // Store wire -> components mapping
            this.wireToComponents.set(wire.id, Array.from(connectedComponents));

            // Store component -> wires mapping
            for (const compId of connectedComponents) {
                if (!this.componentToWires.has(compId)) {
                    this.componentToWires.set(compId, []);
                }
                this.componentToWires.get(compId).push(wire.id);
            }
        }

        console.log('[Explorer] Built wire-component mappings:',
                    this.componentToWires.size, 'components with wires');
    }

    /**
     * Add holes on the same bus to the lookup
     */
    addBusHoles(holeId, componentId, holeToComponent) {
        const match = holeId.match(/^(\d+)([A-J])$/i);
        if (!match) return;

        const col = match[1];
        const row = match[2].toUpperCase();

        // Determine which rows are on the same bus
        const topRows = ['F', 'G', 'H', 'I', 'J'];
        const bottomRows = ['A', 'B', 'C', 'D', 'E'];

        const sameBusRows = topRows.includes(row) ? topRows : bottomRows;

        // Add all holes on the same bus
        for (const r of sameBusRows) {
            const busHoleId = `${col}${r}`;
            if (!holeToComponent.has(busHoleId)) {
                holeToComponent.set(busHoleId, componentId);
            }
        }
    }

    /**
     * Find which component is connected to a wire endpoint
     */
    findComponentForEndpoint(endpoint, holeToComponent) {
        if (!endpoint) return null;

        // Direct hole reference
        const normalized = endpoint.toUpperCase();
        if (holeToComponent.has(normalized)) {
            return holeToComponent.get(normalized);
        }

        // Pico pin - return 'pico1' as a pseudo-component
        if (this.isPicoPin(endpoint)) {
            return 'pico1';
        }

        return null;
    }

    // ==================== Wire Categorization ====================

    categorizeWires(wires, components) {
        this.wireCategories = {
            picoToComponent: [],
            componentToComponent: [],
            powerGround: []
        };

        const componentIds = new Set(components.map(c => c.id));

        for (const wire of wires) {
            const category = this.getWireCategory(wire, componentIds);
            this.wireCategories[category].push(wire.id);
        }

        console.log('[Explorer] Wire categories:', {
            picoToComponent: this.wireCategories.picoToComponent.length,
            componentToComponent: this.wireCategories.componentToComponent.length,
            powerGround: this.wireCategories.powerGround.length
        });
    }

    getWireCategory(wire, componentIds) {
        const fromIsPico = this.isPicoPin(wire.from);
        const toIsPico = this.isPicoPin(wire.to);
        const fromIsPowerGround = this.isPowerOrGround(wire.from);
        const toIsPowerGround = this.isPowerOrGround(wire.to);

        if (fromIsPowerGround || toIsPowerGround) {
            return 'powerGround';
        }

        if (fromIsPico || toIsPico) {
            return 'picoToComponent';
        }

        return 'componentToComponent';
    }

    isPicoPin(pointId) {
        if (!pointId) return false;
        const normalized = pointId.toLowerCase();
        return normalized.startsWith('pico') && normalized.includes('.');
    }

    isPowerOrGround(pointId) {
        if (!pointId) return false;
        const normalized = pointId.toUpperCase();

        if (normalized.includes('GND') ||
            normalized.includes('3V3') ||
            normalized.includes('VBUS') ||
            normalized.includes('VSYS')) {
            return true;
        }

        if (/^[WXYZ]\d+$/i.test(pointId)) {
            return true;
        }

        return false;
    }

    // ==================== Functional Groups ====================

    /**
     * Detect functional groups from component metadata
     * Groups include primary components (LED, button) and their support components (resistors)
     * based on the 'requires' field in component JSON functionalGroup metadata
     * @param {Array} components - Circuit components
     * @param {Array} wires - Circuit wires
     */
    detectFunctionalGroups(components, wires) {
        this.functionalGroups = [];
        this.componentToGroup = new Map();  // Maps any component ID to its group

        // Build bus connectivity map for finding support components
        const holeToBus = new Map();
        for (const hole of this.holes) {
            if (hole.bus) {
                holeToBus.set(hole.id.toUpperCase(), hole.bus);
            }
        }

        // Build component placement lookup - which holes each component occupies (including bus-connected)
        const componentHoles = new Map();  // componentId -> Set of hole IDs
        for (const comp of components) {
            const holes = new Set();
            if (comp.placement) {
                for (const [pinName, holeId] of Object.entries(comp.placement)) {
                    if (holeId && typeof holeId === 'string') {
                        const normalizedHole = holeId.toUpperCase();
                        holes.add(normalizedHole);
                        // Add all holes on same bus
                        const bus = holeToBus.get(normalizedHole);
                        if (bus) {
                            for (const [h, b] of holeToBus) {
                                if (b === bus) holes.add(h);
                            }
                        }
                    }
                }
            }
            componentHoles.set(comp.id, holes);
        }

        // For each component with functionalGroup metadata, build the group
        for (const component of components) {
            const metadata = this.circuitLoader?.renderedComponents?.get(component.id)?.metadata;

            if (metadata?.functionalGroup) {
                const group = {
                    id: `${component.id}-group`,
                    label: metadata.functionalGroup.groupLabel || component.id,
                    primaryComponent: component.id,
                    primaryMetadata: metadata,
                    allComponents: [component.id],  // All components in this group
                    supportComponents: [],
                    wires: [],
                    wireLabels: metadata.functionalGroup.wireLabels || {}
                };

                // Find support components based on 'requires' in metadata
                const requires = metadata.functionalGroup.requires || [];
                for (const req of requires) {
                    // Find resistors (or other support components) that share a bus with primary
                    const primaryHoles = componentHoles.get(component.id);

                    for (const otherComp of components) {
                        if (otherComp.id === component.id) continue;

                        // Check if this component matches the required type
                        const otherType = otherComp.type?.toLowerCase() || '';
                        if (req.type === 'resistor' && otherType.includes('resistor')) {
                            // Check if it shares a bus with the primary component
                            const otherHoles = componentHoles.get(otherComp.id);
                            const sharesConnection = [...primaryHoles].some(h => otherHoles.has(h));

                            if (sharesConnection) {
                                group.supportComponents.push(otherComp.id);
                                group.allComponents.push(otherComp.id);
                                console.log(`[Explorer] Found support component ${otherComp.id} for ${component.id}`);
                            }
                        }
                    }
                }

                // Find all wires connected to ANY component in this group
                for (const compId of group.allComponents) {
                    const compData = components.find(c => c.id === compId);
                    if (!compData?.placement) continue;

                    const compHoles = componentHoles.get(compId);

                    for (const wire of wires) {
                        // Check if wire connects to this component's holes/buses
                        const fromNorm = wire.from?.toUpperCase();
                        const toNorm = wire.to?.toUpperCase();

                        const fromConnects = compHoles.has(fromNorm) || this.wireEndpointOnBus(wire.from, compHoles, holeToBus);
                        const toConnects = compHoles.has(toNorm) || this.wireEndpointOnBus(wire.to, compHoles, holeToBus);

                        if ((fromConnects || toConnects) && !group.wires.includes(wire.id)) {
                            group.wires.push(wire.id);
                        }
                    }
                }

                if (group.wires.length > 0) {
                    this.functionalGroups.push(group);

                    // Map all components in group back to the group
                    for (const compId of group.allComponents) {
                        this.componentToGroup.set(compId, group);
                    }

                    console.log(`[Explorer] Functional group "${group.label}":`,
                               group.allComponents.join(', '),
                               `| ${group.wires.length} wires`);
                }
            }
        }

        console.log('[Explorer] Total functional groups:', this.functionalGroups.length);
    }

    /**
     * Check if a wire endpoint is on a bus that connects to component holes
     */
    wireEndpointOnBus(endpoint, compHoles, holeToBus) {
        if (!endpoint || this.isPicoPin(endpoint)) return false;
        const norm = endpoint.toUpperCase();
        const bus = holeToBus.get(norm);
        if (!bus) return false;
        // Check if any compHole shares this bus
        for (const h of compHoles) {
            if (holeToBus.get(h) === bus) return true;
        }
        return false;
    }

    /**
     * Find which functional group a component belongs to
     * @param {string} componentId - Component identifier
     * @returns {Object|null} Functional group or null
     */
    findGroupForComponent(componentId) {
        return this.componentToGroup.get(componentId) || null;
    }

    /**
     * Find which functional group a wire belongs to
     * @param {string} wireId - Wire identifier
     * @returns {Object|null} Functional group or null
     */
    findGroupForWire(wireId) {
        return this.functionalGroups.find(g => g.wires.includes(wireId)) || null;
    }

    // ==================== Visual Rendering ====================

    applyBreadboardFade() {
        const overlay = document.getElementById('breadboard-fade-overlay');
        if (overlay) {
            overlay.style.display = 'block';
        }
    }

    removeBreadboardFade() {
        const overlay = document.getElementById('breadboard-fade-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    applyWireCategories() {
        const categoryClassMap = {
            picoToComponent: 'category-pico-component',
            componentToComponent: 'category-component-component',
            powerGround: 'category-power-ground'
        };

        for (const [category, wireIds] of Object.entries(this.wireCategories)) {
            const cssClass = categoryClassMap[category];
            for (const wireId of wireIds) {
                const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
                if (wireElement) {
                    wireElement.classList.add(cssClass);
                }
            }
        }
    }

    updateWireVisibility() {
        const categoryKeyMap = {
            picoToComponent: 'pico-component',
            componentToComponent: 'component-component',
            powerGround: 'power-ground'
        };

        for (const [category, wireIds] of Object.entries(this.wireCategories)) {
            const isVisible = this.wireFilterState[category];
            for (const wireId of wireIds) {
                const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
                if (wireElement) {
                    wireElement.classList.toggle('hidden', !isVisible);
                }
            }
        }
    }

    // ==================== Wire Labels (Always visible near Pico) ====================

    renderWireLabels() {
        this.clearWireLabels();

        if (!this.wireLabelsLayer || !this.circuitData) return;

        const wires = this.circuitData.circuit.wires || [];

        // Render labels for all wires that connect to Pico
        for (const wire of wires) {
            // Only label wires that have a Pico endpoint
            const picoEndpoint = this.isPicoPin(wire.from) ? wire.from :
                                this.isPicoPin(wire.to) ? wire.to : null;

            if (!picoEndpoint) continue;

            const wireElement = document.querySelector(`[data-wire-id="${wire.id}"]`);
            if (!wireElement) continue;

            // Determine label text
            const labelText = this.determineLabelForWire(wire, {});
            if (!labelText) continue;

            // Position label near the Pico pin (not at wire endpoint)
            const position = this.getLabelPositionNearPico(wire, picoEndpoint);
            if (!position) continue;

            // Create label group
            const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            labelGroup.classList.add('wire-label-group');
            labelGroup.setAttribute('data-wire-id', wire.id);

            // Create background
            const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bg.classList.add('wire-label-bg');

            // Create text
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.classList.add('wire-label');
            text.setAttribute('x', position.x);
            text.setAttribute('y', position.y);
            text.textContent = labelText;

            // Add signal/ground/power class for coloring
            if (labelText.toLowerCase().includes('signal')) {
                text.classList.add('signal');
            } else if (labelText.toLowerCase().includes('ground')) {
                text.classList.add('ground');
            } else if (labelText.toLowerCase().includes('power') || labelText.toLowerCase().includes('3v')) {
                text.classList.add('power');
            }

            labelGroup.appendChild(bg);
            labelGroup.appendChild(text);
            this.wireLabelsLayer.appendChild(labelGroup);

            // Size background to fit text
            requestAnimationFrame(() => {
                const bbox = text.getBBox();
                bg.setAttribute('x', bbox.x - 3);
                bg.setAttribute('y', bbox.y - 2);
                bg.setAttribute('width', bbox.width + 6);
                bg.setAttribute('height', bbox.height + 4);
            });
        }
    }

    /**
     * Get position for label near the Pico pin
     */
    getLabelPositionNearPico(wire, picoEndpoint) {
        const pinName = picoEndpoint.split('.')[1];

        // Find the Pico pin coordinates
        const picoPin = this.picoPins.find(p => p.pinKey === pinName);
        if (!picoPin) return null;

        // Position label slightly offset from Pico pin
        // Labels go to the left of the Pico (since Pico is on the left side)
        return {
            x: picoPin.x - 8,  // Offset to left of pin
            y: picoPin.y + 2   // Slightly below center for readability
        };
    }

    /**
     * Determine label text for a wire based on its connections
     */
    determineLabelForWire(wire, wireLabels) {
        // Check if wire connects to Pico GPIO
        const picoEndpoint = this.isPicoPin(wire.from) ? wire.from :
                            this.isPicoPin(wire.to) ? wire.to : null;

        if (picoEndpoint) {
            const pinName = picoEndpoint.split('.')[1];
            const pinMeta = this.picoMetadata?.pins?.[pinName];

            if (pinMeta?.electricalType === 'gpio') {
                return `Signal ${pinMeta.name}`;
            }
            if (pinMeta?.electricalType === 'ground') {
                return 'Ground';
            }
            if (pinMeta?.electricalType === 'power') {
                return `Power ${pinMeta.name}`;
            }
        }

        // Check power/ground rails
        if (this.isPowerOrGround(wire.from) || this.isPowerOrGround(wire.to)) {
            const endpoint = this.isPowerOrGround(wire.from) ? wire.from : wire.to;
            if (endpoint.toUpperCase().includes('GND') || /^[YZ]\d+$/i.test(endpoint)) {
                return 'Ground';
            }
            if (endpoint.toUpperCase().includes('3V3') || /^[WX]\d+$/i.test(endpoint)) {
                return 'Power 3.3V';
            }
        }

        return null;
    }

    getWireEndpointPosition(wireElement) {
        let x, y;

        if (wireElement.tagName === 'line') {
            // Use the endpoint farther from Pico (usually x2, y2)
            x = parseFloat(wireElement.getAttribute('x2'));
            y = parseFloat(wireElement.getAttribute('y2')) - 4;
        } else if (wireElement.tagName === 'polyline') {
            const points = wireElement.getAttribute('points').split(' ');
            const lastPoint = points[points.length - 1].split(',');
            x = parseFloat(lastPoint[0]);
            y = parseFloat(lastPoint[1]) - 4;
        }

        return x !== undefined ? { x, y } : null;
    }

    clearWireLabels() {
        if (this.wireLabelsLayer) {
            this.wireLabelsLayer.innerHTML = '';
        }
    }

    // ==================== Wire Interaction ====================

    enableWireInteraction() {
        if (this.wiresLayer) {
            this.wiresLayer.addEventListener('click', this.boundHandleWireClick);
        }
    }

    disableWireInteraction() {
        if (this.wiresLayer) {
            this.wiresLayer.removeEventListener('click', this.boundHandleWireClick);
        }
    }

    handleWireClick(event) {
        const wireElement = event.target.closest('.wire');
        if (!wireElement) return;

        const wireId = wireElement.getAttribute('data-wire-id');
        if (!wireId) return;

        console.log('[Explorer] Wire clicked:', wireId);

        // Clear any component highlight first
        if (this.highlightedComponent) {
            this.unhighlightComponent(this.highlightedComponent);
            this.highlightedComponent = null;
        }

        this.handleSingleWireClick(wireId);
    }

    handleSingleWireClick(wireId) {
        // Unhighlight previous wire
        if (this.highlightedWire && this.highlightedWire !== wireId) {
            this.unhighlightWire(this.highlightedWire);
        }

        // Toggle highlight
        if (this.highlightedWire === wireId) {
            this.unhighlightWire(wireId);
            this.highlightedWire = null;
            this.hideTooltip();
        } else {
            this.highlightWire(wireId);
            this.highlightedWire = wireId;
        }
    }

    // ==================== Component Interaction ====================

    enableComponentInteraction() {
        if (this.componentsLayer) {
            this.componentsLayer.addEventListener('click', this.boundHandleComponentClick);
        }
    }

    disableComponentInteraction() {
        if (this.componentsLayer) {
            this.componentsLayer.removeEventListener('click', this.boundHandleComponentClick);
        }
    }

    handleComponentClick(event) {
        const componentElement = event.target.closest('.component');
        if (!componentElement) return;

        const componentId = componentElement.getAttribute('data-component-id');
        if (!componentId) return;

        console.log('[Explorer] Component clicked:', componentId);

        // Clear any wire-only highlight first
        if (this.highlightedWire) {
            this.unhighlightWire(this.highlightedWire);
            this.highlightedWire = null;
            this.hideTooltip();
        }

        // Toggle component highlight
        if (this.highlightedComponent === componentId) {
            this.unhighlightComponent(componentId);
            this.highlightedComponent = null;
        } else {
            // Unhighlight previous component
            if (this.highlightedComponent) {
                this.unhighlightComponent(this.highlightedComponent);
            }
            this.highlightComponent(componentId);
            this.highlightedComponent = componentId;
        }
    }

    /**
     * Highlight a component and its entire functional group
     * (all components in group, all wires, all Pico pins)
     */
    highlightComponent(componentId) {
        console.log('[Explorer] Highlighting component:', componentId);

        // Check if this component belongs to a functional group
        const group = this.findGroupForComponent(componentId);

        if (group) {
            // Highlight the entire functional group
            console.log(`[Explorer] Highlighting functional group "${group.label}":`, group.allComponents);

            // Highlight all components in the group
            for (const compId of group.allComponents) {
                const compElement = document.querySelector(`[data-component-id="${compId}"]`);
                if (compElement) {
                    compElement.classList.add('component-highlighted');
                }
            }

            // Highlight all wires in the group
            for (const wireId of group.wires) {
                this.highlightWire(wireId);
                this.highlightWireLabel(wireId);
            }

            // Highlight connected Pico pins
            this.highlightConnectedPicoPins(group.wires);

            // Update info panel with group info
            if (this.infoPanel) {
                const componentNames = group.allComponents.map(id => this.getComponentDisplayName(id)).join(' + ');
                this.infoPanel.textContent = `${group.label}: ${componentNames} | ${group.wires.length} wires`;
            }
        } else {
            // No functional group - just highlight this component's wires
            const wireIds = this.componentToWires.get(componentId) || [];

            // Highlight all connected wires
            for (const wireId of wireIds) {
                this.highlightWire(wireId);
                this.highlightWireLabel(wireId);
            }

            // Highlight the component itself
            const componentElement = document.querySelector(`[data-component-id="${componentId}"]`);
            if (componentElement) {
                componentElement.classList.add('component-highlighted');
            }

            // Highlight connected Pico pins
            this.highlightConnectedPicoPins(wireIds);

            // Update info panel
            if (this.infoPanel) {
                const compName = this.getComponentDisplayName(componentId);
                this.infoPanel.textContent = `${compName}: ${wireIds.length} connected wires`;
            }
        }
    }

    /**
     * Remove highlight from a component and its entire functional group
     */
    unhighlightComponent(componentId) {
        console.log('[Explorer] Unhighlighting component:', componentId);

        // Check if this component belongs to a functional group
        const group = this.findGroupForComponent(componentId);

        if (group) {
            // Unhighlight the entire functional group
            for (const compId of group.allComponents) {
                const compElement = document.querySelector(`[data-component-id="${compId}"]`);
                if (compElement) {
                    compElement.classList.remove('component-highlighted');
                }
            }

            // Unhighlight all wires in the group
            for (const wireId of group.wires) {
                this.unhighlightWire(wireId);
                this.unhighlightWireLabel(wireId);
            }
        } else {
            // No functional group - just unhighlight this component's wires
            const wireIds = this.componentToWires.get(componentId) || [];

            for (const wireId of wireIds) {
                this.unhighlightWire(wireId);
                this.unhighlightWireLabel(wireId);
            }

            const componentElement = document.querySelector(`[data-component-id="${componentId}"]`);
            if (componentElement) {
                componentElement.classList.remove('component-highlighted');
            }
        }

        // Unhighlight all Pico pins
        this.unhighlightAllPicoPins();

        // Reset info panel
        if (this.infoPanel) {
            this.infoPanel.textContent = 'Click on components or wires to explore connections';
        }
    }

    /**
     * Highlight wire label (make it bright)
     */
    highlightWireLabel(wireId) {
        const labelGroup = document.querySelector(`.wire-label-group[data-wire-id="${wireId}"]`);
        if (labelGroup) {
            labelGroup.classList.add('label-highlighted');
        }
    }

    /**
     * Unhighlight wire label (make it faded)
     */
    unhighlightWireLabel(wireId) {
        const labelGroup = document.querySelector(`.wire-label-group[data-wire-id="${wireId}"]`);
        if (labelGroup) {
            labelGroup.classList.remove('label-highlighted');
        }
    }

    /**
     * Highlight Pico pins connected to given wires
     */
    highlightConnectedPicoPins(wireIds) {
        const wires = this.circuitData?.circuit?.wires || [];

        for (const wireId of wireIds) {
            const wire = wires.find(w => w.id === wireId);
            if (!wire) continue;

            // Check both endpoints for Pico pins
            for (const endpoint of [wire.from, wire.to]) {
                if (this.isPicoPin(endpoint)) {
                    const pinName = endpoint.split('.')[1];
                    this.highlightPicoPin(pinName);
                }
            }
        }
    }

    /**
     * Highlight a specific Pico pin
     */
    highlightPicoPin(pinName) {
        // Find the pin element in pico-pins-layer
        const pinElement = document.querySelector(`[data-pin-id="pico1.${pinName}"]`);
        if (pinElement) {
            pinElement.classList.add('pin-highlighted');
        }
    }

    /**
     * Unhighlight all Pico pins
     */
    unhighlightAllPicoPins() {
        const highlightedPins = document.querySelectorAll('.pin-highlighted');
        highlightedPins.forEach(pin => pin.classList.remove('pin-highlighted'));
    }

    /**
     * Get a display-friendly name for a component
     */
    getComponentDisplayName(componentId) {
        const metadata = this.circuitLoader?.renderedComponents?.get(componentId)?.metadata;
        if (metadata?.metadata?.name) {
            return metadata.metadata.name;
        }
        // Fallback to formatted ID
        return componentId.replace(/(\d+)/, ' $1').replace(/^./, s => s.toUpperCase());
    }

    highlightWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (wireElement) {
            wireElement.classList.add('highlighted');
        }
    }

    unhighlightWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (wireElement) {
            wireElement.classList.remove('highlighted');
        }
    }

    highlightGroup(groupId) {
        const group = this.functionalGroups.find(g => g.id === groupId);
        if (!group) return;

        for (const wireId of group.wires) {
            const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
            if (wireElement) {
                wireElement.classList.add('group-highlighted');
            }
        }
    }

    unhighlightGroup(groupId) {
        const group = this.functionalGroups.find(g => g.id === groupId);
        if (!group) return;

        for (const wireId of group.wires) {
            const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
            if (wireElement) {
                wireElement.classList.remove('group-highlighted');
            }
        }
    }

    clearHighlights() {
        document.querySelectorAll('.wire.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });
        document.querySelectorAll('.wire.group-highlighted').forEach(el => {
            el.classList.remove('group-highlighted');
        });
        this.highlightedWire = null;
        this.highlightedGroup = null;
    }

    // ==================== Group Info Panel ====================

    showGroupInfo(group) {
        const panel = document.querySelector('.group-info-panel');
        if (!panel) return;

        const title = panel.querySelector('.group-info-title');
        const components = panel.querySelector('.group-info-components');

        if (title) {
            title.textContent = group.primaryMetadata?.functionalGroup?.groupLabel ||
                               group.primaryMetadata?.name ||
                               'Functional Group';
        }

        if (components) {
            components.textContent = `Primary: ${group.primaryComponent} | ${group.wires.length} wires`;
        }

        panel.classList.add('visible');
    }

    hideGroupInfo() {
        const panel = document.querySelector('.group-info-panel');
        if (panel) {
            panel.classList.remove('visible');
        }
    }

    // ==================== Educational Tooltip ====================

    showTooltip(wireId) {
        if (!wireId || !this.circuitData) return;

        const wire = this.circuitData.circuit.wires.find(w => w.id === wireId);
        if (!wire) return;

        const guideContent = this.getConnectionGuideContent(wire);

        this.tooltipElement = document.getElementById('explorer-tooltip');
        if (!this.tooltipElement) return;

        const titleEl = this.tooltipElement.querySelector('.tooltip-title');
        const purposeEl = this.tooltipElement.querySelector('.tooltip-purpose');
        const warningsEl = this.tooltipElement.querySelector('.tooltip-warnings');
        const troubleshootingEl = this.tooltipElement.querySelector('.tooltip-troubleshooting');

        if (titleEl) titleEl.textContent = guideContent.title || 'Connection Info';
        if (purposeEl) purposeEl.textContent = guideContent.purpose || '';
        if (warningsEl) {
            warningsEl.innerHTML = guideContent.warnings?.length
                ? '<strong>Warnings:</strong><ul>' +
                  guideContent.warnings.map(w => `<li>${w}</li>`).join('') + '</ul>'
                : '';
        }
        if (troubleshootingEl) {
            troubleshootingEl.innerHTML = guideContent.troubleshooting?.length
                ? '<strong>Troubleshooting:</strong><ul>' +
                  guideContent.troubleshooting.map(t => `<li>${t}</li>`).join('') + '</ul>'
                : '';
        }

        this.positionTooltipNearWire(wireId);
        this.tooltipElement.classList.add('visible');
    }

    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.classList.remove('visible');
        }
        // Also try by ID
        const tooltip = document.getElementById('explorer-tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }

    getConnectionGuideContent(wire) {
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

    findComponentConnectionGuide(wire) {
        if (!this.circuitLoader?.renderedComponents) return null;

        for (const endpoint of [wire.from, wire.to]) {
            if (endpoint?.includes('.')) {
                const [componentId, pinName] = endpoint.split('.');
                const componentData = this.circuitLoader.renderedComponents.get(componentId);

                if (componentData?.metadata?.pins?.[pinName]?.connectionGuide) {
                    return componentData.metadata.pins[pinName].connectionGuide;
                }
            }
        }

        return null;
    }

    positionTooltipNearWire(wireId) {
        const wireElement = document.querySelector(`[data-wire-id="${wireId}"]`);
        if (!wireElement || !this.tooltipElement) return;

        const position = this.getWireEndpointPosition(wireElement);
        if (!position) return;

        const svg = this.svg;
        const svgRect = svg.getBoundingClientRect();
        const viewBox = svg.viewBox.baseVal;

        const scaleX = svgRect.width / viewBox.width;
        const scaleY = svgRect.height / viewBox.height;

        const screenX = svgRect.left + (position.x * scaleX) + 20;
        const screenY = svgRect.top + (position.y * scaleY) - 60;

        this.tooltipElement.style.left = `${screenX}px`;
        this.tooltipElement.style.top = `${screenY}px`;
    }

    // ==================== Filter UI ====================

    setupFilterListeners() {
        const checkboxes = document.querySelectorAll('.wire-filter-checkbox input[type="checkbox"]');

        checkboxes.forEach(checkbox => {
            const label = checkbox.closest('.wire-filter-checkbox');
            const category = label?.getAttribute('data-category');

            if (category) {
                const categoryKey = this.filterCategoryToKey(category);
                checkbox.checked = this.wireFilterState[categoryKey];

                checkbox.addEventListener('change', (e) => {
                    this.wireFilterState[categoryKey] = e.target.checked;
                    this.updateWireVisibility();
                    console.log('[Explorer] Filter changed:', categoryKey, e.target.checked);
                });
            }
        });

        // Show filters initially (All Wires view)
        const filters = document.getElementById('wire-filters');
        if (filters) {
            filters.classList.add('visible');
        }
    }

    filterCategoryToKey(category) {
        const map = {
            'pico-component': 'picoToComponent',
            'component-component': 'componentToComponent',
            'power-ground': 'powerGround'
        };
        return map[category] || category;
    }

    // ==================== Keyboard Handling ====================

    setupKeyboardListeners() {
        document.addEventListener('keydown', this.boundHandleKeydown);
    }

    handleKeydown(event) {
        // Spacebar - toggle tooltip for highlighted wire
        if (event.code === 'Space' && this.highlightedWire) {
            event.preventDefault();
            const tooltip = document.getElementById('explorer-tooltip');
            if (tooltip?.classList.contains('visible')) {
                this.hideTooltip();
            } else {
                this.showTooltip(this.highlightedWire);
            }
        }
    }

    // ==================== UI Updates ====================

    updateWireCount() {
        if (this.wireCountDisplay && this.circuitData?.circuit?.wires) {
            this.wireCountDisplay.textContent = `Wires: ${this.circuitData.circuit.wires.length}`;
        }
    }

    updateSelectedInfo(wireId) {
        if (!this.selectedInfo) return;

        if (wireId && this.circuitData) {
            const wire = this.circuitData.circuit.wires.find(w => w.id === wireId);
            if (wire) {
                this.selectedInfo.textContent = `Selected: ${wire.from} → ${wire.to}`;
                return;
            }
        }

        this.selectedInfo.textContent = '';
    }

    // ==================== Event Listeners ====================

    attachEventListeners() {
        // Hover info for holes
        this.holesLayer.addEventListener('mouseenter', (e) => {
            if (e.target.closest('.hole')) {
                const hole = e.target.closest('.hole')._holeData;
                this.infoPanel.textContent = `Hole: ${hole.id} | Bus: ${hole.bus}`;
            }
        }, true);

        // Hover info for pins
        this.picoPinsLayer.addEventListener('mouseenter', (e) => {
            if (e.target.closest('.pin')) {
                const pin = e.target.closest('.pin')._pinData;
                const meta = pin.metadata;
                if (meta) {
                    this.infoPanel.textContent = `Pin: ${meta.name} | ${meta.description}`;
                }
            }
        }, true);
    }

    // ==================== Component Info Box ====================

    showComponentInfo(componentId, metadata, placement, position) {
        const infoBox = document.getElementById('component-info-box');
        const infoTitle = document.getElementById('info-box-title');
        const infoDetails = document.getElementById('info-box-details');

        infoTitle.textContent = componentId.toUpperCase();

        let detailsHTML = '';

        if (metadata?.name) {
            detailsHTML += `<div class="info-section">
                <span class="info-label">Type:</span>
                <span class="info-value">${metadata.name}</span>
            </div>`;
        }

        if (metadata?.description) {
            detailsHTML += `<div class="info-section">
                <span class="info-label">Description:</span>
                <span class="info-value">${metadata.description}</span>
            </div>`;
        }

        infoDetails.innerHTML = detailsHTML;

        if (position) {
            const svgRect = this.svg.getBoundingClientRect();
            const viewBox = this.svg.viewBox.baseVal;
            const scaleX = svgRect.width / viewBox.width;
            const scaleY = svgRect.height / viewBox.height;

            const screenX = svgRect.left + (position.centerX * scaleX) + 30;
            const screenY = svgRect.top + (position.centerY * scaleY) - 20;

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

// ==================== Helper Functions (CircuitLoader compatibility) ====================

/**
 * Check if a hole is available (in explorer mode, always returns true)
 * In explorer mode we're rendering complete circuits, not doing guided wiring
 */
function isHoleAvailable(holeId) {
    // In explorer mode, we trust the circuit JSON and render everything
    return true;
}

/**
 * Mark a hole as occupied (no-op in explorer mode)
 */
function markHoleOccupied(holeId, occupantType, occupantId) {
    // In explorer mode, we don't track hole occupation
    // Just log for debugging
    console.log(`[Explorer] Hole ${holeId} used by ${occupantType}: ${occupantId}`);
}

/**
 * Clear hole occupation (no-op in explorer mode)
 */
function clearHoleOccupation(holeId) {
    // No-op in explorer mode
}

/**
 * Suggest alternative holes (not needed in explorer mode)
 */
function suggestAlternativeHoles(occupiedHoleId) {
    return [];
}

/**
 * Highlight alternative holes (no-op in explorer mode)
 */
function highlightAlternativeHoles(holeIds) {
    // No-op in explorer mode
}

/**
 * Clear alternative highlights (no-op in explorer mode)
 */
function clearAlternativeHighlights() {
    // No-op in explorer mode
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.explorerApp = new ExplorerApp();
    console.log('Circuit Explorer app initialized');
});
