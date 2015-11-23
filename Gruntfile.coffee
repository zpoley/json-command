module.exports = (grunt) ->

  grunt.initConfig

    pkg: grunt.file.readJSON("package.json")

    coffeelint:
      lint_src:
        files:
          src: ["src/**/*.coffee"]

    ,
    coffee:

      compile_package:
        options:
          bare: true
          sourceMap: true
        expand: true
        flatten: false
        cwd: "."
        src: [ "package.coffee" ]
        dest: "dist"
        ext: ".js"
      ,
      compile_src:
        options:
          bare: true
          sourceMap: true
        expand: true
        flatten: false
        cwd: "."
        src: [ "src/**/*.coffee" ]
        dest: "dist"
        ext: ".js"

    ,
    copy:
      bin:
        files: [
          expand: true
          src: ["src/bin/*.js"]
          dest:  "dist/"
        ]

    ,
    mochaTest:
      test:
        src: ["dist/src/test/*.js"]
        options:
          quiet: false

    ,
    watch:
      src:
        files: ["src/**/*.coffee", "src/**/*.js"]
        tasks: ["coffeelint", "coffee", "copy", "mochaTest"]

  grunt.loadNpmTasks "grunt-contrib-coffee"
  grunt.loadNpmTasks "grunt-contrib-watch"
  grunt.loadNpmTasks "grunt-contrib-copy"
  grunt.loadNpmTasks "grunt-mocha-test"
  grunt.loadNpmTasks "grunt-coffeelint"

  grunt.registerTask "default", ["coffeelint", "coffee", "copy", "mochaTest"]
