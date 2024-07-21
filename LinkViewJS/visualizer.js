function visualizeMemory(memoryLayout, sections, organizedSymbols) {
    const visualizationDiv = document.getElementById('memoryVisualization');
    visualizationDiv.innerHTML = '';

    const mergedVisualization = document.createElement('div');
    mergedVisualization.className = 'memory-visualization merged-visualization';
    mergedVisualization.innerHTML = '<h5>Memory Layout with Sections</h5>';

    visualizationDiv.appendChild(mergedVisualization);

    const totalSize = Object.values(memoryLayout).reduce((sum, region) => sum + region.size, 0);

    // Find the lowest address in the linker script memory layout
    const lowestLdAddress = Math.min(...Object.values(memoryLayout).map(region => region.start));

    // Consolidate and filter sections
    const consolidatedSections = consolidateSections(sections, lowestLdAddress);
    const sortedSections = consolidatedSections.sort((a, b) => a.address - b.address);

    for (const [name, region] of Object.entries(memoryLayout)) {
        const memoryBlock = createMemoryBlock(name, region, totalSize);
        
        // Find sections that belong to this memory region
        const regionSections = sortedSections.filter(section => 
            section.address >= region.start && section.address < (region.start + region.size)
        );

        // Create section blocks within the memory block
        if (regionSections.length > 0) {
            const sectionContainer = document.createElement('div');
            sectionContainer.className = 'section-container';
            sectionContainer.style.position = 'relative';
            sectionContainer.style.height = '40%';

            regionSections.forEach(section => {
                const sectionBlock = createSectionBlock(section, region.size, region.start);
                sectionContainer.appendChild(sectionBlock);
            });

            memoryBlock.appendChild(sectionContainer);
        }

        // Add symbols
        const symbols = organizedSymbols[name] || [];
        visualizeSymbols(memoryBlock, region, symbols);

        mergedVisualization.appendChild(memoryBlock);
    }
}

function createMemoryBlock(name, region, totalSize) {
    const block = document.createElement('div');
    block.className = `memory-block ${name.toLowerCase()}`;
    const heightPercentage = (region.size / totalSize) * 2000;
    block.style.height = `${heightPercentage}px`;
    block.style.position = 'relative';
    block.style.border = '2px solid #000';
    block.style.marginBottom = '5px';
    block.style.padding = '5px';

    const label = document.createElement('div');
    label.innerHTML = `<strong>${name}</strong><br>0x${region.start.toString(16)} - 0x${(region.start + region.size).toString(16)}<br>Size: ${formatSize(region.size)}`;
    label.style.padding = '2px';
    label.style.marginBottom = '5px';

    block.appendChild(label);
    return block;
}

function createSectionBlock(section, regionSize, regionStart) {
    const block = document.createElement('div');
    block.className = `section-block ${section.name.toLowerCase()}`;
    
    const topPercentage = ((section.address - regionStart) / regionSize) * 100;
    
    // Ensure a minimum height for visibility, even for 0B sections
    const minHeight = 0.5; // Minimum height percentage
    const maxHeight = 50; // Maximum height percentage
    const logSize = Math.log(Math.max(section.size, 1) + 1); // Ensure positive log value
    const logMax = Math.log(regionSize);
    const heightPercentage = Math.max(minHeight, minHeight + ((logSize / logMax) * (maxHeight - minHeight)));
    
    block.style.position = 'relative';
    block.style.top = `${topPercentage}%`;
    block.style.height = `${heightPercentage}%`;
    block.style.left = '0';
    block.style.right = '0';
    block.style.backgroundColor = getColorForSection(section.name);
    block.style.border = '1px solid rgba(0, 0, 0, 0.2)';
    block.style.overflow = 'hidden';
    block.style.transition = 'opacity 0.3s';

    const label = document.createElement('div');
    label.className = 'section-label';
    label.style.fontSize = '10px';
    label.style.padding = '1px';
    label.style.whiteSpace = 'nowrap';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.innerHTML = `${section.name} 0x${section.address.toString(16)} (${formatSize(section.size)})`;

    block.appendChild(label);

    const tooltip = document.createElement('div');
    tooltip.className = 'section-tooltip';
    tooltip.style.display = 'none';
    tooltip.style.position = 'fixed'; // Changed to fixed
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '5px';
    tooltip.style.borderRadius = '3px';
    tooltip.style.zIndex = '1000';
    tooltip.innerHTML = `<strong>${section.name}</strong><br>Start: 0x${section.address.toString(16)}<br>End: 0x${(section.address + section.size).toString(16)}<br>Size: ${formatSize(section.size)}`;

    document.body.appendChild(tooltip);

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

    return block;
}

function formatSize(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function getColorForSection(sectionName) {
    const colorMap = {
        '.text': '#4CAF50',     // Green
        '.data': '#2196F3',     // Blue
        '.bss': 'blue',      
        '.rodata': '#FF5722',   // Deep Orange
        '.isr_vector': '#9C27B0', // Purple
        '.data_init': '#00BCD4', // Cyan
        '.bss_init': '#CDDC39',  // Lime
    };
    // Generate a consistent color for unmapped sections
    if (!colorMap[sectionName]) {
        let hash = 0;
        for (let i = 0; i < sectionName.length; i++) {
            hash = sectionName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const color = 'grey';
        colorMap[sectionName] = color;
    }
    return colorMap[sectionName];
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
        const regionHeader = document.createElement('h5');
        regionHeader.textContent = region;
        symbolListDiv.appendChild(regionHeader);

        const table = document.createElement('table');
        table.className = 'table table-sm';
        table.innerHTML = `
            <thead>
                <tr>
                    <th  style="font-size:9pt;">Symbol</th>
                    <th  style="font-size:9pt;">Address</th>
                    <th  style="font-size:9pt;">Object</th>
                </tr>
            </thead>
            <tbody>
                ${symbols.map(symbol => `
                    <tr>
                        <td style="font-size:9pt;">${symbol.name}</td>
                        <td style="font-size:9pt;">0x${symbol.address.toString(16)}</td>
                        <td style="font-size:9pt;">${symbol.objectFile || 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        symbolListDiv.appendChild(table);
    }
}