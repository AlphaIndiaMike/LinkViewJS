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
    
            // You can now use ldParser.ast for further processing
            //memoryLayout = buildMemoryLayoutFromAST(ldParser.ast);
            //console.log("Memory Layout:", memoryLayout);

        // Assuming parseLdScript uses the tokens
        /* memoryLayout = parseLdScript(ldTokens);
        console.log("Parsed memory layout:");
        for (const [name, region] of Object.entries(memoryLayout)) {
            console.log(`${name}:`);
            console.log(`  Type: ${region.type}`);
            console.log(`  Start: 0x${region.start.toString(16)} (${region.start} bytes)`);
            console.log(`  Size: ${region.size} bytes (${(region.size / 1024).toFixed(2)} KB)`);
        }
            */

    // Tokenize the mapFileContents using AST_Base
    try {
        var mapTokenizer = new AST_Base("Linker script and memory map");
        var mapTokens = mapTokenizer.tokenize(mapFileContents);
        console.log("Map Tokens:");
        console.log(mapTokens);
    } catch (error) {
        console.error("Error tokenizing map file:", error);
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
