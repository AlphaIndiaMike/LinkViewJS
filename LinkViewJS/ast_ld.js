class AST_LD extends AST_Base {
    constructor(starterString) {
        super(starterString);
        this.ast = {
            type: 'LinkerScript',
            memories: [],
            sections: [],
            constants: []
        };
        this.currentIndex = 0;
        this.errors = [];
        this.isInsideComment = false;
    }

    parse() {
        this.currentIndex = 0;

        console.info(this.tokens);

        while (this.currentIndex < this.tokens.length) {
            const token = this.peek();

            if (this.isInsideComment) {
                if (!this.isCommentEnd()) {
                    this.consumeComment();
                } else {
                    this.consumeComment();
                    this.isInsideComment = false;
                }
                continue;
            }

            if (this.isKeyword('MEMORY')) {
                //console.log(`Parsing MEMORY block at token index ${this.currentIndex}`);
                const memoryBlock = this.parseMemoryBlock();
                if (memoryBlock) {
                    this.ast.memories = this.ast.memories.concat(memoryBlock.regions);
                    //console.log("Parsed MEMORY block:", memoryBlock);
                }
            } else if (this.isKeyword('SECTIONS')) {
                //console.log(`Parsing SECTIONS block at token index ${this.currentIndex}`);
                const sectionsBlock = this.parseSectionsBlock();
                if (sectionsBlock) {
                    this.ast.sections = this.ast.sections.concat(sectionsBlock.sections);
                    //console.log("Parsed SECTIONS block:", sectionsBlock);
                }
            } else if (this.isConstant()) {
                //console.log(`Parsing CONSTANT at token index ${this.currentIndex}`);
                const constant = this.parseConstant();
                if (constant) {
                    this.ast.constants.push(constant);
                    //console.log("Parsed CONSTANT:", constant);
                }
            } else if (this.isKeyword('/DISCARD/')) {
                //console.log(`Handling /DISCARD/ at token index ${this.currentIndex}`);
                this.handleDiscard();
                break; // Stop parsing after handling /DISCARD/
            } else {
                // Skip unknown tokens or comments
                if (this.isCommentStart()) {
                    this.consumeComment();
                    this.isInsideComment = true;
                } else {
                    console.warn(`Unknown token at index ${this.currentIndex}:`, token.value);
                    this.consume();
                }
            }
        }
    }

    peek(offset = 0) {
        return this.tokens[this.currentIndex + offset];
    }

    consume() {
        return this.tokens[this.currentIndex++];
    }

    expect(expectedType, expectedValue) {
        const token = this.consume();
        console.info(token);
        if (
            token &&
            token.type === expectedType &&
            (expectedValue === undefined || token.value === expectedValue)
        ) {
            return token.value;
        } else {
            const message = `Expected ${expectedType} '${expectedValue}', but found ${
                token ? `${token.type} '${token.value}'` : 'end of input'
            } at index ${this.currentIndex - 1}`;
            this.addError(message);
            return null;
        }
    }

    addError(message) {
        this.errors.push({ message: message, index: this.currentIndex });
    }

    isKeyword(value) {
        const token = this.peek();
        return token && token.type === 'word' && token.value.toUpperCase() === value.toUpperCase();
    }

    isConstant() {
        const token = this.peek();
        return token && token.type === 'word' && token.value.startsWith('_');
    }

    isCommentStart() {
        const token = this.peek();
        return token && token.type === 'word' && token.value.startsWith('/*');
    }

    isCommentEnd() {
        const token = this.peek();
        return token && token.type === 'word' && token.value.endsWith('*/');
    }

    consumeComment() {
        const token = this.consume();
        //console.log(`Skipping comment at index ${this.currentIndex - 1}:`, token.value);
    }

    parseMemoryBlock() {
        const memoryKeyword = this.expect('word', 'MEMORY');
        if (!memoryKeyword) return null;

        const openingBrace = this.expect('word', '{');
        if (!openingBrace) return null;

        const regions = [];

        while (this.currentIndex < this.tokens.length) {
            const nextToken = this.peek();

            if (nextToken && nextToken.type === 'word' && nextToken.value === '}') {
                this.consume();
                //console.log("Closing MEMORY block");
                break;
            }

            if (this.isCommentStart()) {
                this.consumeComment();
                continue;
            }

            const region = this.parseMemoryRegion();
            if (region) {
                regions.push(region);
                //console.log("Parsed memory region:", region);
            } else {
                console.warn(`Failed to parse memory region at index ${this.currentIndex}`);
                this.consume();
            }
        }

        return {
            type: 'MemoryBlock',
            regions: regions
        };
    }

    parseMemoryRegion() {
        const name = this.expect('word');
        if (!name) return null;

        let accessRights = null;
        if (this.peek() && this.peek().type === 'word') {
            accessRights = this.consume().value;
        }

        const colon = this.expect('word', ':');
        if (!colon) return null;

        const originKey = this.expect('word', 'ORIGIN');
        console.debug("origin key: " + originKey);
        if (!originKey) return null;

        const equalSign1 = this.expect('word', '=');
        console.debug("eq key: " + equalSign1);
        if (!equalSign1) return null;

        const originValue = this.parseExpression();
        console.debug("origin value: " + originValue);
        if (originValue === null) return null;

        const lengthKey = this.expect('word', 'LENGTH');
        if (!lengthKey) return null;

        const equalSign2 = this.expect('word', '=');
        if (!equalSign2) return null;

        const lengthValue = this.parseExpression();
        if (lengthValue === null) return null;

        // Consume optional semicolon or comma
        if (
            this.peek() &&
            this.peek().type === 'word' &&
            (this.peek().value === ';' || this.peek().value === ',')
        ) {
            this.consume();
        }

        return {
            type: 'MemoryRegion',
            name: name,
            accessRights: accessRights,
            origin: originValue,
            length: lengthValue
        };
    }

    parseExpression() {
        const token = this.peek();
        if (!token) {
            this.addError('Unexpected end of input while parsing expression');
            return null;
        }

        if (token.type === 'number_hex' || token.type === 'number_dec') {
            this.consume();
            const value = parseInt(token.value, token.type === 'number_hex' ? 16 : 10);
            return value;
        } else if (token.type === 'size_kb') {
            this.consume();
            const value = parseInt(token.value, 10) * 1024;
            return value;
        } else if (token.type === 'size_mb') {
            this.consume();
            const value = parseInt(token.value, 10) * 1024 * 1024;
            return value;
        } else if (token.type === 'size_gb') {
            this.consume();
            const value = parseInt(token.value, 10) * 1024 * 1024 * 1024;
            return value;
        } else {
            const message = `Unsupported expression token: ${token.type} '${token.value}' at index ${this.currentIndex}`;
            console.error(message);
            this.addError(message);
            this.consume();
            return null;
        }
    }

    parseSectionsBlock() {
        const sectionsKeyword = this.expect('word', 'SECTIONS');
        if (!sectionsKeyword) return null;

        const openingBrace = this.expect('word', '{');
        if (!openingBrace) return null;

        const sections = [];

        while (this.currentIndex < this.tokens.length) {
            const nextToken = this.peek();

            if (this.isInsideComment) {
                if (!this.isCommentEnd()) {
                    this.consumeComment();
                } else {
                    this.consumeComment();
                    this.isInsideComment = false;
                }
                continue;
            }

            if (nextToken && nextToken.type === 'word' && nextToken.value === '}') {
                this.consume();
                //console.log("Closing SECTIONS block");
                break;
            }

            if (this.isCommentStart()) {
                this.consumeComment();
                this.isInsideComment = true;
                continue;
            }

            if (this.isKeyword('/DISCARD/')) {
                //console.log(`Handling /DISCARD/ at token index ${this.currentIndex}`);
                this.handleDiscard();
                continue;
            }

            const section = this.parseSectionDefinition();
            if (section) {
                sections.push(section);
                //console.log("Parsed section:", section);
            } else {
                console.warn(`Failed to parse section at index ${this.currentIndex}`);
                this.consume();
            }
        }

        return {
            type: 'SectionsBlock',
            sections: sections
        };
    }

    parseSectionDefinition() {
        const name = this.expect('word');
        if (!name) return null;

        const colon = this.expect('word', ':');
        if (!colon) return null;

        const openingBrace = this.expect('word', '{');
        if (!openingBrace) return null;

        // Skip content inside section braces
        let braceCount = 1;
        while (this.currentIndex < this.tokens.length && braceCount > 0) {
            const token = this.peek();

            if (this.isInsideComment) {
                if (!this.isCommentEnd()) {
                    this.consumeComment();
                } else {
                    this.consumeComment();
                    this.isInsideComment = false;
                }
                continue;
            }

            if (this.isCommentStart()) {
                this.consumeComment();
                this.isInsideComment = true;
                continue;
            }

            if (token.type === 'word' && token.value === '{') {
                braceCount++;
                this.consume();
            } else if (token.type === 'word' && token.value === '}') {
                braceCount--;
                this.consume();
            } else {
                this.consume();
            }
        }

        let memoryRegion = null;
        const currentToken = this.peek();

        if (currentToken && currentToken.type === 'word') {
            if (currentToken.value.includes('>')) {
                const parts = currentToken.value.split('>');
                if (parts.length > 1 && parts[1].trim() && memoryRegion === null) {
                    memoryRegion = parts[1].trim();
                    this.consume();
                } else {
                    this.consume();
                    if (memoryRegion === null) {
                        memoryRegion = this.expect('word');
                        if (!memoryRegion) return null;
                    }
                    if (this.peek() && this.peek().value === 'AT') {
                        this.consume(); // AT
                        this.consume(); // >
                        this.consume(); // ORIGINAL MEM
                        console.debug("corner case AT");
                    }
                }
            } else if (currentToken.value === '>') {
                if (memoryRegion === null) {
                    this.consume();
                    memoryRegion = this.expect('word');
                    if (!memoryRegion) return null;
                } else {
                    this.consume(); // >
                    this.consume(); // ORIGINAL MEM
                }
            }
        }

        // Consume optional semicolon or comma
        if (
            this.peek() &&
            this.peek().type === 'word' &&
            (this.peek().value === ';' || this.peek().value === ',')
        ) {
            this.consume();
        }

        return {
            type: 'SectionDefinition',
            name: name,
            memoryRegion: memoryRegion
        };
    }

    parseConstant() {
        const name = this.expect('word');
        if (!name) return null;

        const equalSign = this.expect('word', '=');
        if (!equalSign) return null;

        const valueToken = this.peek();
        if (!valueToken) {
            this.addError(`Expected value for constant ${name} at index ${this.currentIndex}`);
            return null;
        }

        let value;
        if (valueToken.type === 'number_hex' || valueToken.type === 'number_dec') {
            value = this.consume().value;
        } else {
            this.addError(`Unsupported constant value type: ${valueToken.type} '${valueToken.value}' at index ${this.currentIndex}`);
            this.consume();
            return null;
        }

        // Consume optional semicolon
        if (
            this.peek() &&
            this.peek().type === 'word' &&
            this.peek().value === ';'
        ) {
            this.consume();
        }

        // Handle inline comment after constant
        if (this.isCommentStart()) {
            this.consumeComment();
            this.isInsideComment = true;
        }

        return {
            type: 'Constant',
            name: name,
            value: value
        };
    }

    handleDiscard() {
        this.consume(); // consume '/DISCARD/'
        // Optionally, consume ':' if present
        if (this.peek() && this.peek().value === ':') {
            this.consume();
        }
        //console.log("Encountered /DISCARD/, handling discard block.");

        // If the next token is '{', consume the block
        if (this.peek() && this.peek().value === '{') {
            this.consume(); // consume '{'
            let braceCount = 1;

            while (this.currentIndex < this.tokens.length && braceCount > 0) {
                const token = this.peek();

                if (this.isInsideComment) {
                    if (!this.isCommentEnd()) {
                        this.consumeComment();
                    } else {
                        this.consumeComment();
                        this.isInsideComment = false;
                    }
                    continue;
                }

                if (this.isCommentStart()) {
                    this.consumeComment();
                    this.isInsideComment = true;
                    continue;
                }

                if (token.value === '{') {
                    braceCount++;
                } else if (token.value === '}') {
                    braceCount--;
                }

                this.consume();
            }

            if (braceCount !== 0) {
                this.addError("Mismatched braces in /DISCARD/ section.");
            } else {
                //console.log("Finished handling /DISCARD/ block.");
            }
        }

        //console.log("Encountered /DISCARD/, stopping parsing.");
        // After handling /DISCARD/, stop parsing
    }

    /**
     * Calculates memory usage based on startAddress and budget.
     * @param {number} startAddress - The starting address of the memory region.
     * @param {number} budget - The total memory budget (size) for the calculation.
     * @returns {object} - An object containing memory usage details or an error.
     */
    calculateMemoryUsage(startAddress, budget) {
        // Convert startAddress to a number if it's a hex string
        if (typeof startAddress === 'string') {
            if (startAddress.startsWith('0x') || startAddress.startsWith('0X')) {
                const parsedAddress = parseInt(startAddress, 16);
                if (isNaN(parsedAddress)) {
                    const message = `Invalid hexadecimal start address: ${startAddress}`;
                    console.error(message);
                    return { error: message };
                }
                console.debug(`Converted startAddress from hex string '${startAddress}' to decimal ${parsedAddress}`);
                startAddress = parsedAddress;
            } else {
                // Assume it's a decimal string
                const parsedAddress = parseInt(startAddress, 10);
                if (isNaN(parsedAddress)) {
                    const message = `Invalid start address: ${startAddress}`;
                    console.error(message);
                    return { error: message };
                }
                console.debug(`Converted startAddress from decimal string '${startAddress}' to number ${parsedAddress}`);
                startAddress = parsedAddress;
            }
        } else if (typeof startAddress !== 'number') {
            const message = `startAddress must be a number or a hexadecimal string. Received type: ${typeof startAddress}`;
            console.error(message);
            return { error: message };
        }

        console.debug(`Starting memory usage calculation with startAddress: 0x${startAddress.toString(16)} (${startAddress}) and budget: ${budget} bytes`);

        // Find the memory region that includes the startAddress
        const memoryRegion = this.ast.memories.find(mem => {
            console.debug(`Checking memory region '${mem.name}': Origin = 0x${mem.origin.toString(16)} (${mem.origin}), Length = ${mem.length} bytes`);
            const inRegion = startAddress >= mem.origin && startAddress < (mem.origin + mem.length);
            console.debug(`  Is startAddress within '${mem.name}'? ${inRegion}`);
            return inRegion;
        });

        if (!memoryRegion) {
            const message = `No memory region found for start address: 0x${startAddress.toString(16)}`;
            console.error(message);
            return { error: message };
        }

        // Calculate the available memory from the startAddress
        const available = (memoryRegion.origin + memoryRegion.length) - startAddress;
        console.debug(`Available memory in '${memoryRegion.name}' from startAddress: ${available} bytes`);

        if (budget > available) {
            const message = `Budget (${budget} bytes) exceeds available memory (${available} bytes) from start address: 0x${startAddress.toString(16)}`;
            console.error(message);
            return { error: message };
        }

        const used = budget;
        const free = available - used;
        const usage_pct = ((used / available) * 100).toFixed(2);

        console.debug(`Memory Usage for '${memoryRegion.name}': Used = ${used} bytes, Free = ${free} bytes, Usage = ${usage_pct}%`);

        return {
            memoryType: memoryRegion.name,
            startAddress: `0x${startAddress.toString(16)}`,
            used: used,
            budget: budget,
            free: free,
            usage_pct: usage_pct,
        };
    }
}