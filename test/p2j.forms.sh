#!/usr/bin/env bash
STARTTIME=$(date +%s)
AGENCIES=("dc" "de" "ef" "fd" "nd" "or" "pa" "sc" "va")
for i in "${AGENCIES[@]}"
do
	sh ./p2j.one.sh $i form "Expected: NO Exception, All Parsed OK"
done

# Travis CI doesn't seem to support arrays in bash for testing. 
# Reverting to a bunch of commands so that build button can be shown.
# sh ./p2j.one.sh dc
# sh ./p2j.one.sh de
# sh ./p2j.one.sh ef
# sh ./p2j.one.sh fd
# sh ./p2j.one.sh nd
# sh ./p2j.one.sh or
# sh ./p2j.one.sh pa
# sh ./p2j.one.sh sc
# sh ./p2j.one.sh va

ENDTIME=$(date +%s)
echo "It takes $(($ENDTIME - $STARTTIME)) seconds to process all PDFs ..."
