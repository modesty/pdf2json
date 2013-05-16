var nodeUtil = require("util"),
    _ = require("underscore"),
    PDFUnit = require('./pdfunit.js');

var PDFField = (function PDFFieldClosure() {
    'use strict';
    // private static
    var _nextId = 1;
    var _name = 'PDFField';

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

    cls.checkRadioGroup = function(boxsets) {
        if (!!cls.currentRadioGroupName) {
            if (cls.currentRadioGroup.length > 0) {
                boxsets.push({boxes:cls.currentRadioGroup, id: { Id: cls.currentRadioGroupName, EN: 0}});
                cls.currentRadioGroup = [];
                cls.currentRadioGroupName = "";
            }
        }
    };

    cls.currentRadioGroup = [];
    cls.currentRadioGroupName = "";

    cls.isWidgetSupported = function(field) {
        var retVal = false;

        switch(field.fieldType) {
            case 'Tx': retVal = true; break; //text input
            case 'Btn':
                if (field.flags & 32768) {
                    field.fieldType = 'Rd'; //radio button
                }
                else if (field.flags & 65536) {
                    field.fieldType = 'Btn'; //push button
                }
                else {
                    field.fieldType = 'Cb'; //checkbox
                }
                retVal = true;
                break;
            case 'Ch': retVal = true; break; //drop down
            default:
                nodeUtil.log(": field.fieldType of " + field.fieldType + " is not supported.");
                break;
        }

        return retVal;
    };

    cls.isFormElement = function(field) {
        var retVal = false;
        switch(field.type) {
            case 'Widget': retVal = cls.isWidgetSupported(field); break;
            default:
                nodeUtil.log(": field.type of " + field.type + " is not supported.");
                break;
        }
        return retVal;
    };

    var _getFieldPosition = function(field) {
        var viewPort = this.viewport;
        var fieldRect = viewPort.convertToViewportRectangle(field.rect);
        var rect = _normalizeRect(fieldRect);

        if (field.fieldType === 'Tx') {
            rect[1] += 3;
        }
        else if (field.fieldType !== 'Ch') { //checkbox, radio button, and link button
            rect[1] -= 3;
        }

        var height = rect[3] - rect[1];
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
        if (field.flags & 0x00000001) {
            attributeMask |= kFBANotOverridable;
        }
        else if (field.flags & 0x00000010) {
            attributeMask |= kFBARequired;
        }

        return _.extend({
            id: { Id: field.fullName, EN: 0},
            TI: 0,
            AM: attributeMask
        }, _getFieldPosition.call(this, field));
    };

    var _addAlpha = function(field) {
        var anData = _.extend({
            style: 48,
            T: {
                Name: field.TName || "alpha",
                TypeInfo: {}
            }
        }, _getFieldBaseData.call(this, field));

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

        if (!!cls.currentRadioGroupName && (cls.currentRadioGroupName !== box.fullName)) {
            cls.checkRadioGroup(this.Boxsets);
        }
        cls.currentRadioGroup.push(anData);
        cls.currentRadioGroupName = box.fullName;
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
        if (this.field.fieldType !== 'Rd') {
            cls.checkRadioGroup(this.Boxsets);
        }

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

    return cls;
})();

module.exports = PDFField;

