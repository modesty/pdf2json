#!/usr/bin/env bash
IN_DIR_BASE=./pdf
OUT_DIR_BASE=./target
DATA_DIR_BASE=./data
PDF2JSON=../pdf2json.js
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
node --trace-deprecation --trace-warnings $PDF2JSON -f $IN_DIR_BASE/$AGENCY_NAME/$FORM_BASE -o $OUT_DIR_BASE/$AGENCY_NAME/$FORM_BASE -s -t -c -m
# diff -rq $OUT_DIR_BASE$AGENCY_NAME/$FORM_BASE/ $DATA_DIR_BASE$AGENCY_NAME/$FORM_BASE/

echo "-----------------------------------------------------"
echo "$IN_DIR_BASE/$AGENCY_NAME/$FORM_BASE : $EXPECTED_RESULT"
echo "-----------------------------------------------------"
