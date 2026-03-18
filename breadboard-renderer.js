/**
 * BreadboardRenderer — Renders parsed circuit components and wires onto the physical breadboard
 *
 * Phase 3 of parse_to_breadboard: replaces abstract box layout with breadboard-hole placement.
 * Components are <image> SVGs centered at breadboard hole positions.
 * Wires are Bezier curves from Pico pins to component pins on the breadboard.
 */
class BreadboardRenderer {
    constructor(options) {
        this.componentsLayer = options.componentsLayer;
        this.wiresLayer = options.wiresLayer;
        this.groupBoundariesLayer = options.groupBoundariesLayer;
        this.wireLabelsLayer = options.wireLabelsLayer;
        this.picoPins = options.picoPins;
    }

    // ==================== Component Rendering ====================

    /**
     * Render all components at their breadboard hole positions
     * @param {Array} functionalGroups
     * @param {Map} componentMetadata - componentId → {type, metadata, ...}
     * @param {BreadboardPlacementSystem} placementSystem
     * @returns {Map} componentPositions - componentId → {centerX, centerY, width, height}
     */
    renderComponents(functionalGroups, componentMetadata, placementSystem) {
        const componentPositions = new Map();

        for (const group of functionalGroups) {
            const groupG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            groupG.setAttribute('class', 'bb-component-group');
            groupG.setAttribute('data-group-id', group.id);

            for (const compId of group.allComponents) {
                const placement = placementSystem.getComponentPosition(compId);
                if (!placement) {
                    console.warn(`[BreadboardRenderer] No placement for ${compId}`);
                    continue;
                }

                const compData = componentMetadata.get(compId);
                if (!compData) continue;

                const rendering = compData.metadata?.rendering?.breadboard;
                if (!rendering?.svg) {
                    console.warn(`[BreadboardRenderer] No SVG for ${compId}`);
                    continue;
                }

                // Get per-formFactor rendering transforms
                const transforms = placementSystem.getRenderingTransforms(placement.formFactor);
                const scale = transforms.scale;
                const renderWidth = rendering.width * scale;
                const renderHeight = rendering.height * scale;

                const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                g.setAttribute('class', 'component bb-component');
                g.setAttribute('data-component-id', compId);
                g.setAttribute('data-component-type', compData.type);
                g.setAttribute('data-group-id', group.id);

                const cx = placement.centerX + transforms.offsetX;
                const cy = placement.centerY + transforms.offsetY;

                const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
                img.setAttribute('href', rendering.svg);
                img.setAttribute('width', renderWidth);
                img.setAttribute('height', renderHeight);
                img.setAttribute('x', cx - renderWidth / 2);
                img.setAttribute('y', cy - renderHeight / 2);
                img.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                // Apply rotation to the image only, not the group container
                if (transforms.rotation % 360 !== 0) {
                    img.setAttribute('transform', `rotate(${transforms.rotation}, ${cx}, ${cy})`);
                }
                g.appendChild(img);

                groupG.appendChild(g);

                componentPositions.set(compId, {
                    centerX: cx,
                    centerY: cy,
                    width: renderWidth,
                    height: renderHeight,
                    pinPositions: placement.pinPositions,
                    isAbstract: false
                });
            }

            this.componentsLayer.appendChild(groupG);
        }

        console.log('[BreadboardRenderer] Rendered', componentPositions.size, 'components on breadboard');
        return componentPositions;
    }

    // ==================== Wire Rendering ====================

