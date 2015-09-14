function applyTraceExtension(loader){
	if(loader._extensions) {
		loader._extensions.push(applyTraceExtension);
	}

	loader._traceData = {
		deps: {},
		dependencies: {},
		loads: {},
		parentMap: {}
	};

	loader.getDependencies = function(moduleName){
		return this._traceData.dependencies[moduleName];
	};
	loader.getDependants = function(moduleName){
		var deps = [];
		var pars = this._traceData.parentMap[moduleName] || {};
		eachOf(pars, function(name) { deps.push(name); });
		return deps;
	};
	loader.getModuleLoad = function(moduleName){
		return this._traceData.loads[moduleName];
	};
	loader.getBundles = function(moduleName, visited){
		visited = visited || {};
		visited[moduleName] = true;
		var loader = this;
		var parentMap = loader._traceData.parentMap;
		var parents = parentMap[moduleName];
		if(!parents) return [moduleName];

		var bundles = [];
		eachOf(parents, function(parentName, value){
			if(!visited[parentName])
				bundles = bundles.concat(loader.getBundles(parentName, visited));
		});
		return bundles;
	};
	loader._allowModuleExecution = {};
	loader.allowModuleExecution = function(name){
		var loader = this;
		return loader.normalize(name).then(function(name){
			loader._allowModuleExecution[name] = true;
		});
	};

	function eachOf(obj, callback){
		var name, val;
		for(name in obj) {
			callback(name, obj[name]);
		}
	}

	// Get a module's dependencies from the loader.load object
	function applyLoads(loader){
		var loads = loader.loads;
		var name, load;
		eachOf(loads, function(name, load){
			var deps = loader._traceData.deps[name] = [];
			var dependencies = loader._traceData.dependencies[name] = [];
			var depName;
			eachOf(load.depMap, function(depName, val){
				deps.push(depName);
				dependencies.push(val);
			});
		});
		delete loader.loads;
	}

	var limport = loader.import;
	loader.import = function(){
		var loader = this;

		if(this.loadBundles) {
			return limport.apply(this, arguments);
		}

		var amTracing = !!loader.trace;
		loader.trace = true;
		return limport.apply(this, arguments).then(function(r){
			if(!amTracing)
				loader.trace = false;
			applyLoads(loader);
			return r;
		});
	};

	// In order to prevent ES modules from executing we have to overwrite transpile (which is like translate, but happens after instantiate) so that an empty module is returned that only contains the dependencies. We can extract these with a simple regular expression.
	var transpiledDepsExp = /System\.register\((\[.+?\])\,/;
	var transpile = loader.transpile;
	loader.transpile = function(load){
		var loader = this;
		var result = transpile.call(this, load);

		return result.then(function(source){
			if(loader.preventModuleExecution) {
				var depsSource = transpiledDepsExp.exec(source)[1] || "[]";
				source = "System.register(" + depsSource + ", function(){" +
				"return {setters:[],execute:function(){}};});";
			}
			return source;
		});
	};

	var normalize = loader.normalize;
	loader.normalize = function(name, parentName){
		var normalizePromise = normalize.apply(this, arguments);

		if(parentName) {
			var parentMap = this._traceData.parentMap;
			return normalizePromise.then(function(name){
				if(!parentMap[name]) {
					parentMap[name] = {};
				}
				parentMap[name][parentName] = true;
				return name;
			});
		}

		return normalizePromise;
	};

	var emptyExecute = function(){
		return loader.newModule({});
	};

	// Determines if a load is an ES load or a load needed to run in order to load ES loads...
	var isEsLoad = (function(){
		var opts = { es: true, "es6": true };
		var special = { traceur: true, babel: true };
		return function(load){ return opts[load.metadata.format] || special[load.name]; };
	})();

	var instantiate = loader.instantiate;
	loader.instantiate = function(load){
		this._traceData.loads[load.name] = load;
		var loader = this;
		var instantiatePromise = Promise.resolve(instantiate.apply(this, arguments));
		return instantiatePromise.then(function(result){
			if(loader.preventModuleExecution && !isEsLoad(load) &&
			  !loader._allowModuleExecution[load.name]) {
				return {
					deps: result && result.deps,
					execute: emptyExecute
				};
			}

			return result;
		});
	};
}

applyTraceExtension.name = "Trace";

if(typeof System !== "undefined") {
	applyTraceExtension(System);
}
