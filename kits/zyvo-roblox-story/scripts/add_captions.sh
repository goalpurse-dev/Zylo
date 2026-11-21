#!/usr/bin/env bash
# Zyvo Studio Kit: the FREE finish. The upright 9:16 video + the voice -> a postable video with simple white
# one-word captions (one word on screen at a time, timed to the voice).
#   bash add_captions.sh <video_9x16.mp4> <voice.mp3> <words.json | narration.txt> <out.mp4> [end card seconds]
# End card (Free and Starter plans, or Zyvo not connected; SKILL.md step 8): give its length (2). The video then runs
# to its own end (the end card shot after the voice) and its last <seconds> get the words "Made with Zyvo AI" and
# "tryzyvo.com" in the top third, over the cast line-up; the voice is padded with silence under it.
# Timings:
#   words.json      exact (a Zyvo voice: [{ "word": "...", "start": 0.12, "end": 0.40 }, ...], seconds)
#   narration.txt   estimated: the text's words are lined up with the pauses ffmpeg hears in the voice (each
#                   stretch of speech gets the words that fit its length, breaking after punctuation where it can),
#                   then spread over that stretch by their length. Close enough for one-word captions; a word can
#                   land a little early or late inside a sentence.
# Free and local (ffmpeg + awk only). Nothing is uploaded. Zyvo's Finish my video is the pro version: our voice,
# coloured captions per speaker, sound effects and a mixed music bed.
set -euo pipefail
export LC_ALL=C
VIDEO="${1:?video}"; VOICE="${2:?voice}"; TEXT="${3:?words.json or narration.txt}"; OUT="${4:?out.mp4}"; ENDCARD="${5:-0}"
for f in "$VIDEO" "$VOICE" "$TEXT"; do [ -f "$f" ] || { echo "not found: $f" >&2; exit 2; }; done
command -v ffmpeg >/dev/null || { echo "ffmpeg is missing (the kit's setup step installs it)" >&2; exit 3; }
# a relative temp folder: Windows ffmpeg can't open Git Bash's /tmp, and a relative path needs no escaping in a filter
TMP=".zyvo_captions_$$"; mkdir -p "$TMP"; trap 'rm -rf "./.zyvo_captions_$$"' EXIT

DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VOICE")"
VDUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO")"

