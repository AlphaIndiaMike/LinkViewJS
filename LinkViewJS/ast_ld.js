class AST_LD extends AST_Base {
    constructor(starterString) {
        super(starterString);
        this.ast = null;
        this.currentIndex = 0;
        this.errors = [];
    }

    parse() {
        this.currentIndex = 0;
        this.ast = {
            type: 'LinkerScript',
            memories: [],
            sections: []
        };

        console.info(this.tokens);

        while (this.currentIndex < this.tokens.length) {
            const token = this.peek();

            if (this.isInsideComment === true)
            {
                if (!this.isCommentEnd())
                {
                    this.consumeComment();
                }
                else
                {
                    this.consumeComment();
                    this.isInsideComment = false;
                }
            }
            else if (this.isKeyword('MEMORY')) {
                console.log(`Parsing MEMORY block at token index ${this.currentIndex}`);
                const memoryBlock = this.parseMemoryBlock();
                if (memoryBlock) {
                    this.ast.memories = memoryBlock.regions;
                    console.log("Parsed MEMORY block:", memoryBlock);
                }
            } else if (this.isKeyword('SECTIONS')) {
                console.log(`Parsing SECTIONS block at token index ${this.currentIndex}`);
                const sectionsBlock = this.parseSectionsBlock();
                if (sectionsBlock) {
                    this.ast.sections = sectionsBlock.sections;
                    console.log("Parsed SECTIONS block:", sectionsBlock);
                }
            } else {
                // Skip unknown tokens or comments
                if (this.isCommentStart()) {
                    this.consumeComment();
                    this.isInsideComment = true;
                } else {
                    console.warn(`Unknown token at index ${this.currentIndex}:`, token);
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
            //console.error(message);
            this.addError(message);
            return null;
        }
    }

    addError(message) {
        this.errors.push({ message: message, index: this.currentIndex });
    }

    isKeyword(value) {
        const token = this.peek();
        return token && token.type === 'word' && token.value === value;
    }

    isCommentStart() {
        const token = this.peek();
        return token && token.type === 'word' && token.value.startsWith('/*');
    }

    isCommentEnd() {
        const token = this.peek();
        return token && token.type === 'word' && token.value.startsWith('*/');
    }

    consumeComment() {
        const token = this.consume();
        console.log(`Skipping comment at index ${this.currentIndex - 1}:`, token.value);
        // Comments are assumed to be consumed as one token
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
                console.log("Closing MEMORY block");
                break;
            }

            if (this.isCommentStart()) {
                this.consumeComment();
                continue;
            }

            const region = this.parseMemoryRegion();
            if (region) {
                regions.push(region);
                console.log("Parsed memory region:", region);
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
            accessRights = '';
            const token = this.consume();
            accessRights += token.value;
        }

        const colon = this.expect('word', ':');
        if (!colon) return null;

        const originKey = this.expect('word', 'ORIGIN');
        console.debug("origin key: "+ originKey);
        if (!originKey) return null;

        const equalSign1 = this.expect('word', '=');
        console.debug("eq key: "+ equalSign1);
        if (!equalSign1) return null;

        const originValue = this.parseExpression();
        console.debug("origin value: "+ originValue);
        if (originValue === null) return null;

        /* Bug in the AST Base 
        const comma = this.expect('word', ',');
        if (!comma) return null;
        */

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

            if (this.isInsideComment === true)
            {
                if (!this.isCommentEnd())
                {
                    this.consumeComment();
                }
                else
                {
                    this.consumeComment();
                    this.isInsideComment = false;
                }
            }
            else
            {
                if (nextToken && nextToken.type === 'word' && nextToken.value === '}') {
                    this.consume();
                    console.log("Closing SECTIONS block");
                    break;
                }

                if (this.isCommentStart()) {
                    this.consumeComment();
                    this.isInsideComment = true;
                    continue;
                }
                else{
                    const section = this.parseSectionDefinition();
                    if (section) {
                        sections.push(section);
                        console.log("Parsed section:", section);
                    } else {
                        console.warn(`Failed to parse section at index ${this.currentIndex}`);
                        this.consume();
                    }
                }
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

            if (this.isInsideComment === true)
            {
                if (!this.isCommentEnd())
                {
                    this.consumeComment();
                }
                else
                {
                    this.consumeComment();
                    this.isInsideComment = false;
                }
            }
            else
            {
                if (this.isCommentStart()) {
                    this.consumeComment();
                    this.isInsideComment = true;
                    continue;
                }
                else
                {
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
            }
        }

        let memoryRegion = null;
        const currentToken = this.peek();

        if (currentToken && currentToken.type === 'word') {
            if (currentToken.value.includes('>')) {
                // Scenario 1: Token includes '>' (e.g., ">memoryRegion")
                const parts = currentToken.value.split('>');
                if (parts.length > 1 && parts[1].trim()) {
                    memoryRegion = parts[1].trim();
                    this.consume();
                } else {
                    // Handle case where '>' is present but no memory region follows
                    this.consume();
                    memoryRegion = this.expect('word');
                    if (!memoryRegion) return null;
                }
            } else if (currentToken.value === '>') {
                // Scenario 2: Token is exactly '>'
                this.consume();
                memoryRegion = this.expect('word');
                if (!memoryRegion) return null;
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

    calculateMemoryUsage(memoryType, startAddress, budget) {
        const memoryRegions = this.ast.memories.filter(mem =>
            mem.name.toUpperCase() === memoryType.toUpperCase()
        );

        if (memoryRegions.length === 0) {
            const message = `Memory type '${memoryType}' not found in linker script.`;
            console.error(message);
            return {
                error: message,
            };
        }

        // Sum up the lengths of the memory regions of the specified type
        const totalDeclaredMemory = memoryRegions.reduce((acc, mem) => acc + mem.length, 0);

        // Since we cannot determine actual used memory from the linker script alone, we'll assume the declared length is the used memory
        const usedMemory = totalDeclaredMemory;

        const usagePct = ((usedMemory / budget) * 100).toFixed(2);

        return {
            memoryType: memoryType,
            startAddress: startAddress,
            used: usedMemory,
            budget: budget,
            free: budget - usedMemory,
            usage_pct: usagePct,
        };
    }
}
