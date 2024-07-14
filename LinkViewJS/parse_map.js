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

function* lexer(input) {
    debug(`Starting lexer`);
    let current = 0;
    let parsingStarted = false;
    let tokenCount = 0;
    
    while (current < input.length) {
        let char = input[current];
        
        if (!parsingStarted) {
            if (input.slice(current).startsWith("Linker script and memory map")) {
                parsingStarted = true;
                yield { type: 'PARSING_START', value: "Linker script and memory map" };
                current += "Linker script and memory map".length;
                input = input.slice(current).replace(/\r?\n/g, ' ');
                current = 0;
            } else {
                current++;
            }
            continue;
        }
        
        if (/\s/.test(char)) {
            current++;
            continue;
        }
        
        if (char === '.') {
            let value = '';
            while (current < input.length && !/\s/.test(input[current])) {
                value += input[current];
                current++;
            }
            if (value.endsWith('.o')) {
                yield { type: 'OBJECT_FILE', value };
            } else if (value.includes('.', 1)) {
                yield { type: 'SYMBOL', value };
            } else {
                yield { type: 'SECTION_NAME', value };
            }
            tokenCount++;
            debug(`Found ${value.endsWith('.o') ? 'OBJECT_FILE' : value.includes('.', 1) ? 'SYMBOL' : 'SECTION_NAME'}`, { value });
            continue;
        }
        
        if (char === '0' && input[current + 1] === 'x') {
            let value = '0x';
            current += 2;
            while (current < input.length && /[0-9a-fA-F]/.test(input[current])) {
                value += input[current];
                current++;
            }
            yield { type: 'HEX_NUMBER', value };
            tokenCount++;
            debug(`Found HEX_NUMBER`, { value });
            continue;
        }
        
        if (/[a-zA-Z_]/.test(char)) {
            let value = '';
            while (current < input.length && /[a-zA-Z0-9_.]/.test(input[current])) {
                value += input[current];
                current++;
            }
            if (value === 'LOAD') {
                yield { type: 'LOAD_DIRECTIVE', value };
            } else {
                yield { type: 'IDENTIFIER', value };
            }
            tokenCount++;
            debug(`Found token`, { type: value === 'LOAD' ? 'LOAD_DIRECTIVE' : 'IDENTIFIER', value });
            continue;
        }
        
        yield { type: 'UNKNOWN', value: char };
        debug(`Found UNKNOWN token`, { value: char });
        current++;
        tokenCount++;
    }
    
    debug(`Lexer finished`, { totalTokens: tokenCount });
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
            } else if (this.match('OBJECT_FILE')) {
                this.parseObjectFile();
            } else if (this.match('LOAD_DIRECTIVE')) {
                this.parseLoadDirective();
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

        if (this.match('HEX_NUMBER')) {
            address = this.previous().value;
            if (this.match('HEX_NUMBER')) {
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

        if (this.match('HEX_NUMBER')) {
            address = this.previous().value;
            if (this.match('HEX_NUMBER')) {
                size = this.previous().value;
                if (this.match('OBJECT_FILE')) {
                    objectFile = this.previous().value;
                    if (this.match('HEX_NUMBER')) {
                        addressFn = this.previous().value;
                        if (this.match('IDENTIFIER')) {
                            fnName = this.previous().value;
                        }
                    }
                }
            }
        }

        if (address !== null) {
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

    parseLoadDirective() {
        debug(`Parsing LOAD directive`);
        while (!this.isAtEnd() && this.peek().type !== 'SECTION_NAME' && this.peek().type !== 'SYMBOL') {
            this.advance();
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