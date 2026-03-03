/**
 * Physical Layout Engine
 *
 * Wraps the existing breadboard-based layout behavior. This is the "pass-through"
 * layout that uses the original BREADBOARD_HOLES coordinates and component
 * adapters' calculatePosition() methods.
 *
 * In physical mode, positions come from the circuit JSON placement data and
 * are resolved via breadboard hole coordinates. This engine is essentially
 * a no-op - it lets the existing CircuitLoader handle everything.
 *
 * @author Bill Church with Claude Code
 * @version 1.0.0
 */

class PhysicalLayoutEngine extends LayoutEngine {
    constructor() {
        // Use original breadboard SVG dimensions
        super(400, 200);
    }

    getName() {
        return 'Physical Breadboard';
    }

    getDescription() {
        return 'Components positioned on physical breadboard layout';
    }

    /**
     * Physical layout doesn't pre-calculate positions.
     * The CircuitLoader and component adapters handle this directly.
     */
    calculateLayout(circuitData, functionalGroups) {
        console.log('[PhysicalLayout] Physical layout uses CircuitLoader directly');

        // Clear any stored positions
        this.clear();

        // Store circuit data reference
        this.circuitData = circuitData;

        // In physical mode, we don't pre-calculate positions
        // The existing flow is:
        // 1. CircuitLoader.loadCircuit() calls renderComponent()
        // 2. renderComponent() calls adapter.calculatePosition(placement, BREADBOARD_HOLES)
        // 3. adapter.render() uses those coordinates

        // We only track wire routes for consistency with abstract layout
        if (circuitData?.circuit?.wires) {
            for (const wire of circuitData.circuit.wires) {
                // Physical wires use fromCoords/toCoords from JSON
                if (wire.fromCoords && wire.toCoords) {
                    this.setWireRoute(wire.id, {
                        from: wire.fromCoords,
                        to: wire.toCoords,
                        type: 'straight',
                        waypoints: wire.waypoints || []
                    });
                }
            }
        }
    }

    /**
     * In physical mode, positions are calculated on-demand by adapters
     */
    getComponentPosition(componentId) {
        // Physical layout doesn't pre-calculate positions
        // Return null to signal that CircuitLoader should use its normal flow
        return null;
    }

    /**
     * Get wire route from stored circuit data
     */
    getWireRoute(wireId) {
        return this.wireRoutes.get(wireId) || null;
    }
}

// Register with layout registry
if (window.layoutRegistry) {
    window.layoutRegistry.register('physical', PhysicalLayoutEngine);
}

// Export for browser
window.PhysicalLayoutEngine = PhysicalLayoutEngine;

console.log('[PhysicalLayout] Layout engine loaded');
