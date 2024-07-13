function visualizeMemory(memoryLayout, objects, organizedSymbols) {
    const visualizationDiv = document.getElementById('memoryVisualization');
    visualizationDiv.innerHTML = '';

    const totalSize = Object.values(memoryLayout).reduce((sum, region) => sum + region.size, 0);

    for (const [name, region] of Object.entries(memoryLayout)) {
        const block = createMemoryBlock(name, region, totalSize);
        const symbols = organizedSymbols[name] || [];
        visualizeSymbols(block, region, symbols);
        visualizationDiv.appendChild(block);
    }
}

function createMemoryBlock(name, region, totalSize) {
    const block = document.createElement('div');
    block.className = `memory-block ${name.toLowerCase()}`;
    const heightPercentage = (region.size / totalSize) * 100;
    block.style.height = `${heightPercentage}vh`;
    block.innerHTML = `<strong>${name} (${region.type})</strong><br>0x${region.start.toString(16)} - 0x${(region.start + region.size).toString(16)}`;
    return block;
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