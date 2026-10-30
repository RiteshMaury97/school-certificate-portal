"use client";
export default function DuplicateChallenge({
  question,
  value,
  onChange,
}: {
  question: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-semibold">
      {question}
      <input
        translate="no"
        value={value}
        onChange={(e) => { onChange(e.target.value); }}
        className="mt-2 min-h-11 w-full rounded-lg border px-3 text-base"
      />
    </label>
  );
}
