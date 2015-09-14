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


	var passThroughModules = {
		traceur: true,
		babel: true
	};
	var isAllowedToExecute = function(load){
		return passThroughModules[load.name] || this._allowModuleExecution[load.name];
	};

	var transpiledDepsExp = /System\.register\((\[.+?\])\,/;
	var singleQuoteExp = /'/g;
	var instantiate = loader.instantiate;
	loader.instantiate = function(load){
		this._traceData.loads[load.name] = load;
		var loader = this;
		var instantiatePromise = Promise.resolve(instantiate.apply(this, arguments));

		function finalizeResult(result){
			var preventExecution = loader.preventModuleExecution &&
				!isAllowedToExecute.call(loader, load);

			if(preventExecution) {
				return {
					deps: result ? result.deps : load.metadata.deps,
					execute: emptyExecute
				};
			}

			return result;
		}

		return instantiatePromise.then(function(result){
			// This must be es6
			if(!result) {
				return loader.transpile(load).then(function(source){
					load.metadata.transpiledSource = source;

					var depsSource = transpiledDepsExp.exec(source)[1] || "[]";
					var deps = JSON.parse(depsSource.replace(singleQuoteExp, '"'));
					load.metadata.deps = deps;

					return finalizeResult(result);
				});
			}
			return finalizeResult(result);
		});
	};

	var transpile = loader.transpile;
	// Allow transpile to be memoized, but only once
	loader.transpile = function(load){
		var transpiled = load.metadata.transpiledSource;
		if(transpiled) {
			delete load.metadata.transpiledSource;
			return Promise.resolve(transpiled);
		}
		return transpile.apply(this, arguments);
	};
}

applyTraceExtension.name = "Trace";

if(typeof System !== "undefined") {
	applyTraceExtension(System);
}
