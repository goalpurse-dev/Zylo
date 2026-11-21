#!/usr/bin/env bash
# Zyvo Studio Kit: THE CONTACT SHEET (reference/recording.md step 5). The stills -> labelled 9:16 tiles -> sheets of
# 24 (8 a row, 3 rows), so the user approves every shot at a glance.
#   bash contact_sheet.sh <list.tsv> <out folder>
# list.tsv: one line per shot, TAB-separated: <shot number> <the still's image file> <label line 1> <label line 2>
#   e.g. "12<TAB>C:/.../blob-1795.jpg<TAB>#12  14.2-15.6s<TAB>But I had ten seconds"
#   A shot that reuses another shot's still (preview P.plan "REUSE") simply lists that same image file.
# Each still is cropped to its centre 9:16 (the shot's real frame: the capture was taken at the shot's lens), scaled
# to 270x480 and labelled. Free and local (ffmpeg only). Prints the sheet files it wrote.
set -euo pipefail
export LC_ALL=C
LIST="${1:?list.tsv}"; OUTDIR="${2:?out folder}"
[ -f "$LIST" ] || { echo "not found: $LIST" >&2; exit 2; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is missing (the kit's setup step installs it)" >&2; exit 3; }
mkdir -p "$OUTDIR"
# a relative temp folder: Windows ffmpeg can't open Git Bash's /tmp, and a relative path needs no escaping in a filter
TMP=".zyvo_sheet_$$"; mkdir -p "$TMP"; trap 'rm -rf "./.zyvo_sheet_$$"' EXIT

# a bold font, copied next to the tiles (a relative path needs no escaping in a filter); none found = no labels
FONT=""
for f in "${WINDIR:-C:/Windows}/Fonts/arialbd.ttf" /c/Windows/Fonts/arialbd.ttf "/System/Library/Fonts/Supplemental/Arial Bold.ttf" \
	"/Library/Fonts/Arial Bold.ttf" /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf; do
	if [ -f "$f" ]; then cp "$f" "$TMP/font.ttf"; FONT="$TMP/font.ttf"; break; fi
done

n=0
tiles=()
while IFS=$'\t' read -r k img l1 l2; do
	[ -n "${k:-}" ] || continue
	case "$k" in \#*) continue ;; esac
	[ -f "$img" ] || { echo "shot $k: no image $img" >&2; continue; }
	printf '%s' "${l1:-#$k}" > "$TMP/a_$k.txt"
	printf '%s' "${l2:-}" > "$TMP/b_$k.txt"
	vf="crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)',scale=270:480"
	if [ -n "$FONT" ]; then
		vf+=",drawbox=y=0:w=iw:h=52:color=black@0.65:t=fill"
		vf+=",drawtext=fontfile=$FONT:textfile=$TMP/a_$k.txt:x=8:y=6:fontsize=20:fontcolor=white"
		vf+=",drawtext=fontfile=$FONT:textfile=$TMP/b_$k.txt:x=8:y=30:fontsize=14:fontcolor=0xFFD86A"
	fi
	ffmpeg -v error -y -i "$img" -vf "$vf" -frames:v 1 "$TMP/t_$(printf '%03d' "$n").png"
	tiles+=("$TMP/t_$(printf '%03d' "$n").png")
	n=$((n + 1))
done < <(tr -d '\r' < "$LIST")
[ "$n" -gt 0 ] || { echo "no stills in $LIST" >&2; exit 4; }

PER=24; COLS=8; sheet=0
for ((s = 0; s < n; s += PER)); do
	sheet=$((sheet + 1))
	args=(-v error -y)
	cnt=0
	for ((j = s; j < n && j < s + PER; j++)); do args+=(-i "${tiles[$j]}"); cnt=$((cnt + 1)); done
	out="$OUTDIR/sheet_$sheet.jpg"
	if [ "$cnt" -eq 1 ]; then
		ffmpeg "${args[@]}" -frames:v 1 "$out"
	else
		layout=""; ins=""
		for ((j = 0; j < cnt; j++)); do
			layout+="$((j % COLS * 270))_$((j / COLS * 480))"; [ "$j" -lt $((cnt - 1)) ] && layout+="|"
			ins+="[$j:v]"
		done
		ffmpeg "${args[@]}" -filter_complex "${ins}xstack=inputs=$cnt:layout=$layout:fill=black" -frames:v 1 "$out"
	fi
	echo "$out ($cnt shots)"
done
