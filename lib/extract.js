var extractor = function() {
    var fs       = require("fs");
    var path     = require("path");

    var _        = require("underscore");
    var ajs      = require("ajs");
    var async    = require("async");
    var Compiler = require("ajs/lib/compiler");
    var Parser   = require("ajs/lib/parser");
    var Node     = Parser.Node;

    var header = [
        "<% if (header) {%>" +
        "# Translations template for <%- project.name %>.",
        "# Copyright (C) <%- year %> <%= copyright %>.",
        "# This file is distributed under the same license as the <%- project.name %> project.",
        "# <%- author %>, <%= year %>.",
        "#",
        "#, fuzzy",
        'msgid ""',
        'msgstr ""',
        '"Project-Id-Version: <%- project.name %> <%= project.version %>\\\\n"',
        '"Report-Msgid-Bugs-To: <%- bugs %>\\\\n"',
        '"POT-Creation-Date: <%- now %>\\\\n"',
        '"PO-Revision-Date: YEAR-MO-DA HO:MI+ZONE\\\\n"',
        '"Last-Translator: FULL NAME <EMAIL@ADDRESS>\\\\n"',
        '"Language-Team: LANGUAGE <LL@li.org>\\\\n"',
        '"MIME-Version: 1.0\\\\n"',
        '"Content-Type: text/plain; charset=utf-8\\\\n"',
        '"Content-Transfer-Encoding: 8bit\\\\n"',
        '"Generated-By: <%- details.name %> <%= details.version %>\\\\n"',
        "<% }; %>" +
        "<% translations.forEach(function(trans) { trans.comments.forEach(function(comment) { %>",
        "#: <%- comment %>" +
        "<% }); %>",
        "msgid <%- trans.msgid %>",
        "msgstr <%- trans.msgstr %>",
        "<% }); %>",
    ];

    var details = JSON.parse(fs.readFileSync(path.join(path.dirname(module.filename), "..", "package.json")), "utf-8");

    return {

        // Parse cmd-line arguments and extract i18n messages from one or more templates as specified
        cmdline: function(argv, cmdline_cb, output) {
            var usage = "usage: " + details.name + " [options] <template> [<template>...]";

            // Get text functions and which of their arguments are message IDs
            var gt_funcs = {
                gettext:   [1],
                dgettext:  [2],
                ngettext:  [1, 2],
                dngettext: [2, 3],
                pgettext:  [2],
                dpgettext: [3],
                npgettext: [2, 3],
                ndgettext: [3, 4],
            };

            // Additional functions to recognize
            var gt_extras = {};

            var opts = require('nomnom')
                .scriptName(details.name)
                .opts({

                    // Output-related options
                    output: {
                        default:  "messages.pot",
                        metavar:  "FILE",
                        help:     "file to write output to [defaults to stdout]",
                    },
                    append: {
                        flag:     true,
                        help:     "append to an existing output file, if any",
                    },

                    // Get-text method related options
                    gtobj: {
                        full:    "gettext",
                        default: "gt",
                        metavar: "NAME",
                        help:    "name of gettext module object [gt]",
                    },
                    gtmeth: {
                        full:    "method",
                        string:  "--method=NAME[:<index>[,index]+]",
                        list:    true,
                        help:    "additional gettext object methods to recognize, with optional 1-based message ID parameter indices",
                    },
                    gtfunc: {
                        full:    "function",
                        string:  "--function=NAME[:<index>[,index]+]",
                        list:    true,
                        help:    "additional global-scope functions to recognize, with optional 1-based message ID parameter indices",
                    },

                    // Header-related options
                    nohdr: {
                        flag:    true,
                        full:    "omit-header",
                        string:  "--omit-header",
                        help:    "omit the header",
                    },
                    project: {
                        default: "PROJECT",
                        help:    "the project's name",
                    },
                    version: {
                        default: "VERSION",
                        help:    "the project's version",
                    },
                    copyright: {
                        default: "ORGANIZATION",
                        help:    "the copyright owner",
                    },
                    bugs_addr: {
                        full:    "bugs-addr",
                        default: "EMAIL@ADDRESS",
                        help:    "the email or web address for reporting bugs",
                    },
                }).parseArgs(_.isArray(argv) ? argv : process.argv.slice(2));

            // Handle writing to stdout or a provided stream
            if (output !== undefined) {
                opts.output = output;
            } else if (opts.output === "-") {
                opts.output = process.stdout;
            }

            // Parse extra gettext functions
            var parse_gt_func = function(dest, gtexpr) {
                var index = gtexpr.indexOf(":");
                var params;
                var gtfunc;
                if (index === -1) {
                    gtfunc = gtexpr;
                    params = [1];
                } else {
                    gtfunc = gtexpr.substr(0, index);
                    params = _.map(gtexpr.substr(index + 1).split(","), function(index) {
                        var ii = parseInt(index);
                        if (!ii || ii < 1) {
                            throw new Error("invalid 1-based parameter index: " + index);
                        }
                        return ii;
                    });
                }
                dest[gtfunc] = params;
            }

            try {
                _.each(opts.gtmeth, function(gtexpr) {
                    parse_gt_func(gt_funcs, gtexpr);
                });
                _.each(opts.gtfunc, function(gtexpr) {
                    parse_gt_func(gt_extras, gtexpr);
                });
            } catch (err) {
                cmdline_cb(usage + "\n" + err.message);
                return;
            }

            // Append implies no header
            if (opts.append) {
                opts.nohdr = true;
            }

            // Validate options & arguments
            if (opts._.length === 0) {
                cmdline_cb(usage + "\n" + "No template specified.");
                return;
            }

            // Check whether a function call is a gettext call
            var gettext_func_params = function(funcexpr) {
                var index = funcexpr.indexOf(".");
                if (index === -1) {
                    return funcexpr in gt_extras ? gt_extras[funcexpr] : null;
                } else if (funcexpr.substr(0, index) !== opts.gtobj) {
                    return [];
                }

                return funcexpr.substr(index + 1) in gt_funcs ? gt_funcs[funcexpr.substr(index + 1)] : [];
            };

            // Extract text to localise from functions
            var get_localised_text = function(functext, args) {
                var params = gettext_func_params(functext);
                if (params === null || params.length === 0) {
                    return [];
                }

                // HACK: this is not really safe
                var index = 1;
                return _.select(args, function(arg) {
                    return _.include(params, index++) && arg !== null;
                });
            };

            // Process each specified template
            async.forEachSeries(opts._, function(filename, callback) {
                fs.readFile(filename, 'utf-8', function(err, source) {
                    if (err) {
                        return callback("Error reading template '" + filename + "': " + err.message);
                    }

                    // Translations
                    var translations = [];

                    // AJS compiler
                    var compiler = new Compiler(source, {
                        filename: filename,
                        tree: true,
                    });

                    // Process a function node
                    var process_func = function(func, args) {
                        var functext = compiler[func.type].apply(compiler, func.children);

                        var argstext = [];
                        _.each(args, function(arg) {
                            if (arg.type === "N_STRING") {
                                argstext.push(compiler[arg.type].apply(compiler, arg.children));
                            } else {
                                argstext.push(null);
                            }
                        });

                        _.each(get_localised_text(functext, argstext), function(text) {
                            translations.push({
                                comments: [filename + ":" + func.line],
                                msgid: text,
                                msgstr: '""',
                            });
                        });
                    };

                    // Walk the AST
                    var walker = function(node) {
                        try {
                            if (node.type === "N_CALL") {
                                process_func.apply(compiler, node.children);
                            } else {
                                _.each(_.flatten(node.children), function(child) {
                                    if (child) {
                                        walker(child);
                                    }
                                });
                            }
                        } catch (err) {
                            console.error(node.line + ":" + err.message);
                        }
                    };

                    // Walk the AST
                    walker(compiler.compile());

                    var fulltime = function(when) {
                        return now.getFullYear() + "-" + now.getMonth() + "-" + now.getDate();
                    };

                    // Write out translations template
                    var now = new Date();
                    ajs.render(header.join("\n"), {
                        locals: {
                            header: !opts.nohdr,
                            project: {
                                name: opts.project,
                                version: opts.version,
                            },
                            copyright: opts.copyright,
                            author: "FIRST AUTHOR <EMAIL@ADDRESS>",
                            year: now.getFullYear(),
                            bugs: opts.bugs_addr,
                            now: fulltime(now),
                            details: details,
                            translations: translations,
                        },
                    }, function(rendered) {
                        if (typeof(opts.output) === "object" && "write" in opts.output) {
                            opts.output.write(rendered, "utf-8");
                            callback();
                        } else if (opts.append) {

                            // This is all pretty ugly
                            var buffer = new Buffer(rendered);
                            fs.open(opts.output, "a", "0666", function(err, fd) {
                                var write_remaining = function(written) {
                                    if (written === buffer.length) {
                                        callback();
                                        return
                                    }

                                    // Write a chunk
                                    fs.write(fd, buffer, written, buffer.length - written, null, function(err2, chunk_written) {
                                        if (err2) {
                                            callback("Error writing output: " + err2.message);
                                        } else {
                                            write_remaining(written + chunk_written);
                                        }
                                    });
                                };
                                write_remaining(0);
                            });
                        } else {
                            try {
                                fs.writeFile(opts.output, rendered, "utf-8", function(err) {

                                    // Append subsequent extracted text and don't repeat the header
                                    opts.append = true;
                                    opts.nohdr = true;
                                    if (err) {
                                        callback("Error writing output to '" + opts.output + "': " + err);
                                    } else {
                                        callback();
                                    }
                                });
                            } catch (err) {
                                callback("Error writing output to '" + opts.output + "': " + err.message);
                            }
                        }
                    });
                });
            }, function(err) {
                cmdline_cb(err);
            });
        },
    };
}();

exports.cli = extractor.cmdline;

if (require.main === module) {
    extractor.cmdline(undefined, function(err) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
    });
}
