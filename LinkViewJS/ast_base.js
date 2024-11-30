class AST_Base {
    constructor(starterString) {
        this.starterString = starterString;
        // Dictionary of acceptable token types
        this.dictionary = ['word', 'number_dec', 'number_hex', 'size_kb', 'size_mb', 'size_gb'];
        this.tokens = []; // Initialize the tokens array as a member variable
    }

    static removeLeadingZeros(str) {
        // Remove leading zeros, but if the string is empty, return '0'
        const res = str.replace(/^0+/, '');
        return res === '' ? '0' : res;
    }

    tokenize(content) {
        // Find the starting index of the starter string
        const startIndex = content.indexOf(this.starterString);
        if (startIndex === -1) {
            // Starter string not found
            this.tokens = [];
            return [];
        }

        // Extract the text starting from the starter string
        const text = content.slice(startIndex + this.starterString.length);

        // Split the text into tokens based on spaces
        const rawTokens = text.trim().split(/\s+/);

        const tokens = [];

        for (const tokenStr of rawTokens) {
            if (tokenStr.includes('>')) {
                const splitParts = tokenStr.split('>');
                splitParts.forEach((part, index) => {
                    if (part) {
                        const cleanedPart = part.replace(/[^\w]$/, '');
                        let match;

                        // Check for size_gb
                        if ((match = cleanedPart.match(/^0*([0-9]+)[Gg]$/))) {
                            tokens.push({ type: 'size_gb', value: AST_Base.removeLeadingZeros(match[1]) });
                        }
                        // Check for size_mb
                        else if ((match = cleanedPart.match(/^0*([0-9]+)[Mm]$/))) {
                            tokens.push({ type: 'size_mb', value: AST_Base.removeLeadingZeros(match[1]) });
                        }
                        // Check for size_kb
                        else if ((match = cleanedPart.match(/^0*([0-9]+)[Kk]$/))) {
                            tokens.push({ type: 'size_kb', value: AST_Base.removeLeadingZeros(match[1]) });
                        }
                        // Check for number_hex
                        else if ((match = cleanedPart.match(/^0x0*([0-9A-Fa-f]+)$/))) {
                            tokens.push({ type: 'number_hex', value: AST_Base.removeLeadingZeros(match[1]).toUpperCase() });
                        }
                        // Check for number_dec
                        else if ((match = cleanedPart.match(/^0*([0-9]+)$/))) {
                            tokens.push({ type: 'number_dec', value: AST_Base.removeLeadingZeros(match[1]) });
                        }
                        // Else, classify as word (including punctuation)
                        else {
                            tokens.push({ type: 'word', value: part });
                        }
                    }

                    // Add '>' as a separate token except after the last part
                    if (index < splitParts.length - 1) {
                        tokens.push({ type: 'word', value: '>' });
                    }
                });
            } else {
                // For number matching, remove trailing punctuation
                const cleanedTokenStr = tokenStr.replace(/[^\w]$/, '');

                let match;

                // Check for size_gb
                if ((match = cleanedTokenStr.match(/^0*([0-9]+)[Gg]$/))) {
                    tokens.push({ type: 'size_gb', value: AST_Base.removeLeadingZeros(match[1]) });
                }
                // Check for size_mb
                else if ((match = cleanedTokenStr.match(/^0*([0-9]+)[Mm]$/))) {
                    tokens.push({ type: 'size_mb', value: AST_Base.removeLeadingZeros(match[1]) });
                }
                // Check for size_kb
                else if ((match = cleanedTokenStr.match(/^0*([0-9]+)[Kk]$/))) {
                    tokens.push({ type: 'size_kb', value: AST_Base.removeLeadingZeros(match[1]) });
                }
                // Check for number_hex
                else if ((match = cleanedTokenStr.match(/^0x0*([0-9A-Fa-f]+)$/))) {
                    tokens.push({ type: 'number_hex', value: AST_Base.removeLeadingZeros(match[1]).toUpperCase() });
                }
                // Check for number_dec
                else if ((match = cleanedTokenStr.match(/^0*([0-9]+)$/))) {
                    tokens.push({ type: 'number_dec', value: AST_Base.removeLeadingZeros(match[1]) });
                }
                // Else, classify as word (including punctuation)
                else {
                    tokens.push({ type: 'word', value: tokenStr });
                }
            }
        }

        // Ensure only acceptable token types are used
        for (const token of tokens) {
            if (!this.dictionary.includes(token.type)) {
                token.type = 'unknown';
            }
        }

        // Store the tokens as a member variable
        this.tokens = tokens;

        return tokens;
    }
}