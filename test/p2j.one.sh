#!/usr/bin/env bash
IN_DIR_BASE=./pdf/
OUT_DIR_BASE=./target/
DATA_DIR_BASE=./data/
PDF2JSON=../pdf2json.js
AGENCY_NAME=$1

echo "-----------------------------------------------------"
echo "Clean up existing $AGENCY_NAME JSON"
echo "-----------------------------------------------------"
rm -rfv $OUT_DIR_BASE$AGENCY_NAME/

echo "-----------------------------------------------------"
echo "Update $AGENCY_NAME PDF"
echo "-----------------------------------------------------"
mkdir -p $OUT_DIR_BASE$AGENCY_NAME/form/
node $PDF2JSON -f $IN_DIR_BASE$AGENCY_NAME/form/ -o $OUT_DIR_BASE$AGENCY_NAME/form/ -s -t -c
diff -rq $OUT_DIR_BASE$AGENCY_NAME/form/ $DATA_DIR_BASE$AGENCY_NAME/form/

echo "-----------------------------------------------------"
echo "All JSON and PDF are updated for $AGENCY_NAME"
echo "-----------------------------------------------------"
