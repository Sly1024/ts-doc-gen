"use strict";

let pairs = { '{':'}', '(':')', '[':']', '"':'"', "'":"'" };

function findMatch(code, pos) {
    const stack = [];         // the stack of closing parenthesis to match in the remaining string
    let inString = false;   // contains the quote character if we're inside a quoted string

    do {
        let c = code.charAt(pos++);
        if (inString) {                             // we're inside a string
            if (c === '\\') pos++; else             // skip escaped chars
            if (c === inString) inString = false;   // found the end of the string
        } else {
            if (c === stack[stack.length-1]) {      // found a matching close paren.
                stack.pop();
            } else if (c === '"' || c === "'") {    // a string starts here
                inString = c;
            } else if (pairs[c]) {                  // found an open parenthesis
                stack.push(pairs[c]);
            } else
            // could be a regex
            // make sure it's not a line comment: "//"
            if (c === '/' && code.charAt(pos) !== '/' && code.charAt(pos-2) !== '/') {
                for (let end = pos+1; end < code.length; end++) {
                    let c2 = code.charAt(end);
                    if (c2 === '\r' || c2 === '\n') break;  // can't be regex
                    // ending "/" of the regex, if it's not escaped
                    if (c2 === '/' && code.charAt(end-1) !== '\\') {
                        try {
                            // let's try to compile the regex
                            var rx = new RegExp(code.substring(pos, end));
                            // no errors, we can skip the whole block
                            pos = end+1;
                            break;
                        } catch (err) {}
                    }
                }
            }
        }
    // exit when the stack is empty and we're not in a string => found the matching pair
    // or when we run out of characters
    } while (pos < code.length && (inString || stack.length > 0));

    return inString === false && stack.length === 0 ? pos-1 : -1;
}

const whiteSpace = /[\s\r\n]/;

// returns: { index: num, length: num, value: ''|{} } | null
function matchPattern(pattern, code, index, props) {
    index = index || 0;

    let retObj = { };
    let length, value;
    
    if (Array.isArray(pattern)) {
        let vals = [], pos = index;
        for (var i = 0, len = pattern.length; i < len; ++i) {
            let patt = pattern[i];
            let res = matchPattern(patt, code, pos, props);
            if (!res) return null;
            pos = (res.index || pos) + res.length;
            vals.push(res.value);
            if (i === 0 && typeof res.index === 'number') index = res.index;
        }
        value = vals.join('');
        length = pos - index;
    } else
    if (typeof pattern === 'string') {
        // empty string always matches
        if (code.substr(index, pattern.length) !== pattern) return null;
        value = pattern;
    } else
    if (pattern instanceof RegExp) {
        pattern.lastIndex = index;
        let match = pattern.exec(code);
        if (!match || match.index !== index) return null;
        value = match[0];
        retObj.capturedValue = match[match.length-1];
        index = match.index;
    } else
    if (typeof pattern === 'object') {    // must be an object
        switch (pattern.type) {
            case '?':  // optional part
                var res = matchPattern(pattern.val, code, index, props);
                value = res ? res.value : '';
                length = res ? res.length : 0;
            break;
            case 'prop':
                retObj = matchPattern(pattern.val, code, index, props);
                if (retObj && props) props[pattern.name] = retObj.capturedValue || retObj.value;
            break;
            case 'propobj':
                retObj = matchPattern(pattern.val, code, index, props);
                if (retObj && props) props[pattern.name] = retObj;
            break;
            case 'obj':
                //retObj = {};
                var res = matchPattern(pattern.val, code, index, retObj);
                if (!res) return null;
                retObj.length = res.length;
                retObj.index = res.index;
            break;
            case 'rep':
                value = [];
                var res;
                var pos = index;
                while (res = matchPattern(pattern.val, code, pos, props)) {
                    value.push(res);
                    pos = res.index + res.length;
                    let sep = matchPattern(pattern.sep, code, pos, props);
                    if (sep) {
                        pos += sep.length;
                    } else break;
                }
                length = pos - index;
                retObj.capturedValue = value.map(item => item.capturedValue || item);
            break;
            case 'code':
                var pos = index;
                while (pos < code.length) {
                    if (pos - index >= (pattern.min || 0) && matchPattern(pattern.sep, code, pos, props)) break;
                    if ((pos = findMatch(code, pos) + 1) === 0) return null;
                }
                value = code.substring(index, pos);
            break;
            case 'if':
                var res = matchPattern(pattern.val, code, index, props);
                if (res) {
                    let pos = res.index + res.length;
                    retObj = matchPattern(pattern.then, code, pos, props);
                } else if (pattern.else) {
                    retObj = matchPattern(pattern.else, code, index, props);
                } else {
                    retObj = null;
                }
            break;
            /*case 'not':
                retObj = matchPattern(pattern.val, code, pos);
                if (!retObj || matchPattern(pattern.not, retObj.value)) return null;
            break;*/
            default: 
                retObj = matchPattern(pattern.val, code, index, props);
        }
    } else 
    {
        throw new Error('Unknown pattern ' + pattern);
    }

    // if value is not filled, there's a new retObj, don't mess with its values!
    if (value || value === '') {
        retObj.value = value;
        retObj.length = length || value.length;
        retObj.index = index;
    }

    if (retObj && pattern.and) {
        // call "and" and set retObj 
        let andRetVal = pattern.and(retObj, code, index, props);
        if (andRetVal !== undefined) retObj = andRetVal;
    }

    if (retObj && props && pattern.attribs) {
        let lookPos = retObj.index;
        
        while (pattern.attribs.some(prop => {
            let p = lookPos;
            while (--p && whiteSpace.test(code[p])) {}
            if (strEndsWithAt(code, prop, ++p)) {
                (props.attribs || (props.attribs = [])).push(prop);
                lookPos = p-prop.length;
                return true;
            }
        })) {}
        
        retObj.length = retObj.index + retObj.length - lookPos;
        retObj.index = lookPos; 
    }

    return retObj;
}

