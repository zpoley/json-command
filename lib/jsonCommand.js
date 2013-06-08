var util = require("util"),
    vm = require("vm");

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

  this.stdin = null;
  this.buffer = "";

  if (args) { this.processArgs(args); }
};

JSON.Command.prototype.printhelp = function() {
  console.log("usage: stdout_generator | json [options] [fields]");
  console.log("");
  console.log("json processes standard input and parses json objects. json currently handles a");
  console.log("few different standard input formats and provides a number of options tailored");
  console.log("toward inspecting and transforming the parsed json objects.");
  console.log("");
  console.log("options:\n");
  console.log("  -h                    print this help info and exit\n");
  console.log("  -v (-V | --version)   print version number and exit\n");
  console.log("  -u                    print ugly json output, each object on a single line\n");
  console.log("  -,                    print leading-comma diff-friendly output, one line per property\n");
  console.log("  -d                    print debugging output including exception messages\n");
  console.log("  -o object.path        specify the path to an array to be iterated on\n");
  console.log("  new.key=old_key       move old_key to new.key in output object\n");
  console.log("  -a                    input object is an array, process each element separately\n");
  console.log("  -c \"js conditional\"   js conditional to be run in the context of each object");
  console.log("                         that determines whether an object is printed\n");
  console.log("  -C                    print the output fields as tab delimited columns in");
  console.log("                         the order specified by fields\n");
  console.log("  -e \"js expression\"    execute arbitrary js in the context of each object.\n");
  console.log("  -i                    use node's util.inspect instead of JSON.stringify\n");
  console.log("  -H                    print headers, if they are supplied.");
  console.log("                        Useful for output from curl -i.\n");

  console.log("examples:\n");
  console.log("  curl http://search.twitter.com/search.json?q=node.js 2> /dev/null |");
  console.log("   json -o results\n");
  console.log("  curl http://search.twitter.com/search.json?q=node.js 2> /dev/null |");
  console.log("   json -o results new_id=id\n");
  console.log("  curl http://search.twitter.com/search.json?q=node.js 2> /dev/null |");
  console.log("   json -o results -C from_user from_user_id text\n");
  console.log("more help:\n");
  console.log("  use \"man json\" or visit http://github.com/zpoley/json-command\n");
  process.exit();
};

JSON.Command.prototype.printversion = function() {
  var npm = require("npm");
  npm.load([], function(er) {
    console.log("json command line toolkit\n version: ");
    npm.commands.view([ "json", "version" ], function(er, data) {
      process.exit();
    });
  });
};


JSON.Command.prototype.stringify = function(obj) {
  return( this.inspectOutput ? util.inspect(obj, false, Infinity, true)
        : this.leadingComma ? this.diffFriendly(obj)
        : this.uglyOutput ? JSON.stringify(obj)
        : JSON.stringify(obj, null, 2) );
};

