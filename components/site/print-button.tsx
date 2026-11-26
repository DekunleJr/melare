"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn btn-outline btn-sm print:hidden" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
