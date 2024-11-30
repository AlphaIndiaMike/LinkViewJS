// main.js

let mapFileContents = '';
let ldFileContents = '';
let memoryLayout = {};

document.getElementById('mapFileInput').addEventListener('change', handleMapFileUpload);
document.getElementById('ldFileInput').addEventListener('change', handleLdFileUpload);
document.getElementById('actionButton').addEventListener('click', parseFiles);

function handleMapFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        mapFileContents = e.target.result;
        console.log("Map file loaded, length:", mapFileContents.length);
        // Removed automatic parsing here
    };

    reader.readAsText(file);
}

function handleLdFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        ldFileContents = e.target.result;
        console.log("LD file loaded, length:", ldFileContents.length);
        console.log("LD file contents:");
        //console.log(ldFileContents);

        // Removed parsing here; will parse on "Calculate" button click
    };

    reader.readAsText(file);
}

function parseFiles() {
    console.log("Parsing files...");

    // Tokenize the ldFileContents using AST_Base
    var ldParser = new AST_LD("ENTRY");
    ldParser.tokens = ldParser.tokenize(ldFileContents);
    ldParser.parse();

    // Check for parsing errors
    if (ldParser.errors.length > 0) {
        console.warn("Parsing completed with errors:");
        ldParser.errors.forEach(error => {
            console.warn(error.message);
        });
    } else {
        console.log("Parsing completed successfully.");
    }

    console.log("AST:", JSON.stringify(ldParser.ast, null, 2));
    
    // For RAM
    const ramStartAddress = 0x20000000;
    const ramBudget = 128 * 1024; //KB
    const ramUsage = ldParser.calculateMemoryUsage(ramStartAddress, ramBudget);
    console.log("RAM Memory Usage:", ramUsage);

    // For FLASH
    const flashStartAddress = 0x8000000
    const flashBudget = 512 * 1024; //KB
    const flashUsage = ldParser.calculateMemoryUsage(flashStartAddress, flashBudget);
    console.log("FLASH Memory Usage:", flashUsage);


    // Tokenize the mapFileContents using AST_Base
    // Instantiate the parser with a starter string (e.g., "ENTRY")
    var mapParser = new AST_MAP("Memory Configuration");

    // Tokenize the map file contents
    mapParser.tokens = mapParser.tokenize(mapFileContents);
    console.info("HERE!");
    console.info(mapParser.tokens);

    // Parse the tokens to build the AST
    mapParser.parse();

    // Access the AST
    console.log(JSON.stringify(mapParser.ast, null, 2));

    // Handle any parsing errors
    if (mapParser.errors.length > 0) {
        console.info("Errors encountered during parsing:", mapParser.errors);
    }


    /* 
    // Continue with parsing and visualizing
    try {
        const { sections, organizedSymbols } = parseMapFile(mapFileContents, memoryLayout);

        console.log("Parsed objects:", sections);
        console.log("Organized symbols:", organizedSymbols);

        console.log("Visualizing memory...");
        visualizeMemory(memoryLayout, sections, organizedSymbols);
        console.log("Displaying symbols...");
        displaySymbols(organizedSymbols);
    } catch (error) {
        console.error("Error parsing files:", error);
        console.error("Stack trace:", error.stack);
    }

    // Disable form inputs
    document.querySelectorAll('#uploadForm input').forEach(input => input.disabled = true);

    // Show reset button
    document.getElementById('resetButton').style.display = 'block';

    // Show result sections
    document.getElementById('resultSections').style.display = 'flex';
    */
}

// Add reset functionality
document.getElementById('resetButton').addEventListener('click', () => {
    location.reload();
});
