"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseRubric } from "@/lib/rubric";

const SAMPLE = `Photo annotations & critique | 10 marks | 0-3 | 4-7 | 8-10
  Photo clarity | 1 | unclear | clear | clear
  Photo authenticity | 1 | not original | authentic | authentic
  Photo annotation | 1 | unannotated | relevant | thoughtful
  Choice of material | 3 | not problematic | minor weaknesses | clearly flawed
  Descriptions | 3 | none | adequate and general | detailed and specific
  Identification of problems | 3 | few, vague or incorrect | 2-3 identified, limited depth | multiple, well-justified problems
  Explanation of design flaws | 3 | little or no explanation | generic or incomplete reasoning | precise cause-and-effect reasoning
  Psychological concepts | 3 | missing, incorrect or misused | some correct, loosely linked | multiple, accurate and integrated

Suggested improvements & sketch | 10 marks | 0-3 | 4-7 | 8-10
  Suggested changes | 3 | few, impractical or irrelevant | 2 relevant, mostly practical changes | 2-4 practical, relevant and well-justified changes
  Sketch | 1 | missing, unclear or unrelated | linked to suggestions, weak theory links | clear, purposeful and grounded in psychological principles
  Psychological concepts | 3 | missing or incorrect application | some correct, limited application | multiple principles applied precisely and together
  Expected impact | 3 | little or no explanation | brief or generic reasoning | clear cause-and-effect links to clarity, attention, memory or action

Rationale write-up | 10 marks | 0-3 | 4-7 | 8-10
  Justification of changes | 3 | missing, unclear or weak | limited, generic or uneven | clear, detailed and logical for all changes
  Psychological concepts | 3 | one or none, or applied incorrectly | 2-3 correct, links need detail | multiple concepts applied accurately in context
  Links to intended outcomes | 3 | little or no explanation | some outcomes explained, others overlooked | convincing links to readability, comprehension, retention or behaviour
  Depth and integration | 3 | theory links absent or incorrect | some understanding, limited integration | deep understanding with psychological principles linked together
  Writing quality | 1 | errors hinder understanding | clear enough, minor errors | polished, coherent and fluent`;

const EXAMPLE_COMPONENT = parseRubric(SAMPLE).components[0];
const EXAMPLE_STUDENTS = [
  { name: "Alex", id: "001", scoreRatio: 0.8 },
  { name: "Taylor", id: "002", scoreRatio: 0.6 },
];
const exampleScore = (student: typeof EXAMPLE_STUDENTS[number], itemIndex: number) =>
  Math.round(EXAMPLE_COMPONENT.marks * (student.scoreRatio + (itemIndex % 2) * 0.1));
const exampleTotal = (student: typeof EXAMPLE_STUDENTS[number]) =>
  (EXAMPLE_COMPONENT.items.reduce((sum, item, index) => sum + exampleScore(student, index) * item.weight, 0)
    / EXAMPLE_COMPONENT.items.reduce((sum, item) => sum + item.weight, 0)).toFixed(2);

