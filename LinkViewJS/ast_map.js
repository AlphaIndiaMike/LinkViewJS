class AST_MAP extends AST_Base {
    constructor(starterString) {
        super(starterString);
        this.ast = {
            type: 'MapFile',
            memories: [],
            sections: [],
            symbols: []
        };
        this.currentIndex = 0;
        this.errors = [];
        this.isInsideComment = false;
    }

    parse() {
        this.currentIndex = 0;
        //console.log("Starting AST_MAP parsing...");

        while (this.currentIndex < this.tokens.length) {
            const token = this.peek();
            //console.log(`Current Token [${this.currentIndex}]: Type=${token.type}, Value='${token.value}'`);

            if (this.isKeyword('Name') && this.isNextKeyword('Origin')) {
                this.consume(); // Consume 'Name'
                this.consume(); // Consume 'Origin'
                this.consume(); // Consume 'Length'
                this.consume(); // Consume 'Attributes'
                //console.log("Detected 'Memory Configuration' section.");
                this.parseMemoryConfiguration();
            } else if (this.isKeyword('Linker') && this.isNextKeyword('script')) {
                this.consume(); // Consume 'Linker'
                this.consume(); // Consume 'script'
                this.consume(); // Consume 'and'
                this.consume(); // Consume 'memory'
                this.consume(); // Consume 'map'
                //console.log("Detected 'Linker script and memory map' section.");
                this.parseLinkerScriptAndMemoryMap();
            } else if (this.isKeyword('Cross') && this.isNextKeyword('Reference')) {
                //console.log(`Finished AST_MAP parsing`);
                break;
            }
            //console.log(`Skipping unrecognized token at index ${this.currentIndex}: ${token.value}`);
            this.consume();
            continue;
    
        }

        //console.log("Finished AST_MAP parsing.");
    }

    parseMemoryConfiguration() {
        //console.log("Parsing Memory Configuration...");
        // Skip header line

        while (this.currentIndex < this.tokens.length) {
            const token = this.peek();
            //console.log(`Memory Config Token [${this.currentIndex}]: Type=${token.type}, Value='${token.value}'`);

            if ((this.isKeyword('Linker') && this.isNextKeyword('script'))||(this.isKeyword('*default*'))) {
                //console.log("End of Memory Configuration section.");
                break;
            }
            const memory = this.parseMemoryRegionLine();
            if (memory) {
                this.ast.memories.push(memory);
                //console.log("Parsed Memory Region:", memory);
            } else {
                //console.log(`Failed to parse memory region at index ${this.currentIndex}. Skipping token.`);
                this.consume();
            }
        }
    }

    parseMemoryRegionLine() {
        //console.log(`Parsing Memory Region Line at index ${this.currentIndex}...`);
        const name = this.expect('word');
        if (!name) return null;
        //console.log(`Memory Name: ${name}`);

        const origin = this.expect('number_hex');
        if (!origin) return null;
        //console.log(`Memory Origin: ${origin}`);

        const length = this.expect('number_hex');
        if (!length) return null;
        //console.log(`Memory Length: ${length}`);

        const attributes = this.expect('word');
        if (!attributes) return null;
        //console.log(`Memory Attributes: ${attributes}`);

        return {
            name: name,
            origin: origin,
            length: length,
            attributes: attributes
        };
    }

    parseLinkerScriptAndMemoryMap() {
        //console.log("Parsing Linker Script and Memory Map...");
        while (this.currentIndex < this.tokens.length) {
            const token = this.peek();
            //console.log(`Linker Script Token [${this.currentIndex}]: Type=${token.type}, Value='${token.value}'`);

            if (this.isKeyword('/DISCARD/')) {
                //console.log("End of Linker Script and Memory Map section.");
                break;
            }
            else if (this.expect('number_hex'))
            {
                this.parseSection();
            }
            else if (this.isKeyword('LOAD')) {
                const loadEntry = this.parseLoadStatement();
                if (loadEntry) {
                    this.ast.sections.push(loadEntry);
                    //console.log("Parsed LOAD Entry:", loadEntry);
                }
                else
                {
                    //Skip:
                    this.consume();//LOAD
                    this.consume();//Object
                }
            }
            this.consume();
            continue;
            
        }
    }

    parseLoadStatement() {
        /* Not required for now...
        //console.log(`Parsing LOAD statement at index ${this.currentIndex}...`);
        this.expect('word', 'LOAD');
        const filePath = this.expect('path');
        if (!filePath) {
            //console.log("Failed to parse LOAD statement file path.");
            return null;
        }
        //console.log(`LOAD File Path: ${filePath}`);
        return {
            type: 'LOAD',
            file: filePath
        };
        */
       return null;//Not required
    }

    parseStartGroup() {
        /* Not required for now...
        //console.log("Entering START GROUP block.");
        this.expect('symbol', '{');

        while (this.currentIndex < this.tokens.length) {
            const token = this.peek();
            //console.log(`START GROUP Token [${this.currentIndex}]: Type=${token.type}, Value='${token.value}'`);

            if (token.type === 'symbol' && token.value === '}') {
                this.consume();
                //console.log("Exiting START GROUP block.");
                break;
            }

            if (this.isKeyword('LOAD')) {
                const loadEntry = this.parseLoadStatement();
                if (loadEntry) {
                    this.ast.sections.push(loadEntry);
                    //console.log("Parsed LOAD Entry within START GROUP:", loadEntry);
                }
            } else {
                //console.log(`Unrecognized token within START GROUP at index ${this.currentIndex}: ${token.value}`);
                this.consume();
            }
        }
        */
    }

    parseSection() {
        //console.log("Parsing Sections and Symmbols");
        while (this.currentIndex < this.tokens.length) {
            const token = this.peek();
            //console.log(`Linker Script Token [${this.currentIndex}]: Type=${token.type}, Value='${token.value}'`);

            if ((this.isKeyword('/DISCARD/'))||(this.peek(4)===undefined)) {
                //console.log("End of Linker Script and Memory Map section.");
                break;
            }
            else if (token.type==='word')
            {
                ////console.log(`Testing section ${this.peek(0).value}, ${this.peek(1).value}, ${this.peek(2).value}, ${this.peek(3).value}`);
                if ((this.peek(0).type==='word')&&
                    (this.peek(1).type==='number_hex')&&
                    (this.peek(2).type==='number_hex')&&
                    (this.peek(3).type==='number_hex'))
                {
                    const section_name = this.consume().value;
                    const address = this.consume().value;
                    const size = this.consume().value;
                    const section = {
                        type: 'Section',
                        name: section_name,
                        address: address,
                        size_hex: size
                    };
                    this.ast.sections.push(section);
                }
                else if (token.type==='word'){
                    ////console.log(`Testing symbol ${this.peek(0).value}, ${this.peek(1).value}, ${this.peek(2).value}, ${this.peek(3).value}, ${this.peek(4).value}`);
                    if ((this.peek(0).type==='word')&&
                        (this.peek(1).type==='number_hex')&&
                        (this.peek(2).type==='number_hex')&&
                        (this.peek(3).type==='word')&&
                        (this.peek(4).type==='number_hex'))
                    {
                        const symbol = this.parseSymbol();
                        this.ast.symbols.push(symbol);
                    }
                }   
            }

            this.consume();
            continue;
            
        }
    }

    parseSymbol() {
        //console.log(`Parsing Section at index ${this.currentIndex}...`);
        const name = this.expect('word');
        if (!name) return null;
        //console.log(`Section Name: ${name}`);

        const address = this.expect('number_hex');
        if (!address) return null;
        //console.log(`Section Address: ${address}`);

        const size = this.expect('number_hex');
        if (!size) return null;
        //console.log(`Section Size: ${size}`);

        const filePath = this.expect('word');
        if (!filePath) return null;
        //console.log(`Section File Path: ${filePath}`);

        return {
            type: 'Symbol',
            name: name,
            address: address,
            size: size,
            object: filePath
        };
    }

    peek(offset = 0) {
        return this.tokens[this.currentIndex + offset];
    }

    consume() {
        if (this.currentIndex < this.tokens.length)
        {return this.tokens[this.currentIndex++];}
        return null;
    }

    expect(expectedType, expectedValue) {
        const token = this.consume();
        //console.log(`Expecting Type=${expectedType}` + (expectedValue ? `, Value='${expectedValue}'` : '') + ` | Found Type=${token.type}, Value='${token.value}'`);
        if (
            token &&
            token.type === expectedType &&
            (expectedValue === undefined || token.value.toUpperCase() === expectedValue.toUpperCase())
        ) {
            return token.value;
        } else {
            const msg = `Expected Type=${expectedType}` + (expectedValue ? `, Value='${expectedValue}'` : '') + ` but found Type=${token.type}, Value='${token.value}'`;
            this.addError(msg);
            //console.log(msg);
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

    isNextKeyword(value) {
        const token = this.peek(1);
        return token && token.type === 'word' && token.value.toUpperCase() === value.toUpperCase();
    }

    consumeComment() {
        const token = this.consume();
        //console.log(`Consumed Comment: '${token.value}'`);
    }
}
