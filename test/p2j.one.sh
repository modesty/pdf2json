#!/usr/bin/env bash
IN_DIR_BASE=./pdf
OUT_DIR_BASE=./target
PDF2JSON=../bin/pdf2json.js
AGENCY_NAME=$1
FORM_BASE=$2
EXPECTED_RESULT=$3

echo "-----------------------------------------------------"
echo "Clean up existing $AGENCY_NAME JSON"
echo "-----------------------------------------------------"
rm -rfv $OUT_DIR_BASE/$AGENCY_NAME

echo "-----------------------------------------------------"
echo "Update $AGENCY_NAME PDF"
echo "-----------------------------------------------------"
mkdir -p $OUT_DIR_BASE/$AGENCY_NAME/$FORM_BASE
PARSER_OUT=$(node $PDF2JSON -f $IN_DIR_BASE/$AGENCY_NAME/$FORM_BASE -o $OUT_DIR_BASE/$AGENCY_NAME/$FORM_BASE -s -t -c -m 2>&1)
PARSER_EXIT=$?
printf '%s\n' "$PARSER_OUT"

if [ "$AGENCY_NAME" = "misc" ]; then
	if [ $PARSER_EXIT -ne 1 ]; then
		echo "ERROR: Expected exit code 1 for misc, got $PARSER_EXIT"
		exit 1
	fi
	if [[ "$PARSER_OUT" =~ ([0-9]+)[[:space:]]+input[[:space:]]+files[[:space:]]+([0-9]+)[[:space:]]+success[[:space:]]+([0-9]+)[[:space:]]+fail ]]; then
		SUCCESS="${BASH_REMATCH[2]}"
		FAIL="${BASH_REMATCH[3]}"
		if [ "$SUCCESS" -ne 16 ] || [ "$FAIL" -ne 6 ]; then
			echo "ERROR: Expected 16 success, 6 fail for misc, got $SUCCESS success, $FAIL fail"
			exit 1
		fi
	else
		echo "ERROR: Could not parse success/failure summary for misc"
		exit 1
	fi
else
	if [ $PARSER_EXIT -ne 0 ]; then
		echo "ERROR: PDF parsing failed for $AGENCY_NAME with exit code $PARSER_EXIT"
		exit 1
	fi
fi

echo "-----------------------------------------------------"
echo "$IN_DIR_BASE/$AGENCY_NAME/$FORM_BASE : $EXPECTED_RESULT"
echo "-----------------------------------------------------"

