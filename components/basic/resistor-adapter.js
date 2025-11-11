// resistor-adapter.js
// Generic adapter for ALL through-hole resistors

/**
 * Adapter for resistors (all values)
 * Resistance value is determined from component metadata at render time
 */
class ResistorAdapter {
    constructor() {
        this.componentType = 'resistor';  // Generic type
    }
    
    validate(placement, breadboardHoles) {
        return validateResistorPlacement(placement, breadboardHoles);
    }
    
    calculatePosition(placement, breadboardHoles) {
        return calculateResistorPosition(placement, breadboardHoles);
    }
    
    getRequiredHoles(placement) {
        return [placement.pin0, placement.pin1];
    }
    
    /**
     * Render color bands as overlays on the resistor body
     * @param {SVGElement} resistorGroup - The resistor group element
     * @param {Object} metadata - Component metadata
     * @param {number} scale - Current scale factor
     */
    renderColorBands(resistorGroup, metadata, scale) {
        const colorBandNames = getResistorColorBands(metadata);
        const { positions, y, height, colors } = RESISTOR_CONFIG.colorBands;

        // Create a group for color bands
        const bandsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        bandsGroup.classList.add('color-bands');

        // Render each color band
        colorBandNames.forEach((colorName, index) => {
            if (index >= positions.length) {
                console.warn(`No position defined for band ${index + 1}`);
                return;
            }

            const bandPos = positions[index];
            const hexColor = colors[colorName] || colors['Black']; // Fallback to black

            // Create rectangle for color band
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', bandPos.x);
            rect.setAttribute('y', y);
            rect.setAttribute('width', bandPos.width);
            rect.setAttribute('height', height);
            rect.setAttribute('fill', hexColor);

            // Add stroke for visibility (especially for yellow/white bands)
            if (colorName === 'Yellow' || colorName === 'White') {
                rect.setAttribute('stroke', '#999');
                rect.setAttribute('stroke-width', '0.2');
            }

            bandsGroup.appendChild(rect);
        });

        // Append bands to resistor group (on top of base SVG)
        resistorGroup.appendChild(bandsGroup);
    }

    async render(componentId, position, metadata) {
        const componentsLayer = document.getElementById('components-layer');
        
        if (!componentsLayer) {
            throw new Error('Components layer not found in DOM');
        }
        
        // Extract resistance value and label
        const valueKey = extractResistanceValue(metadata);
        const label = getResistorLabel(metadata);
        
        console.log(`  📊 Rendering ${label} resistor`);
        
        // Load resistor SVG
        const svgPath = RESISTOR_CONFIG.svg.file;
        const response = await fetch(svgPath);
        if (!response.ok) {
            throw new Error(`Failed to load resistor SVG: ${svgPath}`);
        }
        const svgText = await response.text();
        
        // Parse SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        if (!svgElement) {
            throw new Error('Failed to parse resistor SVG');
        }
        
        // Extract breadboard view
        const breadboardGroup = svgElement.querySelector('#breadboard');
        
        if (!breadboardGroup) {
            throw new Error('No breadboard group found in resistor SVG');
        }
        
        // Create wrapper group
        const resistorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        resistorGroup.classList.add('component', 'resistor', `resistor-${valueKey}`);
        resistorGroup.setAttribute('data-component-id', componentId);
        resistorGroup.setAttribute('data-component-type', metadata.metadata.id);  // Specific type (resistor-10k)
        resistorGroup.setAttribute('data-resistance', valueKey);
        
        // Clone content
        const clonedContent = breadboardGroup.cloneNode(true);
        
        // Calculate dynamic scale
        const scale = calculateResistorScale(position.actualSpacing);
        
        // Get SVG connector positions
        const { pin0, pin1 } = RESISTOR_CONFIG.svg.connectors;
        
        // Calculate translation
        let translateX, translateY, rotation;
        
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
            resistorGroup.setAttribute('transform', 
                `translate(${translateX}, ${translateY}) scale(${scale})`
            );
        } else {
            const adjustX = -((pin0.x + pin1.x) / 2) * scale;
            const adjustY = -((pin0.y + pin1.y) / 2) * scale;
            resistorGroup.setAttribute('transform', 
                `translate(${translateX}, ${translateY}) rotate(${rotation}) translate(${adjustX}, ${adjustY}) scale(${scale})`
            );
        }
        
        // Append cloned content
        resistorGroup.appendChild(clonedContent);

        // Render color bands (overlays on top of base SVG)
        this.renderColorBands(resistorGroup, metadata, scale);

        // Add to components layer
        componentsLayer.appendChild(resistorGroup);
        
        // Add label with resistance value
        const labelElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        labelElement.setAttribute('x', position.centerX);
        labelElement.setAttribute('y', position.centerY - 8);
        labelElement.setAttribute('text-anchor', 'middle');
        labelElement.setAttribute('font-size', '8');
        labelElement.setAttribute('fill', '#333');
        labelElement.setAttribute('font-weight', 'bold');
        labelElement.textContent = label;
        labelElement.classList.add('component-label');
        componentsLayer.appendChild(labelElement);
        
        // Store metadata
        resistorGroup._componentData = {
            position,
            metadata,
            config: RESISTOR_CONFIG,
            scale,
            resistanceValue: valueKey,
            label
        };
        
        // Mark holes as occupied
        markHoleOccupied(position.pin0HoleId, 'component', componentId);
        markHoleOccupied(position.pin1HoleId, 'component', componentId);
        
        console.log(`✓ ${label} resistor rendered: ${componentId} at ${position.pin0HoleId}/${position.pin1HoleId} (scale: ${scale.toFixed(2)})`);
    }
}

// Register adapter globally
window.ResistorAdapter = ResistorAdapter;

console.log('ResistorAdapter loaded (supports all resistance values)');
