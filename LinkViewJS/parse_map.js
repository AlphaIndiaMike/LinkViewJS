function debug(message, data = null) {
    console.log(`DEBUG: ${message}`, data ? JSON.stringify(data, null, 2) : '');
}

class MemorySection {
    constructor(name, address, size) {
        this.name = name;
        this.address = address;
        this.size = size;
        this.objectFiles = [];
        this.symbols = [];
        debug(`Created MemorySection`, { name, address, size });
    }

    addSymbol(symbol) {
        this.symbols.push(symbol);
        const symbolEnd = symbol.address + symbol.size;
        if (symbolEnd > this.address + this.size) {
            this.size = symbolEnd - this.address;
        }
        debug(`Added symbol to section`, { section: this.name, symbol: symbol.name });
    }
}

class Symbol {
    constructor(name, address, size, objectFile, addressFn, fnName) {
        this.name = name;
        this.address = address;
        this.size = size;
        this.objectFile = objectFile;
        this.addressFn = addressFn;
        this.fnName = fnName;
        debug(`Created Symbol`, { name, address, size, objectFile, addressFn, fnName });
    }
}

class ObjectFile {
    constructor(name, address) {
        this.name = name;
        this.address = address;
        this.size = 0;
        this.symbols = [];
        debug(`Created ObjectFile`, { name, address });
    }

    addSymbol(symbol) {
        this.symbols.push(symbol);
        const symbolEnd = symbol.address + symbol.size;
        if (symbolEnd > this.address + this.size) {
            this.size = symbolEnd - this.address;
        }
        debug(`Added symbol to object file`, { objectFile: this.name, symbol: symbol.name });
    }
}

