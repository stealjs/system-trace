var QUnit = require("steal-qunit");
var loader = require("@loader");

function makeLoader(){
	this.loader = loader.clone();
	this.loader.baseURL = "./";
	this.loader.paths = loader.paths;
	applyTraceExtension(this.loader);
}

function setupBasics(assert){
	makeLoader.call(this);

	var done = assert.async();
	this.loader.import("tests/basics/main").then(function(){
		done();
	}, assertFailure("Failed to load"));
}

function assertFailure(reason){
	var doAssert = function(reason, error){
		if(error) {
			reason = reason + "\n" + error;
		}

		QUnit.ok(false, reason);
	};
	return reason ? doAssert.bind(null, "Failure") : doAssert(reason);
}


QUnit.module("getDependencies", {
	setup: setupBasics
});


QUnit.test("Gets the dependencies of a module", function(){
	var loader = this.loader;

	QUnit.deepEqual(loader.getDependencies("tests/basics/main"),
					["tests/basics/b", "tests/basics/c"],
					"Correctly gets the dependencies for the main");

	QUnit.deepEqual(loader.getDependencies("tests/basics/c"),
					["tests/basics/d", "tests/basics/f",
					"tests/basics/h"],
					"Correctly gets the dependencies for the c module");


});

QUnit.test("Returns undefined when a module is not in the graph", function(){
	var loader = this.loader;

	QUnit.equal(loader.getDependencies("test/basics/not_in_graph"), undefined,
				"undefined is returned when the module is not in the graph");
});

QUnit.module("getDependants", {
	setup: setupBasics
});

QUnit.test("Gets modules that are dependants", function(){
	var loader = this.loader;

	QUnit.deepEqual(loader.getDependants("tests/basics/b"), ["tests/basics/main"],
										 "main is the only dependant");
	var dDeps = loader.getDependants("tests/basics/d").sort();
	QUnit.deepEqual(dDeps, ["tests/basics/c","tests/basics/e"],
					"c and e are dependants");
	QUnit.deepEqual(loader.getDependants("tests/basics/main"), [],
										 "main has no dependants");

});

QUnit.module("getModuleLoad", {
	setup: setupBasics
});

QUnit.test("Gets the module's load object", function(){
	var loader = this.loader;

	var load = loader.getModuleLoad("tests/basics/b");

	QUnit.ok(load.source, "Has source");
});

QUnit.module("preventModuleExecution", {
	setup: function(assert){
		makeLoader.call(this);

		var done = assert.async();
		this.loader.preventModuleExecution = true;
		this.loader.import("tests/basics/prevent_me").then(function(){
			done();

		}, assertFailure("Failed to load"));
	}
});

QUnit.test("Prevents a module from executing", function(){
	var loader = this.loader;

	var value = loader.get("tests/basics/prevent_me")["default"];

	QUnit.equal(typeof value, "undefined", "The module is an empty object");
	QUnit.ok(loader.get("tests/basics/d"), "the d module loaded even though its parent is an es6 module");

	var dDeps = loader.getDependencies("tests/basics/prevent_me").sort();
	QUnit.deepEqual(dDeps, ["tests/basics/main", "tests/basics/prevent_es"],
					"got the correct dependencies");

	var cDeps = loader.getDependencies("tests/basics/c").sort();
	QUnit.deepEqual(cDeps, ["tests/basics/d", "tests/basics/f",
		"tests/basics/h"]);
});

QUnit.module("preventModuleExecution with babel", {
	setup: function(assert){
		makeLoader.call(this);

		var done = assert.async();
		this.loader.preventModuleExecution = true;
		this.loader.transpiler = "babel";
		this.loader.import("tests/basics/prevent_me").then(function(){
			done();
		}, assertFailure("Failed to load"));
	}
});

QUnit.test("Prevents a module from executing", function(){
	var loader = this.loader;

	var value = loader.get("tests/basics/prevent_me")["default"];

	QUnit.equal(typeof value, "undefined", "The module is an empty object");
	QUnit.ok(loader.get("tests/basics/d"), "the d module loaded even though its parent is an es6 module");
});

QUnit.module("getBundles", {
	setup: setupBasics
});

QUnit.test("Gets the top-level module", function(){
	var loader = this.loader;

	QUnit.deepEqual(loader.getBundles("tests/basics/d"), ["tests/basics/main"],
				"main is the bundle");
});

QUnit.module("production", {
	setup: function(assert){
		makeLoader.call(this);

		this.loader.baseURL = "./tests/production";
		this.loader.bundles = {"bundles/main":["main"]};
		this.loader.loadBundles = true;

		var done = assert.async();
		this.loader.import("main").then(function(){
			done();
		}, assertFailure("Failed to load"));
	}
});

QUnit.test("Loads normally", function(){
	QUnit.ok(true, "it loaded!");
});

QUnit.module("eachModule", {
	setup: function(assert){
		makeLoader.call(this);

		this.loader.set('module1', System.newModule({'default': function() { return 'foo'; }, __useDefault: true }));
		this.loader.set('module2', System.newModule({'bar': function() { return 'bar'; } }));
	}
});

QUnit.test("Calls callback", function(){
	this.loader.eachModule(function(name, val) {
		if (name === 'module1') {
			QUnit.equal(val['default'](), 'foo', 'should get correct value for module1');
		}
		if (name === 'module2') {
			QUnit.equal(val.bar(), 'bar', 'should get correct value for module2');
		}
	});
});
