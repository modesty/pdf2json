#!/bin/bash
STARTTIME=$(date +%s)
AGENCIES=$("dc" "de" "ef" "fd" "nd" "or" "pa" "sc" "va")
for i in "${AGENCIES[@]}"
do
	sh ./p2j.one.sh $i
done
ENDTIME=$(date +%s)
echo "It takes $(($ENDTIME - $STARTTIME)) seconds to process all PDFs ..."
