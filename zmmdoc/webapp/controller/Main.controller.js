sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "zmmdoc/zmmdoc/xlsx/xlsx.full.min",
    "sap/m/MessageToast",
],
function (Controller, JSONModel, Fragment, MessageToast) {
    "use strict";

    var HEADER_TABLE;
    var ITEM_TABLE;
    var I18N;
    var MODEL_LIST = {};
    var VIEW;
    var PAYLOAD; 
    var HEADER = [];
    var ITEM = [];
    var ITEMDATA = [];
    var INDEX;
    var TOKEN;

    return Controller.extend("zmmdoc.zmmdoc.controller.Main", {
        onInit: function () {

            VIEW = this.getView();
            this.setModel();

            HEADER_TABLE = VIEW.byId("headerTable");
            ITEM_TABLE = VIEW.byId("itemTable");

            I18N = this.getOwnerComponent().getModel('i18n').getResourceBundle();   

        },
        /************** OData ***********************/
        // model 정의
        setModel: function () {
            // 모델 정보
            const models = [
                { name: "oPRODES", entitySet: "/ZMMDOC_PRODES" },
                { name: "oSTOLOC", entitySet: "/ZMMDOC_STOLOC" }
            ];

            // OData Service URL
            const serviceUrl = "https://my405699.s4hana.cloud.sap/sap/opu/odata/sap/ZMMDOC_SRV";

            // 모델 설정
            models.forEach(({ name, entitySet }) => {
                const oModel = new sap.ui.model.odata.v2.ODataModel(serviceUrl, { useBatch: false });
                MODEL_LIST[name] = { oModel, oEntitySet: entitySet };
            });
        },

        /************** Excel ***********************/
        // view 업로드 버튼 실행
        onExcelUpload: function(oEvent) {
            var oView = this.getView();
            if (!this.pDialog) {
                Fragment.load({
                    id: "excel_upload",
                    name: "zmmdoc.zmmdoc.fragment.ExcelUpload", 
                    type: "XML",
                    controller: this
                }).then((oDialog) => {
                    var oFileUploader = Fragment.byId("excel_upload", "uploadSet");
                    oFileUploader.removeAllItems();
                    this.pDialog = oDialog;
                    this.pDialog.open();
                })
                    .catch(error => alert(error.message));
            } else {
                var oFileUploader = Fragment.byId("excel_upload", "uploadSet");
                oFileUploader.removeAllItems();
                this.pDialog.open();
            }
        },

        // 템플릿다운
        onTempDownload: function (oEvent) {

            var colList = this.getColExcel();
            var data = {};
            var excelTemp = [];

            // 제외할 라벨 목록
            var excludedLabels = ["자재 내역", "처리결과", "저장 장소"];

            // 필터링하여 제외할 라벨을 제외한 컬럼 목록을 생성
            var filteredColList = colList.filter(function (col) {
                return !excludedLabels.includes(col.label);
            });
            
            filteredColList.forEach(e => {
                data[e.label] = '';
            });

            excelTemp.push(data);

            // 엑셀 워크시트 초기화
            const ws = XLSX.utils.json_to_sheet(excelTemp);
            // creating the new excel work book
            const wb = XLSX.utils.book_new();
            // set the file value
            XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
            // download the created excel file
            XLSX.writeFile(wb, 'RAP - ExcelTest.xlsx');

            MessageToast.show("템플릿 다운로드 되었습니다.");
        },

        // 엑셀칼럼
        getColExcel: function () {
            return [
                { label : "납품서", 			property : "ReferenceDocument",             value : "" },           
                { label : "이동 유형", 			property : "GoodsMovementType",             value : "" },           
                { label : "전기일", 			property : "PostingDate",                   value : "" },                 
                { label : "문서 헤더 텍스트",  	property : "MaterialDocumentHeaderText",     value : " "},  
                { label : "처리 결과", 	        property : "ProcessingResult",               value : "" },            
                { label : "자재 ID", 		    property : "Material",                       value : ""  },                    
                { label : "자재 내역", 			property : "MaterialList",                   value : ""  },                
                { label : "플랜트", 			property : "Plant",                          value : ""  },                       
                { label : "저장 장소 ID", 	    property : "StorageLocation",                value : ""  },             
                { label : "저장 장소", 	        property : "StorageLocationName",            value : ""  },         
                { label : "생산 오더", 			property : "ManufacturingOrder",             value : ""  },          
                { label : "수량", 	            property : "Material",                       value : ""  },                    
                { label : "단위", 	            property : "EntryUnit",                      value : ""  },                   
                { label : "Batch", 	            property : "Batch",                          value : ""  },                       
                { label : "Serial Number", 	    property : "SerialNumber",                   value : ""  },                
            ];
        },

        // 팝업창닫음
        onCloseDialog: function (oEvent) {
            if (this.pDialog) {
                this.pDialog.close();
                this.pDialog.destroy();
                this.pDialog = null;
            }
        },

        // 업로드
        onUploadSet: function(oEvent) {
            var headerData = []; // 모든 행의 데이터를 담을 배열
            HEADER = new JSONModel();
        
            // 엑셀 데이터
            var list = this.getColExcel();            
            // 헤더 테이블 라벨
            var columns = HEADER_TABLE.getColumns().map(oColumn => oColumn.getLabel().getText());
 
            // 중복 체크 함수
            function isDuplicate(data, newItem) {
                const newItemStr = JSON.stringify(newItem);
                return data.some(item => JSON.stringify(item) === newItemStr);
            }
            
            // 칼럼명 -> 데이터명 -> 저장
            this.excelSheetsData.forEach(e => {  // 전체 엑셀 데이터 반복
                e.forEach(item => {              // 각 행별로 반복
                    var rowHeaderData = {};      // 각 행의 데이터를 담을 객체
                    var rowItemData = {};

                    list.forEach(col => {
                        const label = col.label;
                        if (item[label]) {
                            col.value = item[label];
                            
                            // 전기일 날짜형식 적용
                            if (col.label == '전기일') {
                                col.value = new Date((col.value - 25569) * 86400 * 1000).toISOString().split('T')[0];
                            }

                            if (columns.includes(label)) { //헤더면
                                rowHeaderData[label] = col.value;
                            } else {
                                rowItemData[label] = col.value;
                            }
                        }
                    });

                    // 중복 체크 후 headerData 배열에 추가
                    if (!isDuplicate(headerData, rowHeaderData)) {
                        headerData.push(rowHeaderData);              // 중복이면 빈 배열
                        ITEMDATA[JSON.stringify(rowHeaderData)] = [];
                    }
            
                    // ITEMDATA를 헤더별로 그룹화
                    if (rowItemData) {
                        const rowHeaderDataKey = JSON.stringify(rowHeaderData);
                        if (ITEMDATA[rowHeaderDataKey]) {
                            ITEMDATA[rowHeaderDataKey].push(rowItemData);
                        }
                    }
                });
            });
            
            // 모델에 데이터 설정
            HEADER.setData({ headerData: headerData });
            VIEW.setModel(HEADER, "header");

            // 자재내역, 저장장소
            this.callOdata();
            sap.m.MessageToast.show("업로드되었습니다.");
            this.onCloseDialog();
            
        },

        // item 테이블 바인딩
        onHeaderTableSelect: function () {
            // 선택한 인덱스의 내용
            var oIndex = HEADER_TABLE.getSelectedIndices();
            var oRow = HEADER_TABLE.getContextByIndex(oIndex).getObject();
            var headerKey = JSON.stringify(oRow);
            
            // 전역 변수에서 관련된 아이템 데이터 가져오기
            var filteredItems = ITEMDATA[headerKey] || [];
            ITEM = new JSONModel();

            var itemModel = new sap.ui.model.json.JSONModel({ itemData: filteredItems });
            this.getView().setModel(itemModel, "item");
            
        },

        setViewModel: function () {
            var label = HEADER_TABLE.getColumns();
            console.log(label);

            HEADER_TABLE.getColumns().forEach(function (oColumn) {
                var sLabelText = oColumn.getLabel().getText();

                varPAYLOAD.find(function (item) {
                    return item.label == sLabelText;                    
                })

                var oDataItem = oD

                console.log(sLabelText);
            });


            console.log(oModel);
        },

        // 업로드된 후
        onUploadSetComplete: function (oEvent) {
            var oFileUploader = Fragment.byId("excel_upload", "uploadSet");
            var oItems = oFileUploader.getItems();
            // 하단버튼 활성화
            var oUploadButton = Fragment.byId("excel_upload", "_IDGenButton2");
            var oTempButton = Fragment.byId("excel_upload", "_IDGenButton1");
            oUploadButton.setVisible(true);
            oTempButton.setVisible(false);

            // 업로드 버튼 비활성화(파일1개만 가능)
            oFileUploader.setUploadButtonInvisible(true);
            // 수정 버튼 비활성화
            oItems.forEach(function(oItem) {
                oItem.setVisibleEdit(false);
            });

            var oFile = oFileUploader.getItems()[0].getFileObject();

            var reader = new FileReader();
            var that = this;
			
            this.excelSheetsData = [];

            reader.onload = (e) => {
                let xlsx_content = e.currentTarget.result;
                let workbook = XLSX.read(xlsx_content, { type: 'binary' });
                var excelData = XLSX.utils.sheet_to_row_object_array(workbook.Sheets["Sheet1"]);
                
                workbook.SheetNames.forEach(function (sheetName) {

                    that.excelSheetsData.push(XLSX.utils.sheet_to_row_object_array(workbook.Sheets[sheetName]));
                });
            };
            reader.readAsBinaryString(oFile);

            console.log("Upload Successful");

        },

        // 업로드삭제
        onItemRemoved:function (oEvent) {      
            this.excelSheetsData = [];     
            this.onResetDialog();
        },

        // 팝업초기화
        onResetDialog: function () {
            // 현재 Dialog 닫기 및 파괴
            if (this.pDialog) {
                this.pDialog.close();
                this.pDialog.destroy();
                this.pDialog = null;
            }

            // onExcelUpload 함수 다시 호출하여 Fragment 초기화 및 열기
            this.onExcelUpload();
        },

        /************** OData API ***********************/
        // OData Read -> 자재 내역, 저장 장소 get
        callOdata: function () {
            var that = this;

            var max = {
                $top:"100000"
            };
            
            console.log(ITEMDATA);
            // var pro_filter;

            Object.keys(ITEMDATA).forEach(function(key) {
                ITEMDATA[key].forEach(function(item) {
                    var filter = [
                        new sap.ui.model.Filter("Product", "EQ", item["자재 ID"])
                    ];
                    $.when(
                        that._getODataRead("oPRODES", filter, max)
                    ).done(function(oResults){
                        console.log(oResults);
                    })
                });
            })

        },

        // OData Read
        _getODataRead : function(oModelName, aFilter, aParameters){
            debugger;
            var deferred = $.Deferred();
            var oModelInfo = MODEL_LIST[oModelName];
            
            var oModel = oModelInfo.oModel;
            var oEntitySet = oModelInfo.oEntitySet;

            console.log("여기임");
            console.log(oModelInfo);
            console.log(oModel);
            console.log(oModel.sServiceUrl);  // 서비스 URL 확인


            $.ajax({
                url: oModel.sServiceUrl +oEntitySet,
                async: true,
                contentType: "application/json",
                type: 'GET',
                xhrFields: {
                    withCredentials: true,
                    Accept: "application/json;"
                    
                },
                success: function(data) {
                  console.log('Data:', data);
                },
                error: function(error) {
                  console.error('Error:', error);
                }
              });
              

            // debugger;
            // oModel.read("/ZMMDOC_PRODES", {
            //     filters: aFilter,
            //     urlParameters: aParameters,
            //     success: function (oReturn, response) {
            //         var aResult = oReturn.results;
            //         TOKEN = response.headers["x-csrf-token"];
            //         console.log(TOKEN);
            //         console.log(aResult);
            //         deferred.resolve(aResult);
            //     },
            //     error: function (oError) {
            //         deferred.reject(oError);    //작업 실패 전달
            //         if(oError.responseText){
            //             try {
            //                 var oResponseTextData = JSON.parse(oError.responseText); // 오류 메시지 추출
            //                 console.error("Error Message:", oResponseTextData.error.message.value); // 오류 메시지 표시
            //             } catch (e) {
            //                 console.error("Failed to parse error response", e);
            //             }
            //         } else {
            //             console.error("Error Status:", oError.statusText);
            //         }
            //     }
            // });
            
            return deferred.promise();
        },

        /************** API ***********************/
        // API 요청
        onSaveData: function () {
            var that = this;
            // ITEMDATA : 헤더(key)를 기준으로 아이템(value)가 그룹화되있음
            Object.keys(ITEMDATA).forEach(function(key) {
                //헤더
                var headerInfo = JSON.parse(key);
                var dataList  = [];

                const csrfToken = this.getModel().getSecurityToken();
                console.log(csrfToken);
            
                // 아이템
                ITEMDATA[key].forEach(function(item) {
                    console.log("Item Data:", item);
                    dataList.push(item);
                    console.log("Item Data:", dataList);
                });

                that.requestAPI(headerInfo, dataList);

            });
            
        },

        requestAPI: function (headerInfo, dataList) {
            var apiUrl = 'https://my405699-api.s4hana.cloud.sap/sap/opu/odata/sap/API_MATERIAL_DOCUMENT_SRV/A_MaterialDocumentHeader'
            var sendData;
            
        
        }
    });
});
