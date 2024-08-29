/*global QUnit*/

sap.ui.define([
	"zmmdoc/zmmdoc/controller/ZMMDOC.controller"
], function (Controller) {
	"use strict";

	QUnit.module("ZMMDOC Controller");

	QUnit.test("I should test the ZMMDOC controller", function (assert) {
		var oAppController = new Controller();
		oAppController.onInit();
		assert.ok(oAppController);
	});

});
