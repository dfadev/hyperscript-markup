"use strict"
var transformFileSync = require('babel-core').transformFileSync;
var path = require('path');
var fs = require('fs');
var assert = require('assert');

var plugin = require('../lib/hm').default;

var tests = [
	{file: 'div1'},
	{file: 'div2'},
	{file: 'div3'},
	{file: 'div4'},
	{file: 'div5'},
	{file: 'div6'},
	{file: 'div7'},
	{file: 'div8'},
	{file: 'div9'},
	{file: 'div10'},

	{file: 'comp1'},
	{file: 'comp2'},
	{file: 'comp3'},
	{file: 'comp4'},
	{file: 'comp5'},
	{file: 'comp6'},
	{file: 'comp7'},
	{file: 'comp8'},
	{file: 'comp9'},

	{file: 'classname'},

	{file: 'id1'},
	{file: 'id2'},

	{file: 'children1'},
	{file: 'children2'},
	{file: 'children3'},
	{file: 'children4'},
	{file: 'children5'},

	{file: 'attributes1'},
	{file: 'attributes2'},
	{file: 'attributes3'},
	{file: 'textnode1'},
	{file: 'inline-expr'},
	{file: 'nullmap1'},
	{file: 'nullmap2'},
	{file: 'if1'},
	{file: 'if2'},
	{file: 'if3'},
	{file: 'tilde1'},
	{file: 'map1'},
	{file: 'map2'},
]

describe('transform code', function (){
	tests.forEach(function(test) {
		it('src/' + test.file + '.js', function (done) {
			var transformed = transformFileSync(path.join(__dirname, `src/${test.file}.js`), {
				plugins: [[plugin, test.options]],
				babelrc: false,
				comments: false,
			}).code;
			var expected = fs.readFileSync(path.join(__dirname, `expected/${test.file}.js`)).toString();
			if (expected[expected.length - 1] === '\n') expected = expected.slice(0, -1);
			assert.equal(transformed, expected);
			done();
		});
	});
		
	//it ('Transform', function(){
		//var transformed = transformFileSync(path.join(__dirname, '../src/index.js'), {
			//plugins: [[plugin]]
		//}).code;
		////var expectedCode = fs.readFileSync(..)
		//console.log(transformed);
		////assert.equal(transformed, expected)
		//assert.equal(0, 0);

	//})
});
