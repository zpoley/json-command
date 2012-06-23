# JSON Command

JSON command line processing toolkit. 

no more writing code to inspect or transform JSON objects.

this npm module includes a json shell command. the json command processes standard 
input and parses json objects. json currently handles a few different standard 
input formats and provides a number of options tailored toward inspecting and 
transforming the parsed json objects.

## IMPORTANT

json-command has been renamed to json in npm. all updates will be made to the json npm package.

you need node v0.4.0 or higher and npm to run this program.

## Installation

    npm install json

installs json shell command.

## Examples

the following examples parse json output from twitter http requests and output the 
requested json fields.

please note that the last two examples require you to enter your username and password.

    curl http://search.twitter.com/search.json?q=node.js

    curl -s http://search.twitter.com/search.json?q=node.js | json

    curl -s http://search.twitter.com/search.json?q=node.js | json -o results

    curl -s http://search.twitter.com/search.json?q=node.js | json -o results from_user metadata

    curl -s http://search.twitter.com/search.json?q=node.js | json -o results new_id=id

    curl -s http://search.twitter.com/search.json?q=node.js | json -o results -C from_user from_user_id

    curl -s http://stream.twitter.com/1/statuses/sample.json -uAnyTwitterUser:Password | json user.name user.id

    curl -s http://stream.twitter.com/1/statuses/sample.json -uAnyTwitterUser:Password | json user.name user.id -c "entities.user_mentions.length > 0"

## Synopsis

    json [options] [fields]

## Options

    -h                    print help info and exit

    -v (-V | --version)   print version number and exit

    -u                    print ugly json output, each object on a single line

    -d                    print debugging output including exception messages

    -o object.path        specify the path to an array to be iterated on

    new.key=old_key       move old_key to new.key in output object

    -a                    input object is an array, process each element separately

    -c "js conditional"   js conditional to be run in the context of each object that determines whether an object is printed

    -C                    print the output fields as tab delimited columns in the order specified by fields

    -e "js expression"    execute arbitrary js in the context of each object.

    -i                    use node's util.inspect instead of JSON.stringify.

    -H                    print headers, if they are supplied. Useful for output from curl -i.


## Fields

any number of fields can be specified to be printed from each json object.
by default the structure of the original json object is maintained, however options
like -e and foo=bar allow for transforming object structure.

to remove a particular key, assign it to undefined using the -e flag.

## Standard Input Formats

* line delimited json objects
* back to back json objects. 
    e.g. { obj1 : body }{ obj2 : body }
* file separated json objects. 
    e.g. cat files/* | json
* when using -a, a single JSON array

## Order of operations

1. objects are parsed from stdin

2. any non-existing requested keys are instantiated

3. key transforms are applied to the object

4. expressions are run against the object

5. conditionals are checked against the object. the object is discarded if conditionals do not pass

6. the requested keys are pulled from the object and output

## Limitations

* all input is handled through standard in
* the current version is not particularly slow, but is NOT optimized for speed in any way

## Documentation

the npm package includes a man page that can be accessed using:

    man json

## Known Issues

this is alpha quality code, so use at your own risk.

## Thanks

this project respectfully uses code from and thanks the authors of:

* [node](http://github.com/ry/node) 
* [npm](http://npmjs.org/) 