function stringToRegex(str) {
    // https://github.com/sindresorhus/escape-string-regexp/blob/master/index.js
    return new RegExp(str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&'), 'g');
}

function stringOrRegex(param) {
    return typeof param === 'string' || param instanceof RegExp;
}

function getRegexSrc(strOrRegex) {
    return typeof strOrRegex === 'string' ? 
        strOrRegex.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&') : 
        strOrRegex.source;
}

function joinRegexs(left, separator, right) {
    return new RegExp(`(?:${getRegexSrc(left)})${separator}(?:${getRegexSrc(right)})`, 'g');
}

function processPattern(pattern) {
    if (pattern === ' ') {  // *any* number of whiteSpace, including line endings
        pattern = new RegExp(whiteSpace.source+'*', 'g');
    }

    if (Array.isArray(pattern)) {
        for (var i = 0; i < pattern.length; ++i) {
            pattern[i] = processPattern(pattern[i]);
            if (i > 0 && stringOrRegex(pattern[i-1]) && stringOrRegex(pattern[i])) {
                pattern.splice(i-1, 2, joinRegexs(pattern[i-1], '', pattern[i]));
                --i;
            }
        }
        if (pattern.length === 1) pattern = pattern[0];
    } else
    if (typeof pattern === 'string') {
        // Not sure if this is faster when searching in a fixed position!
        //pattern = stringToRegex(pattern);
    } else
    if (pattern instanceof RegExp) {
        if (!pattern.global) {
            pattern = new RegExp(pattern.source, 'g');
        }
    } else
    if (typeof pattern === 'object') {    // must be an object
        if (pattern.type === 'id') pattern = /[_a-zA-Z]\w*/g;
        else {
            ['val', 'sep', 'then', 'else'].forEach(prop => {
                if (pattern[prop]) pattern[prop] = processPattern(pattern[prop]);
            });
        }
    } else {
        throw new Error('Unknown pattern ' + pattern);
    }

    return pattern;
}

/**
 * @returns {RegExp}
 */
function getFirstRegex(pattern) {
    if (pattern instanceof RegExp) return pattern;
    if (typeof pattern === 'string') return stringToRegex(pattern);
    if (Array.isArray(pattern)) return getFirstRegex(pattern[0]);
    if (pattern.val) return getFirstRegex(pattern.val);
    throw new Error('Couldn\'t find leading RegExp.');
}

function PatternMatcher(pattern, skipPattern) {
    this.pattern = processPattern(pattern);
    this.skipPattern = skipPattern ? processPattern(skipPattern) : null;
    this.scanRegex = skipPattern ? 
        joinRegexs(getFirstRegex(this.pattern), '|', getFirstRegex(this.skipPattern)) : 
        getFirstRegex(this.pattern);
}

PatternMatcher.prototype.setCode = function(code) {
    this.code = code;
    this.scanRegex.lastIndex = 0;
};

PatternMatcher.prototype.next = function () {
    const scanRE = this.scanRegex;
    let scan; 
    while (scan = scanRE.exec(this.code)) {
        if (this.skipPattern) {
            let skipMatch = matchPattern(this.skipPattern, this.code, scan.index);
            if (skipMatch) {
                scanRE.lastIndex = skipMatch.index + skipMatch.length;
                continue;
            }
        }
        
        let match = matchPattern(this.pattern, this.code, scan.index);
        if (match) {
            scanRE.lastIndex = match.index + match.length;
            return match;
        }
    }
    
    return null;
};

function strEndsWithAt(str, end, at) {
    return str.substr(at - end.length, end.length) === end;
}


let classInterfacePattern = { type: 'obj', val: [
    { type: 'prop', name: 'type', val: /class|interface/g, attribs: ['abstract'] },
    ' ',
    { type: 'prop', name: 'name', val: { type: 'id' } },
    ' ',
    { type: '?', val: [
        'extends', ' ',
        { type: 'prop', name: 'extends', val: { type: 'id' } },
        ' '
    ]},
    { type: '?', val: [
        'implements', ' ',
        { type: 'prop', name: 'implements', val:
            { type: 'rep',
                val: { type: 'id' },
                sep: [' ', ',', ' ']
            }
        },
        ' '
    ]},
    '{',
        { type: 'propobj', name: 'contents', val: { type: 'code', sep: '}' }  }, 
    '}'
]};

function addAttribs(matchObj, tags) {
    if (matchObj.attribs) matchObj.attribs.forEach(attrib => tags.push({ name:attrib, order: 0.2 }));
}

function genClassIfaceDocTags(classIface) {
    let tags = [{ name:classIface.type, value:classIface.name, order: 0.1 }];
    if (classIface.extends) tags.push({ name:'extends', value:classIface.extends, order: 0.3});
    if (classIface.implements) classIface.implements.forEach((typeName, idx) => tags.push({ 
        name:'implements', 
        value: '{'+typeName+'}', 
        order: 0.4 + idx * 0.01
    }) );
    addAttribs(classIface, tags);
    return tags;    
}

let methodPropertyPattern = { type: 'obj', val: [
    { type: 'prop', name: 'name', val: { type: 'id' }, attribs: ['public', 'protected', 'private', 'abstract']},
    ' ', 
    { type: 'if', val: { val: '(', and: (ret, code, pos, props) => { props.isMethod = !!ret.value } },         
        then: [ 
            // Method
            { type: 'prop', name: 'params', val:
                {
                    type: 'rep',
                    sep: ',',
                    val: { type: 'obj', val: [
                        ' ',
                        { type: '?', 
                            val: { type: 'prop', name: 'visibility', val: /private|protected|public/g } 
                        },
                        ' ',
                        { type: 'prop', name: 'name', val: { type: 'id'} },
                        { type: 'prop', name: 'optional', val: { 
                            // tricky? this is an optional literal '?'
                            type: '?', val: '?', and: (ret) => { ret.value = !!ret.value } // make it boolean
                        } },    
                        ' ',
                        { type: '?', val: [
                            ':', ' ',
                            { type: 'prop', name: 'type', val:
                                { type: 'code', min: 1, sep: [' ', /[,)=](?!>)/g] } // whitespace followed by ',' or ')', or '=', NOT followed by '>'
                            },
                            ' '
                        ]},
                        { type: '?', val: [
                            '=', ' ',
                            { type: 'prop', name: 'defaultValue', val: { type: 'code', min: 1, sep: [' ', /[,)]/ ] } },
                            ' '
                        ]}
                    ]}
                }
            },
            ' ', ')', ' ',
            { type: '?', val: [
                ':', ' ',
                { type: 'prop', name: 'returnType', val: { type: 'code', min: 1, sep:
                    { 
                        val: [' ', /[;{}]|$/g ],   // whitespace followed by ';' or '{' or '}' or end_of_string
                        and: (ret, code, pos) => {  // not to match '=> {'
                            let p = pos + ret.length-1;
                            if (code[p] === '{') {
                                while (--p && /\s/.test(code[p])) {}
                                if (code[p-1] === '=' && code[p] === '>' ) return null;
                            }
                        }
                    }
                }},
                ' '
            ]},
            { type: '?', val: ['{', { type: 'code', sep: '}' }, '}'] }
        ],  // end of then Method
        else: [
            // Property
            { type: 'prop', name: 'optional', val: {
                // tricky? this is an optional literal '?'
                type: '?', val: '?', and: (ret) => { ret.value = !!ret.value }  // make it boolean
            } },    
            ' ',
            { type: '?', val: [
                ':', ' ',
                { type: 'prop', name: 'type', val:
                    { type: 'code', min: 1, sep: [' ', /[;=](?!>)/g] } // whitespace followed by ';' or '=', NOT followed by '>'
                },
                ' '
            ]},
            { type: '?', val: [
                '=', ' ',
                { type: 'prop', name: 'defaultValue', val: { type: 'code', sep: [' ', ';'], min: 1 } },
                ' '
            ]},
            ' ', ';'
        ]   // end of Property
    }
]};

