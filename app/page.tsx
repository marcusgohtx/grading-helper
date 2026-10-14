"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseRubric } from "@/lib/rubric";

const SAMPLE = `Research | 40 marks
  Evidence | 1
  Analysis | 2

Presentation | 40 marks
  Structure | 1
  Clarity | 1

Reflection | 20 marks
  Insight | 2
  Next steps | 1`;

export default function Home() {
  const [rubric, setRubric] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [download, setDownload] = useState<string | null>(null);
  const [confirmSample, setConfirmSample] = useState(false);
  const downloadRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const parsed = useMemo(() => {
    try {
      return { value: parseRubric(rubric), error: "" };
    } catch (cause) {
      return { value: null, error: cause instanceof Error ? cause.message : "Check your rubric format." };
    }
  }, [rubric]);

  useEffect(() => () => {
    if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
  }, []);

  async function submit() {
    if (loading || !parsed.value) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/workbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rubric }),
      });
      if (!response.ok) {
        const result: unknown = await response.json().catch(() => null);
        const message = typeof result === "object" && result !== null && "error" in result && typeof result.error === "string"
          ? result.error
          : "The workbook could not be created. Please try again.";
        throw new Error(message);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (downloadRef.current) URL.revokeObjectURL(downloadRef.current);
      downloadRef.current = url;
      setDownload(url);
      const link = document.createElement("a");
      link.href = url;
      link.download = "grading-workbook.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetSample() {
    if (rubric !== SAMPLE && rubric.trim() && !confirmSample) {
      setConfirmSample(true);
      return;
    }
    setRubric(SAMPLE);
    setDownload(null);
    setConfirmSample(false);
    setError("");
    textareaRef.current?.focus();
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="wordmark" href="/" aria-label="Grading helper home">
          <svg width="23" height="25" viewBox="0 0 23 25" fill="none" aria-hidden="true">
            <path d="M5 2h13a2 2 0 0 1 2 2v17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 2v21M8 9h12M8 16h12" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Grading helper
        </a>
        <span className="header-note">Rubric to Excel</span>
      </header>

      <main id="main-content">
        <div className="page-intro">
          <h1>Create your grading workbook.</h1>
          <p>Your rubric, ready to grade in Excel.</p>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void submit(); }} aria-busy={loading}>
          <div className="workspace">
            <section className="editor" aria-labelledby="rubric-label">
              <div className="section-heading">
                <label id="rubric-label" htmlFor="rubric">Your rubric</label>
                <div className="sample-controls">
                  {rubric === SAMPLE ? <span className="sample-label">Sample rubric</span> : (
                    <button className="text-button" type="button" onClick={resetSample} disabled={loading}>Use sample</button>
                  )}
                </div>
              </div>

              {confirmSample && (
                <div className="sample-confirmation">
                  <span>Replace your current rubric with the sample?</span>
                  <button type="button" className="text-button" onClick={resetSample} disabled={loading}>Replace</button>
                  <button type="button" className="text-button muted-button" onClick={() => setConfirmSample(false)} disabled={loading}>Keep mine</button>
                </div>
              )}

              <p className="format-help" id="format-help">Add marks to components. Indent sub-items with two spaces and add a weight.</p>
              <div className="syntax-guide" id="syntax-guide">
                <code>Component | 40 marks<br />&nbsp;&nbsp;Sub-item | 1</code>
                <span>Separate values with <code>|</code></span>
              </div>
              <textarea
                ref={textareaRef}
                id="rubric"
                name="rubric"
                value={rubric}
                onChange={(event) => { setRubric(event.target.value); setConfirmSample(false); setError(""); setDownload(null); }}
                onKeyDown={(event) => {
                  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
                    event.preventDefault();
                    void submit();
                  }
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                aria-describedby={`format-help syntax-guide rubric-help${parsed.error ? " rubric-error" : ""}`}
                aria-invalid={Boolean(parsed.error)}
                readOnly={loading}
                placeholder={"Research | 40 marks\n  Evidence | 1\n  Analysis | 2"}
              />
              <div className="editor-footnote" id="rubric-help">
                <span>Weights are relative, so 2 counts twice as much as 1.</span>
              </div>
              {parsed.error && <p className="validation-error" id="rubric-error" role="status">{parsed.error}</p>}
            </section>

            <aside className="rubric-preview" aria-labelledby="preview-heading">
              <div className="section-heading"><h2 id="preview-heading">Rubric preview</h2><span className="live-label">Live</span></div>
              {parsed.value ? (
                <>
                  <div className="preview-components">
                    {parsed.value.components.map((component, index) => (
                      <div className="preview-component" key={index}>
                        <div className="component-title"><h3>{component.name}</h3><span>{component.marks}<small>marks</small></span></div>
                        <ul>
                          {component.items.map((item, itemIndex) => <li key={itemIndex}><span>{item.name}</span><span className="item-weight">{item.weight}<small> wt</small></span></li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="preview-total"><span>Total available</span><strong>{parsed.value.totalMarks}<small> marks</small></strong></div>
                  <p className="preview-count">{parsed.value.components.length} components · {parsed.value.itemCount} sub-items</p>
                </>
              ) : <p className="preview-empty">Follow the format to see your preview.</p>}
              <p className="score-note">Grade each sub-item from 0 to 100. Excel calculates the totals.</p>
            </aside>
          </div>

          <section className="workbook-guide" aria-labelledby="workbook-heading">
            <div className="guide-heading"><h2 id="workbook-heading">Inside your workbook</h2><span>Example</span></div>
            <div className="sheet-examples">
              <figure>
                <figcaption><h3>1. Add students</h3><p>Enter names on the Students sheet.</p></figcaption>
                <div className="sheet-window">
                  <table className="sheet-table roster-example" aria-label="Example Students sheet">
                    <thead><tr><th scope="col">No.</th><th scope="col">Student name</th><th scope="col">Student ID</th></tr></thead>
                    <tbody>
                      <tr><td>1</td><td>Alex</td><td>001</td></tr>
                      <tr><td>2</td><td>Taylor</td><td>002</td></tr>
                      <tr><td>3</td><td></td><td></td></tr>
                    </tbody>
                  </table>
                  <div className="sheet-tabs"><span className="selected-tab">Students</span><span>Grading</span></div>
                </div>
              </figure>
              <figure>
                <figcaption><h3>2. Enter grades</h3><p>Score sub-items. Green cells calculate automatically.</p></figcaption>
                <div className="sheet-window">
                  <table className="sheet-table grading-example" aria-label="Example Grading sheet for a 40-mark component">
                    <thead><tr><th scope="col">Criterion</th><th scope="col">Weight</th><th scope="col" className="formula-cell">Alex</th><th scope="col" className="formula-cell">Taylor</th></tr></thead>
                    <tbody>
                      <tr className="example-component"><th scope="row">Research <small>40 marks</small></th><td></td><td></td><td></td></tr>
                      <tr><th scope="row">Evidence</th><td>1</td><td>80</td><td>70</td></tr>
                      <tr><th scope="row">Analysis</th><td>2</td><td>90</td><td>80</td></tr>
                      <tr className="example-total"><th scope="row">Research total</th><td></td><td className="formula-cell">34.67</td><td className="formula-cell">30.67</td></tr>
                    </tbody>
                  </table>
                  <div className="sheet-tabs"><span>Students</span><span className="selected-tab">Grading</span></div>
                </div>
              </figure>
            </div>
            <p className="privacy-note">Student names and grades stay in your Excel file.</p>
          </section>

          <div className="submit-area">
            <div className="file-detail"><span className="file-type">XLSX</span><span>2 sheets<span className="detail-dot">·</span>100 students</span></div>
            <button type="submit" className="submit-button" disabled={loading || !parsed.value}>
              {loading ? <><span className="spinner" aria-hidden="true" />Creating Excel...</> : <>Download Excel <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v10m-4-4 4 4 4-4M4 14v3h12v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></>}
            </button>
          </div>
          <div className="submission-status" aria-live="polite" aria-atomic="true">
            {!loading && error && <p className="validation-error" role="alert">{error}</p>}
            {!loading && !error && download && <p className="download-success">Excel ready. <a href={download} download="grading-workbook.xlsx">Download again</a></p>}
          </div>
        </form>
      </main>
    </div>
  );
}
