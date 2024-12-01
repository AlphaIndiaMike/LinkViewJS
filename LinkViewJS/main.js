// main.js

let mapFileContents = '';
let ldFileContents = '';
let memoryLayout = {};
let selectedController = null;

document.getElementById('mapFileInput').addEventListener('change', handleMapFileUpload);
document.getElementById('ldFileInput').addEventListener('change', handleLdFileUpload);
document.getElementById('actionButton').addEventListener('click', parseFiles);
document.getElementById('resetButton').addEventListener('click', () => {
    location.reload();
});

// Populate Controller Dropdown on Page Load
window.addEventListener('DOMContentLoaded', populateControllerDropdown);

function populateControllerDropdown() {
    const controllerSelect = document.getElementById('controllerSelect');
    
    controllerConfigurations.forEach(controller => {
        const option = document.createElement('option');
        option.value = controller.name;
        option.textContent = controller.name;
        controllerSelect.appendChild(option);
    });

    // Add event listener for controller selection
    controllerSelect.addEventListener('change', (e) => {
        const selectedName = e.target.value;
        selectedController = controllerConfigurations.find(ctrl => ctrl.name === selectedName);
        console.log("Selected Controller:", selectedController);

        // Optionally, disable the Calculate button until files are uploaded
        toggleCalculateButton();
    });
}

function toggleCalculateButton() {
    const calculateButton = document.getElementById('actionButton');
    if (selectedController && mapFileContents && ldFileContents) {
        calculateButton.disabled = false;
    } else {
        calculateButton.disabled = true;
    }
}


function handleMapFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        mapFileContents = e.target.result;
        console.log("Map file loaded, length:", mapFileContents.length);
        toggleCalculateButton();
    };

    reader.readAsText(file);
}

function handleLdFileUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        ldFileContents = e.target.result;
        console.log("LD file loaded, length:", ldFileContents.length);
        toggleCalculateButton();
    };

    reader.readAsText(file);
}

function parseFiles() {
    if (!selectedController) {
        alert("Please select a controller.");
        return;
    }

    console.log("Parsing files...");

    // Extract memory regions from the selected controller
    memoryLayout = selectedController.memories;

    // Tokenize the ldFileContents using AST_Base
    var ldParser = new AST_LD("ENTRY");
    ldParser.tokens = ldParser.tokenize(ldFileContents);
    ldParser.parse();

    // Check for parsing errors
    if (ldParser.errors.length > 0) {
        console.warn("Parsing completed with errors:");
        ldParser.errors.forEach(error => {
            //console.warn(error.message);
        });
    } else {
        //console.log("Parsing completed successfully.");
    }

    //console.log("AST:", JSON.stringify(ldParser.ast, null, 2));


    // Tokenize the mapFileContents using AST_Base
    // Instantiate the parser with a starter string (e.g., "ENTRY")
    var mapParser = new AST_MAP("Memory Configuration");

    // Tokenize the map file contents
    mapParser.tokens = mapParser.tokenize(mapFileContents);
    console.info("HERE!");
    //console.info(mapParser.tokens);

    // Parse the tokens to build the AST
    mapParser.parse();

    // Access the AST
    //console.log(JSON.stringify(mapParser.ast, null, 2));

    // Continue with parsing and visualizing

    // Process parsed data
    try {
        const memories_linker = ldParser.ast.memories;
        const sections_linker = ldParser.ast.sections;
        const memories_map = mapParser.ast.memories;
        const sections_map = mapParser.ast.sections;
        const symbols_map = mapParser.ast.symbols; 

        // Instantiate MemoryVisualizer with the necessary data
        const visualizer = new MemoryVisualizer(
            memories_linker,
            sections_linker,
            memories_map,
            sections_map,
            symbols_map
        );

        // Render memory usage pie charts
        visualizer.renderMemoryUsageCharts(memoryUsage);

        // Render detailed memory layout
        visualizer.renderMemoryLayout();

        // Display symbols
        visualizer.displaySymbols();

    } catch (error) {
        console.error("Error processing parsed data:", error);
        displayErrors([{ message: error.message }], "Processing Errors:");
        return;
    }

    // Update UI
    disableFormInputs();
    toggleButtons();
    showResultSections();
}

// Add reset functionality
document.getElementById('resetButton').addEventListener('click', () => {
    location.reload();
});

// Helper Functions

/**
 * Displays errors in the UI.
 * @param {Array} errors - Array of error objects.
 * @param {String} title - Title for the error section.
 */
function displayErrors(errors, title) {
    const errorContainer = document.getElementById('errorContainer');
    errorContainer.innerHTML = `<h5>${title}</h5>`;
    errors.forEach(error => {
        const errorMsg = document.createElement('p');
        errorMsg.textContent = error.message;
        errorContainer.appendChild(errorMsg);
    });
}

/**
 * Disables form inputs after processing.
 */
function disableFormInputs() {
    document.querySelectorAll('#uploadForm input, #controllerSelect').forEach(input => input.disabled = true);
}

/**
 * Toggles visibility of action and reset buttons.
 */
function toggleButtons() {
    document.getElementById('actionButton').style.display = 'none';
    document.getElementById('resetButton').style.display = 'block';
}

/**
 * Shows the result sections after processing.
 */
function showResultSections() {
    document.getElementById('resultSections').style.display = 'flex';
}