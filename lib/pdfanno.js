var nodeUtil = require("util"),
    _ = require("underscore"),
    PDFUnit = require('./pdfunit.js');

var PDFAnno = (function PDFAnnoClosure() {
    'use strict';

    //BEGIN - MQZ 9/19/2012. Helper functions to parse acroForm elements
    function setupRadioButton(annotation, item) {
        var asName = '';
        //PDF Spec p.689: parent item's DV holds the item's value that is selected by default
        var po = annotation.get('Parent');
        if (po) {
            po.forEach(function(key, val){
                if (key === 'DV') {
                    asName = val.name || '';
                }
            });
        }

        //PDF Spec p.606: get appearance dictionary
        var ap = annotation.get('AP');
        //PDF Spec p.614 get normal appearance
        var nVal = ap.get('N');
        //PDF Spec p.689
        nVal.forEach(function (key, value) {
            if (key.toLowerCase() != "off") {
                //value if selected
                item.value = key; //export value
                item.checked = (key === asName); //initial selection state
            }
        });

        if (!item.value)
            item.value = "off";
    }

    function setupPushButton(annotation, item) {
        //button label: PDF Spec p.640
        var mk = annotation.get('MK');
        item.value = mk.get('CA') || '';

        //button action: url when mouse up: PDF Spec:p.642
        item.FL = "";
        var ap = annotation.get('A');
        if (ap) {
            var sp = ap.get('S');
            item.FL = ap.get(sp.name);
        }
    }

    function setupCheckBox(annotation, item) {
        //PDF Spec p.606: get appearance dictionary
        var ap = annotation.get('AP');
        //PDF Spec p.614 get normal appearance
        var nVal = ap.get('N');

        //PDF Spec p.689
        var i = 0;
        nVal.forEach(function (key, value) {
            i++;
            if (i == 1) //initial selection state
                item.value = key;
        });
    }

    function setupDropDown(annotation, item) {
        //PDF Spec p.688
        item.value = annotation.get('Opt') || [];
    }

    function setupFieldAttributes(annotation, item) {
        //MQZ. Jan.03.2013. additional-actions dictionary
        //PDF Spec P.648. 8.5.2. Trigger Events
        var aa = annotation.get('AA');
        if (!aa) {
            return;
        }

        //PDF Spec p.651 get format dictionary
        var nVal = aa.get('F');
        if (!nVal) {
            nVal = aa.get('K');
            if (!nVal)
                return;
        }

        nVal.forEach(function (key, value) {
            if (key === "JS") {
                processFieldAttribute(value, item);
            }
        });
    }

    var AFSpecial_Format = ['zip', 'zip', 'phone', 'ssn', ''];
//  var AFNumber_Format = ['nDec', 'sepStyle', 'negStyle', 'currStyle', 'strCurrency', 'bCurrencyPrepend'];
    //– nDec is the number of places after the decimal point;
    //– sepStyle is an integer denoting whether to use a separator or not. If sepStyle=0, use commas. If sepStyle=1, do not separate.
    //– negStyle is the formatting used for negative numbers: 0 = MinusBlack, 1 = Red, 2 = ParensBlack, 3 = ParensRed
    //– currStyle is the currency style - not used
    //- strCurrency is the currency symbol
    //– bCurrencyPrepend
//  var AFDate_FormatEx = ["m/d", "m/d/yy", "mm/dd/yy", "mm/yy", "d-mmm", "d-mmm-yy", "dd-mmm-yy", "yymm-dd", "mmm-yy", "mmmm-yy", "mmm d, yyyy", "mmmm d, yyyy", "m/d/yy h:MM tt", "m/d/yy HH:MM"];

    function processFieldAttribute(jsFuncName, item) {
        if (item.hasOwnProperty('TName'))
            return;

        var vParts = jsFuncName.split('(');
        if (vParts.length !== 2)
            return;

        var funcName = vParts[0];
        var funcParam = vParts[1].split(')')[0];

        switch (funcName) {
            case 'AFSpecial_Format':
                item.TName = AFSpecial_Format[Number(funcParam)];
                break;
            case 'AFNumber_Format':
//              nfs = funcParam.split(',');
//set the Money fields to use the Number type with no decimal places after, no commas, and bCurrencyPrepend is set as true; (o use a negative sign (fits the PDF layout and our print formatting as well).
//              if (nfs[0] === '0' && nfs[1] === '1' && nfs[5])
//                  item.TName = 'money';
//              else
                item.TName = 'number';
                break;
            case 'AFDate_FormatEx':
                item.TName = 'date';
                item.MV = funcParam.replace(/^'+|^"+|'+$|"+$/g,''); //mask value
                break;
            case 'AFSpecial_KeystrokeEx': //special format: "arbitrary mask"
                var maskValue = funcParam.replace(/^'+|^"+|'+$|"+$/g,''); //mask value
                if ((!!maskValue) && maskValue.length > 0 && maskValue.length < 64) {
                    item.TName = 'mask'; //fixed length input
                    item.MV = maskValue;
                }
                break;
            case 'AFPercent_Format':
                item.TName = 'percent'; //funcParam => 2, 0, will specified how many decimal places
                break;
        }
    }

    //END - MQZ 9/19/2012. Helper functions to parse acroForm elements

    // private static
    var _nextId = 1;
    var _name = 'PDFAnno';

    // constructor
    var cls = function (field, viewport, Fields, Boxsets) {
        // private
        var _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function () {
            return _id;
        };
        this.get_name = function () {
            return _name + _id;
        };
    };

    cls.prototype.clean = function () {
        delete this.get_id;
        delete this.get_name;
    };

    // public static
    cls.get_nextId = function () {
        return _name + _nextId;
    };

    cls.processAnnotation = function (annotation, item) {
        if (item.fieldType == 'Btn') { //PDF Spec p.675
            if (item.fieldFlags & 32768) {
                setupRadioButton(annotation, item);
            }
            else if (item.fieldFlags & 65536) {
                setupPushButton(annotation, item);
            }
            else {
                setupCheckBox(annotation, item);
            }
        }
        else if (item.fieldType == 'Ch') {
            setupDropDown(annotation, item);
        }
        else if (item.fieldType == 'Tx') {
            setupFieldAttributes(annotation, item);
        }
    };

    return cls;
})();

module.exports = PDFAnno;

