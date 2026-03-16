/**
 * BreadboardPlacementSystem - Maps parsed components to specific breadboard holes
 *
 * Replaces AbstractLayoutSystem for the parse_to_breadboard branch.
 * Uses breadboard-placements.json for deterministic component positions
 * and BREADBOARD_HOLES (from breadboard-data.js) for coordinate lookups.
 */
class BreadboardPlacementSystem {
    constructor() {
        this.placements = null;          // Loaded from breadboard-placements.json
        this.typeNormalization = {};      // e.g., "led-red-5mm" → "led-5mm"
        this.slotAllocation = new Map();  // formFactor → next available slot index
        this.assignedPlacements = new Map(); // componentId → { placement, position, formFactor, slot }
        this.loaded = false;
    }

    /**
     * Load placement registry from JSON
     */
    async load() {
        try {
            const response = await fetch('breadboard-placements.json');
            const data = await response.json();
            this.placements = data.placements;
            this.typeNormalization = data.typeNormalization || {};
            this.loaded = true;
            console.log('[BreadboardPlacement] Loaded placement registry:', Object.keys(this.placements).join(', '));
        } catch (err) {
            console.error('[BreadboardPlacement] Failed to load placements:', err);
        }
    }

    /**
     * Normalize a component type to its form factor key
     * e.g., "led-red-5mm" → "led-5mm"
     * @param {string} componentType
     * @returns {string} form factor key
     */
    normalizeType(componentType) {
        return this.typeNormalization[componentType] || componentType;
    }

    /**
     * Clear all placement assignments (for re-parsing)
     */
    clear() {
        this.slotAllocation.clear();
        this.assignedPlacements.clear();
    }

    /**
     * Assign breadboard placements for all components in functional groups
     * @param {Array} functionalGroups - Groups from buildFunctionalGroupsFromParser()
     * @returns {Map} componentId → { placement, position, formFactor, slot }
     */
    assignPlacements(functionalGroups, componentMetadata) {
        this.clear();

        if (!this.loaded || !this.placements) {
            console.error('[BreadboardPlacement] Registry not loaded');
            return this.assignedPlacements;
        }

        for (const group of functionalGroups) {
            // Get the actual component type from the group's metadata
            const componentType = this._getComponentType(group);
            const formFactor = this.normalizeType(componentType);

            const placementDef = this.placements[formFactor];
            if (!placementDef) {
                console.warn(`[BreadboardPlacement] No placement defined for form factor: ${formFactor} (type: ${componentType})`);
                continue;
            }

            // Allocate next available slot
            const slotIndex = this.slotAllocation.get(formFactor) || 0;
            if (slotIndex >= placementDef.slots.length) {
                console.warn(`[BreadboardPlacement] No more slots for ${formFactor} (used ${slotIndex}/${placementDef.slots.length})`);
                continue;
            }
            this.slotAllocation.set(formFactor, slotIndex + 1);

            const slotDef = placementDef.slots[slotIndex];

            // Assign primary component
            this._assignComponent(group.primaryComponent, slotDef.placement, formFactor, slotIndex);

            // Assign support components (resistors, etc.)
            for (const supportId of (group.supportComponents || [])) {
                const supportType = this._getSupportType(supportId, componentMetadata);
                const supportFormFactor = this.normalizeType(supportType);

                if (slotDef.supportPlacements && slotDef.supportPlacements[supportFormFactor]) {
                    this._assignComponent(supportId, slotDef.supportPlacements[supportFormFactor], supportFormFactor, slotIndex);
                } else {
                    console.warn(`[BreadboardPlacement] No support placement for ${supportFormFactor} in ${formFactor} slot ${slotIndex}`);
                }
            }

            console.log(`[BreadboardPlacement] ${componentType} → ${formFactor} slot ${slotIndex}:`, slotDef.placement);
        }

        return this.assignedPlacements;
    }

    /**
     * Assign a single component to specific breadboard holes
     * @param {string} componentId
     * @param {Object} holePlacements - { pinName: holeId, ... }
     * @param {string} formFactor
     * @param {number} slotIndex
     */
    _assignComponent(componentId, holePlacements, formFactor, slotIndex) {
        // Resolve each pin's hole to coordinates
        const pinPositions = {};
        let sumX = 0, sumY = 0, pinCount = 0;

        for (const [pinName, holeId] of Object.entries(holePlacements)) {
            const hole = getHoleById(holeId);
            if (hole) {
                pinPositions[pinName] = { x: hole.x, y: hole.y, holeId: hole.id, bus: hole.bus };
                sumX += hole.x;
                sumY += hole.y;
                pinCount++;
            } else {
                console.warn(`[BreadboardPlacement] Hole not found: ${holeId} for ${componentId}.${pinName}`);
            }
        }

        const centerX = pinCount > 0 ? sumX / pinCount : 0;
        const centerY = pinCount > 0 ? sumY / pinCount : 0;

        this.assignedPlacements.set(componentId, {
            placement: holePlacements,
            pinPositions,
            centerX,
            centerY,
            formFactor,
            slotIndex
        });
    }

    /**
     * Extract component type from a functional group
     */
    _getComponentType(group) {
        // Try metadata paths — primaryMetadata is the component object from library JSON
        // Structure: { metadata: { id: "led-red-5mm" }, functionalGroup: {...}, ... }
        if (group.primaryMetadata?.metadata?.id) {
            return group.primaryMetadata.metadata.id;
        }
        // Graphics test groups use a flat { id: "led-red-5mm" } shorthand
        if (group.primaryMetadata?.id) {
            return group.primaryMetadata.id;
        }
        // Fallback: strip instance suffix from component ID (e.g., "led-red-5mm-0" → "led-red-5mm")
        return group.primaryComponent.replace(/-\d+$/, '');
    }

    /**
     * Extract support component type from its ID
     * @param {string} supportId - e.g., "led-resistor" or "resistor-220-0"
     * @param {Map} [componentMetadata] - Optional metadata map for type lookup
     */
    _getSupportType(supportId, componentMetadata) {
        // Try componentMetadata first (has the actual type, e.g., "resistor-220")
        if (componentMetadata?.get) {
            const compData = componentMetadata.get(supportId);
            if (compData?.type) return compData.type;
        }
        // Fallback: strip instance suffix (works for graphics test IDs like "resistor-220-0")
        return supportId.replace(/-\d+$/, '');
    }

    /**
     * Get position for a component
     * @param {string} componentId
     * @returns {{centerX, centerY, pinPositions}|null}
     */
    getComponentPosition(componentId) {
        return this.assignedPlacements.get(componentId) || null;
    }

    /**
     * Get the coordinate of a specific pin on a placed component
     * @param {string} componentId
     * @param {string} pinName
     * @returns {{x, y, holeId, bus}|null}
     */
    getWireEndpoint(componentId, pinName) {
        const assignment = this.assignedPlacements.get(componentId);
        if (!assignment) return null;
        return assignment.pinPositions[pinName] || null;
    }

    /**
     * Get all assigned placements
     * @returns {Map}
     */
    getAllPlacements() {
        return this.assignedPlacements;
    }

    /**
     * Check if placements have been assigned
     * @returns {boolean}
     */
    isActive() {
        return this.assignedPlacements.size > 0;
    }
}

// Make available globally
window.BreadboardPlacementSystem = BreadboardPlacementSystem;

console.log('[BreadboardPlacement] Module loaded');
