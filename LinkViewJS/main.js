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
        console.log("First 200 characters of MAP file:", mapFileContents.substring(0, 200));
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
        const memorySection = ldFileContents.match(/MEMORY\s*{[^}]+}/);
        if (memorySection) {
            console.log(memorySection[0]);
        } else {
            console.log("MEMORY section not found in LD file");
        }
        memoryLayout = parseLdScript(ldFileContents);
        console.log("Parsed memory layout:");
        for (const [name, region] of Object.entries(memoryLayout)) {
            console.log(`${name}:`);
            console.log(`  Type: ${region.type}`);
            console.log(`  Start: 0x${region.start.toString(16)} (${region.start} bytes)`);
            console.log(`  Size: ${region.size} bytes (${(region.size / 1024).toFixed(2)} KB)`);
        }
        if (mapFileContents) {
            parseFiles();
        }
    };

    reader.readAsText(file);
}

function parseFiles() {
    console.log("Parsing files...");
    const { sections, symbols } = parseMapFile(mapFileContents, memoryLayout);
    
    console.log("Visualizing memory...");
    visualizeMemory(memoryLayout, sections, symbols);
    console.log("Displaying symbols...");
    displaySymbols(symbols, memoryLayout);
}