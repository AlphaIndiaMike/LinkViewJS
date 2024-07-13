function parseLdScript(contents) {
    const memoryRegex = /MEMORY\s*{([^}]+)}/;
    const memoryMatch = contents.match(memoryRegex);
    
    if (!memoryMatch) {
        console.error("No MEMORY section found in the linker script");
        return {};
    }

    const memoryDefinitions = memoryMatch[1].trim().split('\n');
    const memoryLayout = {};

    memoryDefinitions.forEach(def => {
        console.log("Parsing memory definition:", def);
        const [name, attributes] = def.trim().split(':');
        if (name && attributes) {
            const attrParts = attributes.trim().split(/[=,\s]+/).filter(Boolean);
            let type, origin, length;

            console.log("Attribute parts:", attrParts);

            type = attrParts[0];  // Typically (rx) or (rwx)

            for (let i = 1; i < attrParts.length; i++) {
                if (attrParts[i] === 'ORIGIN' || attrParts[i] === 'org') {
                    origin = parseMemoryValue(attrParts[i + 1]);
                    console.log(`Parsed origin: ${origin}`);
                    i++; // Skip the next part as we've consumed it
                } else if (attrParts[i] === 'LENGTH' || attrParts[i] === 'len') {
                    length = parseMemoryValue(attrParts[i + 1]);
                    console.log(`Parsed length: ${length}`);
                    i++; // Skip the next part as we've consumed it
                }
            }

            if (!isNaN(origin) && !isNaN(length)) {
                memoryLayout[name.trim()] = { type, start: origin, size: length };
                console.log(`Successfully parsed memory region: ${name}`);
            } else {
                console.error(`Failed to parse memory region: ${name}. Origin: ${origin}, Length: ${length}`);
            }
        }
    });

    console.log("Parsed memory layout:", memoryLayout);
    return memoryLayout;
}

function parseMemoryValue(valueString) {
    console.log("Parsing memory value:", valueString);
    if (typeof valueString !== 'string') {
        console.error("Invalid value type:", typeof valueString);
        return NaN;
    }
    
    let multiplier = 1;
    if (valueString.toUpperCase().endsWith('K')) {
        multiplier = 1024;
        valueString = valueString.slice(0, -1);
    } else if (valueString.toUpperCase().endsWith('M')) {
        multiplier = 1024 * 1024;
        valueString = valueString.slice(0, -1);
    }

    let value;
    if (valueString.toLowerCase().startsWith('0x')) {
        value = parseInt(valueString, 16);
    } else {
        value = parseInt(valueString, 10);
    }

    if (isNaN(value)) {
        console.error("Failed to parse value:", valueString);
        return NaN;
    }
    
    return value * multiplier;
}

function parseMapFile(contents, memoryLayout) {
    const sectionRegex = /^\s*\.(\w+)\s+0x([0-9a-f]+)\s+0x([0-9a-f]+)/gm;
    const symbolRegex = /^\s*(0x[0-9a-f]+)\s+(.+)/gm;
    const sections = [];
    const symbols = [];
    let match;

    function isValidAddress(address) {
        return Object.values(memoryLayout).some(region => 
            address >= region.start && address < (region.start + region.size)
        );
    }

    while ((match = sectionRegex.exec(contents)) !== null) {
        const address = parseInt(match[2], 16);
        if (isValidAddress(address)) {
            sections.push({
                name: match[1],
                address: address,
                size: parseInt(match[3], 16)
            });
        }
    }

    console.log("Parsed sections:", sections);

    let symbolCount = 0;
    while ((match = symbolRegex.exec(contents)) !== null) {
        symbolCount++;
        const address = parseInt(match[1], 16);
        const name = match[2].trim();
        if (isValidAddress(address) && name !== '0' && address !== 0) {
            symbols.push({
                address: address,
                name: name
            });
        }
    }

    console.log(`Total symbols found: ${symbolCount}, Filtered symbols: ${symbols.length}`);
    console.log("First 10 filtered symbols:", symbols.slice(0, 10));

    return { sections, symbols };
}

function getMemoryRegionForAddress(address, memoryLayout) {
    for (const [name, region] of Object.entries(memoryLayout)) {
        if (address >= region.start && address < (region.start + region.size)) {
            return name;
        }
    }
    return null;
}