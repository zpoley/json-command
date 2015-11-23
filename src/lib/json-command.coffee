util = require('util')
vm = require('vm')

###
 JSON Command class
###

JSON.Command = (args) ->
  @args = null
  @debugOn = false
  @fileNames = []
  @files = null
  @keys = []
  @transformedKeys = []
  @uglyOutput = false
  @leadingComma = false
  @inspectOutput = false
  @headerPassthrough = false
  @columnOutput = false
  @useObject = null
  @inputIsArray = false
  @conditionals = []
  @executables = []
  @stdin = null
  @buffer = ''
  if args
    @processArgs args
  return

JSON.Command::printhelp = ->
  console.log 'usage: stdout_generator | json [options] [fields]'
  console.log ''
  console.log 'json processes standard input and parses json objects.'
  console.log 'json currently handles a few different standard input formats'
  console.log 'and provides a number of options tailored toward inspecting and'
  console.log 'transforming the parsed json objects.'
  console.log ''
  console.log 'options:\n'
  console.log '  -h                    print this help info and exit\n'
  console.log '  -v (-V | --version)   print version number and exit\n'
  console.log '  -u                    print ugly json output, each object on a'
  console.log '                        single line\n'
  console.log '  -,                    print leading-comma diff-friendly output'
  console.log '                        with one line per property\n'
  console.log '  -d                    print debugging output including'
  console.log '                        exception messages\n'
  console.log '  -o object.path        specify the path to an array to be'
  console.log '                        iterated on\n'
  console.log '  new.key=old_key       move old_key to new.key in output\n'
  console.log '  -a                    input object is an array,'
  console.log '                        process each element separately\n'
  console.log '  -c "js conditional"   js conditional to be run in the context'
  console.log '                        of each object that determines whether'
  console.log '                        an object is printed\n'
  console.log '  -C                    print the output fields as tab delimited'
  console.log '                        columns in order provided\n'
  console.log '  -e "js expression"    execute arbitrary js in the context of'
  console.log '                        each object.\n'
  console.log '  -i                    use node\'s util.inspect instead of'
  console.log '                        JSON.stringify\n'
  console.log '  -H                    print headers, if they are supplied.'
  console.log '                        Useful for output from curl -i.\n'
  console.log 'examples:\n'
  console.log '  curl https://api.github.com/meta 2> /dev/null'
  console.log '   | json importer\n'
  console.log '  curl http://api.github.com/meta 2> /dev/null'
  console.log '   | json new_importer=importer\n'
  console.log '  curl http://api.github.com/meta 2> /dev/null'
  console.log '   | json -o results -C from_user from_user_id text\n'
  console.log 'more help:\n'
  console.log '  use "man json" or visit http://github.com/zpoley/json-command'
  console.log ''
  process.exit()
  return

JSON.Command::printversion = ->
  npm = require('npm')
  npm.load [], (er) ->
    console.log 'json command line toolkit\n version: '
    npm.commands.view [
      'json'
      'version'
    ], (er, data) ->
      process.exit()
      return
    return
  return

JSON.Command::stringify = (obj) ->
  result = null
  if @inspectOutput
    result = util.inspect(obj, false, Infinity, true)
  else if @leadingComma
    result = @diffFriendly(obj)
  else if @uglyOutput
    result = JSON.stringify(obj)
  else
    result = JSON.stringify(obj, null, 2)
  result

