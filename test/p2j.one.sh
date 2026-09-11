#!/usr/bin/env bash
IN_DIR_BASE=./pdf
OUT_DIR_BASE=./target
DATA_DIR_BASE=./data
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
node $PDF2JSON -f $IN_DIR_BASE/$AGENCY_NAME/$FORM_BASE -o $OUT_DIR_BASE/$AGENCY_NAME/$FORM_BASE -s -t -c -m
PARSER_EXIT=$?

if [ "$AGENCY_NAME" = "misc" ]; then
	if [ $PARSER_EXIT -ne 1 ]; then
		echo "ERROR: Expected exit code 1 for misc, got $PARSER_EXIT"
		exit 1
	fi
else
	if [ $PARSER_EXIT -ne 0 ]; then
		echo "ERROR: PDF parsing failed for $AGENCY_NAME with exit code $PARSER_EXIT"
		exit 1
	fi
fi

# Baseline diff disabled: test/data contains legacy v0.6.8 structures ({formImage}) and lacks .merged.json; structured equivalence is validated via test/_test_.cjs
# diff -rq $OUT_DIR_BASE/$AGENCY_NAME/$FORM_BASE/ $DATA_DIR_BASE/$AGENCY_NAME/$FORM_BASE/

echo "-----------------------------------------------------"
echo "$IN_DIR_BASE/$AGENCY_NAME/$FORM_BASE : $EXPECTED_RESULT"
echo "-----------------------------------------------------"

