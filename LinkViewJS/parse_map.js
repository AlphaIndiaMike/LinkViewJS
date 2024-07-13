const ParsingState = {
    INITIAL: 'INITIAL',
    MEMORY_MAP: 'MEMORY_MAP',
    SECTION: 'SECTION',
    OBJECT_FILE: 'OBJECT_FILE',
    SYMBOL: 'SYMBOL'
};

class MemorySection {
    constructor(name, address, size) {
        this.name = name;
        this.address = address;
        this.size = size;
        this.objectFiles = [];
        this.symbols = [];
    }

    addSymbol(symbol) {
        this.symbols.push(symbol);
        // Update size if necessary
        const symbolEnd = symbol.address + symbol.size;
        if (symbolEnd > this.address + this.size) {
            this.size = symbolEnd - this.address;
        }
    }
}

class Symbol {
    constructor(name, address, size, objectFile) {
        this.name = name;
        this.address = address;
        this.size = size;
        this.objectFile = objectFile;
    }
}

class ObjectFile {
    constructor(name, address) {
        this.name = name;
        this.address = address;
        this.size = 0;
        this.symbols = [];
    }

    addSymbol(symbol) {
        this.symbols.push(symbol);
        // Update size
        const symbolEnd = symbol.address + symbol.size;
        if (symbolEnd > this.address + this.size) {
            this.size = symbolEnd - this.address;
        }
    }
}

function parseMapFile(contents, memoryLayout) {
    const lines = contents.split('\n');
    let state = ParsingState.INITIAL;
    let currentSection = null;
    let currentObjectFile = null;
    const sections = [];
    const symbols = [];
    const debugInfo = { parsing: [], errors: [], warnings: [] };

    console.log("Total lines in map file:", lines.length);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        try {
            switch(state) {
                case ParsingState.INITIAL:
                    if (line.includes('Linker script and memory map')) {
                        state = ParsingState.MEMORY_MAP;
                        debugInfo.parsing.push(`Line ${i + 1}: Started parsing memory map`);
                    }
                    break;
                
                case ParsingState.MEMORY_MAP:
                case ParsingState.SECTION:
                case ParsingState.OBJECT_FILE:
                case ParsingState.SYMBOL:
                    const sectionResult = parseSection(line);
                    if (sectionResult.success) {
                        currentSection = sectionResult.section;
                        sections.push(currentSection);
                        state = ParsingState.SECTION;
                        debugInfo.parsing.push(`Line ${i + 1}: Parsed section ${currentSection.name}`);
                    } else if (sectionResult.symbolName) {
                        // This is a subsection, treat it as a symbol
                        const symbolResult = parseSymbol(line, currentObjectFile, sectionResult.symbolName);
                        if (symbolResult.success) {
                            handleParsedSymbol(symbolResult.symbol, currentSection, currentObjectFile, symbols);
                            state = ParsingState.SYMBOL;
                            debugInfo.parsing.push(`Line ${i + 1}: Parsed symbol ${symbolResult.symbol.name}`);
                        } else {
                            throw new Error(`Failed to parse subsection as symbol: ${line}`);
                        }
                    } else if (line.match(/^\s*0x[0-9a-fA-F]+\s+\S+\.o$/)) {
                        const objectFileResult = parseObjectFile(line);
                        if (objectFileResult.success) {
                            currentObjectFile = objectFileResult.objectFile;
                            if (currentSection) {
                                currentSection.objectFiles.push(currentObjectFile);
                            }
                            state = ParsingState.OBJECT_FILE;
                            debugInfo.parsing.push(`Line ${i + 1}: Parsed object file ${currentObjectFile.name}`);
                        } else {
                            throw new Error(`Failed to parse object file: ${line}`);
                        }
                    } else if (line.match(/^\s*0x[0-9a-fA-F]+\s+\S+/)) {
                        const symbolResult = parseSymbol(line, currentObjectFile);
                        if (symbolResult.success) {
                            handleParsedSymbol(symbolResult.symbol, currentSection, currentObjectFile, symbols);
                            state = ParsingState.SYMBOL;
                            debugInfo.parsing.push(`Line ${i + 1}: Parsed symbol ${symbolResult.symbol.name}`);
                        } else {
                            throw new Error(`Failed to parse symbol: ${line}`);
                        }
                    } else if (line.trim() !== '') {
                        debugInfo.warnings.push(`Line ${i + 1}: Unrecognized line: ${line}`);
                    }
                    break;
            }
        } catch (error) {
            debugInfo.errors.push(`Line ${i + 1}: ${error.message}`);
            // Reset state to MEMORY_MAP to try to recover
            state = ParsingState.MEMORY_MAP;
        }
    }

    console.log(`Total sections parsed: ${sections.length}`);
    console.log(`Total symbols parsed: ${symbols.length}`);
    console.log("Parsing debug info:", debugInfo);

    const organizedSymbols = organizeSymbols(symbols, memoryLayout);
    return { sections, organizedSymbols, debugInfo };
}

function handleParsedSymbol(symbol, currentSection, currentObjectFile, symbols) {
    symbols.push(symbol);
    if (currentSection) {
        currentSection.addSymbol(symbol);
    }
    if (currentObjectFile) {
        currentObjectFile.addSymbol(symbol);
    }
}

function parseSection(line) {
    const match = line.match(/^(\.\S+)(?:\s+(0x[0-9a-fA-F]+)\s+(0x[0-9a-fA-F]+))?/);
    if (match) {
        if (match[2] && match[3]) {
            // This is a main section with address and size
            return {
                success: true,
                section: new MemorySection(
                    match[1],
                    parseInt(match[2], 16),
                    parseInt(match[3], 16)
                )
            };
        } else {
            // This is a subsection or symbol, treat it as a symbol
            return {
                success: false,
                symbolName: match[1]
            };
        }
    }
    return { success: false };
}

function parseObjectFile(line) {
    const match = line.match(/^\s*(0x[0-9a-fA-F]+)\s+(\S+\.o)$/);
    if (match) {
        return {
            success: true,
            objectFile: new ObjectFile(
                match[2],
                parseInt(match[1], 16)
            )
        };
    }
    return { success: false };
}

function parseSymbol(line, currentObjectFile, potentialSymbolName = null) {
    const symbolMatch = line.match(/^\s*(0x[0-9a-fA-F]+)\s+(\S+)(?:\s+(0x[0-9a-fA-F]+))?\s*(.*)$/);
    if (symbolMatch) {
        const address = parseInt(symbolMatch[1], 16);
        const size = symbolMatch[3] ? parseInt(symbolMatch[3], 16) : 0;
        const name = potentialSymbolName || symbolMatch[4] || symbolMatch[2];
        return {
            success: true,
            symbol: new Symbol(
                name,
                address,
                size,
                currentObjectFile ? currentObjectFile.name : null
            )
        };
    }
    return { success: false };
}

function organizeSymbols(symbols, memoryLayout) {
    const organized = Object.keys(memoryLayout).reduce((acc, region) => {
        acc[region] = [];
        return acc;
    }, {});

    symbols.forEach(symbol => {
        const region = getMemoryRegionForAddress(symbol.address, memoryLayout);
        if (region) {
            organized[region].push(symbol);
        } else {
            console.warn(`Symbol ${symbol.name} at address 0x${symbol.address.toString(16)} doesn't belong to any known memory region`);
        }
    });

    return organized;
}

function getMemoryRegionForAddress(address, memoryLayout) {
    return Object.entries(memoryLayout).find(([_, region]) => 
        address >= region.start && address < (region.start + region.size)
    )?.[0] || null;
}