function genMethodPropDocTags(methodProp, className) {
    let tags = [];
    if (methodProp.isMethod) {
        tags.push({ name:'method', value:methodProp.name, order: 0.1});
        if (methodProp.name === 'constructor') {
            tags.push({name:'constructs', value: className, order: 0.3 });
            methodProp.returnType = className;
        }
        methodProp.params.forEach((param, idx) => {
            tags.push({name:'param', value: param.optional ? `[${param.name}]` : param.name, type: param.type || 'any', order: 0.4 + idx * 0.01});
        });
        tags.push({name:'returns', type: methodProp.returnType || 'void', order: 0.7 });
    } else {
        tags.push({name:'property', value:methodProp.name, type:methodProp.type || 'any', order: 0.1});
        if (methodProp.optional) tags.push({name:'optional', order: 0.3});
        if (methodProp.defaultValue) tags.push({name:'default', value: methodProp.defaultValue, order: 0.4});
    }
    addAttribs(methodProp, tags);
    return tags;    
}

function oneLiner(str) {
    return str.replace(/[\s\r\n]+/g, ' ');
}

function trimBrackets(str) {
    return str.replace(/^\[(.*)\]$/, '$1');
}

// matches "@tag.name {type} tag.value"
function getTagPattern(tag) { 
    return {
        type: 'obj',
        val: [
            { type: 'prop', name: 'tagName', val: ['@', tag.name] },
            ' ',
            {
                type: '?',
                val:[ 
                    '{', ' ',
                    { type: 'prop', name: 'type', val: 
                        { type: 'code', sep: [' ', '}'], min: 1 } 
                    }, 
                    ' ', '}'
                ],
                and: (ret, code, pos, props) => {
                    if (tag.value && ret.value === oneLiner(tag.value)) {
                        props.type = null;
                        return { index: ret.index, length: 0, value: '' };
                    }
                }
            },
            ' '
        ].concat( tag.value ? [
            ' ',
            { type: 'propobj', name: 'tagValue' , val:[
                { type: '?', val : ['[', ' '] },
                trimBrackets(oneLiner(tag.value)),
                { type: '?', val : [' ', ']'] }
            ]}
        ] : [])
    };
}

