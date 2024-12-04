sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "mfgcost/model/models",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    'sap/ui/export/library',
    'sap/ui/export/Spreadsheet',
],
    function (Controller, Model, Filter, FilterOperator, exportLibrary, Spreadsheet) {
        "use strict";
        const EdmType = exportLibrary.EdmType;
        const Control = {
            ComboBox: {
                CB_CompanyCode: "CB_CompanyCode"
            },
            FilterBar: {
                FB_MainSearch: "FB_MainSearch"
            },
            Search: {
                MI_CompanyCode: "MI_CompanyCode"
            },
            Table: {
                T_Main: "T_Main"
            },
            Button: {
                B_Excel: "B_Excel"
            }
        };

        return Controller.extend("mfgcost.controller.Main", {
            /******************************************************************
             * Life Cycle
             ******************************************************************/
            onInit: function () {
                console.log("check here");
                // i18n Init
                this.i18n = this.getOwnerComponent().getModel("i18n").getResourceBundle();

                //---------------------------------------------------------------/
                // Change Filterbar's Go Text
                //---------------------------------------------------------------/
                let oFilter = this.byId(Control.FilterBar.FB_MainSearch);
                console.log(oFilter);
                oFilter.addEventDelegate({
                    "onAfterRendering": function (oEvent) {
                        let oButton = oEvent.srcControl._oSearchButton;
                        console.log(oButton);
                        oButton.setText(this.i18n.getText("goButton"));
                    }.bind(this)
                });
                // let oSearchButton = oFilter.getAggregation("_searchButton"); // 검색 버튼 접근
                // if (oSearchButton) {
                //     oSearchButton.setText(this.i18n.getText("goButton"));
                // } else {
                //     console.error("Search button not found in FilterBar.");
                // }

                //---------------------------------------------------------------/
                // Search Model 
                //---------------------------------------------------------------/
                this.getView().setModel(Model.createSearchModel(), 'Search');
                console.log(this.getView().getModel("Search"));

                //---------------------------------------------------------------/
                // Search Model 
                //---------------------------------------------------------------/
                let oTreeTable = this.getView().byId(Control.Table.T_Main);
                console.log(oTreeTable);
                this._bindTable(oTreeTable);
            },

            /******************************************************************
             * Event Listener
             ******************************************************************/
            onSearch: function (oEvent) {
                let oTable = this.getView().byId(Control.Table.T_Main);
                oTable.unbindRows(); // 바인딩된 해제
                this._bindTable(oTable);
            },

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


            /******************************************************************
             * Private Function
             ******************************************************************/
            _bindTable: function (oTable) {
                console.log(oTable);
                oTable.bindRows({
                    path: "/Main",
                    filters: this._getTableFilter(),
                    parameters: {
                        countMode: "Inline",
                        operationMode: "Server",
                        treeAnnotationProperties: {
                            hierarchyLevelFor: "HierarchyLevel",
                            hierarchyNodeFor: "NodeID",
                            hierarchyParentNodeFor: "ParentNodeID",
                            hierarchyDrillStateFor: "DrillState"
                        }
                    },
                    events: {
                        dataRequested: this._onTreeTableRequested.bind(this),
                        dataReceived: this._onTreeTableReceived.bind(this),
                    }
                });
            },

            _onTreeTableRequested: function () {
                let oTable = this.getView().byId(Control.Table.T_Main);
                oTable.setBusy(true);
            },

            _onTreeTableReceived: function () {
                let oTable = this.getView().byId(Control.Table.T_Main);
                oTable.setBusy(false);
            },

            _onCBCompanyRequested: function () {
                let oComboBox = this.getView().byId(Control.ComboBox.CB_CompanyCode);
                oComboBox.setBusy(true);
            },

            _onCBCompanyReceived: function () {
                let oComboBox = this.getView().byId(Control.ComboBox.CB_CompanyCode);
                oComboBox.setBusy(false);
            },

            _getTableFilter: function () {
                let oSearch = this.getView().getModel("Search").getData();
                let aFilter = [];

                let oFilterFromYear = new Filter({
                    path: "P_FROMYEAR",
                    operator: FilterOperator.EQ,
                    value1: oSearch.FromDate.getFullYear(),
                });

                let oFilterFromMonth = new Filter({
                    path: "P_FROMMONTH",
                    operator: FilterOperator.EQ,
                    value1: (oSearch.FromDate.getMonth() + 1 + "").padStart(3, '0'),
                });

                let oFilterToYear = new Filter({
                    path: "P_TOYEAR",
                    operator: FilterOperator.EQ,
                    value1: oSearch.ToDate.getFullYear(),
                });

                let oFilterToMonth = new Filter({
                    path: "P_TOMONTH",
                    operator: FilterOperator.EQ,
                    value1: (oSearch.ToDate.getMonth() + 1 + "").padStart(3, '0'),
                });

                let oFilterCheckGL = new Filter({
                    path: "P_CHEKGL",
                    operator: FilterOperator.EQ,
                    value1: oSearch.CheckGL,
                });

                let oFilterCheckLY = new Filter({
                    path: "P_CHEKLY",
                    operator: FilterOperator.EQ,
                    value1: oSearch.CheckLY,
                });

                let oFilterCompanyCode = new Filter({
                    path: "P_COMPCD",
                    operator: FilterOperator.EQ,
                    value1: oSearch.CompanyCode,
                });

                aFilter.push(oFilterFromYear);
                aFilter.push(oFilterFromMonth);
                aFilter.push(oFilterToYear);
                aFilter.push(oFilterToMonth);
                aFilter.push(oFilterCheckGL);
                aFilter.push(oFilterCheckLY);
                aFilter.push(oFilterCompanyCode);

                return aFilter;
            },

            _createColumnConfig: function () {
                var aCols = [];

                /* 1. SubjectText */
                aCols.push({
                    label: this.i18n.getText("SubjectText"),
                    type: EdmType.String,
                    property: 'SubjectText',
                    width: 29,
                    wrap: true
                });

                aCols.push({
                    label: this.i18n.getText("GlAccount"),
                    type: EdmType.String,
                    property: 'GlAccount',
                    width: 12.5
                });

                aCols.push({
                    label: this.i18n.getText("GlAccountText"),
                    type: EdmType.String,
                    property: 'GlAccountText',
                    width: 32
                });

                aCols.push({
                    label: this.i18n.getText("AmountInCompanyCodeCurrency"),
                    type: EdmType.Currency,
                    property: 'AmountInCompanyCodeCurrency',
                    unitProperty: 'CompanyCodeCurrency',
                    displayUnit: false,
                    width: 32
                });

                /* 4. Add a simple Decimal column */
                aCols.push({
                    label: this.i18n.getText("CompanyCodeCurrency"),
                    type: EdmType.String,
                    property: 'CompanyCodeCurrency',
                });

                return aCols;
            },

            _makeURL: function (sFilterParams, icount) {
                let sfilters = decodeURI(sFilterParams);
                let ofilters = {
                    "$filter": sfilters.substring(1, sfilters.length - 1)
                };
                if(icount){
                    _.set(ofilters, "$top", icount);
                }
                return ofilters;
            }
        });
    });
