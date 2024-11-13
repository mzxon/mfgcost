sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device",
    "sap/ui/core/date/UI5Date",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
], 
function (JSONModel, Device, UI5Date, ODataModel, Filter, FilterOperator) {
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

        readODataModel : function(oModelData, oEntityData, aFilter, aParameters, aSort){
            return new Promise((resolve, reject) => {
                var odataModel = "/sap/opu/odata/sap/" + oModelData + "/";
                var oEntity = "/" + oEntityData;

                var oModel = new ODataModel(odataModel);
                
                var param = {
                    EntitySet : oEntity || "",
                    Parameters : aParameters || null,
                    Filter : aFilter || [],
                    Sorter : aSort || []
                };

                oModel.read(param.EntitySet, {
                    urlParameters: param.Parameters,
                    filters : param.Filter,
                    sorters : param.Sorter,
                    success : function(oResult){
                        resolve(oResult.results);
                    },
                    error: function(oError) {
                        reject(oError);
                        console.error(oError);
                    }
                })
            })
        },

        // 필터
        setFilter : function(oControl, vFieldName, oMvGl){
            var oFilter = null, vValue = null;
            
            if(oControl instanceof sap.m.MultiComboBox){
                vValue = oControl.getSelectedKeys();
                if(vValue.length){
                    return vValue.map(function(item) {
                        return new Filter(vFieldName, "EQ", item);
                    });
                }
            }else if(oControl instanceof sap.m.MultiInput){
                vValue = oControl.getTokens();
                if(vFieldName == 'GLAccount' && vValue.length == 0) {
                    oMvGl.forEach(data => {
                        var oNewToken = new sap.m.Token({
                            key: data.GlAccount, 
                            text: data.GLAccountName
                        });
                        vValue.push(oNewToken);
                    });
                }
                if(vValue.length){
                    oFilter = new Filter({
                        filters : vValue.map(function(oToken){
                            var sCode = oToken.getKey();
                            if(vFieldName === "SOLD_TO_PARTY"){
                                sCode = this._conversionCode(sCode);
                            }
                            return new Filter(vFieldName, "EQ", sCode);
                        }.bind(this)),
                        and : false
                    });
                }
                return oFilter;
            }
        },

    };

});