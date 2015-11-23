var assert, jsonCommand, should, testObj, testObjects;

assert = require("assert");

should = require("should");

jsonCommand = require('../lib/json-command');

testObj = {
  id: 19375093,
  text: 'who knows',
  user: {
    id: 1310571,
    name: 'foo'
  },
  arr1: ['a', 'b', 'c'],
  obj1: {
    arr2: ['d', 'e', 'f']
  },
  created_at: 127817599,
  zero: 0
};

testObjects = [
  {
    id: 19375093,
    text: 'strA'
  }, {
    id: 19375094,
    text: 'strB'
  }
];

describe("test processArgs:", function() {
  var conditions, jsonC;
  jsonC = new JSON.Command;
  conditions = ['(name == \'foo\')', '(text == \'boo\')'];
  jsonC.processArgs(['-c', conditions[0], '-c', conditions[1]]);
  it("conditionals should contain specified conditional [0]", function() {
    return jsonC.conditionals[0].should.equal(conditions[0]);
  });
  it("conditionals contains specified conditional [1]", function() {
    return jsonC.conditionals[1].should.equal(conditions[1]);
  });
});

describe("test add createRequestedKeys:", function() {
  var jsonC;
  jsonC = new JSON.Command;
  jsonC.processArgs(['newKey']);
  jsonC.createRequestedKeys(testObj);
  return it("createRequestedKeys should add requested key to object", function() {
    return should.not.exist(testObj.newKey);
  });
});

describe("test access existing createRequestedKeys:", function() {
  var jsonC;
  jsonC = new JSON.Command;
  jsonC.processArgs(['zero']);
  jsonC.createRequestedKeys(testObj);
  it("createRequestedKeys should not add null for 0 to object", function() {
    return testObj.zero.should.equal(0);
  });
  return delete testObj.newKey;
});

describe("test fail checkConditionals:", function() {
  var jsonC;
  jsonC = new JSON.Command;
  jsonC.processArgs(['-c', '(name == \'foo\')']);
  return it("checkConditionals (name==\'foo\') should be false", function() {
    return jsonC.checkConditionals(testObj).should.equal(false);
  });
});

describe("test success checkConditionals:", function() {
  var jsonC;
  jsonC = new JSON.Command;
  jsonC.processArgs(['-c', '(user.name == \'foo\')']);
  it("checkConditionals (user.name==\'foo\') should be true", function() {
    return jsonC.checkConditionals(testObj).should.equal(true);
  });
});

describe("test processKeyTransforms:", function() {
  var jsonC, tmpTestObj;
  tmpTestObj = {
    id: 19375093,
    text: 'who knows',
    created_at: 127817599,
    user: {
      id: 1310571,
      name: 'foo'
    }
  };
  jsonC = new JSON.Command;
  jsonC.processArgs(['user.new_name=user.name', '-d']);
  jsonC.createRequestedKeys(tmpTestObj);
  jsonC.processKeyTransforms(tmpTestObj);
  return it("processKeyTransforms user.new_name should equal user.name", function() {
    return tmpTestObj.user.new_name.should.equal(testObj.user.name);
  });
});

describe("test processExecutables:", function() {
  var jsonC, tmpTestObj;
  tmpTestObj = {
    id: 19375093,
    text: 'who knows',
    created_at: 127817599,
    user: {
      id: 1310571,
      name: 'foo'
    }
  };
  jsonC = new JSON.Command;
  jsonC.processArgs(['-e', 'user.name = \'boo\';']);
  jsonC.processExecutables(tmpTestObj);
  return it("processExecutables user.name should equal 'boo'", function() {
    return tmpTestObj.user.name.should.equal("boo");
  });
});

describe("test processKeys:", function() {
  var jsonC, resObj;
  jsonC = new JSON.Command;
  jsonC.processArgs(['user.name', 'text', 'arr1[1]', 'obj1.arr2[2]']);
  it("processedKeys keys length should equal 4", function() {
    return jsonC.keys.length.should.equal(4);
  });
  resObj = jsonC.processKeys(testObj);
  it("processKeys object user.name should equal testObj.user.name", function() {
    return resObj.user.name.should.equal(testObj.user.name);
  });
  it("processKeys object user.name should equal testObj.text", function() {
    return resObj.text.should.equal(testObj.text);
  });
  it("processKeys object id should be undefined", function() {
    return should(resObj.id).be.undefined;
  });
  it("processKeys object created_at should be undefined", function() {
    return should(resObj.created_at).be.undefined;
  });
  it("processKeys object user.id should be undefined", function() {
    return should(resObj.user.id).be.undefined;
  });
  it("processKeys object arr1[0] sohuld equal testObj.arr1[0]", function() {
    return resObj.arr1[0].should.equal(testObj.arr1[1]);
  });
  return it("processKeys object obj1.arr2[0] should equal testObj.obj1.arr2[2]", function() {
    return resObj.obj1.arr2[0].should.equal(testObj.obj1.arr2[2]);
  });
});

describe("test leadingComma", function() {
  var jsonC;
  jsonC = new JSON.Command;
  jsonC.processArgs(['-,']);
  it("leading-comma output selection formats test object correctly", function() {
    return jsonC.stringify(testObj).should.equal(jsonC.diffFriendly(testObj));
  });
  it("leading-comma output nests arrays correctly", function() {
    return jsonC.stringify([[]]).should.equal('[ []\n]');
  });
  return it("leading-comma output nests deep object/array combinations correctly", function() {
    var obj;
    obj = {
      "": [
        {
          "deep": {
            "null": null
          }
        }
      ]
    };
    return jsonC.stringify(obj).should.equal(jsonC.diffFriendly(obj));
  });
});

describe("test JSON formats:", function() {
  describe("test back to back objects:", function() {
    var i, jsonC, preparedObjects, rawObjects, testInput;
    jsonC = new JSON.Command;
    jsonC.processArgs(['-,']);
    testInput = '';
    i = 0;
    while (i < testObjects.length) {
      testInput += JSON.stringify(testObjects[i]);
      i++;
    }
    jsonC.processChunk(testInput);
    rawObjects = jsonC.createObjects();
    rawObjects = rawObjects.concat(jsonC.createObjects());
    preparedObjects = jsonC.prepareFinalObjects(rawObjects);
    return it("testObjects should be produced", function() {
      rawObjects[0].should.equal(JSON.stringify(testObjects[0]));
      return rawObjects[1].should.equal(JSON.stringify(testObjects[1]));
    });
  });
  return describe("test new lines between objects:", function() {
    var i, jsonC, preparedObjects, rawObjects, testInput;
    jsonC = new JSON.Command;
    jsonC.processArgs(['-,']);
    testInput = '';
    i = 0;
    while (i < testObjects.length) {
      testInput += JSON.stringify(testObjects[i], null, 0) + '\n';
      i++;
    }
    jsonC.processChunk(testInput);
    rawObjects = jsonC.createObjects();
    rawObjects = rawObjects.concat(jsonC.createObjects());
    preparedObjects = jsonC.prepareFinalObjects(rawObjects);
    return it("testObjects should be produced", function() {
      rawObjects[0].should.equal(JSON.stringify(testObjects[0]));
      return rawObjects[1].should.equal(JSON.stringify(testObjects[1]));
    });
  });
});

//# sourceMappingURL=json-command.js.map