export default function Home() {
  const [rubric, setRubric] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [download, setDownload] = useState<string | null>(null);
  const [confirmSample, setConfirmSample] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(() => new Set());
  const downloadRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const parsed = useMemo(() => {
    try {
      return { value: parseRubric(rubric), error: "" };
    } catch (cause) {
      return { value: null, error: cause instanceof Error ? cause.message : "Check your rubric format." };
    }
  }, [rubric]);
  const anchorKeys = parsed.value?.components.flatMap((component, index) =>
    component.ranges.length ? component.items.map((_, itemIndex) => `${index}-${itemIndex}`) : []
  ) ?? [];
  const allExpanded = anchorKeys.length > 0 && anchorKeys.every((key) => expandedItems.has(key));

  function setItemExpanded(key: string, open: boolean) {
    setExpandedItems((current) => {
      if (current.has(key) === open) return current;
      const next = new Set(current);
      if (open) next.add(key);
      else next.delete(key);
      return next;
    });
  }

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
    setExpandedItems(new Set());
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

              <p className="format-help" id="format-help">Set category ranges. Match each sub-item&apos;s labels in the same order.</p>
              <div className="syntax-guide" id="syntax-guide">
                <code>Category | 40 marks | 21-40 | 0-20<br />&nbsp;&nbsp;Sub-item | 1 | Strong | Developing</code>
              </div>
              <textarea
                ref={textareaRef}
                id="rubric"
                name="rubric"
                wrap="off"
                value={rubric}
                onChange={(event) => { setRubric(event.target.value); setExpandedItems(new Set()); setConfirmSample(false); setError(""); setDownload(null); }}
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
                placeholder={"Research | 40 marks | 21-40 | 0-20\n  Evidence | 1 | Strong evidence | Developing evidence"}
              />
              <div className="editor-footnote" id="rubric-help">
                <span>Indent with two spaces. Separate values with |. Commas are fine in labels.</span>
                <span>Ranges use whole numbers. Weight 2 counts twice as much as 1.</span>
              </div>
              {parsed.error && <p className="validation-error" id="rubric-error" role="status">{parsed.error}</p>}
            </section>

            <aside className="rubric-preview" aria-labelledby="preview-heading">
              <div className="section-heading"><h2 id="preview-heading">Rubric preview</h2>
                {anchorKeys.length > 0 ? <button type="button" className="text-button anchor-toggle-all" aria-controls="preview-components" aria-expanded={allExpanded}
                  onClick={() => setExpandedItems(allExpanded ? new Set() : new Set(anchorKeys))}>
                  {allExpanded ? "Collapse all" : "Expand all"}
                </button> : <span className="live-label">Live</span>}
              </div>
              {parsed.value ? (
                <>
                  <div className="preview-components" id="preview-components">
                    {parsed.value.components.map((component, index) => (
                      <div className="preview-component" key={index}>
                        <div className="component-title"><h3>{component.name}</h3><span>{component.marks}<small>marks</small></span></div>
                        <ul>
                          {component.items.map((item, itemIndex) => <li key={itemIndex}>
                            {component.ranges.length > 0 ? <details className="anchor-details" open={expandedItems.has(`${index}-${itemIndex}`)}
                              onToggle={(event) => setItemExpanded(`${index}-${itemIndex}`, event.currentTarget.open)}>
                              <summary><span className="item-name">{item.name}</span><span className="item-weight">{item.weight}<small> wt</small></span></summary>
                              <dl className="item-anchors">{component.ranges.map((range, rangeIndex) => <div key={rangeIndex}>
                                <dt>{range.label}</dt><dd>{item.anchors[rangeIndex]}</dd>
                              </div>)}</dl>
                            </details> : <div className="plain-item"><span className="item-name">{item.name}</span><span className="item-weight">{item.weight}<small> wt</small></span></div>}
                          </li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <div className="preview-total"><span>Total available</span><strong>{parsed.value.totalMarks}<small> marks</small></strong></div>
                  <p className="preview-count">{parsed.value.components.length} components · {parsed.value.itemCount} sub-items</p>
                </>
              ) : <p className="preview-empty">Follow the format to see your preview.</p>}
              <p className="score-note">Score each sub-item out of its category&apos;s marks. Excel calculates the weighted average.</p>
            </aside>
          </div>

          <section className="workbook-guide" aria-labelledby="workbook-heading">
            <div className="guide-heading"><h2 id="workbook-heading">Inside your workbook</h2><span>Sample rubric | First category</span></div>
            <div className="sheet-examples">
              <figure>
                <figcaption><h3>1. Add students</h3><p>Enter names on the Students sheet.</p></figcaption>
                <div className="sheet-window">
                  <table className="sheet-table roster-example" aria-label="Example Students sheet">
                    <thead><tr><th scope="col">No.</th><th scope="col">Student name</th><th scope="col">Student ID</th></tr></thead>
                    <tbody>
                      {EXAMPLE_STUDENTS.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td>{student.name}</td><td>{student.id}</td></tr>)}
                      <tr><td>3</td><td></td><td></td></tr>
                    </tbody>
                  </table>
                  <div className="sheet-tabs"><span className="selected-tab">Students</span><span>Grading</span></div>
                </div>
              </figure>
              <figure>
                <figcaption><h3>2. Enter grades</h3><p>Anchors wrap beside each sub-item. Scroll right for student scores.</p></figcaption>
                <div className="sheet-window grading-window" tabIndex={0} role="region" aria-label="Grading example, scroll horizontally to see student scores">
                  <table className="sheet-table grading-example" aria-label={`Example Grading sheet for ${EXAMPLE_COMPONENT.name}, out of ${EXAMPLE_COMPONENT.marks} marks`}>
                    <colgroup>
                      <col className="example-criterion-column" /><col className="example-number-column" /><col className="example-number-column" />
                      {EXAMPLE_COMPONENT.ranges.map((_, index) => <col className="example-anchor-column" key={index} />)}
                      <col className="example-number-column" />
                      {EXAMPLE_STUDENTS.map(student => <col className="example-score-column" key={student.id} />)}
                    </colgroup>
                    <thead><tr><th scope="col">Criterion</th><th scope="col">Weight</th><th scope="col">Marks</th>
                      {EXAMPLE_COMPONENT.ranges.map((_, index) => <th scope="col" key={index}>Anchor {index + 1}</th>)}
                      <th scope="col" aria-label="Separator"></th>
                      {EXAMPLE_STUDENTS.map(student => <th scope="col" className="formula-cell" key={student.id}>{student.name}</th>)}
                    </tr></thead>
                    <tbody>
                      <tr className="example-component"><th scope="row">{EXAMPLE_COMPONENT.name}</th><td></td><td>{EXAMPLE_COMPONENT.marks}</td>
                        {EXAMPLE_COMPONENT.ranges.map((range, index) => <td key={index}>{range.label}</td>)}<td></td>
                        {EXAMPLE_STUDENTS.map(student => <td key={student.id}></td>)}
                      </tr>
                      {EXAMPLE_COMPONENT.items.map((item, index) => <tr key={item.name}>
                        <th scope="row">{item.name}</th><td>{item.weight}</td><td></td>
                        {item.anchors.map((anchor, anchorIndex) => <td key={anchorIndex}>{anchor}</td>)}<td></td>
                        {EXAMPLE_STUDENTS.map(student => <td key={student.id}>{exampleScore(student, index)}</td>)}
                      </tr>)}
                      <tr><td colSpan={4 + EXAMPLE_COMPONENT.ranges.length + EXAMPLE_STUDENTS.length}>Insert new criteria above this row</td></tr>
                      <tr className="example-total"><th scope="row">{EXAMPLE_COMPONENT.name} total</th><td></td><td className="formula-cell">{EXAMPLE_COMPONENT.marks}</td>
                        {EXAMPLE_COMPONENT.ranges.map((_, index) => <td key={index}></td>)}<td></td>
                        {EXAMPLE_STUDENTS.map(student => <td className="formula-cell" key={student.id}>{exampleTotal(student)}</td>)}
                      </tr>
                    </tbody>
                  </table>
                  <div className="sheet-tabs"><span>Students</span><span className="selected-tab">Grading</span></div>
                </div>
              </figure>
            </div>
            <p className="workbook-edit-note">To add a criterion in Excel, insert a whole row above its category&apos;s “Insert new criteria above this row” marker. Enter the criterion, weight and student scores. Totals update automatically.</p>
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
