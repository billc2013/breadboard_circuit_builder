/**
 * Explorer App - MicroPython Circuit Explorer
 *
 * Visualizes MicroPython code as block diagrams with:
 * - Abstract slot-based layout (sensors top, outputs bottom)
 * - Bezier curve wires from Pico pins to functional groups
 * - Component click → highlight all connected wires + Pico pins
 * - Wire hover/click → educational tooltips
 * - Faded breadboard background for visual context
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

        // Pico pins reference
        this.picoPins = PICO_PINS;

        // Component metadata (loaded async)
        this.picoMetadata = null;

        // Circuit state
        this.circuitData = null;

        // Interaction state
        this.highlightedWire = null;
        this.highlightedComponent = null;

        // Functional groups (populated when circuit loads)
        this.functionalGroups = [];

        // Wires array
        this.wires = [];

        // Tooltip state
        this.tooltipElement = null;

        // Bundled wire mode state
        this.bundledWireMode = true;
        this.groupBoundariesLayer = null;
        this.activeGroup = null;
        this.groupBoundaries = new Map();

        // Component positions cache
        this.componentPositions = new Map();

        // Abstract layout system for slot-based visualization
        this.abstractLayout = null;

        // Event handler references (for cleanup)
        this.boundHandleWireClick = this.handleWireClick.bind(this);
        this.boundHandleWireHover = this.handleWireHover.bind(this);
        this.boundHandleWireHoverEnd = this.handleWireHoverEnd.bind(this);
        this.boundHandleComponentClick = this.handleComponentClick.bind(this);
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.boundHandleGroupClick = this.handleGroupClick.bind(this);

        // Tooltip pinning state
        this.pinnedTooltips = new Set();
        this.hoveredWireId = null;

        this.init();
    }

    async init() {
        await this.loadPicoMetadata();

        // Get the group boundaries layer
        this.groupBoundariesLayer = document.getElementById('group-boundaries-layer');

        // Initialize abstract layout system (fallback)
        if (typeof AbstractLayoutSystem !== 'undefined') {
            this.abstractLayout = new AbstractLayoutSystem({
                canvasWidth: 400,
                canvasHeight: 200,
                picoAreaWidth: 85
            });
        }

        // Initialize breadboard placement system + renderer (Phase 3)
        if (typeof BreadboardPlacementSystem !== 'undefined') {
            this.placementSystem = new BreadboardPlacementSystem();
            await this.placementSystem.load();
            console.log('[Explorer] Breadboard placement system initialized');
        }

        if (typeof BreadboardRenderer !== 'undefined') {
            this.bbRenderer = new BreadboardRenderer({
                componentsLayer: this.componentsLayer,
                wiresLayer: this.wiresLayer,
                groupBoundariesLayer: this.groupBoundariesLayer,
                wireLabelsLayer: this.wireLabelsLayer,
                picoPins: this.picoPins
            });
            console.log('[Explorer] Breadboard renderer initialized');
        }

        this.renderPicoPins();
        this.attachEventListeners();
        this.setupKeyboardListeners();
        this.setupMicroPythonUI();

        // Enable bundled wire mode styling
        if (this.bundledWireMode) {
            document.body.classList.add('bundled-wire-mode');
        }

        console.log('[Explorer] Circuit Explorer initialized');
    }

    async loadPicoMetadata() {
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

    // ==================== Component Position Cache ====================

    registerComponentPosition(componentId, position) {
        if (!position) {
            console.warn(`[Explorer] Cannot register position for ${componentId}: no position data`);
            return;
        }

        let centerX, centerY;

        if (position.centerX !== undefined && position.centerY !== undefined) {
            centerX = position.centerX;
            centerY = position.centerY;
        } else if (position.center) {
            centerX = position.center.x;
            centerY = position.center.y;
        } else if (position.x !== undefined && position.y !== undefined) {
            centerX = position.x;
            centerY = position.y;
        } else {
            console.warn(`[Explorer] Unknown position format for ${componentId}:`, position);
            return;
        }

        const width = position.width || 30;
        const height = position.height || 30;

        this.componentPositions.set(componentId, {
            centerX,
            centerY,
            width,
            height,
            rawPosition: position
        });
    }

    clearComponentPositions() {
        this.componentPositions.clear();
    }

    // ==================== Utility Methods ====================

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

    findGroupForComponent(componentId) {
        return this.componentToGroup?.get(componentId) || null;
    }

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

    // ==================== Wire Interaction ====================

    enableWireInteraction() {
        if (this.wiresLayer) {
            this.wiresLayer.addEventListener('click', this.boundHandleWireClick);
            this.wiresLayer.addEventListener('mouseover', this.boundHandleWireHover);
            this.wiresLayer.addEventListener('mouseout', this.boundHandleWireHoverEnd);
        }
    }

    disableWireInteraction() {
        if (this.wiresLayer) {
            this.wiresLayer.removeEventListener('click', this.boundHandleWireClick);
            this.wiresLayer.removeEventListener('mouseover', this.boundHandleWireHover);
            this.wiresLayer.removeEventListener('mouseout', this.boundHandleWireHoverEnd);
        }
    }

    findWireElement(target) {
        return target.closest('.wire') || target.closest('.bundled-wire');
    }

    handleWireHover(event) {
        const wireElement = this.findWireElement(event.target);
        if (!wireElement) return;

        const wireId = wireElement.getAttribute('data-wire-id');
        if (!wireId) return;

        if (this.pinnedTooltips.has(wireId)) return;

        this.hoveredWireId = wireId;
        this.showTooltip(wireId);
    }

    handleWireHoverEnd(event) {
        const wireElement = this.findWireElement(event.target);
        if (!wireElement) return;

        const wireId = wireElement.getAttribute('data-wire-id');
        if (!wireId) return;

        if (this.hoveredWireId === wireId && !this.pinnedTooltips.has(wireId)) {
            this.hideTooltip();
            this.hoveredWireId = null;
        }
    }

    handleWireClick(event) {
        const wireElement = this.findWireElement(event.target);
        if (!wireElement) return;

        const wireId = wireElement.getAttribute('data-wire-id');
        if (!wireId) return;

        console.log('[Explorer] Wire clicked:', wireId);
        this.handleSingleWireClick(wireId);
    }

    handleSingleWireClick(wireId) {
        if (this.pinnedTooltips.has(wireId)) {
            this.pinnedTooltips.delete(wireId);
            this.hideTooltip();
            this.unhighlightWire(wireId);
            this.highlightedWire = null;
        } else {
            this.pinnedTooltips.add(wireId);
            this.showTooltip(wireId);
            this.highlightWire(wireId);
            this.highlightedWire = wireId;
        }
    }

    // ==================== Component Interaction ====================

    handleComponentClick(event) {
        const componentElement = event.target.closest('.component');
        if (!componentElement) return;

        const componentId = componentElement.getAttribute('data-component-id');
        if (!componentId) return;

        console.log('[Explorer] Component clicked:', componentId);

        // Redirect to group selection
        const group = this.findGroupForComponent(componentId);
        if (group) {
            this.toggleGroupHighlight(group.id);
        }
    }

    // ==================== Highlighting ====================

    highlightConnectedPicoPins(wireIds) {
        const wires = this.circuitData?.circuit?.wires || [];

        for (const wireId of wireIds) {
            const wire = wires.find(w => w.id === wireId);
            if (!wire) continue;

            for (const endpoint of [wire.from, wire.to]) {
                if (this.isPicoPin(endpoint)) {
                    const pinName = endpoint.split('.')[1];
                    this.highlightPicoPin(pinName);
                }
            }
        }
    }

    highlightPicoPin(pinName) {
        // Exact match first, then prefix match for ADC-capable pins
        // (e.g., "GP26" matches element with data-pin-id="pico1.GP26_ADC0")
        let pinElement = document.querySelector(`[data-pin-id="pico1.${pinName}"]`);
        if (!pinElement) {
            pinElement = document.querySelector(`[data-pin-id^="pico1.${pinName}_"]`);
        }
        if (pinElement) {
            pinElement.classList.add('pin-highlighted');
        }
    }

    unhighlightAllPicoPins() {
        const highlightedPins = document.querySelectorAll('.pin-highlighted');
        highlightedPins.forEach(pin => pin.classList.remove('pin-highlighted'));
    }

    getComponentDisplayName(componentId) {
        // Try to find display name from functional group metadata
        const group = this.componentToGroup?.get(componentId);
        if (group?.primaryMetadata?.metadata?.name) {
            return group.primaryMetadata.metadata.name;
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

        this.pinnedTooltips.clear();
        this.hoveredWireId = null;
    }

    // ==================== Group Info Panel ====================

    showGroupInfo(group) {
        const panel = document.querySelector('.group-info-panel');
        if (!panel) return;

        const title = panel.querySelector('.group-info-title');
        const componentsEl = panel.querySelector('.group-info-components');
        const pathsEl = panel.querySelector('.group-info-paths');

        if (title) {
            title.textContent = group.primaryMetadata?.functionalGroup?.groupLabel ||
                               group.primaryMetadata?.name ||
                               'Functional Group';
        }

        const signalPaths = this.buildSignalPaths(group);

        if (pathsEl) {
            pathsEl.innerHTML = signalPaths.map((path, index) => {
                const isLast = index === signalPaths.length - 1;
                const prefix = isLast ? '└─' : '├─';
                return `<div class="signal-path ${path.role}">${prefix} ${path.display}</div>`;
            }).join('');
        }

        if (componentsEl) {
            const compCount = group.allComponents.length;
            const wireCount = group.wires.length;
            componentsEl.textContent = compCount > 1
                ? `${compCount} components | ${wireCount} wires`
                : `${wireCount} wires`;
        }

        panel.classList.add('visible');
    }

    buildSignalPaths(group) {
        const paths = [];
        const wires = this.circuitData?.circuit?.wires || [];
        const metadata = group.primaryMetadata;
        const requires = metadata?.functionalGroup?.requires || [];
        const hasResistor = requires.some(r => r.type === 'resistor');

        for (const wireId of group.wires) {
            const wire = wires.find(w => w.id === wireId);
            if (!wire) continue;

            const electricalType = this.getWireElectricalType(wire, metadata);
            const arrow = electricalType === 'output' ? '←' : '→';

            let display = '';

            if (wire.role === 'signal') {
                const varName = wire.variableName || '';
                const gpioPin = wire.gpioPin !== null && wire.gpioPin !== undefined
                    ? `GP${wire.gpioPin}`
                    : this.extractGpioFromEndpoint(wire.from);
                const componentPin = wire.componentPinName || 'signal';

                if (hasResistor && wire.role === 'signal') {
                    display = varName
                        ? `${varName}: ${gpioPin} ${arrow} resistor ${arrow} ${componentPin}`
                        : `Signal: ${gpioPin} ${arrow} resistor ${arrow} ${componentPin}`;
                } else {
                    display = varName
                        ? `${varName}: ${gpioPin} ${arrow} ${componentPin}`
                        : `Signal: ${gpioPin} ${arrow} ${componentPin}`;
                }
            } else if (wire.role === 'ground') {
                const componentPin = wire.componentPinName || 'GND';
                display = `GND ${arrow} ${componentPin}`;
            } else if (wire.role === 'power') {
                const componentPin = wire.componentPinName || 'VCC';
                display = `3V3 ${arrow} ${componentPin}`;
            } else {
                display = wire.description || `${wire.from} ${arrow} ${wire.to}`;
            }

            paths.push({
                display,
                role: wire.role || 'signal',
                wireId: wireId,
                variableName: wire.variableName,
                gpioPin: wire.gpioPin
            });
        }

        const roleOrder = { 'signal': 0, 'power': 1, 'ground': 2 };
        paths.sort((a, b) => (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3));

        return paths;
    }

    getWireElectricalType(wire, metadata) {
        if (wire.role === 'ground') return 'ground';
        if (wire.role === 'power') return 'power';

        const pinRole = wire.pinRole || wire.to?.split('.')[1];
        if (pinRole && metadata?.pins?.[pinRole]) {
            return metadata.pins[pinRole].electricalType || 'input';
        }

        return 'input';
    }

    extractGpioFromEndpoint(endpoint) {
        if (!endpoint) return '';
        const match = endpoint.match(/GP(\d+)/i);
        return match ? `GP${match[1]}` : endpoint;
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
        const hintEl = this.tooltipElement.querySelector('.tooltip-hint');

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

        const isPinned = this.pinnedTooltips.has(wireId);
        if (hintEl) {
            hintEl.textContent = isPinned ? 'Click wire again to dismiss' : 'Click to keep visible';
        }

        if (isPinned) {
            this.tooltipElement.classList.add('pinned');
        } else {
            this.tooltipElement.classList.remove('pinned');
        }

        this.positionTooltipNearWire(wireId);
        this.tooltipElement.classList.add('visible');
        this.tooltipElement.setAttribute('data-wire-id', wireId);
    }

    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.classList.remove('visible');
        }
        const tooltip = document.getElementById('explorer-tooltip');
        if (tooltip) {
            tooltip.classList.remove('visible');
        }
    }

    getConnectionGuideContent(wire) {
        let title;
        if (wire.variableName && wire.gpioPin !== null && wire.gpioPin !== undefined) {
            title = `${wire.variableName} → GP${wire.gpioPin}`;
        } else if (wire.gpioPin !== null && wire.gpioPin !== undefined) {
            title = `GP${wire.gpioPin}`;
        } else if (wire.role === 'ground') {
            title = `GND → ${wire.componentPinName || 'Ground'}`;
        } else if (wire.role === 'power') {
            title = `3V3 → ${wire.componentPinName || 'Power'}`;
        } else {
            title = `Wire: ${wire.from} → ${wire.to}`;
        }

        const content = {
            title,
            purpose: '',
            warnings: [],
            troubleshooting: []
        };

        if (wire.connectionGuide) {
            content.purpose = wire.connectionGuide.purpose || '';
            content.warnings = wire.connectionGuide.warnings || [];
            content.troubleshooting = wire.connectionGuide.troubleshooting || [];
        } else {
            content.purpose = wire.description || 'Connection between circuit elements';
        }

        return content;
    }

    getWireEndpointPosition(wireElement) {
        let x, y;

        if (wireElement.tagName === 'line') {
            x = parseFloat(wireElement.getAttribute('x2'));
            y = parseFloat(wireElement.getAttribute('y2')) - 4;
        } else if (wireElement.tagName === 'polyline') {
            const points = wireElement.getAttribute('points').split(' ');
            const lastPoint = points[points.length - 1].split(',');
            x = parseFloat(lastPoint[0]);
            y = parseFloat(lastPoint[1]) - 4;
        } else if (wireElement.tagName === 'path') {
            const d = wireElement.getAttribute('d');
            if (d) {
                const lMatch = d.match(/L\s*([\d.]+)\s+([\d.]+)\s*$/);
                if (lMatch) {
                    x = parseFloat(lMatch[1]);
                    y = parseFloat(lMatch[2]) - 4;
                } else {
                    try {
                        const bbox = wireElement.getBBox();
                        x = bbox.x + bbox.width;
                        y = bbox.y + bbox.height / 2;
                    } catch (e) {
                        return null;
                    }
                }
            }
        }

        return x !== undefined ? { x, y } : null;
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

    // ==================== Keyboard Handling ====================

    setupKeyboardListeners() {
        document.addEventListener('keydown', this.boundHandleKeydown);
    }

    handleKeydown(event) {
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

    // ==================== Event Listeners ====================

    attachEventListeners() {
        // Hover info for Pico pins
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

    // ==================== Group Boundary Rendering ====================

    clearGroupBoundaries() {
        if (this.groupBoundariesLayer) {
            this.groupBoundariesLayer.innerHTML = '';
        }
        this.groupBoundaries.clear();
    }

    // ==================== Group Interaction ====================

    enableGroupInteraction() {
        if (this.groupBoundariesLayer) {
            this.groupBoundariesLayer.addEventListener('click', this.boundHandleGroupClick);
        }

        if (this.componentsLayer) {
            this.componentsLayer.addEventListener('click', this.boundHandleComponentClick);
        }
    }

    handleGroupClick(event) {
        const boundaryElement = event.target.closest('.group-boundary');
        if (!boundaryElement) return;

        const groupId = boundaryElement.getAttribute('data-group-id');
        if (!groupId) return;

        console.log('[Explorer] Group boundary clicked:', groupId);
        this.toggleGroupHighlight(groupId);
    }

    toggleGroupHighlight(groupId) {
        if (this.activeGroup === groupId) {
            this.deactivateGroup(groupId);
            this.activeGroup = null;
            this.resetAllWireFade();
        } else {
            if (this.activeGroup) {
                this.deactivateGroup(this.activeGroup);
            }

            this.activateGroup(groupId);
            this.activeGroup = groupId;
            this.fadeNonActiveWires(groupId);
        }

        this.updateGroupInfoPanel();
    }

    activateGroup(groupId) {
        const boundary = this.groupBoundaries.get(groupId);
        if (!boundary) return;

        boundary.rect.classList.add('group-active');
        boundary.label.classList.add('label-active');

        const group = boundary.group;
        for (const wireId of group.wires) {
            const wireEl = document.querySelector(`[data-wire-id="${wireId}"]`);
            if (wireEl) {
                wireEl.classList.add('wire-active');
                wireEl.classList.remove('wire-faded');
            }
        }

        for (const compId of group.allComponents) {
            const compEl = document.querySelector(`[data-component-id="${compId}"]`);
            if (compEl) {
                compEl.classList.add('component-highlighted');
            }
        }

        this.highlightConnectedPicoPins(group.wires);
    }

    deactivateGroup(groupId) {
        const boundary = this.groupBoundaries.get(groupId);
        if (!boundary) return;

        boundary.rect.classList.remove('group-active');
        boundary.label.classList.remove('label-active');

        const group = boundary.group;
        for (const wireId of group.wires) {
            const wireEl = document.querySelector(`[data-wire-id="${wireId}"]`);
            if (wireEl) {
                wireEl.classList.remove('wire-active');
            }
        }

        for (const compId of group.allComponents) {
            const compEl = document.querySelector(`[data-component-id="${compId}"]`);
            if (compEl) {
                compEl.classList.remove('component-highlighted');
            }
        }

        this.unhighlightAllPicoPins();
    }

    fadeNonActiveWires(activeGroupId) {
        const activeGroup = this.groupBoundaries.get(activeGroupId)?.group;
        if (!activeGroup) return;

        const allWires = document.querySelectorAll('.bundled-wire');
        for (const wireEl of allWires) {
            const wireId = wireEl.getAttribute('data-wire-id');
            if (!activeGroup.wires.includes(wireId)) {
                wireEl.classList.add('wire-faded');
            }
        }
    }

    resetAllWireFade() {
        const allWires = document.querySelectorAll('.bundled-wire');
        for (const wireEl of allWires) {
            wireEl.classList.remove('wire-faded');
            wireEl.classList.remove('wire-active');
        }
    }

    updateGroupInfoPanel() {
        if (this.activeGroup) {
            const boundary = this.groupBoundaries.get(this.activeGroup);
            if (boundary?.group) {
                const group = boundary.group;
                const componentNames = group.allComponents.map(id =>
                    this.getComponentDisplayName(id)
                ).join(' + ');

                if (this.infoPanel) {
                    this.infoPanel.textContent = `${group.label}: ${componentNames}`;
                }

                this.showGroupInfo(group);
            }
        } else {
            if (this.infoPanel) {
                this.infoPanel.textContent = 'Click on a component or group to explore connections';
            }
            this.hideGroupInfo();
        }
    }

    // ==================== Abstract Layout Rendering ====================

    renderGroupBoundariesAbstract() {
        if (!this.groupBoundariesLayer || !this.abstractLayout) {
            console.log('[Explorer] renderGroupBoundariesAbstract: Missing layer or layout');
            return;
        }

        this.clearGroupBoundaries();

        for (const group of this.functionalGroups) {
            const bounds = this.abstractLayout.getGroupBounds(group);
            if (!bounds) continue;

            const { x, y, width, height, centerX } = bounds;

            const boundaryGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            boundaryGroup.classList.add('group-boundary-container', 'abstract-boundary');
            boundaryGroup.setAttribute('data-group-id', group.id);

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.classList.add('group-boundary');
            rect.setAttribute('x', x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('rx', '8');
            rect.setAttribute('ry', '8');
            rect.setAttribute('data-group-id', group.id);
            rect.style.opacity = '0.6';
            rect.style.fill = 'rgba(50, 50, 60, 0.7)';
            rect.style.stroke = '#00ccff';
            rect.style.strokeWidth = '1';

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.classList.add('group-boundary-label');
            label.setAttribute('x', centerX);
            label.setAttribute('y', y - 4);
            label.setAttribute('text-anchor', 'middle');
            label.style.fill = '#00ccff';
            label.style.fontSize = '8px';
            label.style.fontWeight = 'bold';
            label.style.opacity = '1';
            label.textContent = group.label;

            boundaryGroup.appendChild(rect);
            boundaryGroup.appendChild(label);
            this.groupBoundariesLayer.appendChild(boundaryGroup);

            this.groupBoundaries.set(group.id, {
                rect,
                label,
                bounds: bounds,
                group
            });
        }

        console.log('[Explorer] Rendered', this.groupBoundaries.size, 'abstract group boundaries');
    }

    // ==================== MicroPython Parser Integration ====================

    setupMicroPythonUI() {
        const toggleBtn = document.getElementById('micropython-toggle-btn');
        const parseBtn = document.getElementById('parse-micropython-btn');
        const clearBtn = document.getElementById('clear-micropython-btn');
        const panel = document.getElementById('micropython-panel');
        const textarea = document.getElementById('micropython-input');

        toggleBtn?.addEventListener('click', () => {
            panel.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = panel.classList.contains('collapsed') ? '+' : '−';
            }
        });

        parseBtn?.addEventListener('click', async () => {
            const code = textarea?.value?.trim();
            if (!code) {
                this.showMicroPythonError([{
                    type: 'empty_input',
                    message: 'Please enter MicroPython code'
                }]);
                return;
            }

            this.hideMicroPythonMessages();

            parseBtn.textContent = 'Parsing...';
            parseBtn.disabled = true;

            try {
                const result = await this.loadFromLLMCall(code);

                if (!result.success) {
                    this.showMicroPythonError(result.errors, result.warnings);
                } else {
                    this.showMicroPythonSuccess(result);
                }
            } catch (err) {
                this.showMicroPythonError([{
                    type: 'parse_error',
                    message: err.message || 'Failed to parse MicroPython code'
                }]);
            } finally {
                parseBtn.textContent = 'Parse & Visualize';
                parseBtn.disabled = false;
            }
        });

        clearBtn?.addEventListener('click', () => {
            if (textarea) textarea.value = '';
            this.hideMicroPythonMessages();
        });

        console.log('[Explorer] MicroPython UI initialized');

        // Graphics test panel
        this.setupGraphicsTestUI();
    }

    // ==================== Graphics Test (Phase 2) ====================

    /**
     * Graphics test definitions — each test key maps to a group + its SVG info
     */
    _getGraphicsTestDefs() {
        return {
            'debug-holes': { type: 'debug' },
            'led': {
                groups: [
                    {
                        id: 'led-red-5mm-0-group',
                        primaryComponent: 'led-red-5mm-0',
                        primaryMetadata: { id: 'led-red-5mm' },
                        allComponents: ['led-red-5mm-0', 'resistor-220-0'],
                        supportComponents: ['resistor-220-0']
                    },
                    {
                        id: 'led-red-5mm-1-group',
                        primaryComponent: 'led-red-5mm-1',
                        primaryMetadata: { id: 'led-red-5mm' },
                        allComponents: ['led-red-5mm-1', 'resistor-220-1'],
                        supportComponents: ['resistor-220-1']
                    },
                    {
                        id: 'led-red-5mm-2-group',
                        primaryComponent: 'led-red-5mm-2',
                        primaryMetadata: { id: 'led-red-5mm' },
                        allComponents: ['led-red-5mm-2', 'resistor-220-2'],
                        supportComponents: ['resistor-220-2']
                    }
                ],
                svgMap: {
                    'led-red-5mm': { svg: 'components_svg/LED-5mm-red-leg.svg', width: 18, height: 40, label: 'LED' },
                    'resistor-220': { svg: 'components_svg/resistor_220.svg', width: 45, height: 12, label: 'R220' }
                }
            },
            'button': {
                groups: [
                    {
                        id: 'button-tactile-6mm-0-group',
                        primaryComponent: 'button-tactile-6mm-0',
                        primaryMetadata: { id: 'button-tactile-6mm' },
                        allComponents: ['button-tactile-6mm-0', 'resistor-10k-0'],
                        supportComponents: ['resistor-10k-0']
                    },
                    {
                        id: 'button-tactile-6mm-1-group',
                        primaryComponent: 'button-tactile-6mm-1',
                        primaryMetadata: { id: 'button-tactile-6mm' },
                        allComponents: ['button-tactile-6mm-1', 'resistor-10k-2'],
                        supportComponents: ['resistor-10k-2']
                    }
                ],
                svgMap: {
                    'button-tactile-6mm': { svg: 'components_svg/Pushbuttonc.svg', width: 50, height: 56, label: 'Button' },
                    'resistor-10k': { svg: 'components_svg/resistor_220.svg', width: 45, height: 12, label: 'R10k' }
                }
            },
            'photocell': {
                groups: [{
                    id: 'photocell-ldr-0-group',
                    primaryComponent: 'photocell-ldr-0',
                    primaryMetadata: { id: 'photocell-ldr' },
                    allComponents: ['photocell-ldr-0', 'resistor-10k-1'],
                    supportComponents: ['resistor-10k-1']
                }],
                svgMap: {
                    'photocell-ldr': { svg: 'components_svg/ldr.svg', width: 24, height: 11, label: 'Photocell' },
                    'resistor-10k': { svg: 'components_svg/resistor_220.svg', width: 45, height: 12, label: 'R10k' }
                }
            },
            'us100': {
                groups: [{
                    id: 'us100-ultrasonic-0-group',
                    primaryComponent: 'us100-ultrasonic-0',
                    primaryMetadata: { id: 'us100-ultrasonic' },
                    allComponents: ['us100-ultrasonic-0'],
                    supportComponents: []
                }],
                svgMap: {
                    'us100-ultrasonic': { svg: 'components_svg/US-100_ultrasonic-distance-sensor.svg', width: 44, height: 26, label: 'US-100' }
                }
            },
            'tb6612': {
                groups: [{
                    id: 'tb6612-motor-driver-0-group',
                    primaryComponent: 'tb6612-motor-driver-0',
                    primaryMetadata: { id: 'tb6612-motor-driver' },
                    allComponents: ['tb6612-motor-driver-0'],
                    supportComponents: []
                }],
                svgMap: {
                    'tb6612-motor-driver': { svg: 'components_svg/tb6612-motor-driver.svg', width: 54, height: 76, label: 'TB6612' }
                }
            }
        };
    }

    setupGraphicsTestUI() {
        // Track which tests are active
        this._gtestActive = new Set();
        this._gtestPlacementSystem = null;

        const toggleBtns = document.querySelectorAll('.gtest-toggle');
        const allBtn = document.getElementById('gtest-all-btn');
        const clearBtn = document.getElementById('gtest-clear-btn');
        const panelToggle = document.getElementById('gtest-toggle-btn');
        const panel = document.getElementById('graphics-test-panel');

        panelToggle?.addEventListener('click', () => {
            panel.classList.toggle('collapsed');
            const icon = panelToggle.querySelector('.toggle-icon');
            if (icon) icon.textContent = panel.classList.contains('collapsed') ? '+' : '−';
        });

        toggleBtns.forEach(btn => {
            btn.addEventListener('click', () => this._gtestToggle(btn.dataset.gtest, btn));
        });

        allBtn?.addEventListener('click', () => {
            toggleBtns.forEach(btn => {
                if (!this._gtestActive.has(btn.dataset.gtest)) {
                    this._gtestToggle(btn.dataset.gtest, btn);
                }
            });
        });

        clearBtn?.addEventListener('click', () => {
            this._gtestActive.clear();
            toggleBtns.forEach(btn => btn.classList.remove('gtest-on'));
            this._gtestRedraw();
        });

        const copyBtn = document.getElementById('gtest-copy-btn');
        copyBtn?.addEventListener('click', () => this._gtestExportPlacements());

        // Keyboard listener for fine-tune controls
        document.addEventListener('keydown', (e) => this._gtestHandleKey(e));

        // Click on SVG background to deselect
        this.svg?.addEventListener('click', (e) => {
            if (e.target === this.svg || e.target.tagName === 'image' && e.target.closest('#breadboard-image')) {
                this._gtestDeselect();
            }
        });
    }

    async _gtestEnsurePlacementSystem() {
        if (!this._gtestPlacementSystem) {
            this._gtestPlacementSystem = new BreadboardPlacementSystem();
            await this._gtestPlacementSystem.load();
        }
        return this._gtestPlacementSystem;
    }

    async _gtestToggle(testKey, btn) {
        if (this._gtestActive.has(testKey)) {
            this._gtestActive.delete(testKey);
            btn?.classList.remove('gtest-on');
        } else {
            this._gtestActive.add(testKey);
            btn?.classList.add('gtest-on');
        }
        await this._gtestRedraw();
    }

    async _gtestRedraw() {
        // Clean up any in-progress drag
        this._gtestClearDragState();

        // Clear SVG layers
        this.componentsLayer.innerHTML = '';
        this.holesLayer.innerHTML = '';

        const defs = this._getGraphicsTestDefs();
        const placementSystem = await this._gtestEnsurePlacementSystem();

        // Reset slot allocation for fresh assignment
        placementSystem.clear();

        // Collect all active groups and SVG maps
        const allGroups = [];
        const allSvgMaps = {};
        const groupRegistry = [];

        for (const testKey of this._gtestActive) {
            if (testKey === 'debug-holes') continue;
            const def = defs[testKey];
            if (!def || def.type === 'debug') continue;
            for (const group of def.groups) {
                allGroups.push(group);
                groupRegistry.push({ testKey, group });
            }
            Object.assign(allSvgMaps, def.svgMap);
        }

        // Assign placements for all active groups
        if (allGroups.length > 0) {
            placementSystem.assignPlacements(allGroups);
        }

        // Render debug holes if active
        if (this._gtestActive.has('debug-holes')) {
            this._renderDebugHoles();
        }

        // Render each functional group as a draggable unit
        for (const { testKey, group } of groupRegistry) {
            const groupG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            groupG.setAttribute('class', 'gtest-group');
            groupG.setAttribute('data-group-id', group.id);
            groupG.style.cursor = 'grab';

            // Render all components in this group into the group container
            for (const componentId of group.allComponents) {
                const placement = placementSystem.getComponentPosition(componentId);
                if (!placement) continue;
                const componentType = componentId.replace(/-\d+$/, '');
                const svgInfo = allSvgMaps[componentType];
                if (!svgInfo) continue;
                this._gtestRenderComponent(componentId, placement, svgInfo, groupG);

                // Store formFactor on the component element for click-to-select
                const compG = groupG.querySelector(`[data-component-id="${componentId}"]`);
                if (compG) {
                    compG.dataset.formFactor = placement.formFactor;
                }
            }

            this.componentsLayer.appendChild(groupG);

            // Make draggable
            this._gtestMakeDraggable(groupG, group);
        }

        // Update status
        const statusEl = document.getElementById('gtest-status');
        if (statusEl) {
            const allPlacements = placementSystem.getAllPlacements();
            const active = [...this._gtestActive].filter(k => k !== 'debug-holes');
            statusEl.textContent = active.length > 0
                ? `${allPlacements.size} components placed (${active.join(', ')}) — drag to reposition`
                : '';
        }
    }

    /**
     * Render a single component into a parent SVG group
     */
    _gtestRenderComponent(componentId, placement, svgInfo, parentElement) {
        // Get per-formFactor rendering transforms
        const ps = this._gtestPlacementSystem;
        const transforms = ps ? ps.getRenderingTransforms(placement.formFactor) : { offsetX: 0, offsetY: 0, scale: 0.5, rotation: 0 };
        const scale = transforms.scale;
        const renderWidth = svgInfo.width * scale;
        const renderHeight = svgInfo.height * scale;

        const cx = placement.centerX + transforms.offsetX;
        const cy = placement.centerY + transforms.offsetY;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'component test-component');
        g.setAttribute('data-component-id', componentId);

        // Component image
        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', svgInfo.svg);
        img.setAttribute('width', renderWidth);
        img.setAttribute('height', renderHeight);
        img.setAttribute('x', cx - renderWidth / 2);
        img.setAttribute('y', cy - renderHeight / 2);
        img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        // Apply rotation to the image only, not pin markers or labels
        if (transforms.rotation % 360 !== 0) {
            img.setAttribute('transform', `rotate(${transforms.rotation}, ${cx}, ${cy})`);
        }
        g.appendChild(img);

        // Label below
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', cx);
        label.setAttribute('y', cy + renderHeight / 2 + 5);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('fill', '#00ccff');
        label.setAttribute('font-size', '4');
        label.setAttribute('font-family', 'Arial, sans-serif');
        label.textContent = `${svgInfo.label} [${componentId}]`;
        g.appendChild(label);

        // Pin markers
        for (const [pinName, pinPos] of Object.entries(placement.pinPositions)) {
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            marker.setAttribute('cx', pinPos.x);
            marker.setAttribute('cy', pinPos.y);
            marker.setAttribute('r', '2');
            marker.setAttribute('fill', 'rgba(255, 0, 0, 0.8)');
            marker.setAttribute('stroke', '#ff0');
            marker.setAttribute('stroke-width', '0.5');
            g.appendChild(marker);

            const pinLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            pinLabel.setAttribute('x', pinPos.x);
            pinLabel.setAttribute('y', pinPos.y - 3);
            pinLabel.setAttribute('text-anchor', 'middle');
            pinLabel.setAttribute('fill', '#ff0');
            pinLabel.setAttribute('font-size', '3');
            pinLabel.textContent = `${pinName}:${pinPos.holeId}`;
            g.appendChild(pinLabel);
        }

        (parentElement || this.componentsLayer).appendChild(g);
    }

    /**
     * Render debug circles at every breadboard hole position
     */
    _renderDebugHoles() {
        if (typeof BREADBOARD_HOLES === 'undefined') return;

        const debugGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        debugGroup.setAttribute('id', 'debug-holes');
        debugGroup.setAttribute('opacity', '0.4');

        for (const hole of BREADBOARD_HOLES) {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', hole.x);
            circle.setAttribute('cy', hole.y);
            circle.setAttribute('r', '1.2');
            circle.setAttribute('fill', hole.row >= 'F' ? 'rgba(0,200,255,0.5)' : 'rgba(255,200,0,0.5)');
            circle.setAttribute('data-hole-id', hole.id);
            debugGroup.appendChild(circle);
        }

        this.holesLayer.appendChild(debugGroup);
        console.log(`[GraphicsTest] ${BREADBOARD_HOLES.length} debug holes rendered`);
    }

    // ==================== Drag-and-Drop System ====================

    /** Row order for offset calculations (J=0 top → A=9 bottom) */
    static get ALL_ROWS() { return ['J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A']; }

    /** Parse hole ID string to column + row index */
    _gtestParseHoleId(holeId) {
        const match = holeId.match(/^(\d+)([A-J])$/i);
        if (!match) return null;
        return {
            col: parseInt(match[1]),
            row: match[2].toUpperCase(),
            rowIdx: ExplorerApp.ALL_ROWS.indexOf(match[2].toUpperCase())
        };
    }

    /** Build hole ID from column + row index */
    _gtestBuildHoleId(col, rowIdx) {
        if (col < 1 || col > 30 || rowIdx < 0 || rowIdx >= 10) return null;
        return `${col}${ExplorerApp.ALL_ROWS[rowIdx]}`;
    }

    /** Compute the relative pin layout for a functional group (offsets from anchor) */
    _gtestComputeRelativeLayout(group) {
        const ps = this._gtestPlacementSystem;
        const primaryPlacement = ps.getComponentPosition(group.primaryComponent);
        if (!primaryPlacement) return null;

        // Anchor = first pin of primary component
        const pinEntries = Object.entries(primaryPlacement.pinPositions);
        const [anchorPinName, anchorPin] = pinEntries[0];
        const anchorHole = this._gtestParseHoleId(anchorPin.holeId);
        if (!anchorHole) return null;

        const pins = [];

        // Primary component pins
        for (const [pinName, pinPos] of pinEntries) {
            const hole = this._gtestParseHoleId(pinPos.holeId);
            if (!hole) continue;
            pins.push({
                componentId: group.primaryComponent,
                pinName,
                colOffset: hole.col - anchorHole.col,
                rowOffset: hole.rowIdx - anchorHole.rowIdx,
                isSupport: false
            });
        }

        // Support component pins
        for (const supportId of (group.supportComponents || [])) {
            const supportPlacement = ps.getComponentPosition(supportId);
            if (!supportPlacement) continue;
            const supportType = supportId.replace(/-\d+$/, '');
            const supportFormFactor = ps.normalizeType(supportType);

            for (const [pinName, pinPos] of Object.entries(supportPlacement.pinPositions)) {
                const hole = this._gtestParseHoleId(pinPos.holeId);
                if (!hole) continue;
                pins.push({
                    componentId: supportId,
                    pinName,
                    colOffset: hole.col - anchorHole.col,
                    rowOffset: hole.rowIdx - anchorHole.rowIdx,
                    isSupport: true,
                    supportFormFactor
                });
            }
        }

        return { anchor: { ...anchorHole, pinName: anchorPinName }, pins, group };
    }

    /** Apply relative layout at a new anchor position → array of {pinName, holeId, valid, x, y} */
    _gtestApplyRelativeLayout(anchorCol, anchorRowIdx, relLayout) {
        return relLayout.pins.map(pin => {
            const newCol = anchorCol + pin.colOffset;
            const newRowIdx = anchorRowIdx + pin.rowOffset;
            const holeId = this._gtestBuildHoleId(newCol, newRowIdx);
            const hole = holeId ? getHoleById(holeId) : null;
            return { ...pin, holeId, valid: !!hole, x: hole?.x, y: hole?.y };
        });
    }

    /** Find the nearest breadboard hole to an SVG coordinate */
    _gtestFindNearestHole(svgX, svgY) {
        if (typeof BREADBOARD_HOLES === 'undefined') return null;
        let nearest = null, minDist = Infinity;
        for (const hole of BREADBOARD_HOLES) {
            const dist = (hole.x - svgX) ** 2 + (hole.y - svgY) ** 2;
            if (dist < minDist) { minDist = dist; nearest = hole; }
        }
        return nearest;
    }

    /** Convert screen coordinates to SVG coordinates */
    _gtestScreenToSVG(clientX, clientY) {
        const pt = this.svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        return pt.matrixTransform(this.svg.getScreenCTM().inverse());
    }

    /** Make a functional group element draggable */
    _gtestMakeDraggable(groupG, group) {
        const relLayout = this._gtestComputeRelativeLayout(group);
        if (!relLayout) return;

        groupG.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._gtestStartDrag(e, groupG, relLayout);
        });
    }

    /** Begin dragging a component group */
    _gtestStartDrag(e, groupG, relLayout) {
        const svgPt = this._gtestScreenToSVG(e.clientX, e.clientY);

        // Get anchor pin's current SVG position
        const anchorPlacement = this._gtestPlacementSystem.getComponentPosition(relLayout.anchor.componentId || relLayout.group.primaryComponent);
        const anchorPinPos = anchorPlacement.pinPositions[relLayout.anchor.pinName];

        // Create ghost (faded copy at original position)
        const ghost = groupG.cloneNode(true);
        ghost.setAttribute('class', 'gtest-group gtest-ghost');
        ghost.style.opacity = '0.25';
        ghost.style.pointerEvents = 'none';
        this.componentsLayer.insertBefore(ghost, groupG);

        // Drag cursor
        groupG.style.cursor = 'grabbing';

        // Target holes highlight layer
        const highlightGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        highlightGroup.setAttribute('class', 'gtest-drag-highlights');
        this.holesLayer.appendChild(highlightGroup);

        // Store drag state
        this._dragState = {
            groupG,
            ghost,
            relLayout,
            highlightGroup,
            anchorOrigX: anchorPinPos.x,
            anchorOrigY: anchorPinPos.y,
            startSvgX: svgPt.x,
            startSvgY: svgPt.y,
            lastSnapHoleId: anchorPinPos.holeId,
            originalAnchorHoleId: anchorPinPos.holeId,
            hasMoved: false,
            mousedownTarget: e.target
        };

        // Bind SVG-level handlers
        this._boundDragMove = (ev) => this._gtestOnDragMove(ev);
        this._boundDragEnd = (ev) => this._gtestOnDragEnd(ev);
        this.svg.addEventListener('mousemove', this._boundDragMove);
        this.svg.addEventListener('mouseup', this._boundDragEnd);
        this.svg.addEventListener('mouseleave', this._boundDragEnd);

        // Show initial target holes
        const targetHoles = this._gtestApplyRelativeLayout(relLayout.anchor.col, relLayout.anchor.rowIdx, relLayout);
        this._gtestRenderTargetHoles(targetHoles);

        console.log(`[GraphicsTest] Drag started: ${relLayout.group.primaryComponent} anchor at ${anchorPinPos.holeId}`);
    }

    /** Handle mouse movement during drag */
    _gtestOnDragMove(e) {
        if (!this._dragState) return;
        const svgPt = this._gtestScreenToSVG(e.clientX, e.clientY);
        const { anchorOrigX, anchorOrigY, startSvgX, startSvgY, relLayout } = this._dragState;

        // Where anchor pin would be at current mouse position
        const targetX = anchorOrigX + (svgPt.x - startSvgX);
        const targetY = anchorOrigY + (svgPt.y - startSvgY);

        // Find nearest hole for anchor
        const nearestHole = this._gtestFindNearestHole(targetX, targetY);
        if (!nearestHole || nearestHole.id === this._dragState.lastSnapHoleId) return;

        this._dragState.lastSnapHoleId = nearestHole.id;
        this._dragState.hasMoved = true;

        // Snap: translate group so anchor pin lands on this hole
        const snapDx = nearestHole.x - anchorOrigX;
        const snapDy = nearestHole.y - anchorOrigY;
        this._dragState.groupG.setAttribute('transform', `translate(${snapDx}, ${snapDy})`);

        // Compute and show target holes
        const anchorParsed = this._gtestParseHoleId(nearestHole.id);
        const targetHoles = this._gtestApplyRelativeLayout(anchorParsed.col, anchorParsed.rowIdx, relLayout);
        this._gtestRenderTargetHoles(targetHoles);
    }

    /** Handle drag end — finalize position or select for fine-tuning */
    _gtestOnDragEnd(e) {
        if (!this._dragState) return;

        // Remove SVG-level handlers
        this.svg.removeEventListener('mousemove', this._boundDragMove);
        this.svg.removeEventListener('mouseup', this._boundDragEnd);
        this.svg.removeEventListener('mouseleave', this._boundDragEnd);

        const { relLayout, lastSnapHoleId, originalAnchorHoleId, hasMoved, mousedownTarget } = this._dragState;

        if (!hasMoved) {
            // No movement — treat as click-to-select for fine-tuning
            // Find which component was clicked
            const compEl = mousedownTarget?.closest('[data-component-id]');
            if (compEl) {
                const componentId = compEl.dataset.componentId;
                const formFactor = compEl.dataset.formFactor;
                if (componentId && formFactor) {
                    // Clean up drag visuals first
                    if (this._dragState.ghost) this._dragState.ghost.remove();
                    if (this._dragState.highlightGroup) this._dragState.highlightGroup.remove();
                    this._dragState = null;
                    this._gtestRedraw().then(() => {
                        this._gtestSelect(componentId, formFactor);
                    });
                    return;
                }
            }
        }

        // Compute final positions
        const anchorParsed = this._gtestParseHoleId(lastSnapHoleId);
        const targetHoles = this._gtestApplyRelativeLayout(anchorParsed.col, anchorParsed.rowIdx, relLayout);
        const allValid = targetHoles.every(t => t.valid);

        if (allValid && lastSnapHoleId !== originalAnchorHoleId) {
            // Update in-memory placement registry
            this._gtestUpdatePlacementRegistry(relLayout, targetHoles);
            console.log(`[GraphicsTest] Dropped ${relLayout.group.primaryComponent}: anchor ${originalAnchorHoleId} → ${lastSnapHoleId}`);
        }

        // Clean up drag visuals
        if (this._dragState.ghost) this._dragState.ghost.remove();
        if (this._dragState.highlightGroup) this._dragState.highlightGroup.remove();
        this._dragState = null;

        // Re-render everything at updated positions
        this._gtestRedraw();
    }

    /** Render green/red circles at target hole positions during drag */
    _gtestRenderTargetHoles(targetHoles) {
        const hg = this._dragState?.highlightGroup;
        if (!hg) return;
        hg.innerHTML = '';

        for (const target of targetHoles) {
            if (!target.x || !target.y) continue;

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', target.x);
            circle.setAttribute('cy', target.y);
            circle.setAttribute('r', '2.5');
            circle.setAttribute('fill', target.valid ? 'rgba(0, 255, 100, 0.6)' : 'rgba(255, 0, 0, 0.6)');
            circle.setAttribute('stroke', target.valid ? '#0f0' : '#f00');
            circle.setAttribute('stroke-width', '0.5');
            hg.appendChild(circle);

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', target.x);
            label.setAttribute('y', target.y - 3.5);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('fill', target.valid ? '#0f0' : '#f00');
            label.setAttribute('font-size', '2.5');
            label.textContent = target.holeId || '??';
            hg.appendChild(label);
        }
    }

    /** Update the in-memory placement registry after a successful drag */
    _gtestUpdatePlacementRegistry(relLayout, targetHoles) {
        const ps = this._gtestPlacementSystem;
        const group = relLayout.group;
        const componentType = ps._getComponentType(group);
        const formFactor = ps.normalizeType(componentType);
        const placementDef = ps.placements[formFactor];
        if (!placementDef) return;

        const primaryPlacement = ps.getComponentPosition(group.primaryComponent);
        if (!primaryPlacement) return;
        const slotDef = placementDef.slots[primaryPlacement.slotIndex];
        if (!slotDef) return;

        // Build new hole ID maps from target positions
        const newPrimary = {};
        const newSupport = {};

        for (const target of targetHoles) {
            if (!target.holeId) continue;
            if (!target.isSupport) {
                newPrimary[target.pinName] = target.holeId;
            } else {
                const sfKey = target.supportFormFactor || 'resistor';
                if (!newSupport[sfKey]) newSupport[sfKey] = {};
                newSupport[sfKey][target.pinName] = target.holeId;
            }
        }

        // Write back to the in-memory registry
        slotDef.placement = newPrimary;
        slotDef.supportPlacements = newSupport;
        console.log(`[GraphicsTest] Registry updated: ${formFactor} slot ${primaryPlacement.slotIndex}`, newPrimary, newSupport);
    }

    // ==================== Fine-Tune Selection & Keyboard Controls ====================

    /**
     * Select a component for fine-tuning (click handler for graphics test)
     * @param {string} componentId - e.g., "led-red-5mm-0"
     * @param {string} formFactor - normalized form factor key
     */
    _gtestSelect(componentId, formFactor) {
        // Deselect previous
        this._gtestDeselect();

        this._gtestSelection = { componentId, formFactor };

        // Highlight selected component with a dashed outline
        const compG = this.componentsLayer.querySelector(`[data-component-id="${componentId}"]`);
        if (compG) {
            const img = compG.querySelector('image');
            if (img) {
                const selRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                selRect.setAttribute('x', parseFloat(img.getAttribute('x')) - 1);
                selRect.setAttribute('y', parseFloat(img.getAttribute('y')) - 1);
                selRect.setAttribute('width', parseFloat(img.getAttribute('width')) + 2);
                selRect.setAttribute('height', parseFloat(img.getAttribute('height')) + 2);
                selRect.setAttribute('fill', 'none');
                selRect.setAttribute('stroke', '#ff0');
                selRect.setAttribute('stroke-width', '0.8');
                selRect.setAttribute('stroke-dasharray', '2,1');
                selRect.setAttribute('class', 'gtest-selection-rect');
                // Apply same transform as parent if rotated
                const parentTransform = compG.parentElement?.getAttribute('transform');
                if (parentTransform) selRect.setAttribute('transform', parentTransform);
                compG.appendChild(selRect);
            }
        }

        // Show fine-tune panel
        const panel = document.getElementById('gtest-finetune');
        const label = document.getElementById('gtest-selected-label');
        if (panel) panel.style.display = 'block';
        if (label) label.textContent = `${formFactor} (${componentId})`;

        this._gtestUpdateTransformInfo();
        console.log(`[GraphicsTest] Selected ${componentId} (${formFactor}) for fine-tuning`);
    }

    /** Deselect current fine-tune selection */
    _gtestDeselect() {
        this._gtestSelection = null;

        // Remove selection rectangles
        this.componentsLayer.querySelectorAll('.gtest-selection-rect').forEach(r => r.remove());

        // Hide fine-tune panel
        const panel = document.getElementById('gtest-finetune');
        if (panel) panel.style.display = 'none';
    }

    /** Update the transform info display */
    _gtestUpdateTransformInfo() {
        const infoEl = document.getElementById('gtest-transform-info');
        if (!infoEl || !this._gtestSelection) return;

        const ps = this._gtestPlacementSystem;
        const t = ps.getRenderingTransforms(this._gtestSelection.formFactor);
        infoEl.textContent = `offset(${t.offsetX.toFixed(1)}, ${t.offsetY.toFixed(1)}) scale(${t.scale.toFixed(2)}) rot(${t.rotation}°)`;
    }

    /** Handle keyboard input for fine-tuning */
    _gtestHandleKey(e) {
        if (!this._gtestSelection) return;
        // Don't capture keys when typing in text inputs
        const tag = document.activeElement?.tagName;
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;

        const ps = this._gtestPlacementSystem;
        const ff = this._gtestSelection.formFactor;
        const t = ps.getRenderingTransforms(ff);
        const NUDGE = 0.5;
        const SCALE_STEP = 0.05;

        let changed = false;

        switch (e.key) {
            case 'ArrowLeft':
                ps.setRenderingTransforms(ff, { offsetX: t.offsetX - NUDGE });
                changed = true;
                break;
            case 'ArrowRight':
                ps.setRenderingTransforms(ff, { offsetX: t.offsetX + NUDGE });
                changed = true;
                break;
            case 'ArrowUp':
                ps.setRenderingTransforms(ff, { offsetY: t.offsetY - NUDGE });
                changed = true;
                break;
            case 'ArrowDown':
                ps.setRenderingTransforms(ff, { offsetY: t.offsetY + NUDGE });
                changed = true;
                break;
            case '+':
            case '=':
                ps.setRenderingTransforms(ff, { scale: Math.min(t.scale + SCALE_STEP, 4.0) });
                changed = true;
                break;
            case '-':
            case '_':
                ps.setRenderingTransforms(ff, { scale: Math.max(t.scale - SCALE_STEP, 0.05) });
                changed = true;
                break;
            case 'r':
            case 'R':
                ps.setRenderingTransforms(ff, { rotation: (t.rotation + 90) % 360 });
                changed = true;
                break;
            case 'Escape':
                this._gtestDeselect();
                return;
            default:
                return; // Don't prevent default for unhandled keys
        }

        if (changed) {
            e.preventDefault();
            this._gtestUpdateTransformInfo();
            this._gtestRedraw().then(() => {
                // Re-select after redraw so the highlight persists
                if (this._gtestSelection) {
                    this._gtestSelect(this._gtestSelection.componentId, this._gtestSelection.formFactor);
                }
            });
        }
    }

    /** Clean up any active drag state */
    _gtestClearDragState() {
        if (this._dragState) {
            if (this._dragState.ghost) this._dragState.ghost.remove();
            if (this._dragState.highlightGroup) this._dragState.highlightGroup.remove();
            this._dragState = null;
        }
    }

    /** Export current placements to clipboard as JSON */
    _gtestExportPlacements() {
        const ps = this._gtestPlacementSystem;
        if (!ps || !ps.placements) {
            console.warn('[GraphicsTest] No placements to export');
            return;
        }
        const exportData = {
            _description: "Breadboard placement registry — exported from graphics test drag-and-drop",
            typeNormalization: ps.typeNormalization,
            supportRendering: ps.supportRendering,
            placements: ps.placements
        };
        const json = JSON.stringify(exportData, null, 2);
        navigator.clipboard.writeText(json).then(() => {
            console.log('[GraphicsTest] Placements copied to clipboard');
            const statusEl = document.getElementById('gtest-status');
            if (statusEl) statusEl.textContent = 'Placements JSON copied to clipboard!';
        }).catch(err => {
            console.error('[GraphicsTest] Clipboard write failed:', err);
            console.log('[GraphicsTest] Placements JSON:\n', json);
        });
    }


    // ==================== Rendering Pipelines ====================

    /**
     * Breadboard rendering pipeline (Phase 3)
     * Places components at breadboard holes, draws Bezier wires from Pico pins
     */
    _renderOnBreadboard(circuitData, componentMetadata) {
        console.log('[Explorer] Rendering on physical breadboard');

        // Assign placements (pass componentMetadata for support type resolution)
        this.placementSystem.clear();
        this.placementSystem.assignPlacements(this.functionalGroups, componentMetadata);

        // Remove breadboard fade — breadboard is fully visible
        this.removeBreadboardFade();

        // Render group highlight regions
        this.clearGroupBoundaries();
        const groupBounds = this.bbRenderer.renderGroupHighlights(this.functionalGroups, this.placementSystem);
        for (const [groupId, boundary] of groupBounds) {
            this.groupBoundaries.set(groupId, boundary);
        }

        // Render components
        const positions = this.bbRenderer.renderComponents(this.functionalGroups, componentMetadata, this.placementSystem);
        for (const [compId, pos] of positions) {
            this.componentPositions.set(compId, pos);
        }

        // Render wires
        this.wireToGroup = this.bbRenderer.renderWires(
            circuitData.circuit.wires,
            this.functionalGroups,
            componentMetadata,
            this.placementSystem
        );
    }

    /**
     * Abstract layout rendering pipeline (fallback when breadboard system unavailable)
     */
    _renderAbstract(circuitData, componentMetadata) {
        console.log('[Explorer] Rendering with abstract layout (fallback)');

        if (!this.abstractLayout) {
            this.abstractLayout = new AbstractLayoutSystem();
        }
        this.abstractLayout.calculateSlots(this.functionalGroups);
        this.renderGroupBoundariesAbstract();
        this.renderMicroPythonComponents(componentMetadata);
        this.renderMicroPythonWires(circuitData.circuit.wires);
        this.applyBreadboardFade();
    }

    /**
     * Load circuit from MicroPython code
     * @param {string} micropythonCode - Annotated MicroPython code
     * @returns {Promise<{success: boolean, errors: array, warnings: array, components?: number, wires?: number}>}
     */
    async loadFromLLMCall(micropythonCode) {
        console.log('[Explorer] Loading results from LLM call with MicroPython code');

        if (typeof LLMParser === 'undefined') {
            return {
                success: false,
                errors: [{
                    type: 'parser_not_loaded',
                    message: 'MicroPython parser not available',
                    suggestion: 'Ensure llm-micropython-parser.js is loaded'
                }],
                warnings: []
            };
        }

        const parser = new LLMParser();
        const parseResult = await parser.parse(micropythonCode);

        if (!parseResult.success) {
            console.error('[Explorer] Parse errors:', parseResult.errors);
            return {
                success: false,
                errors: parseResult.errors,
                warnings: parseResult.warnings
            };
        }

        console.log('[Explorer] Parse successful, circuit data:', parseResult.circuitData);

        this.clearCircuit();

        try {
            this.circuitData = parseResult.circuitData;

            // 1. Load component metadata for each component
            const componentMetadata = new Map();
            for (const comp of parseResult.circuitData.circuit.components) {
                if (comp.type === 'raspberry-pi-pico') continue;

                const metadata = await this.loadComponentMetadataByType(comp.type);
                if (metadata) {
                    componentMetadata.set(comp.id, {
                        type: comp.type,
                        metadata: metadata,
                        picoConnection: comp.picoConnection,
                        parentId: comp.parentId,
                        autoGenerated: comp.autoGenerated,
                        role: comp.role
                    });
                }
            }

            console.log('[Explorer] Loaded metadata for', componentMetadata.size, 'components');

            // 2. Build functional groups from parser output
            this.buildFunctionalGroupsFromParser(parseResult.circuitData, componentMetadata);

            // 3-7. Render on breadboard (Phase 3) or fall back to abstract layout
            if (this.bbRenderer && this.placementSystem?.loaded) {
                this._renderOnBreadboard(parseResult.circuitData, componentMetadata);
            } else {
                this._renderAbstract(parseResult.circuitData, componentMetadata);
            }

            // 8. Enable interactions
            this.enableGroupInteraction();
            this.enableWireInteraction();

            return {
                success: true,
                errors: [],
                warnings: parseResult.warnings,
                components: componentMetadata.size,
                wires: parseResult.circuitData.circuit.wires.length
            };
        } catch (err) {
            console.error('[Explorer] Error loading circuit:', err);
            return {
                success: false,
                errors: [{
                    type: 'render_error',
                    message: `Failed to render circuit: ${err.message}`
                }],
                warnings: parseResult.warnings
            };
        }
    }


    // /**
    //  * Load circuit from MicroPython code
    //  * @param {string} micropythonCode - Annotated MicroPython code
    //  * @returns {Promise<{success: boolean, errors: array, warnings: array, components?: number, wires?: number}>}
    //  */
    // async loadFromMicroPython(micropythonCode) {
    //     console.log('[Explorer] Loading circuit from MicroPython code');

    //     if (typeof MicroPythonParser === 'undefined') {
    //         return {
    //             success: false,
    //             errors: [{
    //                 type: 'parser_not_loaded',
    //                 message: 'MicroPython parser not available',
    //                 suggestion: 'Ensure micropython-parser.js is loaded'
    //             }],
    //             warnings: []
    //         };
    //     }

    //     const parser = new MicroPythonParser();
    //     const parseResult = await parser.parse(micropythonCode);

    //     if (!parseResult.success) {
    //         console.error('[Explorer] Parse errors:', parseResult.errors);
    //         return {
    //             success: false,
    //             errors: parseResult.errors,
    //             warnings: parseResult.warnings
    //         };
    //     }

    //     console.log('[Explorer] Parse successful, circuit data:', parseResult.circuitData);

    //     this.clearCircuit();

    //     try {
    //         this.circuitData = parseResult.circuitData;

    //         // 1. Load component metadata for each component
    //         const componentMetadata = new Map();
    //         for (const comp of parseResult.circuitData.circuit.components) {
    //             if (comp.type === 'raspberry-pi-pico') continue;

    //             const metadata = await this.loadComponentMetadataByType(comp.type);
    //             if (metadata) {
    //                 componentMetadata.set(comp.id, {
    //                     type: comp.type,
    //                     metadata: metadata,
    //                     picoConnection: comp.picoConnection,
    //                     parentId: comp.parentId,
    //                     autoGenerated: comp.autoGenerated,
    //                     role: comp.role
    //                 });
    //             }
    //         }

    //         console.log('[Explorer] Loaded metadata for', componentMetadata.size, 'components');

    //         // 2. Build functional groups from parser output
    //         this.buildFunctionalGroupsFromParser(parseResult.circuitData, componentMetadata);

    //         // 3. Initialize abstract layout and calculate slots
    //         if (!this.abstractLayout) {
    //             this.abstractLayout = new AbstractLayoutSystem();
    //         }
    //         this.abstractLayout.calculateSlots(this.functionalGroups);

    //         // 4. Render group boundaries
    //         this.renderGroupBoundariesAbstract();

    //         // 5. Render components at abstract positions
    //         this.renderMicroPythonComponents(componentMetadata);

    //         // 6. Render wires from Pico to functional groups
    //         this.renderMicroPythonWires(parseResult.circuitData.circuit.wires);

    //         // 7. Apply breadboard fade for abstract view
    //         this.applyBreadboardFade();

    //         // 8. Enable interactions
    //         this.enableGroupInteraction();
    //         this.enableWireInteraction();

    //         return {
    //             success: true,
    //             errors: [],
    //             warnings: parseResult.warnings,
    //             components: componentMetadata.size,
    //             wires: parseResult.circuitData.circuit.wires.length
    //         };
    //     } catch (err) {
    //         console.error('[Explorer] Error loading circuit:', err);
    //         return {
    //             success: false,
    //             errors: [{
    //                 type: 'render_error',
    //                 message: `Failed to render circuit: ${err.message}`
    //             }],
    //             warnings: parseResult.warnings
    //         };
    //     }
    // }

    /**
     * Load component metadata from library
     * @param {string} componentType - e.g., 'led-red-5mm'
     * @returns {Promise<object|null>}
     */
    async loadComponentMetadataByType(componentType) {
        try {
            const libraryResponse = await fetch('components/library.json');
            const libraryData = await libraryResponse.json();
            const index = libraryData.library.index;

            if (!index[componentType]) {
                console.warn(`[Explorer] Unknown component type: ${componentType}`);
                return null;
            }

            const metadataPath = `components/${index[componentType].metadata}`;
            const metadataResponse = await fetch(metadataPath);
            const metadataData = await metadataResponse.json();

            return metadataData.component;
        } catch (err) {
            console.error(`[Explorer] Failed to load metadata for ${componentType}:`, err);
            return null;
        }
    }

    /**
     * Build functional groups directly from parser output
     * @param {object} circuitData - Parsed circuit data
     * @param {Map} componentMetadata - Component metadata map
     */
    buildFunctionalGroupsFromParser(circuitData, componentMetadata) {
        this.functionalGroups = [];
        this.componentToGroup = new Map();

        const components = circuitData.circuit.components;
        const wires = circuitData.circuit.wires;

        for (const comp of components) {
            if (comp.type === 'raspberry-pi-pico') continue;
            if (comp.autoGenerated) continue;

            const compData = componentMetadata.get(comp.id);
            if (!compData?.metadata?.functionalGroup) continue;

            const metadata = compData.metadata;
            const group = {
                id: `${comp.id}-group`,
                label: metadata.functionalGroup.groupLabel || comp.id,
                primaryComponent: comp.id,
                primaryMetadata: metadata,
                allComponents: [comp.id],
                supportComponents: [],
                wires: [],
                wireLabels: metadata.functionalGroup.wireLabels || {}
            };

            // Find auto-generated support components for this primary
            for (const otherComp of components) {
                if (otherComp.parentId === comp.id && otherComp.autoGenerated) {
                    group.supportComponents.push(otherComp.id);
                    group.allComponents.push(otherComp.id);
                }
            }

            // Find wires connected to this component
            for (const wire of wires) {
                const componentId = comp.id;
                if (wire.from?.startsWith(`${componentId}.`) ||
                    wire.to?.startsWith(`${componentId}.`) ||
                    wire.id?.startsWith(`${componentId}-`)) {
                    if (!group.wires.includes(wire.id)) {
                        group.wires.push(wire.id);
                    }
                }
            }

            this.functionalGroups.push(group);

            for (const compId of group.allComponents) {
                this.componentToGroup.set(compId, group);
            }

            console.log(`[Explorer] Built functional group: ${group.label}`, {
                primary: group.primaryComponent,
                support: group.supportComponents,
                wires: group.wires
            });
        }

        console.log('[Explorer] Total functional groups from parser:', this.functionalGroups.length);
    }

    /**
     * Render components for MicroPython-loaded circuits
     * @param {Map} componentMetadata - Component metadata map
     */
    renderMicroPythonComponents(componentMetadata) {
        const componentsLayer = document.getElementById('components-layer');
        if (!componentsLayer) return;

        for (const group of this.functionalGroups) {
            const slot = this.abstractLayout.getSlotForGroup(group.id);
            if (!slot) {
                console.warn(`[Explorer] No slot for group ${group.id}`);
                continue;
            }

            for (let i = 0; i < group.allComponents.length; i++) {
                const compId = group.allComponents[i];
                const compData = componentMetadata.get(compId);
                if (!compData) continue;

                const position = this.abstractLayout.getAbstractPosition(
                    compId,
                    group.id,
                    null
                );

                this.renderComponentAtPositionDirect(compId, compData, position, componentsLayer);

                this.componentPositions.set(compId, {
                    centerX: position.centerX,
                    centerY: position.centerY,
                    width: position.width || 30,
                    height: position.height || 30,
                    isAbstract: true
                });
            }
        }

        console.log('[Explorer] Rendered', componentMetadata.size, 'components at abstract positions');
    }

    /**
     * Render a component directly (without CircuitLoader)
     */
    renderComponentAtPositionDirect(componentId, compData, position, layer) {
        const metadata = compData.metadata;
        const rendering = metadata?.rendering?.breadboard;

        if (!rendering?.svg) {
            console.warn(`[Explorer] No SVG for component ${componentId}`);
            return;
        }

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('component', 'abstract-component');
        group.setAttribute('data-component-id', componentId);
        group.setAttribute('data-component-type', compData.type);

        const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        img.setAttribute('href', rendering.svg);

        const scale = 0.7;
        const displayWidth = (rendering.width || 30) * scale;
        const displayHeight = (rendering.height || 30) * scale;

        img.setAttribute('width', displayWidth);
        img.setAttribute('height', displayHeight);
        img.setAttribute('x', position.centerX - displayWidth / 2);
        img.setAttribute('y', position.centerY - displayHeight / 2);
        img.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        group.appendChild(img);

        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.classList.add('component-label', 'abstract-label');
        label.setAttribute('x', position.centerX);
        label.setAttribute('y', position.centerY + displayHeight / 2 + 8);
        label.setAttribute('text-anchor', 'middle');

        const displayName = metadata?.metadata?.name || metadata?.name || componentId;
        label.textContent = displayName;

        group.appendChild(label);
        layer.appendChild(group);
    }

    /**
     * Render wires for MicroPython-loaded circuits
     */
    renderMicroPythonWires(wires) {
        if (!wires || wires.length === 0) return;

        this.wiresLayer.innerHTML = '';

        for (const group of this.functionalGroups) {
            const slot = this.abstractLayout.getSlotForGroup(group.id);
            if (!slot) continue;

            const wireOrder = group.primaryMetadata?.functionalGroup?.wireOrder || [];

            const groupWires = [];
            for (const wireId of group.wires) {
                const wire = wires.find(w => w.id === wireId);
                if (!wire) continue;

                groupWires.push({
                    wire,
                    role: wire.role || 'signal',
                    color: wire.color || '#ffcc00',
                    picoEndpoint: wire.from?.startsWith('pico1.') ? wire.from : wire.to
                });
            }

            const roleOrder = wireOrder.map(wo => wo.role);
            if (roleOrder.length === 0) {
                roleOrder.push('power', 'signal', 'ground');
            }
            groupWires.sort((a, b) => {
                const aIdx = roleOrder.indexOf(a.role);
                const bIdx = roleOrder.indexOf(b.role);
                return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
            });

            this.renderMicroPythonWireBundle(group, slot, groupWires);
        }
    }

    /**
     * Render a bundle of wires for a functional group (MicroPython mode)
     */
    renderMicroPythonWireBundle(group, slot, classifiedWires) {
        if (classifiedWires.length === 0) return;

        const wireEntryX = slot.wireEntry.x;
        const wireEntryY = slot.wireEntry.y;
        const height = slot.bounds.height;

        const wireCount = classifiedWires.length;
        const verticalSpacing = Math.min(8, (height - 10) / (wireCount + 1));
        const startY = wireEntryY - ((wireCount - 1) * verticalSpacing) / 2;

        const bundleX = wireEntryX - 25;

        classifiedWires.forEach((classified, index) => {
            const { wire, color, role, picoEndpoint } = classified;

            let startX, startY_wire;

            if (picoEndpoint) {
                const pinName = picoEndpoint.split('.')[1];
                // Exact match first, then prefix match for ADC-capable pins
                // (e.g., "GP26" matches "GP26_ADC0" in pico-geometry)
                const picoPin = this.picoPins.find(p => p.pinKey === pinName) ||
                                this.picoPins.find(p => p.pinKey.startsWith(pinName + '_'));
                if (picoPin) {
                    startX = picoPin.x;
                    startY_wire = picoPin.y;
                } else {
                    startX = 50;
                    startY_wire = 100;
                    console.warn(`[Explorer] Pico pin ${pinName} not found in picoPins`);
                }
            } else {
                startX = 50;
                startY_wire = 100;
            }

            const endX = wireEntryX;
            const endY = startY + index * verticalSpacing;
            const bundleY = endY;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.classList.add('bundled-wire');
            path.classList.add(`wire-${role}`);
            path.setAttribute('data-wire-id', wire.id);
            path.setAttribute('data-group-id', group.id);
            path.style.stroke = color;

            const cp1x = startX + (bundleX - startX) * 0.5;
            const cp1y = startY_wire;
            const cp2x = bundleX - 20;
            const cp2y = bundleY;

            const d = `M ${startX} ${startY_wire}
                       C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${bundleX} ${bundleY}
                       L ${endX} ${endY}`;

            path.setAttribute('d', d);
            this.wiresLayer.appendChild(path);

            if (!this.wireToGroup) this.wireToGroup = new Map();
            this.wireToGroup.set(wire.id, group.id);
        });

        console.log(`[Explorer] Rendered ${classifiedWires.length} wires for group "${group.label}"`);
    }

    /**
     * Clear the current circuit display
     */
    clearCircuit() {
        if (this.wiresLayer) {
            this.wiresLayer.innerHTML = '';
        }

        if (this.componentsLayer) {
            this.componentsLayer.innerHTML = '';
        }

        if (this.groupBoundariesLayer) {
            this.groupBoundariesLayer.innerHTML = '';
        }

        if (this.wireLabelsLayer) {
            this.wireLabelsLayer.innerHTML = '';
        }

        if (this.holesLayer) {
            this.holesLayer.innerHTML = '';
        }

        this.wires = [];
        this.functionalGroups = [];
        this.componentPositions.clear();
        this.groupBoundaries.clear();
        this.activeGroup = null;
        this.highlightedWire = null;
        this.highlightedComponent = null;
    }

    // ==================== MicroPython UI Messages ====================

    showMicroPythonError(errors, warnings = []) {
        const errorsDiv = document.getElementById('micropython-errors');
        const successDiv = document.getElementById('micropython-success');

        if (!errorsDiv) return;

        successDiv?.classList.remove('visible');

        let html = '';

        for (const err of errors) {
            html += `
                <div class="error-item">
                    <div class="error-type">${err.type}</div>
                    <div class="error-message">${err.message}</div>
                    ${err.suggestion ? `<div class="error-suggestion">${err.suggestion}</div>` : ''}
                </div>
            `;
        }

        for (const warn of warnings) {
            html += `
                <div class="error-item warning-item">
                    <div class="error-type">${warn.type}</div>
                    <div class="error-message">${warn.message}</div>
                    ${warn.suggestion ? `<div class="error-suggestion">${warn.suggestion}</div>` : ''}
                </div>
            `;
        }

        errorsDiv.innerHTML = html;
        errorsDiv.classList.add('visible');
    }

    showMicroPythonSuccess(result) {
        const errorsDiv = document.getElementById('micropython-errors');
        const successDiv = document.getElementById('micropython-success');

        if (!successDiv) return;

        errorsDiv?.classList.remove('visible');

        let html = `<div>Circuit loaded successfully!</div>`;
        html += `<div class="success-stats">`;
        html += `${result.components} components | `;
        html += `${result.wires} wires`;
        html += `</div>`;

        if (result.warnings && result.warnings.length > 0) {
            html += `<div style="margin-top: 8px; color: #FFB74D; font-size: 11px;">`;
            html += `${result.warnings.length} warning(s) - check console for details`;
            html += `</div>`;
        }

        successDiv.innerHTML = html;
        successDiv.classList.add('visible');
    }

    hideMicroPythonMessages() {
        document.getElementById('micropython-errors')?.classList.remove('visible');
        document.getElementById('micropython-success')?.classList.remove('visible');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.explorerApp = new ExplorerApp();
    console.log('Circuit Explorer app initialized');
});
