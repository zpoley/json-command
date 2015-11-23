var util, vm;

util = require('util');

vm = require('vm');


/*
 JSON Command class
 */

JSON.Command = function(args) {
  this.args = null;
  this.debugOn = false;
  this.fileNames = [];
  this.files = null;
  this.keys = [];
  this.transformedKeys = [];
  this.uglyOutput = false;
  this.leadingComma = false;
  this.inspectOutput = false;
  this.headerPassthrough = false;
  this.columnOutput = false;
  this.useObject = null;
  this.inputIsArray = false;
  this.conditionals = [];
  this.executables = [];
  this.firstBuffer = true;
  this.foundArray = null;
  this.stdin = null;
  this.buffer = '';
  if (args) {
    this.processArgs(args);
  }
};

JSON.Command.prototype.printhelp = function() {
  var content;
  content = ['usage: stdout_generator | json [options] [fields]', '', 'json processes standard input and parses json objects.', 'json currently handles a few different standard input formats', 'and provides a number of options tailored toward inspecting and', 'transforming parsed json objects.', '', 'options:\n', '  -h                    print this help info and exit\n', '  -v (-V | --version)   print version number and exit\n', '  -u                    print ugly json output, each object on a', '                        single line\n', '  -,                    print leading-comma diff-friendly output', '                        with one line per property\n', '  -d                    print debugging output including', '                        exception messages\n', '  -o object.path        specify the path to an array to be', '                        iterated on\n', '  new.key=old_key       move old_key to new.key in output\n', '  -a                    input object is an array,', '                        process each element separately\n', '  -c "js conditional"   js conditional to be run in the context', '                        of each object that determines whether', '                        an object is printed\n', '  -C                    print the output fields as tab delimited', '                        columns in order provided\n', '  -e "js expression"    execute arbitrary js in the context of', '                        each object.\n', '  -i                    use node\'s util.inspect instead of', '                        JSON.stringify\n', '  -H                    print headers, if they are supplied.', '                        Useful for output from curl -i.\n', 'examples:\n', '  curl https://raw.githubusercontent.com' + '/zpoley/json-command/feature-test/src/data/object.json 2> /dev/null \\', '   | json name\n', '  curl https://raw.githubusercontent.com' + '/zpoley/json-command/feature-test/src/data/object.json 2> /dev/null \\', '   | json new_name=name\n', '  curl https://raw.githubusercontent.com' + '/zpoley/json-command/feature-test/src/data/object.json 2> /dev/null \\', '   | json -o locations -C name\n', 'more help:\n', '  use "man json" or visit http://github.com/zpoley/json-command', ''];
  console.log(content.join("\n"));
  process.exit();
};

JSON.Command.prototype.printversion = function() {
  var npm;
  npm = require('npm');
  npm.load([], function(er) {
    console.log('json command line toolkit\n version: ');
    npm.commands.view(['json', 'version'], function(er, data) {
      process.exit();
    });
  });
};

JSON.Command.prototype.stringify = function(obj) {
  var result;
  result = null;
  if (this.inspectOutput) {
    result = util.inspect(obj, false, Infinity, true);
  } else if (this.leadingComma) {
    result = this.diffFriendly(obj);
  } else if (this.uglyOutput) {
    result = JSON.stringify(obj);
  } else {
    result = JSON.stringify(obj, null, 2);
  }
  return result;
};

