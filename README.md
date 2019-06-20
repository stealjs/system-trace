[![Build Status](https://travis-ci.org/stealjs/system-trace.svg?branch=master)](https://travis-ci.org/stealjs/system-trace)
[![npm version](https://badge.fury.io/js/system-trace.svg)](http://badge.fury.io/js/system-trace) [![Greenkeeper badge](https://badges.greenkeeper.io/stealjs/system-trace.svg)](https://greenkeeper.io/)

# DEPRECATED
The trace extension was merged into [StealJS core](https://github.com/stealjs/steal/pull/1016) and this repository will no longer be maintained.

# system-trace

A Steal and SystemJS extension that performs a trace on the registry, giving you the ability to get the dependencies and dependants of any module. Additionally it retains each module's `load` instance and allows preventing execution of modules (for a server-side trace, for example).

## Use

StealJS comes with system-trace. To use it with SystemJS, just add trace.js to a script tag after SystemJS.

## License

MIT
