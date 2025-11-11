/**
 * Fritzing XML to Component JSON Parser
 * 
 * Extracts component data from Fritzing XML files and generates
 * our component JSON format.
 * 
 * Usage:
 *   node scripts/parse-fritzing.js fritzing_data/resistor.xml
 *   node scripts/parse-fritzing.js fritzing_data/part.PicoX_*.xml
 *   node scripts/parse-fritzing.js fritzing_data/resistor.xml components/basic/resistor-220.json
 * 
 * Outputs JSON to stdout or specified output file
 */

const fs = require('fs');
const path = require('path');

class FritzingParser {
    constructor() {
        this.xmlParser = null;
    }

    /**
     * Parse Fritzing XML file to component JSON
     * @param {string} xmlFilePath - Path to Fritzing XML file
     * @returns {Object} - Component JSON object
     */
    parseFile(xmlFilePath) {
        console.error(`Parsing: ${xmlFilePath}`);
        
        const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
        const component = this.parseXML(xmlContent);
        
        return component;
    }

    /**
     * Parse XML string to component object
     * @param {string} xmlString - Fritzing XML content
     * @returns {Object} - Component JSON
     */
    parseXML(xmlString) {
        // Simple regex-based XML parsing (good enough for well-formed Fritzing XML)
        // For production, would use a proper XML parser library
        
        const component = {
            component: {
                metadata: this.extractMetadata(xmlString),
                pins: this.extractPins(xmlString),
                properties: this.extractProperties(xmlString),
                physical: this.extractPhysical(xmlString),
                rendering: this.extractRendering(xmlString),
                
                // Placeholders for manual enhancement
                _manual: {
                    note: "The following fields must be added manually for validation",
                    validation: {
                        electricalType: "TODO: led|resistor|microcontroller|sensor|etc",
                        polarity: "TODO: polarized|non-polarized (if applicable)",
                        maxCurrent: "TODO: number in amps (if applicable)",
                        rules: {}
                    }
                }
            }
        };

        return component;
    }

    /**
     * Extract metadata from Fritzing XML
     */
    extractMetadata(xml) {
        const metadata = {
            id: this.extractTag(xml, 'moduleId'),
            name: this.extractTag(xml, 'title'),
            description: this.extractTag(xml, 'description'),
            author: this.extractTag(xml, 'author'),
            tags: this.extractTags(xml),
            version: this.extractTag(xml, 'version'),
            created: this.extractTag(xml, 'date'),
            fritzingVersion: this.extractAttribute(xml, 'module', 'fritzingVersion')
        };

        // Try to infer category from properties
        const family = this.extractProperty(xml, 'family');
        metadata.category = this.inferCategory(family, metadata.name);
        
        // Clean up description (remove HTML if present)
        if (metadata.description) {
            metadata.description = this.stripHTML(metadata.description);
        }

        return metadata;
    }

