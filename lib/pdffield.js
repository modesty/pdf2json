var nodeUtil = require("util"),
    _ = require("underscore"),
    PDFUnit = require('./pdfunit.js');

var PDFField = (function PDFFieldClosure() {
    'use strict';
    // private static
    var _nextId = 1;
    var _name = 'PDFField';
    var _tabIndex = 0;

    var kFBANotOverridable = 0x00000400; // indicates the field is read only by the user
    var kFBARequired = 0x00000010; // indicates the field is required
    var kMinHeight = 20;

    // constructor
    var cls = function (field, viewport, Fields, Boxsets) {
        // private
        var _id = _nextId++;

        // public (every instance will have their own copy of these methods, needs to be lightweight)
        this.get_id = function() { return _id; };
        this.get_name = function() { return _name + _id; };

        this.field = field;
        this.viewport = viewport;
        this.Fields = Fields;
        this.Boxsets = Boxsets;
    };

    // Normalize rectangle rect=[x1, y1, x2, y2] so that (x1,y1) < (x2,y2)
    // For coordinate systems whose origin lies in the bottom-left, this
    // means normalization to (BL,TR) ordering. For systems with origin in the
    // top-left, this means (TL,BR) ordering.
    var _normalizeRect = function(rect) {
        var r = rect.slice(0); // clone rect
        if (rect[0] > rect[2]) {
            r[0] = rect[2];
            r[2] = rect[0];
        }
        if (rect[1] > rect[3]) {
            r[1] = rect[3];
            r[3] = rect[1];
        }
        return r;
    };

    // public static
    cls.get_nextId = function () {
        return _name + _nextId;
    };

    cls.isWidgetSupported = function(field) {
        var retVal = false;

        switch(field.fieldType) {
            case 'Tx': retVal = true; break; //text input
            case 'Btn':
                if (field.fieldFlags & 32768) {
                    field.fieldType = 'Rd'; //radio button
                }
                else if (field.fieldFlags & 65536) {
                    field.fieldType = 'Btn'; //push button
                }
                else {
                    field.fieldType = 'Cb'; //checkbox
                }
                retVal = true;
                break;
            case 'Ch': retVal = true; break; //drop down
            default:
                nodeUtil.p2jwarn("Unsupported: field.fieldType of " + field.fieldType);
                break;
        }

        return retVal;
    };

    cls.isFormElement = function(field) {
        var retVal = false;
        switch(field.subtype) {
            case 'Widget': retVal = cls.isWidgetSupported(field); break;
            default:
                nodeUtil.p2jwarn("Unsupported: field.type of " + field.subtype);
                break;
        }
        return retVal;
    };

    var _getFieldPosition = function(field) {
        var viewPort = this.viewport;
        var fieldRect = viewPort.convertToViewportRectangle(field.rect);
        var rect = _normalizeRect(fieldRect);

        var height = rect[3] - rect[1];
        if (field.fieldType === 'Tx') {
            if (height > kMinHeight + 2) {
                rect[1] += 2;
                height -= 2;
            }
        }
        else if (field.fieldType !== 'Ch') { //checkbox, radio button, and link button
            rect[1] -= 3;
        }

        height = (height >= kMinHeight) ? height : kMinHeight;

        return {
            x: PDFUnit.toFormX(rect[0]),
            y: PDFUnit.toFormY(rect[1]),
            w: PDFUnit.toFormX(rect[2] - rect[0]),
            h: PDFUnit.toFormY(height)
        };
    };

    var _getFieldBaseData = function(field) {
        var attributeMask = 0;
        //PDF Spec p.676 TABLE 8.70 Field flags common to all field types
        if (field.fieldFlags & 0x00000001) {
            attributeMask |= kFBANotOverridable;
        }
        if (field.fieldFlags & 0x00000002) {
            attributeMask |= kFBARequired;
        }

        var anData = {
            id: { Id: field.fullName, EN: 0},
            TI: field.TI,
            AM: attributeMask
        };
        //PDF Spec p.675: add TU (AlternativeText) fields to provide accessibility info
        if (field.alternativeText && field.alternativeText.length > 1) {
            anData.TU = field.alternativeText;
        }

        return _.extend(anData, _getFieldPosition.call(this, field));
    };

    var _addAlpha = function(field) {
        var anData = _.extend({
            style: 48,
            T: {
                Name: field.TName || "alpha",
                TypeInfo: {}
            }
        }, _getFieldBaseData.call(this, field));

        if (field.MV) { //field attributes: arbitrary mask value
            anData.MV = field.MV;
        }
        if (field.fieldValue) {
            anData.V = field.fieldValue; //read-only field value, like "self-prepared"
        }

        this.Fields.push(anData);
    };

    var _addCheckBox = function(box) {
        var anData = _.extend({
            style: 48,
            T: {
                Name: "box",
                TypeInfo: {}
            }
        }, _getFieldBaseData.call(this, box));

        this.Boxsets.push({boxes:[anData]});
    };

    var _addRadioButton = function(box) {
        var anData = _.extend({
            style: 48,
            T: {
                Name: "box",
                TypeInfo: {}
            }
        }, _getFieldBaseData.call(this, box));

        anData.id.Id = box.value;
        if (_.has(box, 'checked')) {
            anData.checked = box.checked;
        }

        var rdGroup = _.find(this.Boxsets, function(boxset) {
             return _.has(boxset, 'id') && _.has(boxset.id, 'Id') && (boxset.id.Id === box.fullName);
        });

        if ((!!rdGroup) && (_.has(rdGroup, 'boxes'))) {
            rdGroup.boxes.push(anData);
        }
        else {
            this.Boxsets.push({boxes:[anData], id: { Id: box.fullName, EN: 0}});
        }
    };

    var _addLinkButton = function(field) {
        var anData = _.extend({
            style: 48,
            T: {
                Name: "link"
            },
            FL: {
                form: {Id: field.FL}
            }
        }, _getFieldBaseData.call(this, field));

        this.Fields.push(anData);
    };

    var _addSelect = function(field) {
        var anData = _.extend({
            style: 48,
            T: {
                Name: "alpha",
                TypeInfo: {}
            }
        }, _getFieldBaseData.call(this, field));

        anData.w -= 0.5; //adjust combobox width
        anData.PL = {V: [], D: []};
        _.each(field.value, function(ele, idx) {
            anData.PL.D.push(ele[0]);
            anData.PL.V.push(ele[1]);
        });

        this.Fields.push(anData);
    };

    // public (every instance will share the same method, but has no access to private fields defined in constructor)
    cls.prototype.processField = function () {

        this.field.TI = _tabIndex++;

        switch(this.field.fieldType) {
            case 'Tx': _addAlpha.call(this, this.field); break;
            case 'Cb': _addCheckBox.call(this, this.field); break;
            case 'Rd': _addRadioButton.call(this, this.field);break;
            case 'Btn':_addLinkButton.call(this, this.field); break;
            case 'Ch': _addSelect.call(this, this.field); break;
        }

        this.clean();
    };

    cls.prototype.clean = function() {
        delete this.get_id;
        delete this.get_name;

        delete this.field;
        delete this.viewport;
        delete this.Fields;
        delete this.Boxsets;
    };

    //static public method to generate fieldsType object based on parser result
    cls.getAllFieldsTypes = function(data) {

        function isFieldReadOnly(field) {
            return (field.AM & kFBANotOverridable) ? true : false;
        }

        function getFieldBase(field) {
            return {id: field.id.Id, type: field.T.Name, calc: isFieldReadOnly(field), value: field.V || ""};
        }

        var retVal = [];

        _.each(data.Pages, function(page) {
            _.each(page.Boxsets, function(boxsets) {
                if (boxsets.boxes.length > 1) { //radio button
                    _.each(boxsets.boxes, function(box) {
                        retVal.push({id: boxsets.id.Id, type: "radio", calc: isFieldReadOnly(box), value: box.id.Id});
                    });
                }
                else { //checkbox
                    retVal.push(getFieldBase(boxsets.boxes[0]));
                }
            });

            _.each(page.Fields, function(field){
                retVal.push(getFieldBase(field));
            });
        });
        return retVal;
    };

    return cls;
})();

module.exports = PDFField;

