// tb6612-adapter.js
// Adapter for Adafruit TB6612 Dual Motor Driver

/**
 * Adapter for TB6612 Dual Motor Driver
 * Handles essential pins for basic 2-motor control
 */
class TB6612Adapter {
    constructor() {
        this.componentType = 'tb6612-motor-driver';
    }

    validate(placement, breadboardHoles) {
        return validateTB6612Placement(placement, breadboardHoles);
    }

    calculatePosition(placement, breadboardHoles) {
        return calculateTB6612Position(placement, breadboardHoles);
    }

    getRequiredHoles(placement) {
        return getTB6612RequiredHoles(placement);
    }

    async render(componentId, position, metadata) {
        const componentsLayer = document.getElementById('components-layer');

        if (!componentsLayer) {
            throw new Error('Components layer not found in DOM');
        }

        console.log(`  🔧 Rendering TB6612 motor driver`);

        // Load TB6612 SVG
        const svgPath = TB6612_CONFIG.svg.file;
        const response = await fetch(svgPath);
        if (!response.ok) {
            throw new Error(`Failed to load TB6612 SVG: ${svgPath}`);
        }
        const svgText = await response.text();

        // Parse SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');

        if (!svgElement) {
            throw new Error('Failed to parse TB6612 SVG');
        }

        // Extract breadboard view
        const breadboardGroup = svgDoc.querySelector('#breadboard');

        if (!breadboardGroup) {
            throw new Error('No breadboard group found in TB6612 SVG');
        }

        // Create wrapper group
        const driverGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        driverGroup.classList.add('component', 'tb6612-motor-driver');
        driverGroup.setAttribute('data-component-id', componentId);
        driverGroup.setAttribute('data-component-type', metadata.metadata.id);

        // Clone content
        const clonedContent = breadboardGroup.cloneNode(true);

        // Get rendering settings
        const { scale, verticalOffset } = TB6612_CONFIG.rendering;
        const { centerX: svgCenterX, centerY: svgCenterY } = TB6612_CONFIG.svg.body;

        // Calculate positioning
        const translateX = position.centerX - (svgCenterX * scale);
        const translateY = position.centerY - (svgCenterY * scale) + verticalOffset;

        // Apply transform
        driverGroup.setAttribute('transform',
            `translate(${translateX}, ${translateY}) scale(${scale})`
        );

        // Append cloned content
        driverGroup.appendChild(clonedContent);

        // Add to components layer
        componentsLayer.appendChild(driverGroup);

        // Store metadata
        driverGroup._componentData = {
            position,
            metadata,
            config: TB6612_CONFIG,
            scale
        };

        // Build placement object for hover info
        const allPins = [
            'vm', 'vcc', 'gnd', 'stby',
            'ain1', 'ain2', 'pwma',
            'bin1', 'bin2', 'pwmb',
            'motora1', 'motora2', 'motorb1', 'motorb2'
        ];

        const placement = {};
        for (const pin of allPins) {
            placement[pin] = position[`${pin}HoleId`];
        }

        // Add hover event listeners for info box
        driverGroup.addEventListener('mouseover', () => {
            if (window.breadboardApp) {
                window.breadboardApp.showComponentInfo(componentId, metadata, placement, position);
            }
        });

        driverGroup.addEventListener('mouseout', () => {
            if (window.breadboardApp) {
                window.breadboardApp.hideComponentInfo();
            }
        });

        // Mark holes as occupied
        for (const pin of allPins) {
            const holeId = position[`${pin}HoleId`];
            if (holeId) {
                markHoleOccupied(holeId, 'component', componentId);
            }
        }

        // Log occupied holes
        const occupiedHoles = allPins
            .map(p => position[`${p}HoleId`])
            .filter(h => h)
            .join(', ');

        console.log(`✓ TB6612 rendered: ${componentId}`);
        console.log(`  Occupied holes: ${occupiedHoles}`);
    }
}

// Register adapter globally
window.TB6612Adapter = TB6612Adapter;

console.log('TB6612Adapter loaded (supports Adafruit TB6612 dual motor driver)');
