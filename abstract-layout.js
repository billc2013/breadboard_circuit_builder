/**
 * AbstractLayoutSystem - Slot-based positioning for Circuit Explorer
 *
 * Provides abstract visualization of circuits where:
 * - Canvas is divided into sensor region (top) and output region (bottom)
 * - Each region has 3 slots for functional groups
 * - Slot sizes are dynamic based on group count:
 *   - 1 group: large, centered
 *   - 2 groups: medium, side-by-side
 *   - 3+ groups: smaller, distributed
 *
 * This abstraction layer translates physical breadboard positions to
 * conceptual slot positions, enabling both:
 * - Circuit JSON with hole locations (current)
 * - Future: MicroPython program analysis
 */
class AbstractLayoutSystem {
    constructor(options = {}) {
        // Canvas dimensions (viewBox of the SVG)
        this.canvas = {
            width: options.canvasWidth || 400,
            height: options.canvasHeight || 200,
            // Pico board area on the left
            picoAreaWidth: options.picoAreaWidth || 85
        };

        // Available area for slots (excludes Pico area)
        this.slotArea = {
            x: this.canvas.picoAreaWidth,
            y: 20,  // Top margin
            width: this.canvas.width - this.canvas.picoAreaWidth - 20,  // Right margin
            height: this.canvas.height - 40  // Top + bottom margin
        };

        // Layout configuration
        this.config = {
            // Number of slots per row
            maxSlotsPerRow: 3,

            // Slot sizing strategies
            slotSizing: {
                single: { widthRatio: 0.5, heightRatio: 0.35 },   // 1 group: larger, centered
                double: { widthRatio: 0.45, heightRatio: 0.35 },  // 2 groups: side-by-side
                triple: { widthRatio: 0.30, heightRatio: 0.32 }   // 3+ groups: smaller
            },

            // Spacing between slots
            slotGap: 10,

            // Padding inside slot boundaries
            slotPadding: 12,

            // Vertical split ratio (sensor area vs output area)
            verticalSplit: 0.5,

            // Minimum slot dimensions
            minSlotWidth: 60,
            minSlotHeight: 45
        };

        // Calculated slot positions
        this.slots = {
            sensors: [],  // Top region slots
            outputs: []   // Bottom region slots
        };

        // Group to slot mapping
        this.groupToSlot = new Map();

        console.log('[AbstractLayout] System initialized:', {
            canvas: this.canvas,
            slotArea: this.slotArea
        });
    }

    /**
     * Calculate slot positions for functional groups
     * @param {Array} functionalGroups - Groups detected from circuit
     * @returns {Object} Slot assignments { sensors: [], outputs: [] }
     */
    calculateSlots(functionalGroups) {
        this.groupToSlot.clear();
        this.slots = { sensors: [], outputs: [] };

        if (!functionalGroups || functionalGroups.length === 0) {
            console.log('[AbstractLayout] No functional groups to layout');
            return this.slots;
        }

        // Categorize groups by sensor/output
        const sensorGroups = functionalGroups.filter(g =>
            g.primaryMetadata?.functionalGroup?.category === 'sensor'
        );
        const outputGroups = functionalGroups.filter(g =>
            g.primaryMetadata?.functionalGroup?.category === 'output'
        );
        const otherGroups = functionalGroups.filter(g => {
            const cat = g.primaryMetadata?.functionalGroup?.category;
            return cat !== 'sensor' && cat !== 'output';
        });

        // Calculate regions
        const sensorRegion = this.getSensorRegion();
        const outputRegion = this.getOutputRegion();

        // Calculate slots for each region
        this.slots.sensors = this.calculateRegionSlots(
            sensorGroups,
            sensorRegion,
            'sensor'
        );

        this.slots.outputs = this.calculateRegionSlots(
            outputGroups,
            outputRegion,
            'output'
        );

        // Handle "other" groups - distribute in middle area
        if (otherGroups.length > 0) {
            const middleRegion = this.getMiddleRegion();
            const middleSlots = this.calculateRegionSlots(
                otherGroups,
                middleRegion,
                'other'
            );
            this.slots.others = middleSlots;
        }

        // Build group-to-slot mapping
        [...this.slots.sensors, ...this.slots.outputs, ...(this.slots.others || [])].forEach(slot => {
            if (slot.group) {
                this.groupToSlot.set(slot.group.id, slot);
            }
        });

        return this.slots;
    }

    /**
     * Get the sensor region (top half)
     */
    getSensorRegion() {
        const splitY = this.slotArea.y + this.slotArea.height * this.config.verticalSplit;
        return {
            x: this.slotArea.x,
            y: this.slotArea.y,
            width: this.slotArea.width,
            height: splitY - this.slotArea.y - this.config.slotGap / 2
        };
    }

    /**
     * Get the output region (bottom half)
     */
    getOutputRegion() {
        const splitY = this.slotArea.y + this.slotArea.height * this.config.verticalSplit;
        return {
            x: this.slotArea.x,
            y: splitY + this.config.slotGap / 2,
            width: this.slotArea.width,
            height: this.slotArea.y + this.slotArea.height - splitY - this.config.slotGap / 2
        };
    }

    /**
     * Get middle region (for "other" category groups)
     */
    getMiddleRegion() {
        const sensorRegion = this.getSensorRegion();
        const outputRegion = this.getOutputRegion();
        return {
            x: this.slotArea.x,
            y: sensorRegion.y + sensorRegion.height,
            width: this.slotArea.width,
            height: outputRegion.y - (sensorRegion.y + sensorRegion.height)
        };
    }

