export default function ScriptResult({ data }) {
  if (!data) {
    return (
      <div className="h-full flex items-center justify-center text-white/40">
        Your script will appear here.
      </div>
    );
  }

  return (
    <div className="text-white space-y-6">
      <div className="bg-white/5 p-6 rounded-2xl">
        <h2 className="text-xl font-semibold mb-2">Script Output</h2>
        <pre className="whitespace-pre-wrap text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
}