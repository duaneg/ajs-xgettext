# ajs-xgettext

A utility for extracting localised text from [AJS](https://github.com/kainosnoema/ajs) templates (and probably other EJS-style templates). Extracted text is stored in the standard PO template format.

PO template file(s) can then be processed by the [GNU gettext](http://www.gnu.org/software/gettext/manual/gettext.html) or other compatible tools. Binary message catalogues can be read and accessed using [node-gettext](https://github.com/andris9/node-gettext).

## Installation

```` bash
$ npm install ajs-xgettext
````

## Usage

```` bash
$ ajs-xgettext template.ajs
````

By default the extractor looks for translation methods from the gettext module, as described in its [README](https://github.com/andris9/node-gettext/blob/master/README.md), and assumes the gettext module is available in the ````gt```` variable.

The ````--gettext```` option allows you to specify an alternate variable for accessing the gettext module. E.g.:

> ```` bash
> $ ajs-xgettext --gettext=GetText template.ajs
> ````

The ````--method```` option allows you to specify alternate gettext object method calls and which of their parameters to extract. E.g.:

> ```` bash
> $ ajs-xgettext --method=gt --method=dngt:2,3 template.ajs
> ````

The ````--function```` option allows you to specify top-level translation functions. E.g.:

> ```` bash
> $ ajs-xgettext --function=_ --function=_s:1,2 template.ajs
> ````

Please run with ````--help```` to see all available options.

## Hacking

To run the unit tests use [expresso](http://visionmedia.github.com/expresso/). It should work if you run it without arguments from the top-level project directory.

## License

(The MIT License)

Copyright (c) 2011 Duane Griffin &lt;duaneg@dghda.com&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

