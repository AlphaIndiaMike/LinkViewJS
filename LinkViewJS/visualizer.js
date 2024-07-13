function visualizeMemory(layout, sections, symbols) {
    const visualizationDiv = document.getElementById('memoryVisualization');
    visualizationDiv.innerHTML = '';

    const totalSize = Object.values(layout).reduce((sum, mem) => sum + mem.size, 0);

    for (const [name, info] of Object.entries(layout)) {
        const block = document.createElement('div');
        block.className = `memory-block ${info.type.toLowerCase()}`;
        const heightPercentage = (info.size / totalSize) * 100;
        block.style.height = `${heightPercentage}vh`;
        block.innerHTML = `<strong>${name} (${info.type})</strong><br>${info.start.toString(16)} - ${(info.start + info.size).toString(16)}`;
        
        const relevantSections = sections.filter(s => s.address >= info.start && s.address < (info.start + info.size));
        relevantSections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.className = `section ${section.name}`;
            const sectionHeightPercentage = (section.size / info.size) * 100;
            const sectionTopPercentage = ((section.address - info.start) / info.size) * 100;
            sectionDiv.style.height = `${sectionHeightPercentage}%`;
            sectionDiv.style.top = `${sectionTopPercentage}%`;
            sectionDiv.innerHTML = `${section.name}: ${section.size} bytes`;
            block.appendChild(sectionDiv);
        });

        visualizationDiv.appendChild(block);
    }
}

function displaySymbols(symbols, memoryLayout) {
    const symbolListDiv = document.getElementById('symbolList');
    symbolListDiv.innerHTML = '';

    const table = document.createElement('table');
    table.className = 'table';
    table.innerHTML = `
        <thead>
            <tr>
                <th>Symbol</th>
                <th>Address</th>
                <th>Memory Region</th>
            </tr>
        </thead>
        <tbody>
            ${symbols.map(symbol => {
                const region = getMemoryRegionForAddress(symbol.address, memoryLayout);
                return `
                    <tr>
                        <td>${symbol.name}</td>
                        <td>0x${symbol.address.toString(16)}</td>
                        <td>${region || 'Unknown'}</td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    `;

    symbolListDiv.appendChild(table);
}