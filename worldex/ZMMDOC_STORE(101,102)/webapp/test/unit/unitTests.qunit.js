/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"worldex_zmmdoc/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