const TOKEN_TYPES = [
    {
        type: 'PARSING_START',
        pattern: /^Linker script and memory map/,
        priority: 5
    },
    {
        type: 'HEX_NUMBER',
        pattern: /^0x[0-9a-fA-F]+/,
        priority: 4
    },
    {
        type: 'WHITESPACE',
        pattern: /^\s+/,
        priority: -1
    },
    {
        type: 'SECTION_NAME',
        pattern: /^\.[a-zA-Z_][a-zA-Z0-9_]*/,
        priority: 2
    },
    {
        type: 'SYMBOL',
        pattern: /^\.[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+/,
        priority: 3
    },
    {
        type: 'KEYWORD',
        pattern: /^(LOAD|START|END|VMA|LMA|File|Offset|Align)/i,
        priority: 3
    },
    {
        type: 'OBJECT_FILE',
        pattern: /^(?:\.\/|\/)?\S+(?:\.o|\.a|\.\w+\(\S+\.o\))(?=\s|$)/,
        priority: 3
    },
    {
        type: 'IDENTIFIER',
        pattern: /^[a-zA-Z_][a-zA-Z0-9_]*/,
        priority: 0
    },
    {
        type: 'UNKNOWN',
        pattern: /^./,
        priority: -2
    }
];

function isPathEnd(str) {
    return str.endsWith('.o') || str.endsWith('.a') || /\.a\(.+\.o\)$/.test(str);
}

function initState() {
    return {
        parsingStarted: false,
        lastTokenType: null,
        tokenCount: 0,
        inPath: false,
        pathStart: 0,
        expectingPath: false
    };
}

function handleParsingStart(input, current, state) {
    const startMatch = input.slice(current).match(TOKEN_TYPES[0].pattern);
    if (startMatch) {
        state.parsingStarted = true;
        return {
            token: { type: TOKEN_TYPES[0].type, value: startMatch[0] },
            newCurrent: current + startMatch[0].length
        };
    }
    return { token: null, newCurrent: current + 1 };
}

function handlePath(input, current, state) {
    if (input[current] === ' ' && isPathEnd(input.slice(state.pathStart, current))) {
        const token = { type: 'OBJECT_FILE', value: input.slice(state.pathStart, current) };
        state.inPath = false;
        state.lastTokenType = 'OBJECT_FILE';
        state.tokenCount++;
        state.expectingPath = false;
        return { token, newCurrent: current + 1 };
    }
    if (current === input.length - 1) {
        const token = { type: 'OBJECT_FILE', value: input.slice(state.pathStart) };
        state.inPath = false;
        state.lastTokenType = 'OBJECT_FILE';
        state.tokenCount++;
        state.expectingPath = false;
        return { token, newCurrent: current + 1 };
    }
    return { token: null, newCurrent: current + 1 };
}


function matchToken(slice, sortedTokenTypes) {
    for (const tokenType of sortedTokenTypes) {
        const match = slice.match(tokenType.pattern);
        if (match) {
            return { type: tokenType.type, value: match[0], length: match[0].length };
        }
    }
    return null;
}

function handleRegularToken(input, current, state, sortedTokenTypes) {
    const slice = input.slice(current);
    const match = matchToken(slice, sortedTokenTypes);
    
    if (match) {
        state.lastTokenType = match.type;
        state.tokenCount++;
        
        // Set expectingPath flag if we encounter LOAD or a number
        if (match.type === 'KEYWORD' && match.value.toUpperCase() === 'LOAD') {
            state.expectingPath = true;
        } else if (match.type === 'HEX_NUMBER') {
            state.expectingPath = true;
        } else {
            state.expectingPath = false;
        }
        
        return { token: { type: match.type, value: match.value }, newCurrent: current + match.length };
    }
    
    return {
        token: { type: 'UNKNOWN', value: input[current] },
        newCurrent: current + 1
    };
}

function* lexer(input) {
    let current = 0;
    const state = initState();
    const sortedTokenTypes = TOKEN_TYPES.filter(t => t.pattern)
                                        .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    while (current < input.length) {
        let token = null;

        if (!state.parsingStarted) {
            const result = handleParsingStart(input, current, state);
            token = result.token;
            current = result.newCurrent;
        } else if (state.inPath) {
            const result = handlePath(input, current, state);
            token = result.token;
            current = result.newCurrent;
        } else if (state.expectingPath && (input[current] === '.' || input[current] === '/')) {
            state.inPath = true;
            state.pathStart = current;
            current++;
        } else {
            const result = handleRegularToken(input, current, state, sortedTokenTypes);
            token = result.token;
            current = result.newCurrent;
        }

        if (token) {
            yield token;
        }
    }
}


class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.current = 0;
        this.debugInfo = { parsing: [], errors: [], warnings: [] };
        this.currentSection = null;
        this.currentObjectFile = null;
    }

    parse() {
        debug(`Starting parser`);
        const ast = {
            type: 'MAP_FILE',
            sections: []
        };

        while (!this.isAtEnd()) {
            if (this.match('PARSING_START')) {
                this.debugInfo.parsing.push("Started parsing from 'Linker script and memory map'");
            } else if (this.match('SECTION_NAME')) {
                const section = this.parseSection();
                if (section) {
                    ast.sections.push(section);
                    this.currentSection = section;
                    debug(`Added section to AST`, { sectionName: section.name });
                }
            } else if (this.match('SYMBOL')) {
                this.parseSymbol();
            } else if (this.match('UNKNOWN')) {
                this.debugInfo.warnings.push(`Skipped unknown token: ${this.previous().value}`);
            } else {
                this.advance();
            }
        }

        debug(`Parsing complete`, { 
            totalSections: ast.sections.length,
            debugInfo: this.debugInfo 
        });
        return ast;
    }

    parseSection() {
        const sectionName = this.previous().value;
        let address = null;
        let size = null;

        debug(`Parsing section`, { sectionName });

        if (this.peek().type === 'SECTION_NAME') {
            debug(`Skipping symbol: ${sectionName}`);
            return null;  // This is a symbol, not a section
        }

        if (this.match('WHITESPACE') && this.match('HEX_NUMBER')) {
            address = this.previous().value;
            if (this.match('WHITESPACE') && this.match('HEX_NUMBER')) {
                size = this.previous().value;
            }
        }

        if (address !== null) {
            const section = new MemorySection(
                sectionName,
                parseInt(address, 16),
                size !== null ? parseInt(size, 16) : 0
            );
            debug(`Created section`, { 
                name: section.name, 
                address: `0x${section.address.toString(16)}`, 
                size: `0x${section.size.toString(16)}` 
            });
            return section;
        }

        this.debugInfo.warnings.push(`Failed to parse section: ${sectionName}`);
        debug(`Failed to parse section`, { sectionName, address, size });
        return null;
    }

    parseSymbol() {
        const symbolName = this.previous().value;
        let address = null;
        let size = null;
        let objectFile = null;
        let addressFn = null;
        let fnName = null;
    
        debug(`Parsing symbol`, { symbolName });
    
        if (this.match('WHITESPACE') && this.match('HEX_NUMBER')) {
            address = this.previous().value;
            if (this.match('WHITESPACE') && this.match('HEX_NUMBER')) {
                size = this.previous().value;
                if (this.match('WHITESPACE') && this.match('OBJECT_FILE')) {
                    objectFile = this.previous().value;
                    if (this.match('WHITESPACE') && this.match('HEX_NUMBER')) {
                        addressFn = this.previous().value;
                        if (this.match('WHITESPACE') && this.match('IDENTIFIER')) {
                            fnName = this.previous().value;
                        }
                    }
                }
            }
        }
    
        if (address !== null && objectFile !== null) {
            let sectionObjectFile = this.currentSection.objectFiles.find(of => of.name === objectFile);
            if (!sectionObjectFile) {
                sectionObjectFile = new ObjectFile(objectFile);
                this.currentSection.objectFiles.push(sectionObjectFile);
            }
            const symbol = new Symbol(
                symbolName,
                parseInt(address, 16),
                size !== null ? parseInt(size, 16) : 0,
                objectFile || this.currentObjectFile,
                addressFn !== null ? parseInt(addressFn, 16) : null,
                fnName
            );
            debug(`Created symbol`, { 
                name: symbol.name, 
                address: `0x${symbol.address.toString(16)}`, 
                size: symbol.size !== 0 ? `0x${symbol.size.toString(16)}` : null,
                objectFile: symbol.objectFile,
                addressFn: symbol.addressFn !== null ? `0x${symbol.addressFn.toString(16)}` : null,
                fnName: symbol.fnName
            });
            sectionObjectFile.addSymbol(symbol);
            if (this.currentSection) {
                this.currentSection.addSymbol(symbol);
                debug(`Added symbol to current section`, { 
                    symbolName: symbol.name, 
                    sectionName: this.currentSection.name 
                });
            } else {
                this.debugInfo.warnings.push(`Symbol found outside of a section: ${symbolName}`);
                debug(`Symbol found outside of a section`, { symbolName });
            }
            return symbol;
        }
    
        this.debugInfo.warnings.push(`Failed to parse symbol: ${symbolName}`);
        debug(`Failed to parse symbol`, { symbolName, address, size, objectFile, addressFn, fnName });
        return null;
    }

    parseObjectFile() {
        const objectFileName = this.previous().value;
        let address = null;

        debug(`Parsing object file`, { objectFileName });

        if (this.match('HEX_NUMBER')) {
            address = this.previous().value;
        }

        if (this.currentSection) {
            const objectFile = new ObjectFile(objectFileName, address ? parseInt(address, 16) : null);
            this.currentSection.objectFiles.push(objectFile);
            this.currentObjectFile = objectFileName;
            debug(`Added object file to current section`, { 
                objectFileName, 
                sectionName: this.currentSection.name 
            });
        } else {
            this.debugInfo.warnings.push(`Object file found outside of a section: ${objectFileName}`);
            debug(`Object file found outside of a section`, { objectFileName });
        }
    }

    match(type) {
        if (this.check(type)) {
            this.advance();
            return true;
        }
        return false;
    }

    check(type) {
        if (this.isAtEnd()) return false;
        return this.peek().type === type;
    }

    advance() {
        if (!this.isAtEnd()) this.current++;
        return this.previous();
    }

    peek() {
        return this.tokens[this.current];
    }

    previous() {
        return this.tokens[this.current - 1];
    }

    isAtEnd() {
        return this.current >= this.tokens.length;
    }
}

