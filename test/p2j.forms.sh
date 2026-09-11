#!/usr/bin/env bash
STARTTIME=$(date +%s)
AGENCIES=("dc" "de" "ef" "fd" "nd" "or" "pa" "sc" "va")
FAILED_AGENCIES=()
for i in "${AGENCIES[@]}"
do
	bash ./p2j.one.sh "$i" form "Expected: NO Exception, All Parsed OK"
	STATUS=$?
	if [ $STATUS -ne 0 ]; then
		FAILED_AGENCIES+=("$i")
	fi
done

ENDTIME=$(date +%s)
echo "It takes $(($ENDTIME - $STARTTIME)) seconds to process all PDFs ..."

if [ ${#FAILED_AGENCIES[@]} -ne 0 ]; then
	echo "ERROR: Parsing failed for agencies: ${FAILED_AGENCIES[*]}"
	exit 1
fi