    /**
     * Render wires as Bezier curves from Pico pins to breadboard component pins
     * @param {Array} wires - Wire definitions from parser
     * @param {Array} functionalGroups
     * @param {Map} componentMetadata
     * @param {BreadboardPlacementSystem} placementSystem
     * @returns {Map} wireToGroup - wireId → groupId
     */
    renderWires(wires, functionalGroups, componentMetadata, placementSystem) {
        const wireToGroup = new Map();
        if (!wires || wires.length === 0) return wireToGroup;

        this.wiresLayer.innerHTML = '';

        for (const group of functionalGroups) {
            for (const wireId of group.wires) {
                const wire = wires.find(w => w.id === wireId);
                if (!wire) continue;

                const endpoints = this._resolveWireEndpoints(wire, group, componentMetadata, placementSystem);
                if (!endpoints) {
                    console.warn(`[BreadboardRenderer] Could not resolve endpoints for wire ${wireId}`);
                    continue;
                }

                const { startX, startY, endX, endY, componentCenterY } = endpoints;

                // Bezier control points:
                // - Pico end: exits horizontally (rightward toward breadboard)
                // - Breadboard end: exits perpendicularly AWAY from component body
                //   Component above hole (centerY < pinY) → wire exits downward (+Y)
                //   Component below hole (centerY > pinY) → wire exits upward (-Y)
                const gap = endX - startX;
                const cp1x = startX + Math.abs(gap) * 0.4;
                const cp1y = startY;
                const perpDist = 30;
                const awayDir = (componentCenterY <= endY) ? 1 : -1; // +1 = down, -1 = up
                const cp2x = endX;
                const cp2y = endY + perpDist * awayDir;

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.classList.add('bundled-wire');
                path.classList.add(`wire-${wire.role || 'signal'}`);
                path.setAttribute('data-wire-id', wire.id);
                path.setAttribute('data-group-id', group.id);
                path.style.stroke = wire.color || '#ffcc00';

                const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
                path.setAttribute('d', d);

                this.wiresLayer.appendChild(path);
                wireToGroup.set(wire.id, group.id);
            }
        }

        console.log('[BreadboardRenderer] Rendered', wireToGroup.size, 'wires');
        return wireToGroup;
    }

    /**
     * Resolve both endpoints of a wire to SVG coordinates
     * @returns {{startX, startY, endX, endY}|null}
     */
    _resolveWireEndpoints(wire, group, componentMetadata, placementSystem) {
        let picoEndpoint, componentEndpoint;

        if (wire.from?.startsWith('pico1.')) {
            picoEndpoint = wire.from;
            componentEndpoint = wire.to;
        } else if (wire.to?.startsWith('pico1.')) {
            picoEndpoint = wire.to;
            componentEndpoint = wire.from;
        } else {
            console.warn(`[BreadboardRenderer] Wire ${wire.id} has no Pico endpoint`);
            return null;
        }

        // Resolve Pico pin position
        const pinName = picoEndpoint.split('.')[1];
        const picoPin = this.picoPins.find(p => p.pinKey === pinName) ||
                        this.picoPins.find(p => p.pinKey.startsWith(pinName + '_'));
        if (!picoPin) {
            console.warn(`[BreadboardRenderer] Pico pin ${pinName} not found`);
            return null;
        }

        // Resolve component endpoint to breadboard coordinate
        const componentPos = this._resolveComponentEndpoint(componentEndpoint, group, componentMetadata, placementSystem);
        if (!componentPos) {
            console.warn(`[BreadboardRenderer] Could not resolve component endpoint: ${componentEndpoint}`);
            return null;
        }

        // Get component center for wire direction (away from component body)
        const componentId = componentEndpoint.substring(0, componentEndpoint.indexOf('.'));
        const compCenter = placementSystem.getComponentPosition(componentId);

        return {
            startX: picoPin.x,
            startY: picoPin.y,
            endX: componentPos.x,
            endY: componentPos.y,
            componentCenterY: compCenter ? compCenter.centerY : componentPos.y
        };
    }

    /**
     * Resolve a component endpoint (e.g., "led-red-5mm-0.signal") to a breadboard {x, y}
     *
     * Resolution chain:
     * 1. Try direct pin name match in placement (works for multi-pin components)
     * 2. Try wireLabels[role].pinConnection → physical pin name
     * 3. If pinConnection references a support component, find support's external pin
     */
    _resolveComponentEndpoint(endpoint, group, componentMetadata, placementSystem) {
        const dotIdx = endpoint.indexOf('.');
        if (dotIdx === -1) return null;

        const componentId = endpoint.substring(0, dotIdx);
        const pinRole = endpoint.substring(dotIdx + 1);

        // 1. Direct pin name match (works for multi-pin components like US-100, TB6612)
        const directMatch = placementSystem.getWireEndpoint(componentId, pinRole);
        if (directMatch) return directMatch;

        // 2. Map through wireLabels
        const compData = componentMetadata.get(componentId);
        const wireLabels = compData?.metadata?.functionalGroup?.wireLabels;
        if (wireLabels && wireLabels[pinRole]) {
            const physicalPin = wireLabels[pinRole].pinConnection;

            // Try physical pin on the primary component
            const pinMatch = placementSystem.getWireEndpoint(componentId, physicalPin);
            if (pinMatch) return pinMatch;

            // 3. Support component reference (e.g., "pull-down-resistor", "voltage-divider-resistor")
            return this._resolveSupportEndpoint(group, componentId, placementSystem);
        }

        // Fallback: try component center
        const compPos = placementSystem.getComponentPosition(componentId);
        if (compPos) return { x: compPos.centerX, y: compPos.centerY };

        return null;
    }

