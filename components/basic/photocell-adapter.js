// photocell-adapter.js
// Adapter for Light Dependent Resistor (LDR/Photocell)

/**
 * Adapter for photocell/LDR
 */
class PhotocellAdapter {
    constructor() {
        this.componentType = 'photocell';
    }

    validate(placement, breadboardHoles) {
        return validatePhotocellPlacement(placement, breadboardHoles);
    }

    calculatePosition(placement, breadboardHoles) {
        return calculatePhotocellPosition(placement, breadboardHoles);
    }

    getRequiredHoles(placement) {
        return [placement.pins.pin0, placement.pins.pin1];
    }

    async render(componentId, position, metadata) {
        const componentsLayer = document.getElementById('components-layer');

        if (!componentsLayer) {
            throw new Error('Components layer not found in DOM');
        }

        console.log(`  💡 Rendering photocell/LDR`);

        // Load photocell SVG
        const svgPath = PHOTOCELL_CONFIG.svg.file;
        const response = await fetch(svgPath);
        if (!response.ok) {
            throw new Error(`Failed to load photocell SVG: ${svgPath}`);
        }
        const svgText = await response.text();

        // Parse SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');

        if (!svgElement) {
            throw new Error('Failed to parse photocell SVG');
        }

        // Extract breadboard view
        const breadboardGroup = svgElement.querySelector('#breadboard');

        if (!breadboardGroup) {
            throw new Error('No breadboard group found in photocell SVG');
        }

        // Create wrapper group
        const photocellGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        photocellGroup.classList.add('component', 'photocell', 'ldr');
        photocellGroup.setAttribute('data-component-id', componentId);
        photocellGroup.setAttribute('data-component-type', 'photocell');

        // Clone content
        const clonedContent = breadboardGroup.cloneNode(true);

        // Remove long legs (we'll draw stub legs to breadboard holes)
        const connector0leg = clonedContent.querySelector('#connector0leg');
        const connector1leg = clonedContent.querySelector('#connector1leg');

        if (connector0leg) connector0leg.remove();
        if (connector1leg) connector1leg.remove();

        // Get SVG connector positions
        const { pin0, pin1 } = PHOTOCELL_CONFIG.svg.connectors;

        // Calculate translation based on orientation
        let translateX, translateY, rotation;
        const scale = position.scale;

        if (position.orientation === 'horizontal') {
            translateX = position.pin0Coords.x - (pin0.x * scale);
            translateY = position.pin0Coords.y - (pin0.y * scale);
            rotation = 0;
        } else {
            // Vertical placement
            translateX = position.centerX;
            translateY = position.centerY;
            rotation = 90;
        }

        // Apply transform
        if (position.orientation === 'horizontal') {
            photocellGroup.setAttribute('transform',
                `translate(${translateX}, ${translateY}) scale(${scale})`
            );
        } else {
            const adjustX = -((pin0.x + pin1.x) / 2) * scale;
            const adjustY = -((pin0.y + pin1.y) / 2) * scale;
            photocellGroup.setAttribute('transform',
                `translate(${translateX}, ${translateY}) rotate(${rotation}) translate(${adjustX}, ${adjustY}) scale(${scale})`
            );
        }

        // Append cloned content
        photocellGroup.appendChild(clonedContent);

        // Add stub legs to breadboard holes
        const insertionOffset = -8;  // Same as LED

        // Pin0 stub
        const pin0StubLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        pin0StubLine.setAttribute('x1', position.pin0Coords.x);
        pin0StubLine.setAttribute('y1', position.pin0Coords.y);
        pin0StubLine.setAttribute('x2', position.pin0Coords.x);
        pin0StubLine.setAttribute('y2', position.pin0Coords.y + insertionOffset);
        pin0StubLine.setAttribute('stroke', '#8C8C8C');
        pin0StubLine.setAttribute('stroke-width', '1.5');
        pin0StubLine.setAttribute('stroke-linecap', 'round');
        pin0StubLine.classList.add('photocell-stub', 'pin0-stub');

        // Pin1 stub
        const pin1StubLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        pin1StubLine.setAttribute('x1', position.pin1Coords.x);
        pin1StubLine.setAttribute('y1', position.pin1Coords.y);
        pin1StubLine.setAttribute('x2', position.pin1Coords.x);
        pin1StubLine.setAttribute('y2', position.pin1Coords.y + insertionOffset);
        pin1StubLine.setAttribute('stroke', '#8C8C8C');
        pin1StubLine.setAttribute('stroke-width', '1.5');
        pin1StubLine.setAttribute('stroke-linecap', 'round');
        pin1StubLine.classList.add('photocell-stub', 'pin1-stub');

        // Add stubs BEFORE photocell body
        componentsLayer.appendChild(pin0StubLine);
        componentsLayer.appendChild(pin1StubLine);

        // Add photocell body
        componentsLayer.appendChild(photocellGroup);

        // Add label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', position.centerX);
        label.setAttribute('y', position.centerY - 15);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '8');
        label.setAttribute('fill', '#333');
        label.setAttribute('font-weight', 'bold');
        label.textContent = `${componentId.toUpperCase()} (LDR)`;
        label.classList.add('component-label');
        componentsLayer.appendChild(label);

        // Store metadata
        photocellGroup._componentData = {
            position,
            metadata,
            config: PHOTOCELL_CONFIG
        };

        // Mark holes as occupied
        markHoleOccupied(position.pin0HoleId, 'component', componentId);
        markHoleOccupied(position.pin1HoleId, 'component', componentId);

        console.log(`✓ Photocell rendered: ${componentId} at ${position.pin0HoleId}/${position.pin1HoleId}`);
    }
}

// Register adapter globally
window.PhotocellAdapter = PhotocellAdapter;

console.log('PhotocellAdapter loaded');
