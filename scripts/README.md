# Scripts Usage Guide

## Parse Fritzing Components

### Parse All Components
```bash
# From project root
./scripts/parse-all-components.sh
```

### Parse Single Component
```bash
# From project root
node scripts/parse-fritzing.js <input-xml> [output-json]

# Examples:
node scripts/parse-fritzing.js fritzing_data/resistor.xml
node scripts/parse-fritzing.js fritzing_data/LED-generic-5mm.xml components/basic/led-red-5mm.json
```

## Directory Structure

```
breadboard-circuit-builder/    ← RUN SCRIPTS FROM HERE
├── fritzing_data/             ← Fritzing XML files (.xml extension)
│   ├── resistor.xml
│   ├── LED-generic-5mm.xml
│   └── part.PicoX_*.xml
├── scripts/                   ← Parser scripts
│   ├── parse-fritzing.js
│   └── parse-all-components.sh
└── components/                ← Generated JSON output
    ├── basic/
    └── microcontrollers/
```

## Adding New Components

1. Download Fritzing XML from GitHub:
   https://github.com/fritzing/fritzing-parts/tree/master/core

2. Place `.xml` file in `fritzing_data/` directory

3. Run parser:
   ```bash
   node scripts/parse-fritzing.js fritzing_data/new-component.xml
   ```

4. Review output and add validation fields

5. Move to appropriate components/ subdirectory

## Fritzing Data Sources

Official Fritzing parts repository:
- https://github.com/fritzing/fritzing-parts
- Core parts: `/core/`
- User-contributed: `/svg/`

Download individual XML files or clone the repo:
```bash
git clone https://github.com/fritzing/fritzing-parts.git
cp fritzing-parts/core/resistor.fzp fritzing_data/resistor.xml
```

## Troubleshooting

**Error: "fritzing_data/ directory not found"**
- Solution: `mkdir fritzing_data`
- Then add your `.xml` files

**Error: "Must run from project root directory"**
- Solution: `cd` to the directory containing `index.html`
- Then run: `./scripts/parse-all-components.sh`


---

## File Naming Convention:

For consistency with Fritzing's naming:

| Component | Fritzing Filename | Your Filename in fritzing_data/ |
|-----------|-------------------|--------------------------------|
| Resistor | `resistor.fzp` | `resistor.xml` |
| LED | `LED-generic-5mm.fzp` | `LED-generic-5mm.xml` |
| Pico | `part.PicoX_[hash]_31.fzp` | `part.PicoX_[hash]_31.xml` |

**Note:** Fritzing uses `.fzp` extension (Fritzing Part), but it's just XML. You can rename `.fzp` → `.xml` or keep as `.fzp` - the parser works with either.

---

## Optional: Support Both .fzp and .xml

If you want to support both extensions without renaming:

**Update parse-all-components.sh:**

```bash
# Parse resistor (try both extensions)
echo "→ Parsing Resistor..."
if [ -f "fritzing_data/resistor.xml" ]; then
    RESISTOR_FILE="fritzing_data/resistor.xml"
elif [ -f "fritzing_data/resistor.fzp" ]; then
    RESISTOR_FILE="fritzing_data/resistor.fzp"
else
    echo "  ✗ File not found: fritzing_data/resistor.xml or resistor.fzp"
    RESISTOR_FILE=""
fi

if [ -n "$RESISTOR_FILE" ]; then
    node scripts/parse-fritzing.js \
        "$RESISTOR_FILE" \
        components/basic/resistor-220-raw.json
    echo "  ✓ components/basic/resistor-220-raw.json"
fi
echo ""