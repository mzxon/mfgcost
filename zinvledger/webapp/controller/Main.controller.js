sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "zinvledger/model/models",
    "sap/ui/model/Sorter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/SearchField",
    "sap/ui/model/json/JSONModel",
],
function (Controller, Model, Sorter, Filter, FilterOperator, SearchField, JSONModel) {
    "use strict";

    var oTable;
    var oFilterBar;
    var oView;
    var oResult;
    var oMvGl;
    var oBegEnd;
    var oInOut;
    var oMType;
    var oFromMonth;
    var oToMonth;
    var oSumGroup = [];

    return Controller.extend("zinvledger.controller.Main", {
        onInit: function () {

            oTable = this.getView().byId("TBL_V");
            oFilterBar = this.getView().byId("FB_V");
            oView = this.getView();
            oView.setModel(new JSONModel(), "oResult");
            oResult = oView.getModel("oResult");
            oResult.setProperty("/", []);
            
            // FilterBar Model
            this.getView().setModel(Model.createSearchModel(), 'FB_Model');

            // Table Model
            this.getView().setModel(Model.createTableModel(), 'TBL_Model');
            
            oMvGl = new JSONModel();
            oBegEnd = new JSONModel();
            oInOut = new JSONModel();
            oMType = new JSONModel();
        
        },

        async onSearch() {
            try {
                var vFrom = this.byId("FromDate").getValue().replace("-", ""),
                    oFromYear = vFrom.substring(0,4);
                    oFromMonth = vFrom.substring(4, 6);
                var vTo = this.byId("ToDate").getValue().replace("-", ""),
                    oToYear = vTo.substring(0,4);
                    oToMonth = vTo.substring(4, 6);

                /*********************************************************
                / 평가클래스(GL) get
                **********************************************************/

                oMvGl = await Model.readODataModel("YY1_GL_INVLEDGER_CDS", "YY1_GL_INVLEDGER", null, null, null);
                
                // 기초기말 필터
                var be_f = [
                    new Filter("FiscalYear", "BT", oFromYear, oToYear),
                    new Filter("FiscalPeriod", "LE", oToMonth)
                ];

                // 입출고 필터
                var io_f = [
                    new Filter("FiscalYear", "BT", oFromYear, oToYear),
                    new Filter("FiscalPeriod", "LE", oToMonth),
                    new Filter("Language", "EQ", '3')
                ];

                var iFilterBar = oView.byId("FB_V"),
                aFilterItems = iFilterBar.getFilterGroupItems();
                
                aFilterItems.forEach(function(item){
                    var vFieldName = item.getName(),
                        oControl = item.getControl(),
                        oFilter = Model.setFilter(oControl, vFieldName, oMvGl);
                    if(oFilter){
                        if (Array.isArray(oFilter)) {
                            oFilter.forEach(function(filterItem) {
                                if (filterItem.sPath === "Plant") {
                                    be_f.push(filterItem); 
                                    return;
                                }
                                be_f.push(filterItem);
                                io_f.push(filterItem);
                            });
                        } else {
                            oFilter.aFilters.forEach(function(filterItem) {
                                be_f.push(filterItem);

                                if (filterItem.sPath === "Product") {
                                    let modifilter = new Filter("Material", "EQ", filterItem.oValue1, filterItem.oValue2);
                                    io_f.push(modifilter);
                                } else {
                                    io_f.push(filterItem);
                                }
                            });
                        }      
                    }
                });

                /*********************************************************
                / 기초기말 get
                **********************************************************/
                var be_p = {
                    $select: "GLAccount, GLAccountName, AccountingDocument, Product, ProductName, Quantity, AmountInCompanyCodeCurrency, PostingDate, FiscalYear, FiscalPeriod",
                    $top: "500000"
                };
                var be_s = [
                    new Sorter("GLAccount"),
                    new Sorter("Product")
                ];
                oBegEnd = await Model.readODataModel("ZSB_INVLEDGER_O2UI", "INVLEDGER", be_f, be_p, be_s);

                // 기초기말 + 입출고 합산
                this._sumBeg();

                /*********************************************************
                / 입출고 get
                **********************************************************/
                var io_p = {
                    $select: "GLAccount, Material, InventoryQty, BaseUnit, AmountInCompanyCodeCurrency, CompanyCodeCurrency, FiscalYear, FiscalPeriod, MaterialLedgerProcessType",
                    $top: "500000"
                };
                var io_s = [
                    new Sorter("GLAccount"),
                    new Sorter("Material")
                ];
                oInOut = await Model.readODataModel("YY1_MATERIAL_LEDGER_CDS", "YY1_MATERIAL_LEDGER", io_f, io_p, io_s)
                
                /**********************************************************
                / 입출고타입 get
                **********************************************************/
                var mt_p = {
                    $select: "Materialledgerprocesstype, Materialledgercategory",
                    $top: "500000"
                };
                oMType = await Model.readODataModel("YY1_MATERIALTYPE_INVLEDGER_CDS", "YY1_MATERIALTYPE_INVLEDGER", null, mt_p, null);

                // 총 합산
                this._sumInOut();
            
            } catch (error) {
                console.log("error:", error);
            }
        },

        // 기초기말 합산
        _sumBeg: function() {
            oTable.setBusy(true);

            oSumGroup = [];
            
            oBegEnd.forEach(row => {
                var itemId = row.GLAccount + "/" + row.Product;
                var vItem = oSumGroup.find(item => item.id === itemId);
                
                if (!vItem) {
                    vItem = {
                        id: itemId,
                        GLAccount: row.GLAccount,
                        GLAccountName: row.GLAccountName,
                        AccountingDocument: row.AccountingDocument,
                        Product: row.Product,
                        ProductName: row.ProductName,
                        FiscalYear: row.FiscalYear,
                        FiscalPeriod: row.FiscalPeriod,
                        CompanyCodeCurrency: 'KRW',
                        BegQty: 0,
                        BegUnitPrice: 0,
                        BegAmount: 0,
                        EndQty: 0,
                        EndUnitPrice: 0,
                        EndAmount: 0
                    };
                    oSumGroup.push(vItem);
                }

                if (row.FiscalPeriod >= '0' && row.FiscalPeriod <= Number(oFromMonth - 1)) {
                    vItem.BegQty += parseInt(row.Quantity);
                    vItem.BegAmount += parseInt(row.AmountInCompanyCodeCurrency);
                }
                if (row.FiscalPeriod >= '0' && row.FiscalPeriod <= Number(oToMonth)) {
                    vItem.EndQty += parseInt(row.Quantity);
                    vItem.EndAmount += parseInt(row.AmountInCompanyCodeCurrency);
                }

            })
            
           
        },

        // 총 합산
        _sumInOut: function () {
            var that = this;
            
            oInOut.forEach(data => {
                var dataId = data.GLAccount + "/" + data.Material;
                var vItem = oSumGroup.find(item => item.id === dataId);

                if (vItem) {         
                    var vCheckType = data.MaterialLedgerProcessType;
                    
                    // 합산
                    const mergeItem = (qtyKey, amountKey) => {
                        vItem[qtyKey] = (vItem[qtyKey] || 0) + parseInt(data.InventoryQty);
                        vItem[amountKey] = (vItem[amountKey] || 0) + parseInt(data.AmountInCompanyCodeCurrency);
                    };

                    // 입출고 타입에 따른 변수 네이밍
                    const processTypes = {
                        '2100': ['PurchInQty', 'PurchInAmount'],
                        '2200': ['ProdInQty', 'ProdInAmount'],
                        '2900': ['OtherInQty', 'OtherInAmount'],
                        '3100': ['ProdOutQty', 'ProdOutAmount'],
                        '3200': ['SalesOutQty', 'SalesOutAmount'],
                        '3900': ['OtherOutQty', 'OtherOutAmount']
                    };

                    // 타입에 따라 process 가져와서 합산
                    Object.keys(processTypes).forEach(mt => {
                        if (that._getProcessType(mt).includes(vCheckType)) {
                            const [qtyKey, amountKey] = processTypes[mt];
                            mergeItem(qtyKey, amountKey);
                        }
                    });

                    // 합계
                    vItem.TotalInQty = (vItem.PurchInQty || 0) + (vItem.ProdInQty || 0) + (vItem.OtherInQty || 0);
                    vItem.TotalInAmount = (vItem.PurchInAmount || 0) + (vItem.ProdInAmount || 0) + (vItem.OtherInAmount || 0);
                    
                    vItem.TotalOutQty = (vItem.ProdOutQty || 0) + (vItem.SalesOutQty || 0) + (vItem.OtherOutQty || 0);
                    vItem.TotalOutAmount = (vItem.ProdOutAmount || 0) + (vItem.SalesOutAmount || 0) + (vItem.OtherOutAmount || 0);
                    
                    vItem.vOtherOut2Qty = vItem.BegQty + vItem.TotalInQty - Math.abs(vItem.TotalOutQty) - Math.abs(vItem.EndQty);
                    vItem.vOtherOut2Amount = vItem.BegAmount + vItem.TotalInAmount - vItem.TotalOutAmount - vItem.EndAmount;
                    
                }
            })
            
            this._getUnitPrice();

        },

        _getProcessType: function (type) {
            switch (type) {
                case '2100':
                case '2200':
                case '2900':
                case '3100':
                case '3200':
                case '3900':
                    return oMType.filter(item => item.Materialledgerprocesstype === type)
                    .map(item => item.Materialledgercategory);

                default:
                    break;
            }
        },

        _getUnitPrice : function () {
          
            // oTable.setBusy(false);
            oSumGroup.forEach(data => {
                // 기초기말
                data.BegUnitPrice = Math.round((Math.abs(data.BegAmount) / Math.abs(data.BegQty)) * 1000) / 1000 || 0;
                data.EndUnitPrice = Math.round((Math.abs(data.EndAmount) / Math.abs(data.EndQty)) * 1000) / 1000 || 0;
                // 입고
                data.PurchInUnitPrice = Math.round((Math.abs(data.PurchInAmount) / Math.abs(data.PurchInQty)) * 1000) / 1000 || 0;
                data.ProdInUnitPrice = Math.round((Math.abs(data.ProdInAmount) / Math.abs(data.ProdInQty)) * 1000) / 1000 || 0;
                data.OtherInUnitPrice = Math.round((Math.abs(data.OtherInAmount) / Math.abs(data.OtherInQty)) * 1000) / 1000 || 0;
                data.TotalInUnitPrice = Math.round((Math.abs(data.TotalInAmount) / Math.abs(data.TotalInQty)) * 1000) / 1000 || 0;
                // 출고
                data.ProdOutUnitPrice = Math.round((Math.abs(data.ProdOutAmount) / Math.abs(data.ProdOutQty)) * 1000) / 1000 || 0;
                data.SalesOutUnitPrice = Math.round((Math.abs(data.SalesOutAmount) / Math.abs(data.SalesOutQty)) * 1000) / 1000 || 0;
                data.OtherOutUnitPrice = Math.round((Math.abs(data.OtherOutAmount) / Math.abs(data.OtherOutQty)) * 1000) / 1000 || 0;
                data.OtherOut2UnitPrice = Math.round((Math.abs(data.OtherOut2Amount) / Math.abs(data.OtherOut2Qty)) * 1000) / 1000 || 0;
                data.TotalOutUnitPrice = Math.round((Math.abs(data.TotalOutAmount) / Math.abs(data.TotalOutQty)) * 1000) / 1000 || 0;

            });
            
            oResult.setProperty("/", oSumGroup);
            oTable.setBusy(false);

        },

        //VH Material
        async onVHMT() {
            try {
                oView.setModel(new JSONModel(), "oMaterial");
                var vVHMT = oView.getModel("oMaterial");

                var mt_p = {
                    $top: "500000"
                };
                var mt_s = [
                    new Sorter("Product")
                ];
                var data  = await Model.readODataModel("ZSB_INVLEDGER_O2UI", "VH_Product", null, mt_p, mt_s);
                
                vVHMT.setProperty("/", data);

                var oMultiInput = this.byId("MI_MT");
                this._oMultiInput = oMultiInput;

                this._oBasicSearchField = new SearchField();
                this.loadFragment({
                    name: "zinvledger/fragment/Material",
                }).then(function(oDialog) {
                    var oFilterBar = oDialog.getFilterBar();
                    this._oVHD = oDialog;

                    this.getView().addDependent(oDialog);

                    oFilterBar.setFilterBarExpanded(false);
                    oFilterBar.setBasicSearch(this._oBasicSearchField);

                    // Trigger filter bar search when the basic search is fired
                    this._oBasicSearchField.attachSearch(function() {
                        oFilterBar.search();
                    });

                    oDialog.getTableAsync().then(function (oTable) {

                        oTable.setModel(vVHMT);

                        // For Desktop and tabled the default table is sap.ui.table.Table
                        if (oTable.bindRows) {
                            // Bind rows to the ODataModel and add columns
                            oTable.bindAggregation("rows", {
                                path: "/",
                                events: {
                                    dataReceived: function() {
                                        oDialog.update();
                                    }
                                }
                            });
                
                            oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>Material}"}), template: new sap.m.Text({wrapping: false, text: "{Product}"})}));
                            oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>MaterialText}"}), template: new sap.m.Text({wrapping: false, text: "{ProductName}"})}));
                        }
                    }.bind(this));           

                    oDialog.setTokens(this._oMultiInput.getTokens()); 
                    oDialog.open();
                }.bind(this));  
            } catch (error) {
                console.log("error:", error);
            }
            
        },

        //VH GLAccount
        async onVHGL() {
            try {
                oView.setModel(new JSONModel(), "oGLAccount");
                var vVHGL = oView.getModel("oGLAccount");

                vVHGL.setProperty("/", oMvGl);

                var oMultiInput = this.byId("MI_GL");
                this._oMultiInput = oMultiInput;

                this._oBasicSearchField = new SearchField();
                this.loadFragment({
                    name: "zinvledger/fragment/GLAccount",
                }).then(function(oDialog) {
                    var oFilterBar = oDialog.getFilterBar();
                    this._oVHD = oDialog;

                    this.getView().addDependent(oDialog);

                    oFilterBar.setFilterBarExpanded(false);
                    oFilterBar.setBasicSearch(this._oBasicSearchField);

                    // Trigger filter bar search when the basic search is fired
                    this._oBasicSearchField.attachSearch(function() {
                        oFilterBar.search();
                    });

                    oDialog.getTableAsync().then(function (oTable) {

                        oTable.setModel(vVHGL);

                        // For Desktop and tabled the default table is sap.ui.table.Table
                        if (oTable.bindRows) {
                            // Bind rows to the ODataModel and add columns
                            oTable.bindAggregation("rows", {
                                path: "/",
                                events: {
                                    dataReceived: function() {
                                        oDialog.update();
                                    }
                                }
                            });
                
                            oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>Materialvaluationclass}"}), template: new sap.m.Text({wrapping: false, text: "{Materialvaluationclass}"})}));
                            oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>GLAccount}"}), template: new sap.m.Text({wrapping: false, text: "{GlAccount}"})}));
                            oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>GLAccountText}"}), template: new sap.m.Text({wrapping: false, text: "{GLAccountName}"})}));
                        }
                    }.bind(this));           

                    oDialog.setTokens(this._oMultiInput.getTokens()); 
                    oDialog.open();
                }.bind(this));    
            } catch (error) {
                console.log("error:", error);
            }
            
        },

        onValueHelpOkPress: function (oEvent) {
            var aTokens = oEvent.getParameter("tokens");
            this._oMultiInput.setTokens(aTokens);
            this._oVHD.close();
        },

        onValueHelpCancelPress: function () {
            this._oVHD.close();
        },

        onValueHelpAfterClose: function () {
            this._oVHD.destroy();
        },

        onVHFBMT: function (oEvent) {
            var sSearchQueGLry = this._oBasicSearchField.getValue(),
                aSelectionSet = oEvent.getParameter("selectionSet");

            var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                if (oControl.getValue()) {
                    aResult.push(new Filter({
                        path: oControl.getName(),
                        operator: FilterOperator.Contains,
                        value1: oControl.getValue()
                    }));
                }

                return aResult;
            }, []);

            aFilters.push(new Filter({
                filters: [
                    new Filter({ path: "Product", operator: FilterOperator.Contains, value1: sSearchQueGLry }),
                    new Filter({ path: "ProductName", operator: FilterOperator.Contains, value1: sSearchQueGLry })
                ],
                and: false
            }));

            this._filterTable(new Filter({
                filters: aFilters,
                and: true
            }));
        },

        onVHFBGL: function (oEvent) {
            var sSearchQueGLry = this._oBasicSearchField.getValue(),
                aSelectionSet = oEvent.getParameter("selectionSet");

            var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                if (oControl.getValue()) {
                    aResult.push(new Filter({
                        path: oControl.getName(),
                        operator: FilterOperator.Contains,
                        value1: oControl.getValue()
                    }));
                }

                return aResult;
            }, []);

            aFilters.push(new Filter({
                filters: [
                    new Filter({ path: "Materialvaluationclass", operator: FilterOperator.Contains, value1: sSearchQueGLry }),
                    new Filter({ path: "GlAccount", operator: FilterOperator.Contains, value1: sSearchQueGLry }),
                    new Filter({ path: "GLAccountName", operator: FilterOperator.Contains, value1: sSearchQueGLry })
                ],
                and: false
            }));

            this._filterTable(new Filter({
                filters: aFilters,
                and: true
            }));
        },

        _filterTable: function (oFilter) {
            var oVHD = this._oVHD;

            oVHD.getTableAsync().then(function (oTable) {
                if (oTable.bindRows) {
                    oTable.getBinding("rows").filter(oFilter);
                }
                if (oTable.bindItems) {
                    oTable.getBinding("items").filter(oFilter);
                }

                // This method must be called after binding update of the table.
                oVHD.update();
            });
        },

        // 엑셀 다운로드
        onExport:function(){

            var aColumns = oTable.getColumns(), 
                aColumnConfig = [];
                
            aColumns.forEach(function(col){
                var sItems = col.getTemplate().mAggregations.items[0];
                
                var sProperty = sItems.getBindingPath("text");
                console.log("check sItems", sItems);
                console.log("check sProperty", sProperty);

                var sText = "";
                if(col.getLabel() === null) {
                    // switch (sProperty.) {
                    //     case value:
                            
                    //         break;
                    
                    //     default:
                    //         break;
                    // }



                    sText = col.getMultiLabels()[0].getText().trim();
                }
                
                console.log("check sText", sText);
                
                // // 숫자 필드에 대한 쉼표 처리
                // if(col.getLabel().getText() === "현잔액" || col.getLabel().getText().indexOf("/") > 0 ){
                //     var obj = {
                //         label : sText,
                //         property : sProperty,
                //         type: sap.ui.export.EdmType.Number,
                //         delimiter : true,
                //         scales : 0,
                //         width: 20,
                //     };
                // }else{
                //     var obj = {
                //         label : sText,
                //         property : sProperty,
                //         width: 20,
                //     };
                // }
                
                // var bVisible = col.getVisible();
                // if(bVisible){
                //     aColumnConfig.push(obj);
                // }
            });
            
            // var oRowBinding, oSettings, oSheet;
            //     oRowBinding = _oTable.getBinding();
            // var oModel = oRowBinding.getModel(),
            //     sPath = oRowBinding.sPath,
            //     aModelData = oModel.getProperty(sPath);
            
            // oSettings = {
            //     workbook: { columns: aColumnConfig },
            //     dataSource: aModelData,
            //     fileName : "수불부_worldex" + ".xlsx"
            // };
    
            // oSheet = new Spreadsheet(oSettings);
            // oSheet.build().finally(function() {
            //     oSheet.destroy();
            // });
        },

        excelBindingInfo: function (col) {
            var colTemp = col.getTemplate(),
            sResult = "";
    
            if (colTemp.getText) {
                sResult = colTemp.getBindingInfo("text");
            } else if (colTemp.getValue) {
                sResult = colTemp.getBindingInfo("value");
            } else {
                return sResult;
            }
            return sResult;
        },

        formatCurrency: function (price, currency) {
            if(price != null && currency != null){

                var vCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({
                    currencyCode: true,
                    showMeasure : false
                });

                return vCurrencyFormat.format(price, currency);
            } else {
                return 0;
            }
        }
    });
});
