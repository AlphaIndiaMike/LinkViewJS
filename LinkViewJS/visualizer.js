// visualizer.js

class MemoryVisualizer {
    /**
     * Constructs the MemoryVisualizer instance.
     * @param {Object} memories_linker - Memory regions from the linker script AST.
     * @param {Object} sections_linker - Sections from the linker script AST.
     * @param {Object} memories_map - Memory regions from the map file AST.
     * @param {Object} sections_map - Sections from the map file AST.
     * @param {Object} symbols_map - Symbols from the map file AST.
     */
    constructor(memories_linker, sections_linker, memories_map, sections_map, symbols_map) {
        this.memories_linker = memories_linker;
        this.sections_linker = sections_linker;
        this.memories_map = memories_map;
        this.sections_map = sections_map;
        this.symbols_map = symbols_map;

        // Debug: Confirm instantiation with data
        console.log("MemoryVisualizer instantiated with data:", {
            memories_linker: this.memories_linker,
            sections_linker: this.sections_linker,
            memories_map: this.memories_map,
            sections_map: this.sections_map,
            symbols_map: this.symbols_map
        });

        // Initialize memory usage object
        this.memoryUsage = {};
    }

    /**
     * Formats size from bytes to a human-readable string.
     * @param {Number} size - Size in bytes.
     * @returns {String} Formatted size string.
     */
    formatSize(size) {
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * Calculates memory usage (Used, Free, Not Mapped) for each memory type.
     */
    calculateMemoryUsage() {
        console.log("Calculating memory usage...");
        this.memoryUsage = {
            FLASH: { used: 0, free: 0, notMapped: 0 },
            RAM: { used: 0, free: 0, notMapped: 0 }
        };

        ['FLASH', 'RAM'].forEach(memType => {
            const linkerMemories = this.memories_linker.filter(mem => mem.memory_type === memType);
            const mapMemories = this.memories_map.filter(mem => mem.name === memType);

            const allMemories = [...linkerMemories, ...mapMemories];

            if (allMemories.length === 0) {
                console.warn(`No memory regions found for ${memType}.`);
            }

            allMemories.forEach(region => {
                const origin = parseInt(region.origin, 16) || region.origin;
                const length = parseInt(region.length, 16) || region.length;

                console.log(`Processing ${memType} region: ${region.name}, Origin: 0x${origin.toString(16)}, Length: ${length}`);

                const sections = this.sections_map.filter(section => {
                    const addr = parseInt(section.address, 16);
                    return addr >= origin && addr < (origin + length);
                });

                console.log(`Found ${sections.length} sections in ${region.name} region.`);

                const used = sections.reduce((sum, sec) => {
                    const secSize = parseInt(sec.size_hex, 16);
                    if (isNaN(secSize)) {
                        console.warn(`Invalid size for section ${sec.name}: ${sec.size_hex}`);
                        return sum;
                    }
                    return sum + secSize;
                }, 0);

                this.memoryUsage[memType].used += used;
                this.memoryUsage[memType].free += (length - used);
            });

            // Not Mapped is set to 0; adjust if needed
            this.memoryUsage[memType].notMapped = 0;
        });

        console.log("Memory Usage Calculated:", this.memoryUsage);
    }

    /**
     * Renders memory usage pie charts for FLASH and RAM.
     */
    renderMemoryUsageCharts() {
        console.log("Rendering memory usage charts...");
        this.calculateMemoryUsage();

        // Define colors for pie chart segments
        const colors = {
            used: '#FF6384',      // Red
            free: '#36A2EB',      // Blue
            notMapped: '#FFCE56'  // Yellow
        };

        ['FLASH', 'RAM'].forEach(memType => {
            const canvasId = `${memType.toLowerCase()}PieChart`;
            const ctx = document.getElementById(canvasId)?.getContext('2d');

            if (!ctx) {
                console.error(`Canvas element with ID '${canvasId}' not found.`);
                return;
            }

            const data = [
                this.memoryUsage[memType].used,
                this.memoryUsage[memType].free,
                this.memoryUsage[memType].notMapped
            ];
            const labels = ['Used', 'Free', 'Not Mapped'];
            const backgroundColors = [
                colors.used,
                colors.free,
                colors.notMapped
            ];

            // Bind formatSize to use inside the callback
            const formatSize = this.formatSize.bind(this);

            // Destroy existing chart instance if it exists to prevent duplication
            if (window[`${memType.toLowerCase()}PieChartInstance`]) {
                window[`${memType.toLowerCase()}PieChartInstance`].destroy();
                console.log(`Destroyed existing ${memType} pie chart instance.`);
            }

            // Create new pie chart
            try {
                window[`${memType.toLowerCase()}PieChartInstance`] = new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: data,
                            backgroundColor: backgroundColors
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            title: {
                                display: true,
                                text: `${memType} Memory Usage`
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const label = context.label || '';
                                        const value = context.raw;
                                        const total = data.reduce((a, b) => a + b, 0);
                                        const percentage = ((value / total) * 100).toFixed(2) + '%';
                                        return `${label}: ${formatSize(value)} (${percentage})`;
                                    }
                                }
                            }
                        }
                    }
                });
                console.log(`${memType} pie chart rendered successfully.`);
            } catch (error) {
                console.error(`Error rendering ${memType} pie chart:`, error);
            }
        });
    }

    /**
     * Renders the detailed memory layout with sections and symbols.
     */
    renderMemoryLayout() {
        console.log("Rendering memory layout...");
        const visualizationDiv = document.getElementById('memoryVisualization');
        if (!visualizationDiv) {
            console.error("Element with ID 'memoryVisualization' not found.");
            return;
        }
        visualizationDiv.innerHTML = ''; // Clear previous visualizations

        // Create containers for FLASH and RAM
        const flashContainer = this.createMemoryContainer('FLASH');
        const ramContainer = this.createMemoryContainer('RAM');

        // Append headers
        const flashHeader = document.createElement('h6');
        flashHeader.textContent = 'FLASH Memory';
        flashHeader.style.textAlign = 'center';
        flashContainer.appendChild(flashHeader);

        const ramHeader = document.createElement('h6');
        ramHeader.textContent = 'RAM Memory';
        ramHeader.style.textAlign = 'center';
        ramContainer.appendChild(ramHeader);

        // Render memory blocks for FLASH
        const flashRegions = this.memories_linker.filter(mem => mem.memory_type === 'FLASH');
        if (flashRegions.length === 0) {
            console.warn("No FLASH memory regions to display.");
        }
        flashRegions.forEach(region => {
            const memoryBlock = this.createMemoryBlock(region, 'FLASH');
            flashContainer.appendChild(memoryBlock);
        });

        // Render memory blocks for RAM
        const ramRegions = this.memories_linker.filter(mem => mem.memory_type === 'RAM');
        if (ramRegions.length === 0) {
            console.warn("No RAM memory regions to display.");
        }
        ramRegions.forEach(region => {
            const memoryBlock = this.createMemoryBlock(region, 'RAM');
            ramContainer.appendChild(memoryBlock);
        });

        // Append both containers to the visualization div
        visualizationDiv.appendChild(flashContainer);
        visualizationDiv.appendChild(ramContainer);

        console.log("Memory layout rendered.");
    }

    /**
     * Creates a container div for a memory type.
     * @param {String} memType - Memory type ('FLASH' or 'RAM').
     * @returns {HTMLElement} container
     */
    createMemoryContainer(memType) {
        const container = document.createElement('div');
        container.className = 'memory-container';
        container.style.width = '48%';
        container.style.display = 'inline-block';
        container.style.verticalAlign = 'top';
        container.style.marginRight = memType === 'FLASH' ? '2%' : '0';
        container.style.border = '1px solid #ccc';
        container.style.borderRadius = '5px';
        container.style.padding = '10px';
        container.style.backgroundColor = '#f9f9f9';
        container.style.height = '600px'; // Adjust as needed
        container.style.overflowY = 'auto';
        return container;
    }

    /**
     * Creates a styled memory block representing a memory region.
     * @param {Object} region - Memory region object.
     * @param {String} memType - Memory type ('FLASH' or 'RAM').
     * @returns {HTMLElement} memoryBlock
     */
    createMemoryBlock(region, memType) {
        const block = document.createElement('div');
        block.className = `memory-block ${region.name.toLowerCase()}`;
        block.style.position = 'relative';
        block.style.height = '100%';
        block.style.border = '2px solid #000';
        block.style.marginBottom = '10px';
        block.style.padding = '5px';
        block.style.boxSizing = 'border-box';
        block.style.backgroundColor = memType === 'FLASH' ? '#ffc107' : '#17a2b8';
        block.style.height = '100%';
        block.style.width = '100%';

        // Label
        const label = document.createElement('div');
        label.innerHTML = `<strong>${region.name}</strong><br>0x${region.origin.toString(16)} - 0x${(region.origin + region.length).toString(16)}<br>Size: ${this.formatSize(region.length)}`;
        label.style.padding = '2px';
        label.style.marginBottom = '5px';
        label.style.fontSize = '12px';
        label.style.color = 'white';
        block.appendChild(label);

        // Find sections that belong to this memory region
        const regionSections = this.sections_map.filter(section => {
            const sectionAddress = parseInt(section.address, 16);
            return sectionAddress >= region.origin && sectionAddress < (region.origin + region.length);
        }).sort((a, b) => parseInt(a.address, 16) - parseInt(b.address, 16));

        if (regionSections.length === 0) {
            console.warn(`No sections found for region ${region.name}.`);
        }

        // Create section blocks within the memory block
        regionSections.forEach(section => {
            const sectionBlock = this.createSectionBlock(section, region);
            block.appendChild(sectionBlock);
        });

        // Add symbols
        const symbols = this.symbols_map.filter(symbol => {
            const symbolAddress = parseInt(symbol.address, 16);
            return symbolAddress >= region.origin && symbolAddress < (region.origin + region.length);
        });

        if (symbols.length === 0) {
            console.warn(`No symbols found for region ${region.name}.`);
        }

        this.visualizeSymbols(block, region, symbols);

        // Debug: Confirm memory block creation
        console.log(`Memory block created for ${memType} - ${region.name}`);
        return block;
    }

    /**
     * Creates a styled section block within a memory region.
     * @param {Object} section - Section object.
     * @param {Object} region - Memory region object.
     * @returns {HTMLElement} sectionBlock
     */
    createSectionBlock(section, region) {
        const block = document.createElement('div');
        block.className = `section-block ${section.name.toLowerCase()}`;

        // Calculate position and size based on section address and size
        const sectionStartOffset = parseInt(section.address, 16) - region.origin;
        const sectionSize = parseInt(section.size_hex, 16);

        if (isNaN(sectionStartOffset) || isNaN(sectionSize)) {
            console.warn(`Invalid section data for ${section.name}. Skipping.`);
            return block;
        }

        const topPercentage = (sectionStartOffset / region.length) * 100;
        const heightPercentage = (sectionSize / region.length) * 100;

        block.style.position = 'absolute';
        block.style.top = `${topPercentage}%`;
        block.style.height = `${heightPercentage}%`;
        block.style.left = '0';
        block.style.right = '0';
        block.style.backgroundColor = this.getColorForSection(section.name);
        block.style.border = '1px solid rgba(0, 0, 0, 0.2)';
        block.style.overflow = 'hidden';
        block.style.transition = 'opacity 0.3s';

        // Label
        const label = document.createElement('div');
        label.className = 'section-label';
        label.style.fontSize = '10px';
        label.style.padding = '1px';
        label.style.whiteSpace = 'nowrap';
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.innerHTML = `${section.name} 0x${parseInt(section.address, 16).toString(16)} (${this.formatSize(section.size_hex)})`;
        block.appendChild(label);

        // Tooltip
        const tooltipContent = `<strong>${section.name}</strong><br>Start: 0x${parseInt(section.address, 16).toString(16)}<br>End: 0x${(parseInt(section.address, 16) + sectionSize).toString(16)}<br>Size: ${this.formatSize(section.size_hex)}`;
        const tooltip = this.createTooltip(tooltipContent);
        this.bindTooltip(block, tooltip);

        // Debug: Confirm section block creation
        console.log(`Section block created for ${section.name} at address 0x${section.address}`);

        return block;
    }

    /**
     * Creates and binds a tooltip to a section block.
     * @param {HTMLElement} block - The section block element.
     * @param {HTMLElement} tooltip - The tooltip element.
     */
    bindTooltip(block, tooltip) {
        block.addEventListener('mouseover', () => {
            block.style.opacity = '0.8';
            tooltip.style.display = 'block';
        });

        block.addEventListener('mousemove', (e) => {
            tooltip.style.left = `${e.clientX + 10}px`;
            tooltip.style.top = `${e.clientY + 10}px`;
        });

        block.addEventListener('mouseout', () => {
            block.style.opacity = '1';
            tooltip.style.display = 'none';
        });

        // Debug: Confirm tooltip binding
        console.log("Tooltip bound to section block.");
    }

    /**
     * Creates a tooltip element with the given content.
     * @param {String} content - HTML content for the tooltip.
     * @returns {HTMLElement} tooltip
     */
    createTooltip(content) {
        const tooltip = document.createElement('div');
        tooltip.className = 'section-tooltip';
        tooltip.style.display = 'none';
        tooltip.style.position = 'fixed';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        tooltip.style.color = 'white';
        tooltip.style.padding = '5px';
        tooltip.style.borderRadius = '3px';
        tooltip.style.zIndex = '1000';
        tooltip.innerHTML = content;
        document.body.appendChild(tooltip);

        // Debug: Confirm tooltip creation
        console.log("Tooltip created.");

        return tooltip;
    }

    /**
     * Determines the color for a section based on its name.
     * @param {String} sectionName - Name of the section (e.g., '.text').
     * @returns {String} Hex color code.
     */
    getColorForSection(sectionName) {
        const colorMap = {
            '.text': '#4CAF50',          // Green
            '.data': '#2196F3',          // Blue
            '.bss': '#3F51B5',           // Indigo
            '.rodata': '#FF5722',        // Deep Orange
            '.isr_vector': '#9C27B0',    // Purple
            '.preinit_array': '#00BCD4', // Cyan
            '.init_array': '#CDDC39',     // Lime
            '.fini_array': '#FF9800'      // Orange
            // Add more predefined colors as needed
        };

        if (colorMap[sectionName]) {
            return colorMap[sectionName];
        } else {
            // Generate a unique color based on the section name
            let hash = 0;
            for (let i = 0; i < sectionName.length; i++) {
                hash = sectionName.charCodeAt(i) + ((hash << 5) - hash);
            }
            const hue = hash % 360;
            return `hsl(${hue}, 70%, 50%)`;
        }
    }

    /**
     * Visualizes symbols within a memory block.
     * @param {HTMLElement} block - The memory block element.
     * @param {Object} region - Memory region object.
     * @param {Array} symbols - Array of symbol objects.
     */
    visualizeSymbols(block, region, symbols) {
        if (symbols.length === 0) {
            console.log(`No symbols to visualize for region ${region.name}.`);
            return;
        }

        symbols.forEach(symbol => {
            const symbolElement = document.createElement('div');
            symbolElement.className = 'symbol';

            // Calculate position based on symbol address
            const symbolAddress = parseInt(symbol.address, 16);
            const symbolOffset = symbolAddress - region.origin;
            const symbolSize = parseInt(symbol.size, 16) || parseInt(symbol.size, 10);

            if (isNaN(symbolOffset) || isNaN(symbolSize)) {
                console.warn(`Invalid symbol data for ${symbol.name}. Skipping.`);
                return;
            }

            const topPercentage = (symbolOffset / region.length) * 100;
            const heightPercentage = (symbolSize / region.length) * 100;

            symbolElement.style.position = 'absolute';
            symbolElement.style.top = `${topPercentage}%`;
            symbolElement.style.height = `${heightPercentage}%`;
            symbolElement.style.left = '0';
            symbolElement.style.right = '0';
            symbolElement.style.backgroundColor = '#FFC0CB'; // Light Pink for symbols
            symbolElement.style.border = '1px solid rgba(0, 0, 0, 0.2)';
            symbolElement.style.opacity = '0.6';
            symbolElement.style.cursor = 'pointer';

            // Tooltip for symbols
            const tooltipContent = `<strong>${symbol.name}</strong><br>Address: 0x${symbol.address}<br>Size: ${this.formatSize(symbol.size)}<br>Object: ${symbol.object}`;
            const tooltip = this.createTooltip(tooltipContent);
            this.bindTooltip(symbolElement, tooltip);

            block.appendChild(symbolElement);

            // Debug: Confirm symbol visualization
            console.log(`Symbol visualized: ${symbol.name} at 0x${symbol.address}`);
        });

        // Debug: Confirm all symbols for the region have been visualized
        console.log(`All symbols visualized for region ${region.name}.`);
    }

    /**
     * Displays symbols in a table categorized by memory regions.
     */
    displaySymbols() {
        console.log("Displaying symbols in tables...");
        const symbolListDiv = document.getElementById('symbolList');
        if (!symbolListDiv) {
            console.error("Element with ID 'symbolList' not found.");
            return;
        }
        symbolListDiv.innerHTML = ''; // Clear previous symbols

        // Categorize symbols by memory regions based on their addresses
        const categorizedSymbols = {};

        this.symbols_map.forEach(symbol => {
            const symbolAddress = parseInt(symbol.address, 16);
            let found = false;

            // Iterate through memory types and their regions to find where the symbol belongs
            for (const memType of ['FLASH', 'RAM']) {
                const regions = this.memories_linker.filter(mem => mem.memory_type === memType);
                for (const region of regions) {
                    if (symbolAddress >= region.origin && symbolAddress < (region.origin + region.length)) {
                        if (!categorizedSymbols[memType]) {
                            categorizedSymbols[memType] = [];
                        }
                        categorizedSymbols[memType].push(symbol);
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }

            // If symbol does not belong to any region, categorize as 'Unmapped'
            if (!found) {
                if (!categorizedSymbols['Unmapped']) {
                    categorizedSymbols['Unmapped'] = [];
                }
                categorizedSymbols['Unmapped'].push(symbol);
            }
        });

        // Generate tables for each memory type
        for (const [memType, symbols] of Object.entries(categorizedSymbols)) {
            const memHeader = document.createElement('h6');
            memHeader.textContent = memType;
            symbolListDiv.appendChild(memHeader);

            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'table-responsive';

            const table = document.createElement('table');
            table.className = 'table table-sm table-striped';
            table.innerHTML = `
                <thead>
                    <tr>
                        <th style="font-size:9pt; width: 40%;">Symbol</th>
                        <th style="font-size:9pt; width: 20%;">Address</th>
                        <th style="font-size:9pt; width: 40%;">Object</th>
                    </tr>
                </thead>
                <tbody>
                    ${symbols.map(symbol => `
                        <tr>
                            <td style="font-size:9pt; word-break: break-word;">${symbol.name}</td>
                            <td style="font-size:9pt;">0x${symbol.address}</td>
                            <td style="font-size:9pt; word-break: break-word;">${symbol.object || 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            `;
            tableWrapper.appendChild(table);
            symbolListDiv.appendChild(tableWrapper);

            // Debug: Confirm table creation for memory type
            console.log(`Symbols table created for ${memType} with ${symbols.length} symbols.`);
        }

        // Debug: Confirm symbols display completion
        console.log("All symbols displayed in tables.");
    }
}