    /**
     * Extract pin definitions from connectors
     */
    extractPins(xml) {
        const pins = {};
        
        // Find all connector elements
        const connectorRegex = /<connector[^>]*id="([^"]*)"[^>]*>(.*?)<\/connector>/gs;
        let match;
        
        while ((match = connectorRegex.exec(xml)) !== null) {
            const connectorXml = match[0];
            const connectorId = match[1];
            
            // Extract pin details
            const name = this.extractAttribute(connectorXml, 'connector', 'name') || connectorId;
            const type = this.extractAttribute(connectorXml, 'connector', 'type');
            const description = this.extractTag(connectorXml, 'description');
            
            // Extract pin number from connector ID (e.g., "connector0" -> 0)
            const pinNumber = this.extractPinNumber(connectorId, name);
            
            // Create pin name (clean up connector name)
            const pinName = this.cleanPinName(name, connectorId);
            
            pins[pinName] = {
                number: pinNumber,
                name: name,
                description: description || '',
                connectorId: connectorId
            };
            
            // Try to infer electrical type from description
            const electricalType = this.inferElectricalType(description, name);
            if (electricalType) {
                pins[pinName].electricalType = electricalType;
            }
        }
        
        return pins;
    }

    /**
     * Extract properties from <property> elements
     */
    extractProperties(xml) {
        const properties = {};
        
        const propertyRegex = /<property name="([^"]*)"[^>]*>([^<]*)<\/property>/g;
        let match;
        
        while ((match = propertyRegex.exec(xml)) !== null) {
            const propName = match[1];
            const propValue = match[2];
            
            // Skip family and type (those go in metadata/physical)
            if (propName === 'family' || propName === 'type') continue;
            
            // Convert property name to camelCase
            const key = this.toCamelCase(propName);
            
            // Try to parse value to appropriate type
            properties[key] = this.parseValue(propValue);
        }
        
        return properties;
    }

    /**
     * Extract physical properties
     */
    extractPhysical(xml) {
        const physical = {};
        
        const type = this.extractProperty(xml, 'type');
        if (type) {
            physical.type = type.toLowerCase();
        }
        
        const pinSpacing = this.extractProperty(xml, 'Pin Spacing');
        if (pinSpacing) {
            physical.pinSpacing = pinSpacing;
        }
        
        const packageType = this.extractProperty(xml, 'package');
        if (packageType) {
            physical.package = packageType;
        }
        
        return physical;
    }

    /**
     * Extract rendering/view information
     */
    extractRendering(xml) {
        const rendering = {
            breadboard: {},
            schematic: {},
            pcb: {}
        };
        
        // Extract breadboard view
        const breadboardImage = this.extractViewImage(xml, 'breadboardView');
        if (breadboardImage) {
            rendering.breadboard.svg = breadboardImage;
        }
        
        // Extract schematic view
        const schematicImage = this.extractViewImage(xml, 'schematicView');
        if (schematicImage) {
            rendering.schematic.svg = schematicImage;
        }
        
        // Extract PCB view
        const pcbImage = this.extractViewImage(xml, 'pcbView');
        if (pcbImage) {
            rendering.pcb.svg = pcbImage;
        }
        
        return rendering;
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    /**
     * Extract text content from XML tag
     */
    extractTag(xml, tagName) {
        const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i');
        const match = xml.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * Extract attribute from XML tag
     */
    extractAttribute(xml, tagName, attrName) {
        const regex = new RegExp(`<${tagName}[^>]*${attrName}="([^"]*)"`, 'i');
        const match = xml.match(regex);
        return match ? match[1] : null;
    }

    /**
     * Extract all tags
     */
    extractTags(xml) {
        const tags = [];
        const tagRegex = /<tag>([^<]+)<\/tag>/g;
        let match;
        
        while ((match = tagRegex.exec(xml)) !== null) {
            tags.push(match[1].trim());
        }
        
        return tags;
    }

    /**
     * Extract property value by name
     */
    extractProperty(xml, propertyName) {
        const regex = new RegExp(`<property name="${propertyName}"[^>]*>([^<]*)<\/property>`, 'i');
        const match = xml.match(regex);
        return match ? match[1].trim() : null;
    }

    /**
     * Extract image path from view
     */
    extractViewImage(xml, viewName) {
        const viewRegex = new RegExp(`<${viewName}>(.*?)<\/${viewName}>`, 's');
        const viewMatch = xml.match(viewRegex);
        
        if (!viewMatch) return null;
        
        const viewContent = viewMatch[1];
        const imageRegex = /image="([^"]*)"/;
        const imageMatch = viewContent.match(imageRegex);
        
        return imageMatch ? imageMatch[1] : null;
    }

    /**
     * Extract pin number from connector ID or name
     */
    extractPinNumber(connectorId, name) {
        // Try to extract number from connectorId (e.g., "connector0" -> 1, "connector1" -> 2)
        const match = connectorId.match(/\d+$/);
        if (match) {
            return parseInt(match[0]) + 1; // Fritzing uses 0-indexed, we use 1-indexed
        }
        
        // Try to extract from name (e.g., "pin 1" -> 1)
        const nameMatch = name.match(/\d+/);
        if (nameMatch) {
            return parseInt(nameMatch[0]);
        }
        
        return null;
    }

    /**
     * Clean pin name for use as object key
     */
    cleanPinName(name, connectorId) {
        // If name is like "pin 1", "pin 2", convert to "pin1", "pin2"
        let cleaned = name.replace(/\s+/g, '_').replace(/[^\w]/g, '_');
        
        // Special handling for common patterns
        if (name.toLowerCase().includes('gnd') || name.toLowerCase() === 'ground') {
            // For multiple GND pins, append connector number
            const num = this.extractPinNumber(connectorId, name);
            return num > 3 ? `GND_${num}` : 'GND';
        }
        
        if (name.match(/^pin\s+\d+$/i)) {
            return 'pin' + name.match(/\d+/)[0];
        }
        
        if (name.match(/^GP\d+$/)) {
            return name; // Keep GPIO names as-is
        }
        
        return cleaned;
    }

    /**
     * Infer electrical type from pin description
     */
    inferElectricalType(description, name) {
        if (!description) return null;
        
        const desc = description.toLowerCase();
        const pinName = name.toLowerCase();
        
        // Ground pins
        if (pinName.includes('gnd') || pinName.includes('ground') || desc.includes('ground')) {
            return 'ground';
        }
        
        // Power pins
        if (pinName.match(/v(dd|cc|bus|sys|bat|in|out|\d)/) || 
            desc.includes('power') || 
            desc.includes('voltage')) {
            return 'power';
        }
        
        // GPIO pins
        if (pinName.match(/^gp\d+/) || desc.includes('gpio')) {
            return 'gpio';
        }
        
        // Generic I/O
        if (desc.includes('input') && desc.includes('output')) {
            return 'io';
        }
        
        if (desc.includes('input')) {
            return 'input';
        }
        
        if (desc.includes('output')) {
            return 'output';
        }
        
        return null;
    }

    /**
     * Infer component category from family or name
     */
    inferCategory(family, name) {
        if (!family && !name) return 'unknown';
        
        const text = (family || name).toLowerCase();
        
        if (text.includes('resistor')) return 'basic';
        if (text.includes('capacitor')) return 'basic';
        if (text.includes('led')) return 'basic';
        if (text.includes('button') || text.includes('switch')) return 'basic';
        if (text.includes('sensor')) return 'sensors';
        if (text.includes('motor')) return 'outputs';
        if (text.includes('servo')) return 'outputs';
        if (text.includes('pico') || text.includes('arduino') || text.includes('microcontroller')) {
            return 'microcontrollers';
        }
        
        return 'basic';
    }

    /**
     * Convert string to camelCase
     */
    toCamelCase(str) {
        return str
            .replace(/(?:^\w|[A-Z]|\b\w)/g, (letter, index) => {
                return index === 0 ? letter.toLowerCase() : letter.toUpperCase();
            })
            .replace(/\s+/g, '')
            .replace(/[^\w]/g, '');
    }

    /**
     * Parse string value to appropriate type
     */
    parseValue(value) {
        // Try to parse as number
        const num = parseFloat(value);
        if (!isNaN(num) && value.match(/^-?\d+\.?\d*$/)) {
            return num;
        }
        
        // Keep as string
        return value;
    }

    /**
     * Strip HTML tags from string
     */
    stripHTML(html) {
        return html
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}

