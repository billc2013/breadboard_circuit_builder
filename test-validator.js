// test-validator.js

/**
 * Test script for circuit validator
 * Run in browser console or Node.js
 */

// Test with the example circuit
async function testValidator() {
    console.log('Loading circuit validator test...\n');

    // Initialize validator with breadboard data
    const validator = new CircuitValidator(
        COMPONENTS_LIBRARY || {}, // Will need to create this
        BREADBOARD_HOLES
    );

    // Load example circuit
    const response = await fetch('example_01.json');
    const circuitData = await response.json();

    console.log('Validating circuit:', circuitData.circuit.metadata.name);

    // Run validation
    const result = validator.validate(circuitData);

    // Print report
    console.log('\n' + validator.generateReport(result));

    // Return result for programmatic access
    return result;
}

// Auto-run if in browser
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Add test button to page
        const button = document.createElement('button');
        button.textContent = 'Test Validator';
        button.style.position = 'fixed';
        button.style.top = '10px';
        button.style.right = '10px';
        button.style.zIndex = '9999';
        button.onclick = testValidator;
        document.body.appendChild(button);
    });
}

