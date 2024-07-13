function parseLdScript(contents) {
    const memorySection = extractMemorySection(contents);
    if (!memorySection) {
        console.error("No MEMORY section found in the linker script");
        return {};
    }

    const memoryDefinitions = splitMemoryDefinitions(memorySection);
    const memoryLayout = {};

    memoryDefinitions.forEach(def => {
        const parsedRegion = parseMemoryRegion(def);
        if (parsedRegion) {
            memoryLayout[parsedRegion.name] = parsedRegion.attributes;
        }
    });

    console.log("Parsed memory layout:", memoryLayout);
    return memoryLayout;
}

function extractMemorySection(contents) {
    const memoryRegex = /MEMORY\s*{([^}]+)}/;
    const memoryMatch = contents.match(memoryRegex);
    return memoryMatch ? memoryMatch[1].trim() : null;
}

function splitMemoryDefinitions(memorySection) {
    return memorySection.split('\n').filter(line => line.trim() !== '');
}

function parseMemoryRegion(definition) {
    console.log("Parsing memory definition:", definition);
    const [nameAndType, attributes] = definition.split(':').map(s => s.trim());
    
    if (!nameAndType || !attributes) {
        console.error("Invalid memory region definition:", definition);
        return null;
    }

    const nameMatch = nameAndType.match(/^(\S+)\s*(\([^)]+\))?/);
    if (!nameMatch) {
        console.error("Failed to parse name and type:", nameAndType);
        return null;
    }

    const name = nameMatch[1];
    const type = nameMatch[2] ? nameMatch[2].slice(1, -1) : ''; // Remove parentheses

    const origin = extractValue(attributes, 'ORIGIN');
    const length = extractValue(attributes, 'LENGTH');

    if (!isNaN(origin) && !isNaN(length)) {
        console.log(`Successfully parsed memory region: ${name}`);
        return {
            name: name,
            attributes: { type, start: origin, size: length }
        };
    } else {
        console.error(`Failed to parse memory region: ${name}. Type: ${type}, Origin: ${origin}, Length: ${length}`);
        return null;
    }
}

function extractValue(attributes, keyword) {
    const regex = new RegExp(`${keyword}\\s*=\\s*([^,\\s]+)`);
    const match = attributes.match(regex);
    return match ? parseMemoryValue(match[1]) : NaN;
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