// ============================================================
// CLI INTERFACE
// ============================================================

function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: node parse-fritzing.js <fritzing-xml-file> [output-json-file]');
        console.error('');
        console.error('Examples:');
        console.error('  node parse-fritzing.js components_svg/resistor.txt');
        console.error('  node parse-fritzing.js components_svg/resistor.txt components/basic/resistor-220.json');
        process.exit(1);
    }
    
    const inputFile = args[0];
    const outputFile = args[1] || null;
    
    if (!fs.existsSync(inputFile)) {
        console.error(`Error: File not found: ${inputFile}`);
        process.exit(1);
    }
    
    try {
        const parser = new FritzingParser();
        const component = parser.parseFile(inputFile);
        
        const jsonOutput = JSON.stringify(component, null, 2);
        
        if (outputFile) {
            // Ensure output directory exists
            const outputDir = path.dirname(outputFile);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            
            fs.writeFileSync(outputFile, jsonOutput);
            console.error(`✓ Component written to: ${outputFile}`);
            console.error(`⚠ Remember to manually add validation fields from _manual section`);
        } else {
            // Output to stdout
            console.log(jsonOutput);
        }
        
    } catch (error) {
        console.error(`Error parsing Fritzing file: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

// Export for use as module
module.exports = FritzingParser;
