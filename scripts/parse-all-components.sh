#!/bin/bash

# Parse all Fritzing components to JSON
# 
# Usage: Run from PROJECT ROOT directory
#   ./scripts/parse-all-components.sh
#
# This script assumes:
# - Node.js is installed
# - You're running from the breadboard-circuit-builder/ root directory
# - Fritzing XML files are in fritzing_data/

# Check if running from correct directory
if [ ! -f "index.html" ]; then
    echo "Error: Must run from project root directory (where index.html is located)"
    echo "Usage: ./scripts/parse-all-components.sh"
    exit 1
fi

# Check if fritzing_data directory exists
if [ ! -d "fritzing_data" ]; then
    echo "Error: fritzing_data/ directory not found"
    echo "Please create fritzing_data/ and add Fritzing XML files"
    exit 1
fi

echo "════════════════════════════════════════════════════════"
echo "  Fritzing Component Parser"
echo "════════════════════════════════════════════════════════"
echo ""

# Create output directories
mkdir -p components/basic
mkdir -p components/microcontrollers
mkdir -p components/sensors
mkdir -p components/outputs

# Parse resistor
echo "→ Parsing Resistor..."
if [ -f "fritzing_data/resistor.xml" ]; then
    node scripts/parse-fritzing.js \
        fritzing_data/resistor.xml \
        components/basic/resistor-220-raw.json
    echo "  ✓ components/basic/resistor-220-raw.json"
else
    echo "  ✗ File not found: fritzing_data/resistor.xml"
fi
echo ""

# Parse LED
echo "→ Parsing LED..."
if [ -f "fritzing_data/LED-generic-5mm.xml" ]; then
    node scripts/parse-fritzing.js \
        fritzing_data/LED-generic-5mm.xml \
        components/basic/led-red-5mm-raw.json
    echo "  ✓ components/basic/led-red-5mm-raw.json"
else
    echo "  ✗ File not found: fritzing_data/LED-generic-5mm.xml"
    echo "  (Add LED Fritzing XML file to fritzing_data/ directory)"
fi
echo ""

# Parse Pico (handle wildcard filename)
echo "→ Parsing Raspberry Pi Pico..."
PICO_FILE=$(ls fritzing_data/part.PicoX_*.xml 2>/dev/null | head -n 1)
if [ -n "$PICO_FILE" ]; then
    node scripts/parse-fritzing.js \
        "$PICO_FILE" \
        components/microcontrollers/pico-raw.json
    echo "  ✓ components/microcontrollers/pico-raw.json"
else
    echo "  ✗ File not found: fritzing_data/part.PicoX_*.xml"
fi
echo ""

echo "════════════════════════════════════════════════════════"
echo "✓ Parsing complete!"
echo ""
echo "Generated files:"
find components -name "*-raw.json" 2>/dev/null | while read file; do
    echo "  • $file"
done
echo ""
echo "Next steps:"
echo "  1. Review *-raw.json files in components/ directories"
echo "  2. Add validation fields from the _manual section"
echo "  3. Rename to final filename (remove -raw suffix):"
echo "     cd components/basic"
echo "     mv resistor-220-raw.json resistor-220.json"
echo "     mv led-red-5mm-raw.json led-red-5mm.json"
echo "  4. Update components/library.json with new components"
echo ""
echo "See components/_templates/validation-fields.md for guidance"
echo "════════════════════════════════════════════════════════"