function getDocTagInserts(contents, position, tags) {
    // find the block comment before `position`
    let commentPos = findBlockCommentBefore(contents, position);
    const indent = commentPos.indent;
    let lines = [];
    let inserts = [];
    let beforeLastLine;
    
    if (commentPos.length > 0) {
        let comment = contents.substr(commentPos.index, commentPos.length);

        // TODO: only if an option is set!
        if (comment.match(/@inheritdoc/i)) return [];

        const oneLine = /^.+?$/gm;
        let match;
        while (match = oneLine.exec(comment)) {
            lines.push({ index: commentPos.index + match.index, value: match[0] });
        }
        const lastLine = lines[lines.length-1];
        
        if (lines.length === 1 || !/^\s*\*\/$/.test(lastLine.value)) {
            beforeLastLine = commentPos.index + comment.length-2;   // step back from '*/'
            inserts.push({ index: beforeLastLine, value: '\n', order: 0 },
                         { index: beforeLastLine, value: indent + ' ', order: 0.99 });
        } else {
            beforeLastLine = lastLine.index;            
        }
    } else {
        beforeLastLine = commentPos.index;
        inserts.push({ index: beforeLastLine, value: indent + '/**\n', order: 0 },
                     { index: beforeLastLine, value: indent + ' */\n', order: 0.99 });
    }
    
    tags.forEach(tag => {
        let tagMatcher = new PatternMatcher(getTagPattern(tag));

        if (!lines.some(line => {
            tagMatcher.setCode(line.value);
            let match = tagMatcher.next();

            if (match) {
                if (tag.type && !match.type) {    // insert type
                    inserts.push({
                        index: line.index + match.index + match.tagName.length, 
                        value: ' {' + oneLiner(tag.type) + '}',
                        order: tag.order
                    });
                }
                
                if (tag.value) {
                    const mTagVal = match.tagValue.value;
                    // insert brackets around @prop [name] to indicate it's optional
                    // TODO: remove [] if it's the other way around
                    if (tag.value[0] === '[' && mTagVal[0] !== '[') {
                        inserts.push({
                            index: line.index + match.tagValue.index,
                            value: '[',
                            order: tag.order
                        });
                    }
                    if (tag.value[tag.value.length-1] === ']' && mTagVal[mTagVal.length-1] !== ']') {
                        inserts.push({
                            index: line.index + match.tagValue.index + mTagVal.length,
                            value: ']',
                            order: tag.order
                        });
                    }
                }
                return true;
            }
        })) {
            // didn't find @tag, insert a new line
            inserts.push({ 
                index: beforeLastLine, 
                value: indent + ` * @${tag.name}${tag.type ? ' {' + oneLiner(tag.type) + '}' : ''}${tag.value ? ' ' + oneLiner(tag.value) : ''}\n`,
                order: tag.order
            });
        }
    });
    
    return inserts;
}