JSON.Command.prototype.diffFriendly = function(obj) {
  return JSON.stringify(obj, null, 2)
    .replace(/ ?([[{,])\n ( *)(?: )/gm, '\n$2$1 ') // trailing->leading ,-{-[s
    .replace(/(^|[[{,] ?)\n */gm, '$1'); // cuddle brackets/braces/array items
};

JSON.Command.prototype.debug = function(msg) {
  if (this.debugOn) { console.log(msg); }
};

JSON.Command.prototype.printex = function(ex) {
  this.debug("ex: " + JSON.stringify(ex, null, 2));
};

/*
  Process Command line arguments to JSON Command
*/

JSON.Command.prototype.processArgs = function processArgs(args) {

  // copy argv to chop it up
  var a = args.slice(0);
  // turn -iH into -i -H
  // nb: don't cache length.  it may change.
  for (var i = 0; i < a.length; i ++) {
    if (a[i].charAt(0) === "-" && a[i].length > 2) {
      var arg = a[i].replace(/^-+/, "").split("").map(function (a) {
        return "-" + a;
      });
      a.splice.apply(a, [i, 1].concat(arg));
    }
  }

  while (a.length > 0) {
    var arg = a.shift();
    switch(arg) {
      case "-h": // display help and exit
        this.printhelp();
        break;
      case "-v": // display version and exit
      case "-V":
      case "--version":
        this.printversion();
        break;
      case "-f": // file
        this.fileNames.push(a.shift());
        break;
      case "-d": // debug
        this.debugOn = true;
        break;
      case "-u": // pretty printing (turn off)
        this.uglyOutput = true;
        break;
      case "-,": // diff-friendlier output
        this.leadingComma = true;
        break;
      case "-c": // conditional
        this.conditionals.push(a.shift());
        break;
      case "-C": // column output
        this.columnOutput = true;
        break;
      case "-e": // executable (transform data)
        this.executables.push(a.shift());
        break;
      case "-o": // use object
        this.useObject = a.shift();
        break;
      case "-a": // array
        this.inputIsArray = true;
        break;
      case "-i": // use util.inspect
        this.inspectOutput = true;
        break;
      case "-H": // header passthrough
        this.headerPassthrough = true;
        break;
      default: // json object keys
        if (arg.match("=")) {
          var kk = arg.split("=");
          this.keys.push(kk[0]);
          this.transformedKeys.push({ 
            newKey : kk[0],
            oldKey : kk[1]
          });
        }
        else {
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
  // instantiate any requested keys
  for(var j = 0; (j < this.keys.length); j++) {
    if (typeof(parsedObject[this.keys[j]]) === 'undefined') {
      parsedObject[this.keys[j]] = null;
    }
  }
};

/*
  Check conditionals against object.
*/

JSON.Command.prototype.checkConditionals = function(parsedObject) {
  if (this.conditionals.length) {
    try {
      var conditionsFailed = false;
      for(var i = 0; (i < this.conditionals.length); i++) {
        if (!vm.runInNewContext(this.conditionals[i], parsedObject)) { 
          conditionsFailed = true; 
        }
      }
      // if any conditions failed return false
      if (conditionsFailed) { return false; }
    }
    catch(ex) {
      // if any conditional fails, return false,
      //  the conditional may access something not present, etc..
      this.printex(ex);
      return false;
    }
  }
  // all conditionals passed
  return true;
};

/*
  Process key transforms against object.
*/

JSON.Command.prototype.processKeyTransforms = function(parsedObject) {
  if (this.transformedKeys.length) {
    for(var i = 0; (i < this.transformedKeys.length); i++) {
      try { 
        vm.runInNewContext(this.transformedKeys[i].newKey +
          " = " + this.transformedKeys[i].oldKey, parsedObject);
      }
      catch (ex) {
        this.printex(ex);
      }
    }
  }
};

/*
  Process executables against object.
*/

JSON.Command.prototype.processExecutables = function(parsedObject) {
  if (this.executables.length) {
    for(var i = 0; (i < this.executables.length); i++) {
      try { 
        vm.runInNewContext(this.executables[i], parsedObject);
      }
      catch (ex) {
        // stop catstrophic failure if any executable fails.
        //  TODO: this may not be the desired behavior.
        this.printex(ex);
      }
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
  if (this.keys.length) {
    var hsh = {}, cols = [], evalStr = null, instStr = null, simpleKey = null;
    function instantiateArrayAndPush(key) {
      simpleKey = key.split("[").shift();
      // instantiate array in new object if not exists
      instStr = "if (!hsh." + simpleKey + ") { hsh." + simpleKey + " = []; }";
      eval(instStr);
      // push new value into array (command line order matters)
      evalStr = "hsh." + simpleKey + ".push(" + "parsedObject." + key + ")";
      eval(evalStr);
      cols.push(eval("parsedObject." + key));
    }
    for (var i = 0; (i < this.keys.length); i++) {
      try { 
        if ((this.keys[i].indexOf(".") > -1) || (this.keys[i].indexOf("[") > -1)) {
          // create any keys that don't exist in the object chain
          if (this.keys[i].indexOf(".") > -1) {
            var s = this.keys[i].split(".");
            for (var j = 1; (j < s.length); j++) {
              // create necessary keys
              evalStr = "hsh." + s.slice(0,j).join(".");
              if (!eval(evalStr)) {
                eval("hsh." + s.slice(0,j).join(".") + " = {};");
              }
            }
            if (this.keys[i].indexOf("[") > -1) {
              instantiateArrayAndPush(this.keys[i]);
            }
            else {
              evalStr = "hsh." + s.join(".") + " = " + "parsedObject." + s.join(".");
              eval(evalStr);
              cols.push(eval("parsedObject." + s.join(".")));
            }
          }
          else if (this.keys[i].indexOf("[") > -1) {
            instantiateArrayAndPush(this.keys[i]);
          }
        }
        else {
          // no expansion
          hsh[this.keys[i]] = parsedObject[this.keys[i]];
          cols.push(parsedObject[this.keys[i]]);
        }
      }
      catch(ex) {
        this.debug("Failed to read property " + this.keys[i] + " from object: " + JSON.stringify(parsedObject));
        ex.message = "Failed to read property";
        throw ex;
      }
    }
    return this.columnOutput ? cols : hsh;
  }
  else {
    return parsedObject;
  }
};

/*
  Process input objects.
*/

JSON.Command.prototype.processObjects = function(objects) {

  var rawObject = null, parsedObject = null;

  try {
    if (this.useObject && objects && objects.length > 0 && typeof(objects[0]) == 'string' && objects[0].trim().length > 0) {
      objects = vm.runInNewContext(this.useObject, JSON.parse(objects[0]));
    }
  }
  catch(ex) {
    this.printex(ex);
  }

  if (this.inputIsArray && objects && objects.length > 0 && typeof(objects[0]) == 'string') {
    var trimmed = objects[0].trim();
    if (trimmed.length > 0 && trimmed[0] == '[') {
      objects = JSON.parse(objects[0]);
    }
  }

  try {
    for (var i = 0; (i < (objects.length)); i++) {
      // if there's no object, there's nothing to do 
      //  (null object is not the same as string null)
      if ((objects[i] == null) || (objects[i] == undefined)) { continue; }

      try {
        if (typeof(objects[i]) == "string") {
          rawObject = objects[i];
          if (rawObject.trim().length == 0) continue;
          parsedObject = JSON.parse(rawObject);
        }
        else {
          rawObject = JSON.stringify(objects[i]);
          parsedObject = objects[i];
        }
      } catch(ex) {
        // discard bad records
        this.printex(ex); 
        continue;
      }

      // create any requested keys that are missing
      this.createRequestedKeys(parsedObject);

      // process key transformations  on this parsedObject
      this.processKeyTransforms(parsedObject);

      // process executables on this parsedObject
      this.processExecutables(parsedObject);

      // continue if any conditionals fail on this parsedObject
      if (!this.checkConditionals(parsedObject)) {
        continue; 
      }

      try {
        // process requested keys on the parsed object
        outputObject = this.processKeys(parsedObject);
      }
      catch(ex) { continue; }

      // finally, print output
      if (this.columnOutput) {
        process.stdout.write(outputObject.join("\t") + "\n");
      }
      else {
        process.stdout.write(this.stringify(outputObject) + "\n");
      }
    }
  }
  catch(ex) {
    this.printex(ex);
  }
};

/*
  Process input.
*/

JSON.Command.prototype.processInput = function() {
  if (this.files) {
    // TODO: implement file support?
  }
  else {
    this.stdin = process.openStdin();
    this.stdin.setEncoding("utf8");
    this.stdin.jsonC = this; // context for closure

    this.stdin.on("data", function(chunk) {
      this.jsonC.buffer += chunk;
      if (this.jsonC.inputIsArray) return;

      var objects = null;
      if (this.jsonC.buffer.match(/\n/g) || 
          this.jsonC.buffer.match(/\r\n/g) || 
          this.jsonC.buffer.match(/\0/g) || 
          this.jsonC.buffer.match("}{")) {
        if (this.jsonC.buffer.match(/\n/g)) {
          objects = this.jsonC.buffer.split("\n");
        }
        if (this.jsonC.buffer.match(/\r\n/g)) {
          objects = this.jsonC.buffer.split("\r\n");
        }
        if (this.jsonC.buffer.match(/\0/g)) {
          objects = this.jsonC.buffer.split("\0");
        }
        if (this.jsonC.buffer.match("}{")) {
          objects = this.jsonC.buffer.split("}{").join("}\n{").split("\n");
        }

        this.jsonC.buffer = objects.pop();

        if (this.jsonC.headerPassthrough) {
          for (var i = 0, l = objects.length; i < l; i ++) {
            process.stdout.write(objects[i]+"\r\n");
            if (objects[i] === "") {
              this.jsonC.headerPassthrough = false;
              break;
            }
          }
          objects.splice(0, i);
        }

        if (objects.length) this.jsonC.processObjects(objects);
      }
    });

    var handleEPIPE = function(e) {
      if (e.code !== "EPIPE") {
        process.emit("error", e);
      }
    };
    process.stdout.on("error", handleEPIPE);

    this.stdin.on("end", function() {
      this.jsonC.processObjects([this.jsonC.buffer, null]);
      process.stdout.removeListener("error", handleEPIPE);
    });
  }
};