JSON.Command.prototype.diffFriendly = function(obj) {
  var regex;
  regex = RegExp(' ?([[{,])\\n ( *)(?: )', 'gm');
  return JSON.stringify(obj, null, 2).replace(regex, '\n$2$1 ').replace(/(^|[[{,] ?)\n */gm, '$1');
};

JSON.Command.prototype.debug = function(msg) {
  if (this.debugOn) {
    console.log(msg);
  }
};

JSON.Command.prototype.printex = function(ex) {
  this.debug('ex: ' + JSON.stringify(ex, null, 2));
};


/*
  Process Command line arguments to JSON Command
 */

JSON.Command.prototype.processArgs = function(args) {
  var a, arg, i, kk;
  a = args.slice(0);
  i = 0;
  while (i < a.length) {
    if (a[i].charAt(0) === '-' && a[i].length > 2) {
      arg = a[i].replace(/^-+/, '').split('').map(function(a) {
        return "-" + a;
      });
      a.splice.apply(a, [i, 1].concat(arg));
    }
    i++;
  }
  while (a.length > 0) {
    arg = a.shift();
    switch (arg) {
      case '-h':
        this.printhelp();
        break;
      case '-v':
      case '-V':
      case '--version':
        this.printversion();
        break;
      case '-f':
        this.fileNames.push(a.shift());
        break;
      case '-d':
        this.debugOn = true;
        break;
      case '-u':
        this.uglyOutput = true;
        break;
      case '-,':
        this.leadingComma = true;
        break;
      case '-c':
        this.conditionals.push(a.shift());
        break;
      case '-C':
        this.columnOutput = true;
        break;
      case '-e':
        this.executables.push(a.shift());
        break;
      case '-o':
        this.useObject = a.shift();
        break;
      case '-a':
        this.inputIsArray = true;
        break;
      case '-i':
        this.inspectOutput = true;
        break;
      case '-H':
        this.headerPassthrough = true;
        break;
      default:
        if (arg.match('=')) {
          kk = arg.split('=');
          this.keys.push(kk[0]);
          this.transformedKeys.push({
            newKey: kk[0],
            oldKey: kk[1]
          });
        } else {
          this.keys.push(arg);
        }
        break;
    }
  }
};


/*
  Create any reuested keys that don't already exist. Init values with null.
   The default value could be an option.
 */

JSON.Command.prototype.createRequestedKeys = function(parsedObject) {
  var j;
  j = 0;
  while (j < this.keys.length) {
    if (typeof parsedObject[this.keys[j]] === 'undefined') {
      parsedObject[this.keys[j]] = null;
    }
    j++;
  }
};


/*
  Check conditionals against object.
 */

JSON.Command.prototype.checkConditionals = function(parsedObject) {
  var conditionsFailed, ex, i;
  if (this.conditionals.length) {
    try {
      conditionsFailed = false;
      i = 0;
      while (i < this.conditionals.length) {
        if (!vm.runInNewContext(this.conditionals[i], parsedObject)) {
          conditionsFailed = true;
        }
        i++;
      }
      if (conditionsFailed) {
        return false;
      }
    } catch (_error) {
      ex = _error;
      this.printex(ex);
      return false;
    }
  }
  return true;
};


/*
  Process key transforms against object.
 */

JSON.Command.prototype.processKeyTransforms = function(parsedObject) {
  var ex, i;
  if (this.transformedKeys.length) {
    i = 0;
    while (i < this.transformedKeys.length) {
      try {
        vm.runInNewContext(this.transformedKeys[i].newKey + ' = ' + this.transformedKeys[i].oldKey, parsedObject);
      } catch (_error) {
        ex = _error;
        this.printex(ex);
      }
      i++;
    }
  }
};


/*
  Process executables against object.
 */

JSON.Command.prototype.processExecutables = function(parsedObject) {
  var ex, i;
  if (this.executables.length) {
    i = 0;
    while (i < this.executables.length) {
      try {
        vm.runInNewContext(this.executables[i], parsedObject);
      } catch (_error) {
        ex = _error;
        this.printex(ex);
      }
      i++;
    }
  }
};


/*
  Process requested keys against parsedObject.
   This is one of the most complicated parts of this code, and it may
   very well not need to be. If you have a better idea of how to do this
   please let me know: zpoley@gmail.com.

   What's happening here is:
    1. Create a new object to replace the old one since we don't want all
     the keys from the old object.
    2. Create each object necessary in the chain in order for the resulting
     object to retain the same structure of the parsedObject.
     (arrays and dictionaries require separate handling)
    3. Assign each requested key value from the parsedObject into the new
     object. (arrays and dictionaries require separate handling)
 */

JSON.Command.prototype.processKeys = function(parsedObject) {
  var cols, evalStr, ex, hsh, i, instStr, instantiateArrayAndPush, j, s, simpleKey;
  instantiateArrayAndPush = function(key) {
    var evalStr, instStr, simpleKey;
    simpleKey = key.split('[').shift();
    instStr = 'if (!hsh.' + simpleKey + ') { hsh.' + simpleKey + ' = []; }';
    eval(instStr);
    evalStr = 'hsh.' + simpleKey + '.push(' + 'parsedObject.' + key + ')';
    eval(evalStr);
    cols.push(eval('parsedObject.' + key));
  };
  if (this.keys.length) {
    hsh = {};
    cols = [];
    evalStr = null;
    instStr = null;
    simpleKey = null;
    i = 0;
    while (i < this.keys.length) {
      try {
        if (this.keys[i].indexOf('.') > -1 || this.keys[i].indexOf('[') > -1) {
          if (this.keys[i].indexOf('.') > -1) {
            s = this.keys[i].split('.');
            j = 1;
            while (j < s.length) {
              evalStr = 'hsh.' + s.slice(0, j).join('.');
              if (!eval(evalStr)) {
                eval('hsh.' + s.slice(0, j).join('.') + ' = {};');
              }
              j++;
            }
            if (this.keys[i].indexOf('[') > -1) {
              instantiateArrayAndPush(this.keys[i]);
            } else {
              evalStr = 'hsh.' + s.join('.') + ' = ' + 'parsedObject.' + s.join('.');
              eval(evalStr);
              cols.push(eval('parsedObject.' + s.join('.')));
            }
          } else if (this.keys[i].indexOf('[') > -1) {
            instantiateArrayAndPush(this.keys[i]);
          }
        } else {
          hsh[this.keys[i]] = parsedObject[this.keys[i]];
          cols.push(parsedObject[this.keys[i]]);
        }
      } catch (_error) {
        ex = _error;
        this.debug('Failed to read property ' + this.keys[i] + ' from object: ' + JSON.stringify(parsedObject));
        ex.message = 'Failed to read property';
        throw ex;
      }
      i++;
    }
    if (this.columnOutput) {
      return cols;
    } else {
      return hsh;
    }
  } else {
    return parsedObject;
  }
};


/*
  Create objects.
 */

JSON.Command.prototype.createObjects = function() {
  var ex, i, newObjects, objects, trimmed;
  objects = this.parseObjects();
  try {
    if (this.useObject && objects && (objects.length > 0) && (typeof objects[0] === 'string') && (objects[0].trim().length > 0)) {
      newObjects = [];
      i = 0;
      while (i < objects.length) {
        newObjects.push(vm.runInNewContext(this.useObject, JSON.parse(objects[i])));
        i++;
      }
      objects = newObjects;
    }
  } catch (_error) {
    ex = _error;
    this.printex(ex);
  }
  if (this.inputIsArray && objects && (objects.length > 0) && (typeof objects[0] === 'string')) {
    trimmed = objects[0].trim();
    if (trimmed.length > 0 && trimmed[0] === '[') {
      objects = JSON.parse(objects[0]);
    }
  }
  return objects;
};


/*
  Prepare final objects.
 */

JSON.Command.prototype.prepareFinalObjects = function(objects) {
  var ex, i, parsedObject, preparedObjects, rawObject;
  rawObject = null;
  parsedObject = null;
  preparedObjects = [];
  try {
    i = 0;
    while (i < objects.length) {
      if (objects[i] === null || objects[i] === void 0) {
        i++;
        continue;
      }
      try {
        if (typeof objects[i] === 'string') {
          rawObject = objects[i];
          if (rawObject.trim().length === 0) {
            i++;
            continue;
          }
          parsedObject = JSON.parse(rawObject);
        } else {
          rawObject = JSON.stringify(objects[i]);
          parsedObject = objects[i];
        }
        preparedObjects.push(parsedObject);
      } catch (_error) {
        ex = _error;
        this.printex(ex);
        i++;
        continue;
      }
      i++;
    }
  } catch (_error) {
    ex = _error;
  }
  return preparedObjects;
};


/*
  Process input objects.
 */

JSON.Command.prototype.processObjects = function(objects) {
  var ex, i, outputObject, po, preparedObjects;
  preparedObjects = this.prepareFinalObjects(objects);
  try {
    i = 0;
    while (i < preparedObjects.length) {
      po = preparedObjects[i];
      this.createRequestedKeys(po);
      this.processKeyTransforms(po);
      this.processExecutables(po);
      if (!this.checkConditionals(po)) {
        i++;
        continue;
      }
      try {
        outputObject = this.processKeys(po);
      } catch (_error) {
        ex = _error;
        i++;
        continue;
      }
      if (this.columnOutput) {
        process.stdout.write(outputObject.join("\t") + '\n');
      } else {
        process.stdout.write(this.stringify(outputObject) + '\n');
      }
      i++;
    }
  } catch (_error) {
    ex = _error;
    this.printex(ex);
  }
};


/*
  Process input.
 */

JSON.Command.prototype.processInput = function() {
  var handleEPIPE;
  if (this.files) {

  } else {
    this.stdin = process.openStdin();
    this.stdin.setEncoding('utf8');
    this.stdin.jsonC = this;
    this.stdin.on('data', function(chunk) {
      var ex, objects;
      try {
        this.jsonC.processChunk(chunk);
        objects = this.jsonC.createObjects();
        this.jsonC.processObjects(objects);
      } catch (_error) {
        ex = _error;
        null;
      }
    });
    handleEPIPE = function(e) {
      if (e.code !== 'EPIPE') {
        process.emit('error', e);
      }
    };
    process.stdout.on('error', handleEPIPE);
    this.stdin.on('end', function() {
      var ex;
      try {
        this.jsonC.processObjects([this.jsonC.buffer, null]);
        process.stdout.removeListener('error', handleEPIPE);
      } catch (_error) {
        ex = _error;
        null;
      }
    });
  }
};


/*
  Process chunk.
 */

JSON.Command.prototype.processChunk = function(chunk) {
  var firstChunk;
  if (this.firstBuffer) {
    firstChunk = chunk.trim();
    if (firstChunk.match(/^\[/)) {
      chunk = firstChunk.replace(/^\[/, "");
      this.foundArray = true;
    } else {
      this.foundArray = false;
    }
    this.firstBuffer = false;
  }
  this.buffer += chunk.replace(/\r/g, "").replace(/\n/g, "");
  if (this.inputIsArray) {
    return;
  }
};


/*
  Parse objects.
 */

JSON.Command.prototype.parseObjects = function() {
  var ex, foundEnd, i, l, objects, res;
  objects = null;
  res = null;
  foundEnd = false;
  try {
    res = JSON.parse(this.buffer);
  } catch (_error) {
    ex = _error;
  }
  if (res || this.buffer.match(/\n/g) || this.buffer.match(/\r\n/g) || this.buffer.match(/\0$/) || this.buffer.match('}{') || this.buffer.match(/\}\s*\,\s*\{/)) {
    if (this.buffer.match(/\0$/)) {
      foundEnd = true;
      if (this.foundArray) {
        this.buffer = this.buffer.replace(/\]\0$/, "");
      } else {
        this.buffer = this.buffer.replace(/\0$/, "");
      }
    }
    if (this.buffer.match(/\n/g)) {
      objects = this.buffer.split("\n");
    }
    if (this.buffer.match(/\r\n/g)) {
      objects = this.buffer.split("\r\n");
    }
    if (this.buffer.match("}{")) {
      objects = this.buffer.split("}{").join("}\n{").split("\n");
    }
    if (this.buffer.match(/\}\s*\,\s*\{/)) {
      objects = this.buffer.split(/\}\s*\,\s*\{/).join("}\n{").split("\n");
    }
    if (res && (!objects || (objects.length === 0))) {
      if (Array.isArray(res)) {
        objects = JSON.stringify(res);
      } else {
        objects = [JSON.stringify(res)];
      }
    }
    if (!foundEnd) {
      this.buffer = objects.pop();
    }
    if (this.headerPassthrough) {
      i = 0;
      l = objects.length;
      while (i < l) {
        process.stdout.write(objects[i] + "\r\n");
        if (objects[i] === '') {
          this.headerPassthrough = false;
          break;
        }
        i++;
      }
      objects.splice(0, i);
    }
  }
  return objects;
};

//# sourceMappingURL=json-command.js.map
