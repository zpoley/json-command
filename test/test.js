var assert = require("assert"),
    jsonCommand = require("../lib/jsonCommand");

var testObj = {
  id : 19375093,
  text : "who knows",
  user : {
    id : 1310571,
    name : "foo"
  },
  arr1 : [
    'a', 'b', 'c'
  ],
  obj1 : {
    arr2 : [ 
      'd', 'e', 'f'
    ]
  },
  created_at : 127817599,
  zero : 0
};

function printTestName(testName) {
  console.log("\nRunning " + testName + ":");
  console.log("-----------------------------------------");
}

(function testSimpleSetup() {

  (function testProcessArgs() {
    printTestName("testProcessArgs");

    var jsonC = new JSON.Command();
    var conditions = [ "(name == 'foo')", "(text == 'boo')" ];
    jsonC.processArgs([ "-c", conditions[0], "-c", conditions[1] ]);
    assert.equal(jsonC.conditionals[0], conditions[0],
      "conditionals contains specified conditional [0]");
    assert.equal(jsonC.conditionals[1], conditions[1],
      "conditionals contains specified conditional [1]");

  })();

  (function testCreateRequestedKeys() {
    printTestName("testCreateRequestedKeys");

    var jsonC = new JSON.Command();
    jsonC.processArgs([ "newKey" ]);
    jsonC.createRequestedKeys(testObj);

    assert.equal(testObj.newKey, null,
      "createRequestedKeys adds requested key to object");

    jsonC = new JSON.Command();
    jsonC.processArgs([ "zero" ]);
    jsonC.createRequestedKeys(testObj);

    assert.equal(testObj.zero, 0,
      "createRequestedKeys does not add null for 0 to object");
  })();

  (function testCheckConditionals() {
    printTestName("testCheckConditionals");

    var jsonC = new JSON.Command();
    jsonC.processArgs([ "-c", "(name == 'foo')"]);

    assert.equal(jsonC.checkConditionals(testObj), false,
      "checkConditionals (name=='foo') is false");

    var jsonC = new JSON.Command();
    jsonC.processArgs([ "-c", "(user.name == 'foo')"]);

    assert.equal(jsonC.checkConditionals(testObj), true,
      "checkConditionals (user.name=='foo') is true");
  })();

  (function testProcessKeyTransforms() {
    printTestName("testProcessKeyTransforms");

    var tmpTestObj = {
      id : 19375093, text : "who knows", created_at : 127817599,
      user : {
        id : 1310571, name : "foo"
      }
    };

    var jsonC = new JSON.Command();
    jsonC.processArgs([ "user.new_name=user.name", "-d"]);
    jsonC.createRequestedKeys(tmpTestObj);
    jsonC.processKeyTransforms(tmpTestObj);

    assert.equal(tmpTestObj.user.new_name, testObj.user.name,
      "processKeyTransforms user.new_name = user.name is true");

  })();

  (function testProcessExecutables() {
    printTestName("testProcessExecutables");

    var tmpTestObj = {
      id : 19375093, text : "who knows", created_at : 127817599,
      user : {
        id : 1310571, name : "foo"
      }
    };

    var jsonC = new JSON.Command();
    jsonC.processArgs([ "-e", "user.name = 'boo';"]);
    jsonC.processExecutables(tmpTestObj);

    assert.equal(tmpTestObj.user.name, "boo",
      "processExecutables user.name = 'boo' is true");
  })();

  (function testProcessKeys() {
    printTestName("testProcessKeys");

    var jsonC = new JSON.Command();
    jsonC.processArgs([ "user.name", "text", "arr1[1]", "obj1.arr2[2]" ]);
    assert.equal(jsonC.keys.length, 4,
      "processedKeys keys length == 4");

    var resObj = jsonC.processKeys(testObj);

    assert.equal(resObj.user.name, testObj.user.name,
      "processKeys result object user.name = testObj.user.name is true");
    assert.equal(resObj.text, testObj.text,
      "processKeys result object user.name = testObj.text is true");
    assert.equal(resObj.id, undefined,
      "processKeys result object id is undefined is true");
    assert.equal(resObj.created_at, undefined,
      "processKeys result object created_at is undefined is true");
    assert.equal(resObj.user.id, undefined,
      "processKeys result object user.id is undefined is true");
    assert.equal(resObj.arr1[0], testObj.arr1[1],
      "processKeys result object arr1[0] = testObj.arr1[0] is true");
    assert.equal(resObj.obj1.arr2[0], testObj.obj1.arr2[2],
      "processKeys result object obj1.arr2[0] = testObj.obj1.arr2[2] is true");

  })();

})();

console.log("\nAll tests passed!\n");
