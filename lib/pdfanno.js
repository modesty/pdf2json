import nodeUtil from "util";

//BEGIN - MQZ 9/19/2012. Helper functions to parse acroForm elements
function setupRadioButton(annotation, item) {
    //let asName = '';
    //PDF Spec p.689: parent item's DV holds the item's value that is selected by default
    const po = annotation.get('Parent');
    if (po) {
        po.forEach((key, val) => {
            if (key === 'DV') {
                //asName = val.name || '';
            }
            else if (key === 'TU') {
                //radio buttons use the alternative text from the parent
                item.alternativeText = val;
            } else if( key === 'TM') {
                item.alternativeID   = val;
            }
        });
    }

    //PDF Spec p.606: get appearance dictionary
    const ap = annotation.get('AP');
    //PDF Spec p.614 get normal appearance
    const nVal = ap.get('N');
    //PDF Spec p.689
    nVal.forEach((key, value) => {
        if (key.toLowerCase() !== "off") {
            //value if selected
            item.value = key; //export value
            
            item.checked = (item.fieldValue === item.value); //initial selection state
        }
    });

    if (!item.value)
        item.value = "off";
}

function setupPushButton(annotation, item) {
    //button label: PDF Spec p.640
    const mk = annotation.get('MK');
    if(mk) {
        item.value = mk.get('CA') || '';
    }

    //button action: url when mouse up: PDF Spec:p.642
    item.FL = "";
    const ap = annotation.get('A');
    if (ap) {
        const sp = ap.get('S');
        item.FL = ap.get(sp.name);
    }
}

function setupCheckBox(annotation, item) {
    //PDF Spec p.606: get appearance dictionary
    const ap = annotation.get('AP');
    //PDF Spec p.614 get normal appearance
    const nVal = ap.get('N');

    //PDF Spec p.689
    let i = 0;
    nVal.forEach((key, value) => {
        i++;
        if (i === 1) //initial selection state
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
    const aa = annotation.get('AA');
    if (!aa) {
        return;
    }

    //PDF Spec p.651 get format dictionary
    let nVal = aa.get('F');
    if (!nVal) {
        nVal = aa.get('K');
        if (!nVal)
            return;
    }

    nVal.forEach((key, value) => {
        if (key === "JS") {
            processFieldAttribute(value, item);
        }
    });
}

const AFSpecialFormat = ['zip', 'zip', 'phone', 'ssn', ''];
//  let AFNumber_Format = ['nDec', 'sepStyle', 'negStyle', 'currStyle', 'strCurrency', 'bCurrencyPrepend'];
//– nDec is the number of places after the decimal point;
//– sepStyle is an integer denoting whether to use a separator or not. If sepStyle=0, use commas. If sepStyle=1, do not separate.
//– negStyle is the formatting used for negative numbers: 0 = MinusBlack, 1 = Red, 2 = ParensBlack, 3 = ParensRed
//– currStyle is the currency style - not used
//- strCurrency is the currency symbol
//– bCurrencyPrepend
//  let AFDate_FormatEx = ["m/d", "m/d/yy", "mm/dd/yy", "mm/yy", "d-mmm", "d-mmm-yy", "dd-mmm-yy", "yymm-dd", "mmm-yy", "mmmm-yy", "mmm d, yyyy", "mmmm d, yyyy", "m/d/yy h:MM tt", "m/d/yy HH:MM"];

function processFieldAttribute(jsFuncName, item) {
    if (Object.prototype.hasOwnProperty.call(item, 'TName'))
        return;

    if(!jsFuncName.split)
        return;

    const vParts = jsFuncName.split('(');
    if (vParts.length !== 2)
        return;

    const funcName = vParts[0];
    const funcParam = vParts[1].split(')')[0];

	switch (funcName) {
		case 'AFSpecial_Format':
			item.TName = AFSpecialFormat[Number(funcParam)];
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
			item.MV = funcParam.replace(/^'+|^"+|'+$|"+$/g, ''); //mask value
			break;
		case 'AFSpecial_KeystrokeEx': { //special format: "arbitrary mask"
				const maskValue = funcParam.replace(/^'+|^"+|'+$|"+$/g, ''); //mask value
				if ((!!maskValue) && maskValue.length > 0 && maskValue.length < 64) {
					item.TName = 'mask'; //fixed length input
					item.MV = maskValue;
				}
			}
            break;
        case 'AFPercent_Format':
            item.TName = 'percent'; //funcParam => 2, 0, will specified how many decimal places
            break;
    }
}

function setupSignature(annotation, item) {
    //PDF Spec p.695: field value is signature dict if signed
    const sig = annotation.get('V');
    if (!sig) return;

    //PDF Spec p.728: get signature information
    item.Sig = {};
    const name = sig.get('Name');
    if (name) item.Sig.Name = name;
    const time = sig.get('M');
    if (time) item.Sig.M = time;
    const location = sig.get('Location');
    if (location) item.Sig.Location = location;
    const reason = sig.get('Reason');
    if (reason) item.Sig.Reason = reason;
    const contactInfo = sig.get('ContactInfo');
    if (contactInfo) item.Sig.ContactInfo = contactInfo;
}

//END - MQZ 9/19/2012. Helper functions to parse acroForm elements

export default class PDFAnno {
    static processAnnotation(annotation, item) {
        if (item.fieldType === 'Btn') { //PDF Spec p.675
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
        else if (item.fieldType ===  'Ch') {
            setupDropDown(annotation, item);
        }
        else if (item.fieldType === 'Tx') {
            setupFieldAttributes(annotation, item);
        }
        else if (item.fieldType === 'Sig') {
            setupSignature(annotation, item);
        }
        else {
            nodeUtil.p2jwarn("Unknown fieldType: ", item);
        }
    }
}
