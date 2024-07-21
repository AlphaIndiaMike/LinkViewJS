function visualizeMemory(memoryLayout, sections, organizedSymbols) {
    const visualizationDiv = document.getElementById('memoryVisualization');
    visualizationDiv.innerHTML = '';

    const ldVisualization = document.createElement('div');
    ldVisualization.className = 'memory-visualization ld-visualization';
    ldVisualization.innerHTML = '<h3>Linker Script Memory Layout</h3>';

    const mapVisualization = document.createElement('div');
    mapVisualization.className = 'memory-visualization map-visualization';
    mapVisualization.innerHTML = '<h3>Map File Sections</h3>';

    visualizationDiv.appendChild(ldVisualization);
    visualizationDiv.appendChild(mapVisualization);

    const totalSize = Object.values(memoryLayout).reduce((sum, region) => sum + region.size, 0);

    // Find the lowest address in the linker script memory layout
    const lowestLdAddress = Math.min(...Object.values(memoryLayout).map(region => region.start));

    // Visualize LD memory layout
    for (const [name, region] of Object.entries(memoryLayout)) {
        const block = createMemoryBlock(name, region, totalSize);
        const symbols = organizedSymbols[name] || [];
        visualizeSymbols(block, region, symbols);
        ldVisualization.appendChild(block);
    }

     // Visualize Map file sections
     const consolidatedSections = consolidateSections(sections, lowestLdAddress);
     const totalSizeMap = consolidatedSections.reduce((sum, section) => sum + section.size, 0);
     const sortedSections = consolidatedSections.sort((a, b) => a.address - b.address);
     for (const section of sortedSections) {
         const block = createSectionBlock(section, totalSizeMap);
         mapVisualization.appendChild(block);
     }
}

function createMemoryBlock(name, region, totalSize) {
    const block = document.createElement('div');
    block.className = `memory-block ${name.toLowerCase()}`;
    const heightPercentage = (region.size / totalSize) * 100;
    block.style.height = `${heightPercentage}vh`;
    block.innerHTML = `<strong>${name}</strong><br>0x${region.start.toString(16)} - 0x${(region.start + region.size).toString(16)}`;
    return block;
}

function createSectionBlock(section, totalSize) {
    const block = document.createElement('div');
    block.className = `section-block ${section.name.toLowerCase()}`;
    
    // Adjust the logarithmic scale to make smaller sections more visible
    const minHeight = 3; // Increased minimum height
    const maxHeight = 20;
    const logSize = Math.log(section.size + 1); // Add 1 to avoid log(0)
    const logTotal = Math.log(totalSize);
    const heightPercentage = minHeight + ((logSize / logTotal) * (maxHeight - minHeight));
    
    block.style.height = `${heightPercentage}vh`;
    block.style.position = 'relative';
    block.style.overflow = 'hidden';
    block.style.border = '1px solid #ccc';
    block.style.marginBottom = '2px';
    block.style.backgroundColor = getColorForSection(section.name);

    const label = document.createElement('div');
    label.className = 'section-label';
    label.style.position = 'absolute';
    label.style.top = '2px';
    label.style.left = '2px';
    label.style.right = '2px';
    label.style.fontSize = '10px';
    label.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    label.style.padding = '1px';
    label.style.whiteSpace = 'nowrap';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.innerHTML = `<strong>${section.name}</strong> 0x${section.address.toString(16)} (${formatSize(section.size)})`;

    const tooltip = document.createElement('div');
    tooltip.className = 'section-tooltip';
    tooltip.style.display = 'none';
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '5px';
    tooltip.style.borderRadius = '3px';
    tooltip.style.zIndex = '1000';
    tooltip.innerHTML = `<strong>${section.name}</strong><br>Start: 0x${section.address.toString(16)}<br>End: 0x${(section.address + section.size).toString(16)}<br>Size: ${formatSize(section.size)}`;

    block.appendChild(label);
    block.appendChild(tooltip);

    block.addEventListener('mouseover', (e) => {
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 10}px`;
        tooltip.style.top = `${e.clientY + 10}px`;
    });

    block.addEventListener('mousemove', (e) => {
        tooltip.style.left = `${e.clientX + 10}px`;
        tooltip.style.top = `${e.clientY + 10}px`;
    });

    block.addEventListener('mouseout', () => {
        tooltip.style.display = 'none';
    });

    return block;
}

function formatSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getColorForSection(sectionName) {
    // Add a color scheme for different section types
    const colorMap = {
        '.text': '#FFB3BA',
        '.data': '#BAFFC9',
        '.bss': '#BAE1FF',
        '.rodata': '#FFFFBA',
        // Add more colors for other section types
    };
    return colorMap[sectionName] || '#F0F0F0'; // Default color if not specified
}

function consolidateSections(sections, lowestLdAddress) {
    const sectionMap = new Map();

    for (const section of sections) {
        // Skip sections with addresses lower than the lowest address in the linker script
        if (section.address < lowestLdAddress) continue;

        if (!sectionMap.has(section.name)) {
            sectionMap.set(section.name, { ...section, symbols: [...section.symbols] });
        } else {
            const existingSection = sectionMap.get(section.name);
            const newEndAddress = Math.max(
                existingSection.address + existingSection.size,
                section.address + section.size
            );
            existingSection.address = Math.min(existingSection.address, section.address);
            existingSection.size = newEndAddress - existingSection.address;
            existingSection.symbols.push(...section.symbols);
        }
    }

    return Array.from(sectionMap.values());
}


function visualizeSymbols(block, region, symbols) {
    symbols.forEach(symbol => {
        const symbolElement = document.createElement('div');
        symbolElement.className = 'symbol';
        const topPercentage = ((symbol.address - region.start) / region.size) * 100;
        symbolElement.style.top = `${topPercentage}%`;
        symbolElement.title = `${symbol.name} (0x${symbol.address.toString(16)})`;
        block.appendChild(symbolElement);
    });
}

function displaySymbols(organizedSymbols) {
    const symbolListDiv = document.getElementById('symbolList');
    symbolListDiv.innerHTML = '';

    for (const [region, symbols] of Object.entries(organizedSymbols)) {
        const regionHeader = document.createElement('h3');
        regionHeader.textContent = region;
        symbolListDiv.appendChild(regionHeader);

        const table = document.createElement('table');
        table.className = 'table table-sm';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Symbol</th>
                    <th>Address</th>
                    <th>Object</th>
                </tr>
            </thead>
            <tbody>
                ${symbols.map(symbol => `
                    <tr>
                        <td>${symbol.name}</td>
                        <td>0x${symbol.address.toString(16)}</td>
                        <td>${symbol.object || 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        symbolListDiv.appendChild(table);
    }
}