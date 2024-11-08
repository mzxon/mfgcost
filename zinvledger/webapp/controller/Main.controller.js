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
    var oModelList = [];
    var oView;
    var oResult;
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

            // 테이블 바인딩
            // this._bindTable();

        
        },

        onSearch: function () {
            var that = this;

            // 필터
            var vFrom = this.byId("FromDate").getValue().replace("-", "");
            oFromMonth = vFrom.substring(4, 6);
            var vTo = this.byId("ToDate").getValue().replace("-", "");
            oToMonth = vTo.substring(4, 6);

            // 기초, 기말
            oBegEnd = new JSONModel();
            Model.createoModelList( oModelList, "oBegEnd", "/sap/opu/odata/sap/ZSB_INVLEDGER_O2UI/", "/INVLEDGER");
            
            var be_f = [
                new Filter("SourceLedger", "EQ", "0L"),
                new Filter("CompanyCode", "EQ", "1000"),
                new Filter("FiscalYear", "GE", "2024"),
                new Filter("FiscalPeriod", "LE", oToMonth)
            ];
            var be_p = {
                $select: "GLAccount, GLAccountName, Product, ProductName, Quantity, AmountInCompanyCodeCurrency, PostingDate, FiscalYear, FiscalPeriod",
                $top: "500000"
            };
            var be_s = [
                new Sorter("GLAccount"),
                new Sorter("Product")
            ];
            $.when(
                Model.readODataModel(oModelList["oBegEnd"], be_f, be_p, be_s)
            ).done(function(results){
                oBegEnd = results;
                that._sumBeg();

                // 입출고
                that._getInOut();
                
            })
        },

        _sumBeg: function() {
            oSumGroup = [];
            
            oBegEnd.forEach(row => {
                // 조회를 위한 ID
                var itemId = row.GLAccount + "/" + row.Product;
                var vItem = oSumGroup.find(item => item.id === itemId);

                // 조회 Item
                if (!vItem) {
                    vItem = {
                        id: itemId,
                        GLAccount: row.GLAccount,
                        GLAccountName: row.GLAccountName,
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

                // 기초, 기말 합산
                if (row.FiscalPeriod == '0' && row.FiscalPeriod <= oFromMonth - 1) {
                    // console.log("check Quantity", row.Quantity);
                    // console.log("check AmountInCompanyCodeCurrency", row.AmountInCompanyCodeCurrency);
                    // console.log("check BegUnitPrice", Math.round((row.AmountInCompanyCodeCurrency/row.Quantity) * 1000) / 1000);
                    vItem.BegQty += parseInt(row.Quantity);
                    vItem.BegAmount += parseInt(row.AmountInCompanyCodeCurrency);
                    vItem.BegUnitPrice += Math.round((row.AmountInCompanyCodeCurrency/row.Quantity) * 1000) / 1000;
                } else if (row.FiscalPeriod >= '0' && row.FiscalPeriod <= oToMonth) {
                    vItem.EndQty += parseInt(row.Quantity);
                    vItem.EndAmount += parseInt(row.AmountInCompanyCodeCurrency);
                    vItem.EndUnitPrice += Math.round((row.AmountInCompanyCodeCurrency/row.Quantity) * 1000) / 1000;
                }
                
            })
            oResult.setProperty("/", oSumGroup);
           
        },

        _getInOut: function () {
            var that = this;
            
            oInOut = new JSONModel();
            Model.createoModelList(oModelList, "oInOut", "/sap/opu/odata/sap/YY1_MATERIAL_LEDGER_CDS/", "/YY1_MATERIAL_LEDGER");
                
            var be_f = [
                new Filter("SourceLedger", "EQ", "0L"),
                new Filter("CompanyCode", "EQ", "1000"),
                new Filter("FiscalYear", "GE", "2024"),
                new Filter("FiscalPeriod", "LE", oToMonth)
            ];
            var be_p = {
                $select: "GLAccount, Material, InventoryQty, BaseUnit, AmountInCompanyCodeCurrency, CompanyCodeCurrency, FiscalYear, FiscalPeriod, MaterialLedgerProcessType",
                $top: "500000"
            };
            var be_s = [
                new Sorter("GLAccount"),
                new Sorter("Material")
            ];
            $.when(
                Model.readODataModel(oModelList["oInOut"], be_f, be_p, be_s)
            ).done(function(results){
                oInOut = results;

                // 입출고 타입 get
                that._getProcessType();
                
            })

        },

        _getProcessType: function () {
            var that = this;

            oMType = new JSONModel();
            Model.createoModelList(oModelList, "oMType", "/sap/opu/odata/sap/YY1_MATERIALTYPE_INVLEDGER_CDS/", "/YY1_MATERIALTYPE_INVLEDGER");
                    
            var be_p = {
                $select: "Materialledgerprocesstype, Materialledgercategory",
                $top: "500000"
            };
            $.when(
                Model.readODataModel(oModelList["oMType"], null, be_p, null)
            ).done(function(results){
                oMType = results;

                // 입출고 합산
                that._sumInOut();

            })

        },

        _sumInOut: function () {
            console.log("check InOut:", oInOut);
            console.log("check oMType:", oMType);
            
            oInOut.forEach(data => {
                var dataId = data.GLAccount + "/" + data.Material;
                var vItem = oSumGroup.find(item => item.id === dataId);

                console.log(vItem);
                

            })




            // oBegEnd.forEach(row => {
            //     // 조회를 위한 ID
            //     var itemId = row.GLAccount + "/" + row.Product;
            //     var vItem = oSumGroup.find(item => item.id === itemId);

            //     // 조회 Item
            //     if (!vItem) {
            //         vItem = {
            //             id: itemId,
            //             GLAccount: row.GLAccount,
            //             GLAccountName: row.GLAccountName,
            //             Product: row.Product,
            //             ProductName: row.ProductName,
            //             FiscalYear: row.FiscalYear,
            //             FiscalPeriod: row.FiscalPeriod,
            //             CompanyCodeCurrency: 'KRW',
            //             BegQty: 0,
            //             BegUnitPrice: 0,
            //             BegAmount: 0,
            //             EndQty: 0,
            //             EndUnitPrice: 0,
            //             EndAmount: 0
            //         };
            //         oSumGroup.push(vItem);
            //     }
            
            // const typeNameMapping = {
            //     "2100": "PurchIn",  
            //     "2200": "ProdIn", 
            //     "2900": "OtherIn",
            //     "3100": "ProdOut",
            //     "3200": "SalesOut",  
            //     "3900": "OtherOut"
            // };

            // oMType.forEach(mItem => {
            //     var { Materialledgercategory, Materialledgerprocesstype} = mItem;
            //     console.log("check Materialledgercategory", Materialledgercategory);

            //     var vProcessType = oInOut.filter(ioItem => ioItem.MaterialLedgerProcessType === Materialledgercategory);

            //     console.log("check vProcessType:", vProcessType);
            //     // console.log("check sum:", sum_amount);

            //     var sum_qty = vProcessType.reduce((sum, ioItem) => sum + parseInt(ioItem.InventoryQty), 0);
            //     var sum_amount = vProcessType.reduce((sum, ioItem) => sum + parseInt(ioItem.AmountInCompanyCodeCurrency), 0);
            //     var unitprice = sum_qty > 0 ? sum_amount / sum_qty : 0;
                
            //     console.log("check sum_qty:", sum_qty);
            //     console.log("check sum_amount:", sum_amount);
            //     console.log("check unitprice:", unitprice);












            // })

            // oMType.forEach(type => {
            //     switch (type.Materialledgerprocesstype) {
            //         case "2100":
            //             console.log("here 2100");

            //             oInOut.forEach(data => {

            //             })


            //             break;
            //         case "2200":
                    
            //         break;
            //         case "2900": 
                        
            //             break;
            //         case "3100": 
                    
            //             break;
            //         case "3200": 
                        
            //             break;
            //         case "3900": 
                    
            //             break;
            //         default:
            //             break;
            //     }
            // })

            // oSumGroup.forEach(row => {

            //     oInOut.forEach(data => {
            //         var itemId = data.GLAccount + "/" + data.Material;
            //         console.log("check inoutId", itemId);
            //         if(row.id == itemId) {

            //             oMType.forEach(type => {
            //                 switch (type.Materialledgerprocesstype) {
            //                     case "2100":
            //                         console.log("here 2100");
            //                         console.log("check oSumGroup:", row);
            //                         console.log("check oInOut:", data);
            //                         console.log(data.MaterialLedgerProcessType);
            //                         break;
            //                     case "2200":
                                
            //                     break;
            //                     case "2900": 
                                    
            //                         break;
            //                     case "3100": 
                                
            //                         break;
            //                     case "3200": 
                                    
            //                         break;
            //                     case "3900": 
                                
            //                         break;
            //                     default:
            //                         break;
            //                 }
            //             })
            


            //             // data.Price2 = 0;
            //             // console.log(data);

            //         }
            //     })







                // 조회를 위한 ID
                // var itemId = row.GLAccount + "/" + row.Product;
                // var vItem = aGroup.find(item => item.id === itemId);

                // // 조회 Item
                // if (!vItem) {
                //     vItem = {
                //         id: itemId,
                //         GLAccount: row.GLAccount,
                //         GLAccountName: row.GLAccountName,
                //         Product: row.Product,
                //         ProductName: row.ProductName,
                //         FiscalYear: row.FiscalYear,
                //         FiscalPeriod: row.FiscalPeriod,
                //         CompanyCodeCurrency: 'KRW',
                //         BegQty: 0,
                //         BegUnitPrice: 0,
                //         BegAmount: 0,
                //         EndQty: 0,
                //         EndUnitPrice: 0,
                //         EndAmount: 0
                //     };
                //     aGroup.push(vItem);
                // }

                // if (row.FiscalPeriod == '0' && row.FiscalPeriod <= oFromMonth - 1) {
                //     vItem.BegQty += parseInt(row.Quantity);
                //     vItem.BegAmount += parseInt(row.AmountInCompanyCodeCurrency);
                //     vItem.BegUnitPrice += Math.round((row.AmountInCompanyCodeCurrency/row.Quantity) * 1000) / 1000;
                // } else if (row.FiscalPeriod >= '0' && row.FiscalPeriod <= oToMonth) {
                //     vItem.EndQty += parseInt(row.Quantity);
                //     vItem.EndUnitPrice += parseInt(row.AmountInCompanyCodeCurrency);
                //     vItem.EndAmount += Math.round((row.AmountInCompanyCodeCurrency/row.Quantity) * 1000) / 1000;
                // }
                
            
            
            // console.log("check aGroup:", aGroup);
            // oBegEnd.setProperty("/", aGroup);

        },

        //VH Material
        onVHMT: function() {
           
            var oMultiInput = this.byId("MI_MT");
            this._oMultiInput = oMultiInput;

            this._oBasicSearchField = new SearchField();
            this.loadFragment({
                name: "zinvledger/fragment/Material",
            }).then(function(oDialog) {
                var oFilterBar = oDialog.getFilterBar();
                this._oVHD = oDialog;

                this.getView().addDependent(oDialog);
                var oVHModel = this.getView().getModel("oMaterial");

                oFilterBar.setFilterBarExpanded(false);
                oFilterBar.setBasicSearch(this._oBasicSearchField);

                // Trigger filter bar search when the basic search is fired
                this._oBasicSearchField.attachSearch(function() {
                    oFilterBar.search();
                });

                oDialog.getTableAsync().then(function (oTable) {

                    oTable.setModel(oVHModel);

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
              
                         oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>Material}"}), template: new sap.m.Text({wrapping: false, text: "{GLAccount}"})}));
                         oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>MaterialText}"}), template: new sap.m.Text({wrapping: false, text: "{GLAccountName}"})}));
                    }
                }.bind(this));           

                oDialog.setTokens(this._oMultiInput.getTokens()); 
                oDialog.open();
            }.bind(this));
        },

        //VH GLAccount
        onVHGL: function() {
           
            var oMultiInput = this.byId("MI_GL");
            this._oMultiInput = oMultiInput;

            this._oBasicSearchField = new SearchField();
            this.loadFragment({
                name: "zinvledger/fragment/GLAccount",
            }).then(function(oDialog) {
                var oFilterBar = oDialog.getFilterBar();
                this._oVHD = oDialog;

                this.getView().addDependent(oDialog);
                var oVHModel = this.getView().getModel("oGLAccount");

                oFilterBar.setFilterBarExpanded(false);
                oFilterBar.setBasicSearch(this._oBasicSearchField);

                // Trigger filter bar search when the basic search is fired
                this._oBasicSearchField.attachSearch(function() {
                    oFilterBar.search();
                });

                oDialog.getTableAsync().then(function (oTable) {

                    oTable.setModel(oVHModel);

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
              
                         oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>GLAccount}"}), template: new sap.m.Text({wrapping: false, text: "{GLAccount}"})}));
                         oTable.addColumn(new sap.ui.table.Column({label: new sap.m.Label({text: "{i18n>GLAccountText}"}), template: new sap.m.Text({wrapping: false, text: "{GLAccountName}"})}));
                    }
                }.bind(this));           

                oDialog.setTokens(this._oMultiInput.getTokens()); 
                oDialog.open();
            }.bind(this));
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
                    new Filter({ path: "Material", operator: FilterOperator.Contains, value1: sSearchQueGLry }),
                    new Filter({ path: "MaterialText", operator: FilterOperator.Contains, value1: sSearchQueGLry })
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
                    new Filter({ path: "GLAccount", operator: FilterOperator.Contains, value1: sSearchQueGLry }),
                    new Filter({ path: "GLAccountText", operator: FilterOperator.Contains, value1: sSearchQueGLry })
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
        onExport: function () {
            let oBExcel = this.getView().byId(Control.Button.B_Excel);
            oBExcel.setBusy(true);

            let oTreeTable = this.getView().byId(Control.Table.T_Main);
            let oRowBinding = oTreeTable.getBinding('rows');

            this.getView().getModel().read('/Main/$count', {
                urlParameters: this._makeURL(oRowBinding.sFilterParams),
                success: function (oResult) {
                    this.count = oResult;
                    this.getView().getModel().read('/Main', {
                        urlParameters: this._makeURL(oRowBinding.sFilterParams, oResult),
                        success: function (oResult) {
                            this.data = oResult.results
                            let aCols, oSettings, oSheet;
                            aCols = this._createColumnConfig();

                            oSettings = {
                                workbook: {
                                    columns: aCols,
                                    hierarchyLevel: "HierarchyLevel"
                                },
                                dataSource: this.data,
                                fileName: this.i18n.getText("title") + (new Date()).toISOString() + '.xlsx',
                                worker: true // We need to disable worker because we are using a Mockserver as OData Service
                            };

                            oSheet = new Spreadsheet(oSettings);
                            oSheet.build().finally(function () {
                                oSheet.destroy();
                                oBExcel.setBusy(false);
                            });
                        }.bind(this)
                    })
                }.bind(this)
            })
        },

        formatterCurrency : function(amount, currency){

            if(amount != null && currency != null){

                var vCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({
                    currencyCode: true,
                    showMeasure : false
                });

                return vCurrencyFormat.format(amount, currency);
            }
        },
    });
});