JSON.Command::diffFriendly = (obj) ->
  regex = RegExp(' ?([[{,])\\n ( *)(?: )', 'gm')
  JSON.stringify(obj, null, 2).replace(regex, '\n$2$1 ').
    replace /(^|[[{,] ?)\n */gm, '$1'
  # cuddle brackets/braces/array items

JSON.Command::debug = (msg) ->
  if @debugOn
    console.log msg
  return

JSON.Command::printex = (ex) ->
  @debug 'ex: ' + JSON.stringify(ex, null, 2)
  return

###
  Process Command line arguments to JSON Command
###

JSON.Command::processArgs = (args) ->
  # copy argv to chop it up
  a = args.slice(0)
  # turn -iH into -i -H
  # nb: don't cache length.  it may change.
  i = 0
  while i < a.length
    if a[i].charAt(0) == '-' and a[i].length > 2
      arg = a[i].replace(/^-+/, '').split('').map((a) ->
        "-" + a
      )
      a.splice.apply a, [
        i
        1
      ].concat(arg)
    i++
  while a.length > 0
    arg = a.shift()
    switch arg
      when '-h'
        # display help and exit
        @printhelp()
      # display version and exit
      when '-v', '-V', '--version'
        @printversion()
      when '-f'
        # file
        @fileNames.push a.shift()
      when '-d'
        # debug
        @debugOn = true
      when '-u'
        # pretty printing (turn off)
        @uglyOutput = true
      when '-,'
        # diff-friendlier output
        @leadingComma = true
      when '-c'
        # conditional
        @conditionals.push a.shift()
      when '-C'
        # column output
        @columnOutput = true
      when '-e'
        # executable (transform data)
        @executables.push a.shift()
      when '-o'
        # use object
        @useObject = a.shift()
      when '-a'
        # array
        @inputIsArray = true
      when '-i'
        # use util.inspect
        @inspectOutput = true
      when '-H'
        # header passthrough
        @headerPassthrough = true
      else
        # json object keys
        if arg.match('=')
          kk = arg.split('=')
          @keys.push kk[0]
          @transformedKeys.push
            newKey: kk[0]
            oldKey: kk[1]
        else
          @keys.push arg
        break
  return

###
  Create any reuested keys that don't already exist. Init values with null.
   The default value could be an option.
###

JSON.Command::createRequestedKeys = (parsedObject) ->
  # instantiate any requested keys
  j = 0
  while j < @keys.length
    if typeof parsedObject[@keys[j]] == 'undefined'
      parsedObject[@keys[j]] = null
    j++
  return

###
  Check conditionals against object.
###

JSON.Command::checkConditionals = (parsedObject) ->
  if @conditionals.length
    try
      conditionsFailed = false
      i = 0
      while i < @conditionals.length
        if !vm.runInNewContext(@conditionals[i], parsedObject)
          conditionsFailed = true
        i++
      # if any conditions failed return false
      if conditionsFailed
        return false
    catch ex
      # if any conditional fails, return false,
      #  the conditional may access something not present, etc..
      @printex ex
      return false
  # all conditionals passed
  true

###
  Process key transforms against object.
###

JSON.Command::processKeyTransforms = (parsedObject) ->
  if @transformedKeys.length
    i = 0
    while i < @transformedKeys.length
      try
        vm.runInNewContext @transformedKeys[i].newKey + ' = ' +
          @transformedKeys[i].oldKey, parsedObject
      catch ex
        @printex ex
      i++
  return

###
  Process executables against object.
###

JSON.Command::processExecutables = (parsedObject) ->
  if @executables.length
    i = 0
    while i < @executables.length
      try
        vm.runInNewContext @executables[i], parsedObject
      catch ex
        # stop catstrophic failure if any executable fails.
        #  TODO: this may not be the desired behavior.
        @printex ex
      i++
  return

###
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

###

JSON.Command::processKeys = (parsedObject) ->

  instantiateArrayAndPush = (key) ->
    simpleKey = key.split('[').shift()
    # instantiate array in new object if not exists
    instStr = 'if (!hsh.' + simpleKey + ') { hsh.' + simpleKey + ' = []; }'
    eval instStr
    # push new value into array (command line order matters)
    evalStr = 'hsh.' + simpleKey + '.push(' + 'parsedObject.' + key + ')'
    eval evalStr
    cols.push eval('parsedObject.' + key)
    return

  if @keys.length
    hsh = {}
    cols = []
    evalStr = null
    instStr = null
    simpleKey = null
    i = 0
    while i < @keys.length
      try
        if @keys[i].indexOf('.') > -1 or @keys[i].indexOf('[') > -1
          # create any keys that don't exist in the object chain
          if @keys[i].indexOf('.') > -1
            s = @keys[i].split('.')
            j = 1
            while j < s.length
              # create necessary keys
              evalStr = 'hsh.' + s.slice(0, j).join('.')
              if !eval(evalStr)
                eval 'hsh.' + s.slice(0, j).join('.') + ' = {};'
              j++
            if @keys[i].indexOf('[') > -1
              instantiateArrayAndPush @keys[i]
            else
              evalStr = 'hsh.' + s.join('.') + ' = ' +
                'parsedObject.' + s.join('.')
              eval evalStr
              cols.push eval('parsedObject.' + s.join('.'))
          else if @keys[i].indexOf('[') > -1
            instantiateArrayAndPush @keys[i]
        else
          # no expansion
          hsh[@keys[i]] = parsedObject[@keys[i]]
          cols.push parsedObject[@keys[i]]
      catch ex
        @debug 'Failed to read property ' + @keys[i] +
          ' from object: ' + JSON.stringify(parsedObject)
        ex.message = 'Failed to read property'
        throw ex
      i++
    if @columnOutput then cols else hsh
  else
    parsedObject

###
  Create objects.
###

JSON.Command::createObjects = ->

  objects = @parseObjects()

  try
    if (@useObject and objects and (objects.length > 0) and
    (typeof objects[0] == 'string') and (objects[0].trim().length > 0))
      newObjects = []
      i = 0
      while i < objects.length
        newObjects.push vm.runInNewContext(@useObject, JSON.parse(objects[i]))
        i++
      objects = newObjects
  catch ex
    @printex ex

  if (@inputIsArray and objects and (objects.length > 0) and
  (typeof objects[0] == 'string'))
    trimmed = objects[0].trim()
    if trimmed.length > 0 and trimmed[0] == '['
      objects = JSON.parse(objects[0])

  objects

###
  Prepare final objects.
###

JSON.Command::prepareFinalObjects = (objects) ->
  rawObject = null
  parsedObject = null
  preparedObjects = []
  try
    i = 0
    while i < objects.length
      # if there's no object, there's nothing to do
      #  (null object is not the same as string null)
      if objects[i] == null or objects[i] == undefined
        i++
        continue
      try
        if typeof objects[i] == 'string'
          rawObject = objects[i]
          if rawObject.trim().length == 0
            i++
            continue
          parsedObject = JSON.parse(rawObject)
        else
          rawObject = JSON.stringify(objects[i])
          parsedObject = objects[i]
        preparedObjects.push parsedObject
      catch ex
        # discard bad records
        @printex ex
        i++
        continue
      i++
  catch ex
  # no-op
  preparedObjects

###
  Process input objects.
###

JSON.Command::processObjects = (objects) ->
  preparedObjects = @prepareFinalObjects(objects)
  try
    i = 0
    while i < preparedObjects.length
      po = preparedObjects[i]

      # create any requested keys that are missing
      @createRequestedKeys po
      # process key transformations  on this preparedObject
      @processKeyTransforms po
      # process executables on this preparedObject
      @processExecutables po
      # continue if any conditionals fail on this preparedObject
      if !@checkConditionals(po)
        i++
        continue
      try
        # process requested keys on the parsed object
        outputObject = @processKeys(po)
      catch ex
        i++
        continue
      # finally, print output
      if @columnOutput
        process.stdout.write outputObject.join("\t") + '\n'
      else
        process.stdout.write @stringify(outputObject) + '\n'
      i++
  catch ex
    @printex ex
  return

###
  Process input.
###

JSON.Command::processInput = ->
  if @files
    # TODO: implement file support?
  else
    @stdin = process.openStdin()
    @stdin.setEncoding 'utf8'
    @stdin.jsonC = this

    # context for closure
    @stdin.on 'data', (chunk) ->
      try
        @jsonC.processChunk chunk
        objects = @jsonC.createObjects()
        @jsonC.processObjects objects
      catch ex
        null # no-op
      return

    handleEPIPE = (e) ->
      if e.code != 'EPIPE'
        process.emit 'error', e
      return

    process.stdout.on 'error', handleEPIPE
    @stdin.on 'end', ->
      try
        @jsonC.processObjects [
          @jsonC.buffer
          null
        ]
        process.stdout.removeListener 'error', handleEPIPE
      catch ex
        null # no-op
      return
  return

###
  Process chunk.
###

JSON.Command::processChunk = (chunk) ->
  @buffer += chunk.replace(/\r/g, "").replace(/\n/g, "")
  if @inputIsArray
    return
  return

###
  Parse objects.
###

JSON.Command::parseObjects = ->

  objects = null

  if (@buffer.match(/\n/g) or @buffer.match(/\r\n/g) or
  @buffer.match(/\0/g) or @buffer.match('}{'))

    if @buffer.match(/\n/g)
      objects = @buffer.split("\n")

    if @buffer.match(/\r\n/g)
      objects = @buffer.split("\r\n")

    if @buffer.match(/\0/g)
      objects = @buffer.split("\0")

    if @buffer.match("}{")
      objects = @buffer.split("}{").join("}\n{").split("\n")

    @buffer = objects.pop()

    if @headerPassthrough
      i = 0
      l = objects.length
      while i < l
        process.stdout.write objects[i] + "\r\n"
        if objects[i] == ''
          @headerPassthrough = false
          break
        i++
      objects.splice 0, i
  if objects == null or !objects.length
    try
      if res = JSON.parse(@buffer)
        objects = [ JSON.stringify(res) ]
    catch ex
    # no-op
  objects
