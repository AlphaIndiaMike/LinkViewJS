let mapFileContents = '';
let ldFileContents = '';
let memoryLayout = {};

document.getElementById('mapFileInput').addEventListener('change', handleMapFileUpload);
document.getElementById('ldFileInput').addEventListener('change', handleLdFileUpload);

function handleMapFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        mapFileContents = e.target.result;
        console.log("Map file loaded, length:", mapFileContents.length);
        if (ldFileContents) {
            parseFiles();
        }
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
        console.log(ldFileContents);
        
        try {
            memoryLayout = parseLdScript(ldFileContents);
            console.log("Parsed memory layout:");
            for (const [name, region] of Object.entries(memoryLayout)) {
                console.log(`${name}:`);
                console.log(`  Type: ${region.type}`);
                console.log(`  Start: 0x${region.start.toString(16)} (${region.start} bytes)`);
                console.log(`  Size: ${region.size} bytes (${(region.size / 1024).toFixed(2)} KB)`);
            }
        } catch (error) {
            console.error("Error parsing LD script:", error);
        }

        if (mapFileContents) {
            parseFiles();
        }
    };

    reader.readAsText(file);
}

function parseFiles() {
    console.log("Parsing files...");
    console.log("Memory layout:", memoryLayout);
    console.log("Map file contents length:", mapFileContents.length);
    
    // Disable form inputs
    document.querySelectorAll('#uploadForm input').forEach(input => input.disabled = true);
    
    // Show reset button
    document.getElementById('resetButton').style.display = 'block';
    
    // Show result sections
    document.getElementById('resultSections').style.display = 'flex';
    
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
}

// Add reset functionality
document.getElementById('resetButton').addEventListener('click', () => {
    location.reload();
});