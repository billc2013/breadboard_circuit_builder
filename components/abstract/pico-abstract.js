/**
 * Pico Abstract Renderer
 *
 * Renders a simplified representation of the Raspberry Pi Pico for abstract
 * layout mode. Shows only connected pins with labels, making the conceptual
 * connections clear without the complexity of the full pin layout.
 *
 * @author Bill Church with Claude Code
 * @version 1.0.0
 */

class PicoAbstractRenderer {
    constructor() {
        // Visual styling
        this.bodyColor = '#2d5a27';       // Pico green
        this.bodyStroke = '#4CAF50';
        this.bodyStrokeWidth = 2;
        this.cornerRadius = 8;

        // Pin styling
        this.pinColor = '#9a916c';         // Gold-ish
        this.pinStroke = '#30312e';
        this.pinSize = 6;
        this.pinLabelColor = '#d4d4d4';
        this.pinLabelSize = 8;

        // Title styling
        this.titleColor = '#ffffff';
        this.titleSize = 11;
    }

    /**
     * Render the abstract Pico representation
     * @param {Object} position - Position from layout engine
     * @param {SVGElement} svgLayer - SVG group to render into
     * @param {Set} connectedPins - Set of connected pin names (e.g., "GP15", "GND_3")
     * @param {Object} picoMetadata - Pico metadata (optional, for pin descriptions)
     * @returns {SVGGElement} The rendered group element
     */
    render(position, svgLayer, connectedPins, picoMetadata = null) {
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.classList.add('pico-abstract');
        group.setAttribute('data-component-id', 'pico1');

        const { centerX, centerY, width, height } = position;

        // 1. Render main body rectangle
        this.renderBody(group, centerX, centerY, width, height);

        // 2. Render title
        this.renderTitle(group, centerX, centerY, height);

        // 3. Render connected pins
        if (connectedPins && connectedPins.size > 0) {
            this.renderPins(group, centerX, centerY, width, height, connectedPins, picoMetadata);
        }

        svgLayer.appendChild(group);

        console.log('[PicoAbstract] Rendered with', connectedPins?.size || 0, 'connected pins');

        return group;
    }

    /**
     * Render the Pico body rectangle
     */
    renderBody(group, centerX, centerY, width, height) {
        const body = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        body.setAttribute('x', centerX - width / 2);
        body.setAttribute('y', centerY - height / 2);
        body.setAttribute('width', width);
        body.setAttribute('height', height);
        body.setAttribute('rx', this.cornerRadius);
        body.setAttribute('ry', this.cornerRadius);
        body.classList.add('pico-abstract-body');

        // Inline styles as fallback
        body.style.fill = this.bodyColor;
        body.style.stroke = this.bodyStroke;
        body.style.strokeWidth = this.bodyStrokeWidth;

        group.appendChild(body);
    }

    /**
     * Render the Pico title text
     */
    renderTitle(group, centerX, centerY, height) {
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        title.setAttribute('x', centerX);
        title.setAttribute('y', centerY - height / 2 + 18);
        title.setAttribute('text-anchor', 'middle');
        title.classList.add('pico-abstract-title');
        title.textContent = 'Pico';

        // Inline styles as fallback
        title.style.fill = this.titleColor;
        title.style.fontSize = `${this.titleSize}px`;
        title.style.fontWeight = 'bold';
        title.style.fontFamily = 'Arial, sans-serif';

        group.appendChild(title);
    }

