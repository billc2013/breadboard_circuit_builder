// us100-adapter.js
// Adapter for US-100 Ultrasonic Distance Sensor

/**
 * Adapter for US-100 Ultrasonic Distance Sensor
 * Handles 5-pin module: VCC, TRIG, ECHO, GND, GND-2
 */
class US100Adapter {
    constructor() {
        this.componentType = 'us100-ultrasonic';
    }

    validate(placement, breadboardHoles) {
        return validateUS100Placement(placement, breadboardHoles);
    }

    calculatePosition(placement, breadboardHoles) {
        return calculateUS100Position(placement, breadboardHoles);
    }

    getRequiredHoles(placement) {
        return getUS100RequiredHoles(placement);
    }

    async render(componentId, position, metadata) {
        const componentsLayer = document.getElementById('components-layer');

        if (!componentsLayer) {
            throw new Error('Components layer not found in DOM');
        }

        console.log(`  📡 Rendering US-100 ultrasonic sensor`);

        // Load US-100 SVG
        const svgPath = US100_CONFIG.svg.file;
        const response = await fetch(svgPath);
        if (!response.ok) {
            throw new Error(`Failed to load US-100 SVG: ${svgPath}`);
        }
        const svgText = await response.text();

        // Parse SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');

        if (!svgElement) {
            throw new Error('Failed to parse US-100 SVG');
        }

        // Extract breadboard view
        const breadboardGroup = svgDoc.querySelector('#breadboard');

        if (!breadboardGroup) {
            throw new Error('No breadboard group found in US-100 SVG');
        }

        // Create wrapper group
        const sensorGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        sensorGroup.classList.add('component', 'us100-ultrasonic');
        sensorGroup.setAttribute('data-component-id', componentId);
        sensorGroup.setAttribute('data-component-type', metadata.metadata.id);

        // Clone content
        const clonedContent = breadboardGroup.cloneNode(true);

        // Get rendering settings
        const { scale, verticalOffset } = US100_CONFIG.rendering;
        const { centerX: svgCenterX, centerY: svgCenterY } = US100_CONFIG.svg.body;

        // The SVG already has transform="translate(22,0)" so the center is at x=0
        // We need to position it so the ECHO pin (center) aligns with position.centerX
        const translateX = position.centerX - (svgCenterX * scale);
        const translateY = position.centerY - (svgCenterY * scale) + verticalOffset;

        // Apply transform based on orientation
        if (position.orientation === 'vertical') {
            // Rotate 90 degrees for vertical placement (pins going down into breadboard)
            sensorGroup.setAttribute('transform',
                `translate(${position.centerX}, ${position.centerY}) rotate(${position.rotation}) translate(${-svgCenterX * scale}, ${-(svgCenterY * scale) + verticalOffset}) scale(${scale})`
            );
        } else {
            // Horizontal (default orientation from SVG)
            sensorGroup.setAttribute('transform',
                `translate(${translateX}, ${translateY}) scale(${scale})`
            );
        }

        // Append cloned content
        sensorGroup.appendChild(clonedContent);

        // Add to components layer
        componentsLayer.appendChild(sensorGroup);

        // Store metadata
        sensorGroup._componentData = {
            position,
            metadata,
            config: US100_CONFIG,
            scale
        };

        // Build placement object for hover info
        const placement = {
            vcc: position.vccHoleId,
            trig: position.trigHoleId,
            echo: position.echoHoleId,
            gnd: position.gndHoleId,
            gnd2: position.gnd2HoleId
        };

        // Add hover event listeners for info box
        sensorGroup.addEventListener('mouseover', () => {
            if (window.breadboardApp) {
                window.breadboardApp.showComponentInfo(componentId, metadata, placement, position);
            }
        });

        sensorGroup.addEventListener('mouseout', () => {
            if (window.breadboardApp) {
                window.breadboardApp.hideComponentInfo();
            }
        });

        // Mark holes as occupied
        const pinNames = ['vcc', 'trig', 'echo', 'gnd', 'gnd2'];
        for (const pin of pinNames) {
            const holeId = position[`${pin}HoleId`];
            if (holeId) {
                markHoleOccupied(holeId, 'component', componentId);
            }
        }

        const occupiedHoles = pinNames
            .map(p => position[`${p}HoleId`])
            .filter(h => h)
            .join('/');

        console.log(`✓ US-100 rendered: ${componentId} at ${occupiedHoles}`);
    }
}

// Register adapter globally
window.US100Adapter = US100Adapter;

console.log('US100Adapter loaded (supports US-100 ultrasonic distance sensor)');
