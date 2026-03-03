/**
 * Layout Registry - Manages available layout engines
 *
 * Provides a central registry for layout algorithms. New layouts can be
 * registered and switched at runtime, enabling extensibility for future
 * layout types (signal flow, radial, schematic, etc.)
 *
 * @author Bill Church with Claude Code
 * @version 1.0.0
 */

class LayoutRegistry {
    constructor() {
        this.layouts = new Map();      // name -> LayoutEngine class
        this.activeLayout = null;      // Current active layout instance
        this.activeLayoutName = null;  // Name of active layout
    }

    /**
     * Register a layout engine class
     * @param {string} name - Unique identifier for this layout
     * @param {Class} LayoutClass - Class that extends LayoutEngine
     */
    register(name, LayoutClass) {
        if (this.layouts.has(name)) {
            console.warn(`[LayoutRegistry] Overwriting existing layout: ${name}`);
        }

        this.layouts.set(name, LayoutClass);
        console.log(`[LayoutRegistry] Registered layout: ${name}`);
    }

    /**
     * Get a new instance of a registered layout
     * @param {string} name - Layout identifier
     * @returns {LayoutEngine|null} New instance or null if not found
     */
    get(name) {
        const LayoutClass = this.layouts.get(name);

        if (!LayoutClass) {
            console.error(`[LayoutRegistry] Layout not found: ${name}`);
            return null;
        }

        return new LayoutClass();
    }

    /**
     * Set the active layout by name
     * @param {string} name - Layout identifier
     * @returns {LayoutEngine|null} The activated layout instance
     */
    setActive(name) {
        const layout = this.get(name);

        if (layout) {
            this.activeLayout = layout;
            this.activeLayoutName = name;
            console.log(`[LayoutRegistry] Active layout set to: ${name}`);
        }

        return layout;
    }

    /**
     * Get the currently active layout
     * @returns {LayoutEngine|null}
     */
    getActive() {
        return this.activeLayout;
    }

    /**
     * Get the name of the active layout
     * @returns {string|null}
     */
    getActiveName() {
        return this.activeLayoutName;
    }

    /**
     * List all registered layout names
     * @returns {string[]}
     */
    list() {
        return Array.from(this.layouts.keys());
    }

    /**
     * Get info about all registered layouts
     * @returns {Array<{name: string, description: string}>}
     */
    listWithInfo() {
        const info = [];

        for (const [name, LayoutClass] of this.layouts) {
            const instance = new LayoutClass();
            info.push({
                name,
                displayName: instance.getName(),
                description: instance.getDescription()
            });
        }

        return info;
    }

    /**
     * Check if a layout is registered
     * @param {string} name
     * @returns {boolean}
     */
    has(name) {
        return this.layouts.has(name);
    }

    /**
     * Remove a registered layout
     * @param {string} name
     * @returns {boolean} True if removed, false if not found
     */
    unregister(name) {
        if (this.activeLayoutName === name) {
            this.activeLayout = null;
            this.activeLayoutName = null;
        }

        return this.layouts.delete(name);
    }
}

// Create global registry instance
window.layoutRegistry = new LayoutRegistry();

console.log('[LayoutRegistry] Registry initialized');