    /**
     * Calculate slot positions for a region
     * @param {Array} groups - Groups to place in this region
     * @param {Object} region - Region bounds { x, y, width, height }
     * @param {string} category - 'sensor', 'output', or 'other'
     * @returns {Array} Slot definitions
     */
    calculateRegionSlots(groups, region, category) {
        const slots = [];
        const count = groups.length;

        if (count === 0) return slots;

        // Get sizing strategy based on count
        const sizingKey = count === 1 ? 'single' : count === 2 ? 'double' : 'triple';
        const sizing = this.config.slotSizing[sizingKey];

        // Calculate slot dimensions
        const slotWidth = Math.max(
            region.width * sizing.widthRatio,
            this.config.minSlotWidth
        );
        const slotHeight = Math.max(
            region.height * sizing.heightRatio,
            this.config.minSlotHeight
        );

        // Calculate horizontal distribution
        const totalWidth = count * slotWidth + (count - 1) * this.config.slotGap;
        const startX = region.x + (region.width - totalWidth) / 2;

        // Vertical centering in region
        const centerY = region.y + region.height / 2;

        for (let i = 0; i < count && i < this.config.maxSlotsPerRow; i++) {
            const group = groups[i];

            const slotX = startX + i * (slotWidth + this.config.slotGap);
            const slotY = centerY - slotHeight / 2;

            const slot = {
                id: `slot-${category}-${i}`,
                category,
                index: i,
                group: group,
                bounds: {
                    x: slotX,
                    y: slotY,
                    width: slotWidth,
                    height: slotHeight,
                    centerX: slotX + slotWidth / 2,
                    centerY: slotY + slotHeight / 2
                },
                // Wire entry point (left edge of slot)
                wireEntry: {
                    x: slotX,
                    y: slotY + slotHeight / 2
                },
                // Component placement area (with padding)
                componentArea: {
                    x: slotX + this.config.slotPadding,
                    y: slotY + this.config.slotPadding,
                    width: slotWidth - 2 * this.config.slotPadding,
                    height: slotHeight - 2 * this.config.slotPadding
                }
            };

            slots.push(slot);

            console.log(`[AbstractLayout] Slot ${slot.id}:`, {
                group: group?.label,
                bounds: slot.bounds
            });
        }

        return slots;
    }

    /**
     * Get the abstract position for a component
     * Translates from physical breadboard position to slot position
     * @param {string} componentId - Component identifier
     * @param {string} groupId - Functional group ID
     * @param {Object} physicalPosition - Original position { centerX, centerY, width, height }
     * @returns {Object} Abstract position in slot
     */
    getAbstractPosition(componentId, groupId, physicalPosition) {
        const slot = this.groupToSlot.get(groupId);

        if (!slot) {
            console.warn(`[AbstractLayout] No slot found for group ${groupId}`);
            return physicalPosition; // Fallback to physical
        }

        // Get all components in this group to distribute them within slot
        const group = slot.group;
        const componentIndex = group.allComponents.indexOf(componentId);
        const totalComponents = group.allComponents.length;

        if (componentIndex === -1) {
            console.warn(`[AbstractLayout] Component ${componentId} not in group ${groupId}`);
            return physicalPosition;
        }

        // Calculate position within slot's component area
        const area = slot.componentArea;

        if (totalComponents === 1) {
            // Single component: center it
            return {
                centerX: area.x + area.width / 2,
                centerY: area.y + area.height / 2,
                width: physicalPosition?.width || 30,
                height: physicalPosition?.height || 30
            };
        } else {
            // Multiple components: distribute horizontally
            const spacing = area.width / (totalComponents + 1);
            return {
                centerX: area.x + spacing * (componentIndex + 1),
                centerY: area.y + area.height / 2,
                width: physicalPosition?.width || 25,
                height: physicalPosition?.height || 25
            };
        }
    }

    /**
     * Get slot for a functional group
     * @param {string} groupId - Group identifier
     * @returns {Object|null} Slot definition or null
     */
    getSlotForGroup(groupId) {
        return this.groupToSlot.get(groupId) || null;
    }

    /**
     * Get wire entry point for a group
     * @param {string} groupId - Group identifier
     * @returns {Object|null} { x, y } or null
     */
    getWireEntryPoint(groupId) {
        const slot = this.groupToSlot.get(groupId);
        return slot?.wireEntry || null;
    }

    /**
     * Get all slots for a category
     * @param {string} category - 'sensor', 'output', or 'other'
     * @returns {Array} Slots in that category
     */
    getSlotsByCategory(category) {
        if (category === 'sensor') return this.slots.sensors;
        if (category === 'output') return this.slots.outputs;
        if (category === 'other') return this.slots.others || [];
        return [];
    }

    /**
     * Calculate abstract bounds for rendering group boundaries
     * @param {Object} group - Functional group
     * @returns {Object} Bounds { x, y, width, height, centerX, centerY, wireEntryX, wireEntryY }
     */
    getGroupBounds(group) {
        const slot = this.groupToSlot.get(group.id);

        if (!slot) {
            return null;
        }

        return {
            ...slot.bounds,
            wireEntryX: slot.wireEntry.x,
            wireEntryY: slot.wireEntry.y
        };
    }

    /**
     * Check if abstract layout is active
     * @returns {boolean}
     */
    isActive() {
        return this.groupToSlot.size > 0;
    }

    /**
     * Clear all slot calculations
     */
    clear() {
        this.slots = { sensors: [], outputs: [] };
        this.groupToSlot.clear();
    }
}

// Make available globally
window.AbstractLayoutSystem = AbstractLayoutSystem;

console.log('✓ AbstractLayoutSystem module loaded');
