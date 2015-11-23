assert = require("assert")
should = require("should")
jsonCommand = require('../lib/json-command')

testObj =
  id: 19375093
  text: 'who knows'
  user:
    id: 1310571
    name: 'foo'
  arr1: [
    'a'
    'b'
    'c'
  ]
  obj1: arr2: [
    'd'
    'e'
    'f'
  ]
  created_at: 127817599
  zero: 0

testObjects = [
  id: 19375093
  text: 'strA'
,
  id: 19375094
  text: 'strB'
]


describe "test processArgs:", ->

  jsonC = new (JSON.Command)
  conditions = [
    '(name == \'foo\')'
    '(text == \'boo\')'
  ]
  jsonC.processArgs [
    '-c'
    conditions[0]
    '-c'
    conditions[1]
  ]
  it "conditionals should contain specified conditional [0]", ->
    jsonC.conditionals[0].should.equal(conditions[0])
  it "conditionals contains specified conditional [1]", ->
    jsonC.conditionals[1].should.equal(conditions[1])

  return


describe "test add createRequestedKeys:", ->

  jsonC = new (JSON.Command)
  jsonC.processArgs [ 'newKey' ]
  jsonC.createRequestedKeys testObj
  it "createRequestedKeys should add requested key to object", ->
    should.not.exist(testObj.newKey)


describe "test access existing createRequestedKeys:", ->

  jsonC = new (JSON.Command)
  jsonC.processArgs [ 'zero' ]
  jsonC.createRequestedKeys testObj
  it "createRequestedKeys should not add null for 0 to object", ->
    testObj.zero.should.equal(0)

  delete testObj.newKey


describe "test fail checkConditionals:", ->

  jsonC = new (JSON.Command)
  jsonC.processArgs [
    '-c'
    '(name == \'foo\')'
  ]
  it "checkConditionals (name==\'foo\') should be false", ->
    jsonC.checkConditionals(testObj).should.equal(false)


describe "test success checkConditionals:", ->

  jsonC = new (JSON.Command)
  jsonC.processArgs [
    '-c'
    '(user.name == \'foo\')'
  ]
  it "checkConditionals (user.name==\'foo\') should be true", ->
    jsonC.checkConditionals(testObj).should.equal(true)
  return


describe "test processKeyTransforms:", ->
  tmpTestObj =
    id: 19375093
    text: 'who knows'
    created_at: 127817599
    user:
      id: 1310571
      name: 'foo'
  jsonC = new (JSON.Command)
  jsonC.processArgs [
    'user.new_name=user.name'
    '-d'
  ]
  jsonC.createRequestedKeys tmpTestObj
  jsonC.processKeyTransforms tmpTestObj
  it "processKeyTransforms user.new_name should equal user.name", ->
    tmpTestObj.user.new_name.should.equal(testObj.user.name)


describe "test processExecutables:", ->
  tmpTestObj =
    id: 19375093
    text: 'who knows'
    created_at: 127817599
    user:
      id: 1310571
      name: 'foo'
  jsonC = new (JSON.Command)
  jsonC.processArgs [
    '-e'
    'user.name = \'boo\';'
  ]
  jsonC.processExecutables tmpTestObj
  it "processExecutables user.name should equal 'boo'", ->
    tmpTestObj.user.name.should.equal("boo")


describe "test processKeys:", ->
  jsonC = new (JSON.Command)
  jsonC.processArgs [
    'user.name'
    'text'
    'arr1[1]'
    'obj1.arr2[2]'
  ]
  it "processedKeys keys length should equal 4", ->
    jsonC.keys.length.should.equal(4)

  resObj = jsonC.processKeys(testObj)

  it "processKeys object user.name should equal testObj.user.name", ->
    resObj.user.name.should.equal(testObj.user.name)

  it "processKeys object user.name should equal testObj.text", ->
    resObj.text.should.equal(testObj.text)

  it "processKeys object id should be undefined", ->
    should(resObj.id).be.undefined

  it "processKeys object created_at should be undefined", ->
    should(resObj.created_at).be.undefined

  it "processKeys object user.id should be undefined", ->
    should(resObj.user.id).be.undefined

  it "processKeys object arr1[0] sohuld equal testObj.arr1[0]", ->
    resObj.arr1[0].should.equal(testObj.arr1[1])

  it "processKeys object obj1.arr2[0] should equal testObj.obj1.arr2[2]", ->
    resObj.obj1.arr2[0].should.equal(testObj.obj1.arr2[2])


describe "test leadingComma", ->
  jsonC = new (JSON.Command)
  jsonC.processArgs [ '-,' ]

  it "leading-comma output selection formats test object correctly", ->
    jsonC.stringify(testObj).should.equal(jsonC.diffFriendly(testObj))

  it "leading-comma output nests arrays correctly", ->
    jsonC.stringify([ [] ]).should.equal('[ []\n]')

  it "leading-comma output nests deep object/array combinations correctly", ->
    obj = {"":[{"deep":{"null":null}}]}
    jsonC.stringify(obj).should.equal(jsonC.diffFriendly(obj))


describe "test JSON formats:", ->
  describe "test back to back objects:", ->
    jsonC = new (JSON.Command)
    jsonC.processArgs [ '-,' ]
    testInput = ''

    i = 0
    while i < testObjects.length
      testInput += JSON.stringify(testObjects[i])
      i++
    testInput += "\0"

    jsonC.processChunk testInput

    rawObjects = jsonC.createObjects()
    rawObjects = rawObjects.concat(jsonC.createObjects())
    preparedObjects = jsonC.prepareFinalObjects(rawObjects)

    it "testObjects should be produced", ->
      rawObjects[0].should.equal(JSON.stringify(testObjects[0]))
      rawObjects[1].should.equal(JSON.stringify(testObjects[1]))

  describe "test new lines between objects:", ->
    jsonC = new (JSON.Command)
    jsonC.processArgs [ '-,' ]
    testInput = ''

    i = 0
    while i < testObjects.length
      testInput += JSON.stringify(testObjects[i], null, 0) + '\n'
      i++
    testInput += "\0"

    jsonC.processChunk testInput

    rawObjects = jsonC.createObjects()
    rawObjects = rawObjects.concat(jsonC.createObjects())
    console.log "rawObjects: #{JSON.stringify(rawObjects)}"
    preparedObjects = jsonC.prepareFinalObjects(rawObjects)

    it "testObjects should be produced", ->
      rawObjects[0].should.equal(JSON.stringify(testObjects[0]))
      rawObjects[1].should.equal(JSON.stringify(testObjects[1]))

  describe "test array input object:", ->
    jsonC = new (JSON.Command)
    jsonC.processArgs [
      '-a'
    ]

    testInput = JSON.stringify(testObjects, null, 2)
    testInput += "\0"

    jsonC.processChunk testInput

    rawObjects = jsonC.createObjects()
    rawObjects = rawObjects.concat(jsonC.createObjects())

    console.log "raw objects: #{JSON.stringify(rawObjects, null, 2)}"
    preparedObjects = jsonC.prepareFinalObjects(rawObjects)
    console.log "prepd objects: #{JSON.stringify(preparedObjects, null, 2)}"

    it "testObjects should be produced", ->
      JSON.stringify(JSON.parse(rawObjects[0])).
        should.equal(JSON.stringify(testObjects[0]))
      JSON.stringify(JSON.parse(rawObjects[1])).
        should.equal(JSON.stringify(testObjects[1]))

