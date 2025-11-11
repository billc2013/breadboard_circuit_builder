// button-adapter.js
// Generic adapter for tactile pushbuttons

/**
 * Adapter for tactile pushbuttons
 * Handles 2-pin momentary switches (SPST, normally open)
 */
class ButtonAdapter {
    constructor() {
        this.componentType = 'button';
    }
    
    validate(placement, breadboardHoles) {
        return validateButtonPlacement(placement, breadboardHoles);
    }
    
    calculatePosition(placement, breadboardHoles) {
        return calculateButtonPosition(placement, breadboardHoles);
    }
    
    getRequiredHoles(placement) {
        return [placement.leg0, placement.leg1];
    }
    
    async render(componentId, position, metadata) {
        const componentsLayer = document.getElementById('components-layer');
        
        if (!componentsLayer) {
            throw new Error('Components layer not found in DOM');
        }
        
        console.log(`  🔘 Rendering button`);
        
        // Load button SVG
        const svgPath = BUTTON_CONFIG.svg.file;
        const response = await fetch(svgPath);
        if (!response.ok) {
            throw new Error(`Failed to load button SVG: ${svgPath}`);
        }
        const svgText = await response.text();
        
        // Parse SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        if (!svgElement) {
            throw new Error('Failed to parse button SVG');
        }
        
        // Extract breadboard view
        const breadboardGroup = svgDoc.querySelector('#breadboard');
        
        if (!breadboardGroup) {
            throw new Error('No breadboard group found in button SVG');
        }
        
        // Create wrapper group
        const buttonGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        buttonGroup.classList.add('component', 'button');
        buttonGroup.setAttribute('data-component-id', componentId);
        buttonGroup.setAttribute('data-component-type', metadata.metadata.id);
        
        // Clone content
        const clonedContent = breadboardGroup.cloneNode(true);
        
        // Get rendering settings
        const { scale, verticalOffset } = BUTTON_CONFIG.rendering;
        const { centerX, centerY } = BUTTON_CONFIG.svg.body;
        
        // Calculate positioning
        // Button sits ON TOP of breadboard with legs going into holes
        const translateX = position.centerX - (centerX * scale);
        const translateY = position.centerY - (centerY * scale) + verticalOffset;
        
        // Apply transform (with rotation if horizontal)
        if (position.orientation === 'horizontal') {
            // Rotate around button center for horizontal placement
            buttonGroup.setAttribute('transform', 
                `translate(${position.centerX}, ${position.centerY}) rotate(${position.rotation}) translate(${-centerX * scale}, ${-(centerY * scale) + verticalOffset}) scale(${scale})`
            );
        } else {
            // Vertical (default)
            buttonGroup.setAttribute('transform', 
                `translate(${translateX}, ${translateY}) scale(${scale})`
            );
        }
        
        // Append cloned content
        buttonGroup.appendChild(clonedContent);
        
        // Add to components layer
        componentsLayer.appendChild(buttonGroup);
        
        // Add label
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', position.centerX);
        label.setAttribute('y', position.centerY - 30);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '8');
        label.setAttribute('fill', '#333');
        label.setAttribute('font-weight', 'bold');
        label.textContent = componentId.toUpperCase();
        label.classList.add('component-label');
        componentsLayer.appendChild(label);
        
        // Store metadata
        buttonGroup._componentData = {
            position,
            metadata,
            config: BUTTON_CONFIG,
            scale
        };
        
        // Mark holes as occupied
        markHoleOccupied(position.leg0HoleId, 'component', componentId);
        markHoleOccupied(position.leg1HoleId, 'component', componentId);
        
        console.log(`✓ Button rendered: ${componentId} at ${position.leg0HoleId}/${position.leg1HoleId}`);
    }
}

// Register adapter globally
window.ButtonAdapter = ButtonAdapter;

console.log('ButtonAdapter loaded (supports tactile pushbuttons)');
