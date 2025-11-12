// led-5mm-adapter.js
// Generic adapter for ALL 5mm LEDs with dynamic color rendering

/**
 * Adapter for LED 5mm (all colors)
 * Color is determined from component metadata at render time
 */
class LED5mmAdapter {
    constructor() {
        this.componentType = 'led-5mm';  // Generic type
    }
    
    validate(placement, breadboardHoles) {
        return validateLEDPlacement(placement, breadboardHoles);
    }
    
    calculatePosition(placement, breadboardHoles) {
        return calculateLEDPosition(placement, breadboardHoles);
    }
    
    getRequiredHoles(placement) {
        return [placement.cathode, placement.anode];
    }
    
    async render(componentId, position, metadata) {
        const componentsLayer = document.getElementById('components-layer');
        
        if (!componentsLayer) {
            throw new Error('Components layer not found in DOM');
        }
        
        // Extract color from metadata
        const colorName = extractLEDColor(metadata);
        const colorInfo = LED_5MM_CONFIG.colors[colorName];
        
        console.log(`  🎨 Rendering ${colorName} LED (${colorInfo.hex})`);
        
        // Load LED SVG
        const svgPath = LED_5MM_CONFIG.svg.file;
        const response = await fetch(svgPath);
        if (!response.ok) {
            throw new Error(`Failed to load LED SVG: ${svgPath}`);
        }
        const svgText = await response.text();
        
        // Parse SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        if (!svgElement) {
            throw new Error('Failed to parse LED SVG');
        }
        
        // Extract breadboard view
        const breadboardGroup = svgElement.querySelector('#breadboard');
        
        if (!breadboardGroup) {
            throw new Error('No breadboard group found in LED SVG');
        }
        
        // Create wrapper group
        const ledGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        ledGroup.classList.add('component', 'led', `led-${colorName}`);
        ledGroup.setAttribute('data-component-id', componentId);
        ledGroup.setAttribute('data-component-type', metadata.metadata.id);  // Specific type (led-red-5mm)
        ledGroup.setAttribute('data-color', colorName);
        
        // Clone content
        const clonedContent = breadboardGroup.cloneNode(true);
        
        // COLORIZE THE LED! 🎨
        this.applyColor(clonedContent, colorInfo.hex);
        
        // Remove long legs
        const connector0leg = clonedContent.querySelector('#connector0leg');
        const connector1leg = clonedContent.querySelector('#connector1leg');
        
        if (connector0leg) connector0leg.remove();
        if (connector1leg) connector1leg.remove();
        
        // Calculate positioning
        const { scale, insertionOffset } = LED_5MM_CONFIG.rendering;
        const { centerX, baseY } = LED_5MM_CONFIG.svg.body;

        // Apply transform: translate to center, rotate, then scale and offset
        // Rotation ensures cathode (short leg) is on the correct side
        const transform = `translate(${position.centerX}, ${position.centerY}) ` +
                         `rotate(${position.rotation}) ` +
                         `scale(${scale}) ` +
                         `translate(${-centerX}, ${-baseY + (insertionOffset / scale)})`;

        ledGroup.setAttribute('transform', transform);
        
        // Append cloned content
        ledGroup.appendChild(clonedContent);
        
        // Add stub legs
        const { cathodeStub, anodeStub } = LED_5MM_CONFIG.rendering;
        
        // Cathode stub (darker)
        const cathodeStubLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        cathodeStubLine.setAttribute('x1', position.cathodeCoords.x);
        cathodeStubLine.setAttribute('y1', position.cathodeCoords.y);
        cathodeStubLine.setAttribute('x2', position.cathodeCoords.x);
        cathodeStubLine.setAttribute('y2', position.cathodeCoords.y + insertionOffset);
        cathodeStubLine.setAttribute('stroke', cathodeStub.color);
        cathodeStubLine.setAttribute('stroke-width', cathodeStub.width);
        cathodeStubLine.setAttribute('stroke-linecap', 'round');
        cathodeStubLine.classList.add('led-stub', 'cathode-stub');
        
        // Anode stub (lighter)
        const anodeStubLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        anodeStubLine.setAttribute('x1', position.anodeCoords.x);
        anodeStubLine.setAttribute('y1', position.anodeCoords.y);
        anodeStubLine.setAttribute('x2', position.anodeCoords.x);
        anodeStubLine.setAttribute('y2', position.anodeCoords.y + insertionOffset);
        anodeStubLine.setAttribute('stroke', anodeStub.color);
        anodeStubLine.setAttribute('stroke-width', anodeStub.width);
        anodeStubLine.setAttribute('stroke-linecap', 'round');
        anodeStubLine.classList.add('led-stub', 'anode-stub');
        
        // Add stubs BEFORE LED body
        componentsLayer.appendChild(cathodeStubLine);
        componentsLayer.appendChild(anodeStubLine);
        
        // Add LED body
        componentsLayer.appendChild(ledGroup);
        
        // Add label with color indicator
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', position.centerX);
        label.setAttribute('y', position.centerY - 15);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '8');
        label.setAttribute('fill', '#333');
        label.setAttribute('font-weight', 'bold');
        label.textContent = `${componentId.toUpperCase()} (${colorName})`;
        label.classList.add('component-label');
        componentsLayer.appendChild(label);
        
        // Store metadata
        ledGroup._componentData = {
            position,
            metadata,
            config: LED_5MM_CONFIG,
            color: colorName
        };
        
        // Mark holes as occupied
        markHoleOccupied(position.cathodeHoleId, 'component', componentId);
        markHoleOccupied(position.anodeHoleId, 'component', componentId);
        
        console.log(`✓ ${colorName.toUpperCase()} LED rendered: ${componentId} at ${position.cathodeHoleId}/${position.anodeHoleId}`);
    }
    
    /**
     * Apply color to LED SVG elements
     * Finds all color_* elements and changes their fill
     */
    applyColor(svgContent, hexColor) {
        const colorElements = LED_5MM_CONFIG.svg.colorElements;
        
        colorElements.forEach(selector => {
            const element = svgContent.querySelector(selector);
            if (element) {
                element.setAttribute('fill', hexColor);
                
                // Adjust opacity for depth effect
                const currentOpacity = element.getAttribute('opacity');
                if (currentOpacity) {
                    // Keep opacity but with new color
                    element.setAttribute('opacity', currentOpacity);
                }
            }
        });
        
        console.log(`  ✓ Applied color ${hexColor} to LED SVG`);
    }
}

// Register adapter globally
window.LED5mmAdapter = LED5mmAdapter;

console.log('LED5mmAdapter loaded (supports all colors)');
