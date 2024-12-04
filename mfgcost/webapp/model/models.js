sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
    function (JSONModel, Device) {
        "use strict";

        let fromdate = new Date();
        let todate = new Date();

        let oSearchModel = {
            FromDate: fromdate,
            ToDate: todate,
            CheckGL: true,
            CheckLY: false,
            CompanyCode: '1000'
        };

        return {
            /**
             * Provides runtime information for the device the UI5 app is running on as a JSONModel.
             * @returns {sap.ui.model.json.JSONModel} The device model.
             */
            createDeviceModel: function () {
                var oModel = new JSONModel(Device);
                oModel.setDefaultBindingMode("OneWay");
                return oModel;
            },

            createSearchModel: function () {
                var oModel = new JSONModel(oSearchModel);
                oModel.setDefaultBindingMode("TwoWay");
                return oModel;
            }
        };

    });