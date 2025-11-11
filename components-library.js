// components-library.js (minimal stub for validation testing)

const COMPONENTS_LIBRARY = {
    'led': {
        type: 'led',
        pins: ['anode', 'cathode'],
        requiredPins: ['anode', 'cathode']
    },
    'resistor': {
        type: 'resistor',
        pins: ['pin0', 'pin1'],
        requiredPins: ['pin0', 'pin1']
    },
    'microcontroller': {
        type: 'microcontroller',
        subtypes: {
            'raspberry-pi-pico': {
                pins: 40,
                requiredPins: ['pin1', 'pin40']
            }
        }
    }
};

