#!/usr/bin/env bash
STARTTIME=$(date +%s)
# AGENCIES=("dc" "de" "ef" "fd" "nd" "or" "pa" "sc" "va")
# for i in "${AGENCIES[@]}"
# do
# 	sh ./p2j.one.sh $i
# done

# try doing it manually. Maybe travis ci doesn't support bash arrays?
sh ./p2j.one.sh dc
sh ./p2j.one.sh de
sh ./p2j.one.sh ef
sh ./p2j.one.sh fd
sh ./p2j.one.sh nd
sh ./p2j.one.sh or
sh ./p2j.one.sh pa
sh ./p2j.one.sh sc
sh ./p2j.one.sh va

ENDTIME=$(date +%s)
echo "It takes $(($ENDTIME - $STARTTIME)) seconds to process all PDFs ..."
