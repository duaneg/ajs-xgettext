var assert = require("assert");
var fs     = require("fs");
var path   = require("path");
var temp   = require('temp');
var BufferStream = require('bufferstream')

var extract = require("../lib/extract");

var testdir = "test";

exports.testNoTemplate = function(beforeExit) {
    var called = 0;

    extract.cli([], function(err) {
        called++;
        assert.equal(err, "usage: ajs-xgettext [options] <template> [<template>...]\nNo template specified.");
    });

    beforeExit(function() {
        assert.equal(called, 1);
    });
};

exports.testBadTemplate = function(beforeExit) {
    var called = 0;

    extract.cli(["non-existent file"], function(err) {
        called++;
        assert.equal(err, "Error reading template 'non-existent file': ENOENT, No such file or directory 'non-existent file'");
    });

    beforeExit(function() {
        assert.equal(called, 1);
    });
};

exports.testBadOutput1 = function(beforeExit) {
    var called = 0;

    extract.cli(["--output=/", path.join(testdir, "i18n.ajs")], function(err) {
        called++;
        assert.equal(err, "Error writing output to '/': Error: EISDIR, Is a directory '/'");
    });

    beforeExit(function() {
        assert.equal(called, 1);
    });
};

exports.testBadFuncSpec = function(beforeExit) {
    var called = 0;

    extract.cli(["--gtmeth=_:0", path.join(testdir, "i18n.ajs")], function(err) {
        called++;
        assert.equal(err, "usage: ajs-xgettext [options] <template> [<template>...]\ninvalid 1-based parameter index: 0");
    });

    beforeExit(function() {
        assert.equal(called, 1);
    });
};

exports.testExtract = function(beforeExit) {
    var called = 0;
    var chunks = [];
    var output = new BufferStream({encoding: "utf8", size: "flexible"});
    output.split("\n");
    output.on("split", function(chunk, token) {
        chunks.push(chunk.toString());
    });

    extract.cli(["--omit-header", "--method=gtmeth", "--function=_", "--function=gtfunc:1,3,5", path.join(testdir, "i18n.ajs")], function(err) {
        called++;
        assert.isUndefined(err);
    }, output);

    beforeExit(function() {
        assert.equal(chunks.length, 52);
        assert.equal(chunks[2], 'msgid "This is localised text"');
        assert.equal(chunks[3], 'msgstr ""');
        assert.equal(chunks[34], 'msgid "This is Chinese text with %d plural forms"');
        assert.equal(chunks[50], 'msgid "<this is>"');
        assert.equal(called, 1);
    });
};

exports.testWrite = function(beforeExit) {
    var called = 0;
    var output_file = temp.path({suffix: ".txt"});
    var output_stream = new BufferStream({encoding: "utf8", size: "flexible"});

    extract.cli([path.join(testdir, "i18n.ajs")], function(err) {
        called++;
        assert.isUndefined(err);
    }, output_stream);

    extract.cli(["--output", output_file, path.join(testdir, "i18n.ajs")], function(err) {
        called++;
        assert.isUndefined(err);
    });

    beforeExit(function() {
        assert.equal(called, 2);
        assert.equal(fs.readFileSync(output_file, "utf-8"), output_stream.toString());
        fs.unlinkSync(output_file);
    });
};

exports.testWriteAppend = function(beforeExit) {
    var called = 0;
    var output_file = temp.path({suffix: ".txt"});
    var output_stream = new BufferStream({encoding: "utf8", size: "flexible"});
    var prefix = "# Hello\n";

    fs.writeFileSync(output_file, prefix, "utf-8");

    extract.cli(["--omit-header", path.join(testdir, "i18n.ajs")], function(err) {
        called++;
        assert.isUndefined(err);
    }, output_stream);

    extract.cli(["--append", "--output", output_file, path.join(testdir, "i18n.ajs")], function(err) {
        called++;
        assert.isUndefined(err);
    });

    beforeExit(function() {
        assert.equal(called, 2);
        assert.equal(fs.readFileSync(output_file, "utf-8"), prefix + output_stream.toString());
        fs.unlinkSync(output_file);
    });
};
