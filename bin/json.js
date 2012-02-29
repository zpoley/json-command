#!/usr/bin/env node

var jsonCommand = require("../lib/jsonCommand");

var args = process.argv.slice(0);
// shift off node and script name
args.shift(); args.shift();

new JSON.Command(args).processInput(); 