# ---------------------------------------------------------------- 1. word timings -> $TMP/words.tsv (start end word)
case "$TEXT" in
*.json)
	# a flat list of { "word", "start", "end" } objects (the Zyvo voice's words.json)
	tr -d '\r\n' < "$TEXT" | tr '}' '\n' | awk '
		{
			w = ""; s = ""; e = ""
			if (match($0, /"word"[ \t]*:[ \t]*"[^"]*"/)) { w = substr($0, RSTART, RLENGTH); sub(/^"word"[ \t]*:[ \t]*"/, "", w); sub(/"$/, "", w) }
			if (match($0, /"start"[ \t]*:[ \t]*[-0-9.eE+]+/)) { s = substr($0, RSTART, RLENGTH); sub(/^"start"[ \t]*:[ \t]*/, "", s) }
			if (match($0, /"end"[ \t]*:[ \t]*[-0-9.eE+]+/)) { e = substr($0, RSTART, RLENGTH); sub(/^"end"[ \t]*:[ \t]*/, "", e) }
			if (w != "" && s != "" && e != "") printf "%.3f\t%.3f\t%s\n", s, e, w
		}' > "$TMP/words.tsv"
	MODE="exact (words.json)"
	;;
*)
	# the pauses in the voice: quieter than the voice's average by 8 dB (so a quiet or a loud file both work), 0.15 s+
	MEAN="$(ffmpeg -v info -nostats -i "$VOICE" -af volumedetect -f null - 2>&1 | grep -o 'mean_volume: *-\{0,1\}[0-9.]*' | grep -o -- '-\{0,1\}[0-9.]*$' || true)"
	NOISE="$(awk -v m="${MEAN:--22}" -v d="${ZYVO_CAP_BELOW:-8}" 'BEGIN { n = m - d; if (n < -55) n = -55; if (n > -15) n = -15; printf "%.1f", n }')"
	NOISE="${ZYVO_CAP_NOISE:-$NOISE}"
	ffmpeg -v info -nostats -i "$VOICE" -af "silencedetect=noise=${NOISE}dB:d=${ZYVO_CAP_GAP:-0.15}" -f null - 2>&1 | grep -o 'silence_\(start\|end\): *[0-9.]*' > "$TMP/silence.txt" || true
	tr '\r\n\t' '   ' < "$TEXT" | tr -s ' ' '\n' | grep -v '^$' > "$TMP/text_words.txt" || true
	awk -v dur="$DUR" -v SIL="$TMP/silence.txt" '
		# how long a word takes to say: its letters, and about 4 letters per digit ("42" is said "forty-two")
		function weight(w,   t, d) { t = w; d = w; gsub(/[^A-Za-z]/, "", t); gsub(/[^0-9]/, "", d); return length(t) + 4 * length(d) + 1 }
		function breaks(w) { return (w ~ /[.,!?;:](["\047)\]]|”|’)*$/) || (w ~ /(\.\.\.|-|…|—)$/) }
		BEGIN {
			# speech = what is between the silences; specks under 0.12 s join the silence
			m = 0; t = 0; inSil = 0
			while ((getline line < SIL) > 0) {
				split(line, a, ":"); v = a[2] + 0
				if (line ~ /silence_start/) { if (v - t >= 0.12) { m++; s0[m] = t; s1[m] = v } inSil = 1 }
				else { t = v; inSil = 0 }
			}
			if (!inSil && dur - t >= 0.12) { m++; s0[m] = t; s1[m] = dur }
			if (m == 0) { m = 1; s0[1] = 0; s1[1] = dur }
		}
		{ n++; w[n] = $0; c[n] = weight($0); C[n] = C[n - 1] + c[n]; br[n] = breaks($0); S[n] = S[n - 1] + ($0 ~ /[.!?](["\047)\]]|”|’)*$/) }
		END {
			if (n == 0) exit
			speech = 0; for (j = 1; j <= m; j++) speech += s1[j] - s0[j]
			rate = C[n] / speech                       # weight per second of speech
			MAXG = 60; INF = 1e18
			PEN = ENVIRON["ZYVO_CAP_PEN"] != "" ? ENVIRON["ZYVO_CAP_PEN"] + 0 : 0.35     # a stretch that ends mid-phrase
			PEN2 = ENVIRON["ZYVO_CAP_PEN2"] != "" ? ENVIRON["ZYVO_CAP_PEN2"] + 0 : 0.35  # a sentence that ends inside a stretch
			# D[j,i]: the best cost of giving words 1..i to speech stretches 1..j (a stretch may get none: a breath)
			D[0, 0] = 0; for (i = 1; i <= n; i++) D[0, i] = INF
			for (j = 1; j <= m; j++) {
				len = s1[j] - s0[j]
				for (i = 0; i <= n; i++) {
					best = INF; arg = i
					lo = i - MAXG; if (lo < 0) lo = 0
					for (k = i; k >= lo; k--) {
						if (D[j - 1, k] >= INF) continue
						d = (C[i] - C[k]) / rate - len
						cost = D[j - 1, k] + d * d
						if (i > k && i < n && !br[i]) cost += PEN   # a stretch should end after punctuation
						if (i - 1 > k) cost += PEN2 * (S[i - 1] - S[k])   # and a sentence should end at a pause
						if (cost < best) { best = cost; arg = k }
					}
					D[j, i] = best; B[j, i] = arg
				}
			}
			# back through the choices, then each stretch spreads its words by their length
			i = n
			for (j = m; j >= 1; j--) { k = B[j, i]; first[j] = k + 1; last[j] = i; i = k }
			for (j = 1; j <= m; j++) {
				if (last[j] < first[j]) continue
				tot = C[last[j]] - C[first[j] - 1]; at = s0[j]; len = s1[j] - s0[j]
				for (i = first[j]; i <= last[j]; i++) {
					e = at + len * c[i] / tot
					printf "%.3f\t%.3f\t%s\n", at, e, w[i]
					at = e
				}
			}
		}' "$TMP/text_words.txt" > "$TMP/words.tsv"
	MODE="estimated from the pauses (no words.json)"
	;;
esac
N="$(wc -l < "$TMP/words.tsv" | tr -d ' ')"
[ "$N" -gt 0 ] || { echo "no words found in $TEXT" >&2; exit 4; }

# ---------------------------------------------------------------- 2. the captions (ASS): white, bold, black outline
awk -F '\t' -v ecs="$ENDCARD" -v ec1="$VDUR" '
	function ts(x,   h, mi, s) { if (x < 0) x = 0; h = int(x / 3600); mi = int((x - h * 3600) / 60); s = x - h * 3600 - mi * 60; return sprintf("%d:%02d:%05.2f", h, mi, s) }
	function clean(w) { gsub(/[{}\\]/, "", w); gsub(/^(["\047(\[]|“|‘)+/, "", w); gsub(/(["\047)\],.;:]|”|’)+$/, "", w); return w }
	BEGIN {
		print "[Script Info]"; print "ScriptType: v4.00+"; print "PlayResX: 1080"; print "PlayResY: 1920"; print "WrapStyle: 2"; print ""
		print "[V4+ Styles]"
		print "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding"
		print "Style: Word,Arial,128,&H00FFFFFF,&H00FFFFFF,&H00000000,&H64000000,1,0,0,0,100,100,0,0,1,8,3,2,60,60,540,1"
		# the end card words (Zyvo: white + lime #BEF264, dark outline)
		print "Style: EndBig,Arial,104,&H00FFFFFF,&H00FFFFFF,&H000F0D0B,&H64000000,1,0,0,0,100,100,0,0,1,7,3,8,60,60,330,1"
		print "Style: EndUrl,Arial,76,&H0064F2BE,&H0064F2BE,&H000F0D0B,&H64000000,1,0,0,0,100,100,0,0,1,6,3,8,60,60,470,1"
		print ""; print "[Events]"; print "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
	}
	{ n++; s[n] = $1 + 0; e[n] = $2 + 0; w[n] = clean($3) }
	END {
		if (ecs > 0 && ec1 > ecs) {
			printf "Dialogue: 1,%s,%s,EndBig,,0,0,0,,{\\fad(250,0)}Made with Zyvo AI\n", ts(ec1 - ecs), ts(ec1 + 1)
			printf "Dialogue: 1,%s,%s,EndUrl,,0,0,0,,{\\fad(250,0)}tryzyvo.com\n", ts(ec1 - ecs + 0.15), ts(ec1 + 1)
		}
		for (i = 1; i <= n; i++) {
			if (w[i] == "") continue
			# on screen until the next word starts (a short hold before a pause, never over the next word)
			end = e[i] + 0.15; if (i < n && s[i + 1] - e[i] < 0.5) end = s[i + 1]; if (i < n && end > s[i + 1]) end = s[i + 1]
			if (end - s[i] < 0.08) end = s[i] + 0.08
			printf "Dialogue: 0,%s,%s,Word,,0,0,0,,%s\n", ts(s[i]), ts(end), w[i]
		}
	}' "$TMP/words.tsv" > "$TMP/captions.ass"

# ---------------------------------------------------------------- 3. burn them in, with the voice
if awk -v e="$ENDCARD" 'BEGIN { exit !(e > 0) }'; then
	# the end card: the video's full length (story + card); the voice padded with silence to it
	ffmpeg -v error -y -i "$VIDEO" -i "$VOICE" -map 0:v:0 -map 1:a:0 \
		-vf "subtitles=$TMP/captions.ass" -af "apad" -t "$VDUR" \
		-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "$OUT"
	CARD=", end card the last ${ENDCARD}s"
else
	ffmpeg -v error -y -i "$VIDEO" -i "$VOICE" -map 0:v:0 -map 1:a:0 \
		-vf "subtitles=$TMP/captions.ass" \
		-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
	CARD=""
fi
cp "$TMP/words.tsv" "${OUT%.mp4}_captions.tsv"
echo "$N words, timings $MODE$CARD -> $OUT (word timings in ${OUT%.mp4}_captions.tsv)"