    /**
     * Find the external pin of a support component (the pin NOT sharing a bus column with the primary)
     * This is where the wire physically lands (e.g., GND wire to resistor's far end)
     */
    _resolveSupportEndpoint(group, primaryId, placementSystem) {
        const primaryPos = placementSystem.getComponentPosition(primaryId);
        if (!primaryPos) return null;

        // Get primary component's pin columns
        const primaryCols = new Set();
        for (const pinPos of Object.values(primaryPos.pinPositions)) {
            const col = this._holeColumn(pinPos.holeId);
            if (col) primaryCols.add(col);
        }

        // Find the support component's external pin
        for (const supportId of (group.supportComponents || [])) {
            const supportPos = placementSystem.getComponentPosition(supportId);
            if (!supportPos) continue;

            let externalPin = null;

            for (const [pinName, pinPos] of Object.entries(supportPos.pinPositions)) {
                const col = this._holeColumn(pinPos.holeId);
                if (col && !primaryCols.has(col)) {
                    externalPin = pinPos;
                    break;
                }
            }

            // If no external pin found, use the support component's center
            if (externalPin) return externalPin;
            return { x: supportPos.centerX, y: supportPos.centerY };
        }

        return null;
    }

    /** Extract column number from a hole ID (e.g., "3D" → 3) */
    _holeColumn(holeId) {
        const match = holeId?.match(/^(\d+)[A-J]$/i);
        return match ? parseInt(match[1]) : null;
    }

    // ==================== Group Highlight Rendering ====================

    /**
     * Render subtle highlight rectangles around each functional group's breadboard region
     * @param {Array} functionalGroups
     * @param {BreadboardPlacementSystem} placementSystem
     * @returns {Map} groupBoundaries - groupId → {rect, label, bounds, group}
     */
    renderGroupHighlights(functionalGroups, placementSystem) {
        const groupBoundaries = new Map();
        const PADDING = 6;

        for (const group of functionalGroups) {
            // Compute bounding box of all component placements in this group
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            let hasPositions = false;

            for (const compId of group.allComponents) {
                const pos = placementSystem.getComponentPosition(compId);
                if (!pos) continue;

                for (const pinPos of Object.values(pos.pinPositions)) {
                    minX = Math.min(minX, pinPos.x);
                    minY = Math.min(minY, pinPos.y);
                    maxX = Math.max(maxX, pinPos.x);
                    maxY = Math.max(maxY, pinPos.y);
                    hasPositions = true;
                }
            }

            if (!hasPositions) continue;

            // Add padding
            minX -= PADDING;
            minY -= PADDING;
            maxX += PADDING;
            maxY += PADDING;

            const width = maxX - minX;
            const height = maxY - minY;
            const centerX = minX + width / 2;

            const boundaryGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            boundaryGroup.classList.add('group-boundary-container', 'bb-boundary');
            boundaryGroup.setAttribute('data-group-id', group.id);

            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.classList.add('group-boundary');
            rect.setAttribute('x', minX);
            rect.setAttribute('y', minY);
            rect.setAttribute('width', width);
            rect.setAttribute('height', height);
            rect.setAttribute('rx', '4');
            rect.setAttribute('ry', '4');
            rect.setAttribute('data-group-id', group.id);
            rect.style.opacity = '0.4';
            rect.style.fill = 'rgba(0, 204, 255, 0.08)';
            rect.style.stroke = '#00ccff';
            rect.style.strokeWidth = '0.5';

            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.classList.add('group-boundary-label');
            label.setAttribute('x', centerX);
            label.setAttribute('y', minY - 2);
            label.setAttribute('text-anchor', 'middle');
            label.style.fill = '#00ccff';
            label.style.fontSize = '5px';
            label.style.fontWeight = 'bold';
            label.style.opacity = '0.8';
            label.textContent = group.label;

            boundaryGroup.appendChild(rect);
            boundaryGroup.appendChild(label);
            this.groupBoundariesLayer.appendChild(boundaryGroup);

            groupBoundaries.set(group.id, {
                rect,
                label,
                bounds: { x: minX, y: minY, width, height, centerX },
                group
            });
        }

        console.log('[BreadboardRenderer] Rendered', groupBoundaries.size, 'group highlights');
        return groupBoundaries;
    }
}

// Make available globally
window.BreadboardRenderer = BreadboardRenderer;

console.log('[BreadboardRenderer] Module loaded');
