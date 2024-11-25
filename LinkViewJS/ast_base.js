// ast_base.js

function AST_Base(starterString) {
    this.starterString = starterString;
    // Dictionary of acceptable token types
    this.dictionary = ['word', 'number_dec', 'number_hex', 'size_kb', 'size_mb', 'size_gb'];
}

AST_Base.prototype.tokenize = function(content) {
    // Find the starting index of the starter string
    var startIndex = content.indexOf(this.starterString);
    if (startIndex === -1) {
        // Starter string not found
        return [];
    }

    // Extract the text starting from the starter string
    var text = content.slice(startIndex + this.starterString.length);

    // Split the text into tokens based on spaces
    var rawTokens = text.trim().split(/\s+/);

    var tokens = [];

    for (var i = 0; i < rawTokens.length; i++) {
        var tokenStr = rawTokens[i];

        // For number matching, remove trailing punctuation
        var cleanedTokenStr = tokenStr.replace(/[^\w]$/, '');

        var match;

        // Check for size_gb
        if ((match = cleanedTokenStr.match(/^0*([0-9]+)[Gg]$/))) {
            tokens.push({ type: 'size_gb', value: removeLeadingZeros(match[1]) });
        }
        // Check for size_mb
        else if ((match = cleanedTokenStr.match(/^0*([0-9]+)[Mm]$/))) {
            tokens.push({ type: 'size_mb', value: removeLeadingZeros(match[1]) });
        }
        // Check for size_kb
        else if ((match = cleanedTokenStr.match(/^0*([0-9]+)[Kk]$/))) {
            tokens.push({ type: 'size_kb', value: removeLeadingZeros(match[1]) });
        }
        // Check for number_hex
        else if ((match = cleanedTokenStr.match(/^0x0*([0-9A-Fa-f]+)$/))) {
            tokens.push({ type: 'number_hex', value: removeLeadingZeros(match[1]).toUpperCase() });
        }
        // Check for number_dec
        else if ((match = cleanedTokenStr.match(/^0*([0-9]+)$/))) {
            tokens.push({ type: 'number_dec', value: removeLeadingZeros(match[1]) });
        }
        // Else, classify as word (including punctuation)
        else {
            tokens.push({ type: 'word', value: tokenStr });
        }
    }

    // Ensure only acceptable token types are used
    for (var j = 0; j < tokens.length; j++) {
        var token = tokens[j];
        if (this.dictionary.indexOf(token.type) === -1) {
            token.type = 'unknown';
        }
    }

    return tokens;
};

function removeLeadingZeros(str) {
    // Remove leading zeros, but if the string is empty, return '0'
    var res = str.replace(/^0+/, '');
    return res === '' ? '0' : res;
}
