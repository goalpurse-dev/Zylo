# Blocky Worlds free voice: Windows SAPI (System.Speech) -> one raw 16-bit mono PCM file per line + word events.
# Called by voice/free.mjs. ASCII only (PowerShell 5.1 mangles UTF-8 in scripts); the text itself is read as UTF-8 by C#.
# Output: <outDir>/line_000.pcm ... and <outDir>/events.json:
#   { "sampleRate": 44100, "lines": [ { "bytes": n, "events": [[audioMs, charPos, charCount], ...] }, ... ] }
param(
  [Parameter(Mandatory = $true)][string]$LinesFile,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [string]$Voice = "Microsoft David Desktop",
  [int]$Rate = 3,
  [int]$SampleRate = 44100
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Speech
$code = @'
using System;
using System.IO;
using System.Text;
using System.Globalization;
using System.Collections.Generic;
using System.Speech.Synthesis;
using System.Speech.AudioFormat;
public static class BWSapi {
  public static void Run(string linesFile, string outDir, string voice, int rate, int sampleRate) {
    string[] lines = File.ReadAllLines(linesFile, Encoding.UTF8);
    StringBuilder sb = new StringBuilder();
    sb.Append("{\"sampleRate\":" + sampleRate + ",\"lines\":[");
    List<string> evs = new List<string>();
    object gate = new object();
    using (SpeechSynthesizer s = new SpeechSynthesizer()) {
      s.SelectVoice(voice);
      s.Rate = rate;
      s.Volume = 100;
      SpeechAudioFormatInfo fmt = new SpeechAudioFormatInfo(sampleRate, AudioBitsPerSample.Sixteen, AudioChannel.Mono);
      s.SpeakProgress += delegate (object o, SpeakProgressEventArgs e) {
        lock (gate) {
          evs.Add("[" + e.AudioPosition.TotalMilliseconds.ToString(CultureInfo.InvariantCulture) + "," + e.CharacterPosition + "," + e.CharacterCount + "]");
        }
      };
      for (int i = 0; i < lines.Length; i++) {
        lock (gate) { evs.Clear(); }
        byte[] pcm;
        using (MemoryStream ms = new MemoryStream()) {
          s.SetOutputToAudioStream(ms, fmt);
          s.Speak(lines[i]);
          s.SetOutputToNull();
          pcm = ms.ToArray();
        }
        File.WriteAllBytes(Path.Combine(outDir, "line_" + i.ToString("000") + ".pcm"), pcm);
        if (i > 0) sb.Append(",");
        lock (gate) {
          sb.Append("{\"bytes\":" + pcm.Length + ",\"events\":[" + String.Join(",", evs.ToArray()) + "]}");
        }
      }
    }
    sb.Append("]}");
    File.WriteAllText(Path.Combine(outDir, "events.json"), sb.ToString(), new UTF8Encoding(false));
  }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Speech
[BWSapi]::Run($LinesFile, $OutDir, $Voice, $Rate, $SampleRate)
Write-Output "ok"