function parseMapFile(contents, memoryLayout) {
    debug(`Starting parseMapFile`, { memoryLayoutKeys: Object.keys(memoryLayout) });
    
    const tokens = Array.from(lexer(contents));
    debug(`Tokenization complete`, { tokenCount: tokens.length });
    
    const parser = new Parser(tokens);
    const ast = parser.parse();
    debug(`AST generated`, { sectionCount: ast.sections.length });

    const symbols = ast.sections.flatMap(section => section.symbols);
    debug(`Symbols extracted`, { symbolCount: symbols.length });

    const objectFiles = ast.sections.flatMap(section => section.objectFiles);
    debug(`Object files extracted`, { objectFileCount: objectFiles.length });

    const organizedSymbols = _organizeSymbols(symbols, memoryLayout);
    debug(`Symbols organized`, { 
        organizedSymbolCount: Object.values(organizedSymbols).flat().length 
    });

    return {
        sections: ast.sections,
        organizedSymbols,
        objectFiles,
        debugInfo: {
            ...parser.debugInfo,
            tokenCount: tokens.length,
            sectionCount: ast.sections.length,
            symbolCount: symbols.length,
            objectFileCount: objectFiles.length,
            organizedSymbolCount: Object.values(organizedSymbols).flat().length
        }
    };
}

function _organizeSymbols(symbols, memoryLayout) {
    debug(`Starting symbol organization`, { 
        symbolCount: symbols.length, 
        memoryRegions: Object.keys(memoryLayout) 
    });

    const organized = Object.keys(memoryLayout).reduce((acc, region) => {
        acc[region] = [];
        return acc;
    }, {});

    let unassignedSymbols = 0;

    symbols.forEach((symbol, index) => {
        if (index % 1000 === 0) {
            debug(`Organizing symbols progress`, { processed: index, total: symbols.length });
        }

        const region = _getMemoryRegionForAddress(symbol.address, memoryLayout);
        if (region) {
            organized[region].push(symbol);
        } else {
            unassignedSymbols++;
            debug(`Unassigned symbol`, { 
                name: symbol.name, 
                address: `0x${symbol.address.toString(16)}` 
            });
        }
    });

    debug(`Symbol organization complete`, {
        totalSymbols: symbols.length,
        assignedSymbols: symbols.length - unassignedSymbols,
        unassignedSymbols: unassignedSymbols
    });

    Object.entries(organized).forEach(([region, syms]) => {
        debug(`Symbols in region`, { region, count: syms.length });
    });

    return organized;
}

function _getMemoryRegionForAddress(address, memoryLayout) {
    for (const [region, { start, size }] of Object.entries(memoryLayout)) {
        if (address >= start && address < (start + size)) {
            return region;
        }
    }
    debug(`No matching region found for address`, { 
        address: `0x${address.toString(16)}` 
    });
    return null;
}