function findBlockCommentBefore(contents, position) {
    let pos = position-1;
    
    while (pos > 0 && whiteSpace.test(contents[pos])) pos--;
    
    // a block comment is at least 4 characters "/**/"
    if (pos >= 3 && contents[pos-1] === '*' && contents[pos] === '/') {
        const end = pos+1;
        pos -= 3;
        while (pos > 0 && !(contents[pos] === '/' && contents[pos+1] === '*')) pos--;
        
        if (contents[pos] === '/' && contents[pos+1] === '*') {
            let indentPos = pos-1;
            while (/[ \t]/.test(contents[indentPos])) indentPos--;
            return { index: pos, length: end-pos, indent: contents.substring(indentPos+1, pos) };
        }
    }
    
    pos = position-1;
    while (/[ \t]/.test(contents[pos])) pos--;
    
    return { index: pos+1, length: 0, indent: contents.substring(pos+1, position) };
}

function applyInserts(contents, inserts) {
    // sort in ascending "index+order" order 
    inserts.sort((a, b) => a.index + (a.order || 0) - b.index - (b.order || 0));
    
    let result = '';
    let pos = 0;
    
    inserts.forEach(insert => {
        result += contents.substring(pos, insert.index) + insert.value;
        pos = insert.index;        
    });
    
    return result + contents.substr(pos);
}

let blockCommentRE = /\/\*[\w\W]*?\*\//g;
let lineCommentRE = /\/\/.*/g;
let commentRE = joinRegexs(blockCommentRE, '|', lineCommentRE);

function generateDocComments(fileDescriptions) {
    const classIfaceMatcher = new PatternMatcher(classInterfacePattern, commentRE);
    const methodPropMatcher = new PatternMatcher(methodPropertyPattern, commentRE);
    
    return fileDescriptions.forEach(desc => {
        const contents = desc.contents;
        let inserts = [];

        classIfaceMatcher.setCode(contents);
        let classIface;

        while (classIface = classIfaceMatcher.next()) {
            //console.log(`found ${classIface.type} ${classIface.name}`, genClassIfaceDocTags(classIface));
            [].push.apply(inserts, getDocTagInserts(contents, classIface.index, genClassIfaceDocTags(classIface)));
            
            if (classIface.contents) {
                methodPropMatcher.setCode(classIface.contents.value);
                let methodProp;
                while (methodProp = methodPropMatcher.next()) {
                    //console.log(`--- found ${methodProp.isMethod ? 'method' : 'property'} ${methodProp.name}`, genMethodPropDocTags(methodProp, classIface.name));
                    let methodInserts = getDocTagInserts(classIface.contents.value, methodProp.index, genMethodPropDocTags(methodProp, classIface.name));
                    methodInserts.forEach(insert => insert.index += classIface.contents.index);
                    [].push.apply(inserts, methodInserts);
                }
            }
        }
        
        desc.augmented = applyInserts(contents, inserts);
    });
}

module.exports = generateDocComments;