    /**
     * Render connected pins along the right edge
     */
    renderPins(group, centerX, centerY, width, height, connectedPins, picoMetadata) {
        const connectedArray = Array.from(connectedPins);
        const pinCount = connectedArray.length;

        // Calculate vertical distribution
        const usableHeight = height - 40;  // Leave space for title and margin
        const startY = centerY - height / 2 + 30;
        const spacing = usableHeight / (pinCount + 1);

        // Pin position: right edge of body
        const pinX = centerX + width / 2;

        connectedArray.forEach((pinName, index) => {
            const pinY = startY + spacing * (index + 1);

            // Render pin marker (small circle)
            const pin = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            pin.setAttribute('cx', pinX);
            pin.setAttribute('cy', pinY);
            pin.setAttribute('r', this.pinSize / 2);
            pin.classList.add('pico-abstract-pin');
            pin.setAttribute('data-pin-name', pinName);

            // Color code by type
            const pinType = this.getPinType(pinName);
            pin.classList.add(`pin-type-${pinType}`);

            // Inline styles as fallback
            pin.style.fill = this.getPinColor(pinType);
            pin.style.stroke = this.pinStroke;
            pin.style.strokeWidth = '1';

            group.appendChild(pin);

            // Render pin label
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', pinX + 10);
            label.setAttribute('y', pinY + 3);
            label.setAttribute('text-anchor', 'start');
            label.classList.add('pico-abstract-pin-label');
            label.textContent = this.formatPinLabel(pinName, picoMetadata);

            // Inline styles as fallback
            label.style.fill = this.pinLabelColor;
            label.style.fontSize = `${this.pinLabelSize}px`;
            label.style.fontFamily = 'monospace';

            group.appendChild(label);

            // Store pin coordinates for wire routing
            pin._pinCoords = { x: pinX, y: pinY };
        });
    }

    /**
     * Get pin type from pin name
     * @param {string} pinName - e.g., "GP15", "GND_3", "3V3_OUT"
     * @returns {string} Type: 'gpio', 'ground', 'power', 'other'
     */
    getPinType(pinName) {
        const upper = pinName.toUpperCase();

        if (upper.startsWith('GP')) return 'gpio';
        if (upper.includes('GND')) return 'ground';
        if (upper.includes('3V3') || upper.includes('VBUS') || upper.includes('VSYS')) return 'power';

        return 'other';
    }

    /**
     * Get color for pin type
     */
    getPinColor(pinType) {
        const colors = {
            'gpio': '#00ccff',     // Cyan for GPIO
            'ground': '#666666',   // Dark gray for ground
            'power': '#ff6b6b',    // Red for power
            'other': '#9a916c'     // Gold for other
        };
        return colors[pinType] || colors.other;
    }

    /**
     * Format pin label for display
     * @param {string} pinName - Raw pin name (e.g., "GP15", "GND_3")
     * @param {Object} picoMetadata - Optional metadata for descriptions
     * @returns {string} Formatted label
     */
    formatPinLabel(pinName, picoMetadata) {
        // Simplify GND_X to just GND
        if (pinName.toUpperCase().startsWith('GND')) {
            return 'GND';
        }

        // Simplify 3V3_OUT to 3.3V
        if (pinName.toUpperCase().includes('3V3')) {
            return '3.3V';
        }

        // GPIO pins: just show the name
        return pinName;
    }

    /**
     * Get the coordinates for a specific pin (for wire routing)
     * @param {string} pinName
     * @param {Object} position - Pico position
     * @param {Set} connectedPins - Connected pins (for index calculation)
     * @returns {{x: number, y: number}}
     */
    getPinCoordinates(pinName, position, connectedPins) {
        const connectedArray = Array.from(connectedPins);
        const index = connectedArray.indexOf(pinName);

        if (index < 0) {
            // Pin not in connected set - return right edge center
            return {
                x: position.centerX + position.width / 2,
                y: position.centerY
            };
        }

        const pinCount = connectedArray.length;
        const usableHeight = position.height - 40;
        const startY = position.centerY - position.height / 2 + 30;
        const spacing = usableHeight / (pinCount + 1);

        return {
            x: position.centerX + position.width / 2,
            y: startY + spacing * (index + 1)
        };
    }

    /**
     * Remove the Pico abstract rendering
     * @param {SVGElement} svgLayer
     */
    static remove(svgLayer) {
        const existing = svgLayer.querySelector('.pico-abstract');
        if (existing) {
            existing.remove();
        }
    }
}

// Export for browser
window.PicoAbstractRenderer = PicoAbstractRenderer;

console.log('[PicoAbstract] Renderer loaded');
