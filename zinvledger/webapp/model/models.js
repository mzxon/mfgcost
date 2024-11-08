sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device",
    "sap/ui/core/date/UI5Date",
    "sap/ui/model/odata/v2/ODataModel",
], 
function (JSONModel, Device, UI5Date, ODataModel) {
    "use strict";

    let year = new Date().getFullYear();
    let fromdate = UI5Date.getInstance(year, 0, 1);
    let todate = new Date();

    let oSearchModel = {
        FromDate: fromdate,
        ToDate: todate,
        CompanyCode: '1000',
    };
    
    let oTableModel = {
        GLAccounts: [
            {
                GLAccount: '',
                Materials: []
            }
        ]
    };

    return {
        /**
         * Provides runtime info for the device the UI5 app is running on as JSONModel
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
        },

        createTableModel: function () {
            var oModel = new JSONModel(oTableModel);
            oModel.setDefaultBindingMode("TwoWay");
            return oModel;
        },
        
        createoModelList: function (oModelList, oModelName, oModel, oEntitySet) {
            oModelList[oModelName] = {
                'oModel': oModel,
                'oEntitySet': oEntitySet
            };
            
            // oView.setModel(new JSONModel(), oModelName);
            // return oView.getModel(oModelName);
        },

        readODataModel : function(oModel, aFilter, aParameters, aSort){
            var deferred = $.Deferred();
            var odataModel = new ODataModel(oModel.oModel);

            var param = {
                EntitySet : oModel.oEntitySet || "",
                Parameters : aParameters || null,
                Filter : aFilter || [],
                Sorter : aSort || []
            };

            odataModel.read(param.EntitySet, {
                urlParameters: param.Parameters,
                filters : param.Filter,
                sorters : param.Sorter,
                success : function(oResult){
                    var aResult = oResult.results;
                    deferred.resolve(aResult); 
                },
                error: function(oError) {
                    deferred.reject(oError);
                    if(oError.responseText){
                        var oResponseTextData = JSON.parse(oError.responseText);
                        console.log(oResponseTextData.error.message.value);
                        console.log("오류임");
                    }else{
                        console.log(oError.statusText);	
                    }
                }
            })
            return deferred.promise();
        
        },

    };

});