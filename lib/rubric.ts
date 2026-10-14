export type Rubric = {
  components: {
    name: string;
    marks: number;
    items: { name: string; weight: number }[];
  }[];
  totalMarks: number;
  itemCount: number;
};

const MAX_TEXT_LENGTH = 30_000;
const MAX_COMPONENTS = 30;
const MAX_ITEMS = 200;
const MAX_LABEL_LENGTH = 180;
const DECIMAL = /^(?:\d+(?:\.\d*)?|\.\d+)$/;

/** Parse the two-level rubric format. Blank lines are allowed between entries. */
export function parseRubric(text: string): Rubric {
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Enter a rubric with a component and at least one indented subitem.");
  }
  if (text.length > MAX_TEXT_LENGTH) {
    throw new Error(`The rubric is too long. Use at most ${MAX_TEXT_LENGTH.toLocaleString("en-US")} characters.`);
  }

  const components: Rubric["components"] = [];
  let itemCount = 0;
  let totalMarks = 0;
  let itemIndent: string | undefined;
  let componentLine = 0;
  const lines = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const fail = (line: number, message: string): never => {
    throw new Error(`Line ${line}: ${message}`);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const line = lines[index];
    if (!line.trim()) continue;
    if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u.test(line)) {
      fail(lineNumber, "Remove the unsupported control character.");
    }
    const indent = line.match(/^[ \t]*/)?.[0] ?? "";
    const isItem = indent.length > 0;
    if (isItem && indent !== "  " && indent !== "\t") {
      fail(lineNumber, "Indent subitems with exactly two spaces or one tab. Only two levels are supported.");
    }
    if (isItem && itemIndent && indent !== itemIndent) {
      fail(lineNumber, "Use the same indentation for every subitem, either two spaces or one tab.");
    }
    if (isItem) itemIndent ??= indent;

    const parts = line.slice(indent.length).trimEnd().split("|");
    if (parts.length !== 2) {
      fail(lineNumber, isItem ? 'Use "  Subitem name | 2" with one pipe separator.' : 'Use "Component name | 40 marks" with one pipe separator.');
    }
    const name = parts[0].trim();
    if (!name) fail(lineNumber, "Add a name before the pipe separator.");
    if (name.length > MAX_LABEL_LENGTH) fail(lineNumber, `Shorten the name to ${MAX_LABEL_LENGTH} characters or fewer.`);
    if (/\t/.test(name) || /^\s/u.test(line.slice(indent.length))) {
      fail(lineNumber, "Remove extra indentation or tabs inside the name.");
    }
    const rawValue = parts[1].trim();
    const parentValue = rawValue.match(/^(.+?)\s+marks?$/i);
    if (!isItem && !parentValue) fail(lineNumber, 'End a component with its marks, for example "Presentation | 40 marks".');
    const numericText = isItem ? rawValue : parentValue![1].trim();
    const value = Number(numericText);
    if (!DECIMAL.test(numericText) || !Number.isFinite(value) || value <= 0) {
      fail(lineNumber, `Use a positive decimal ${isItem ? "weight" : "mark value"}, such as 1, 2.5 or 40.`);
    }
    if (value < 0.000001 || value > 1_000_000 || (numericText.split(".")[1]?.length ?? 0) > 6) {
      fail(lineNumber, `Use a ${isItem ? "weight" : "mark value"} from 0.000001 to 1,000,000 with at most 6 decimal places.`);
    }

    if (isItem) {
      const component = components.at(-1);
      if (!component) throw new Error(`Line ${lineNumber}: Add a component above this subitem, without indentation.`);
      itemCount += 1;
      if (itemCount > MAX_ITEMS) fail(lineNumber, `Use at most ${MAX_ITEMS} subitems in one rubric.`);
      component.items.push({ name, weight: value });
      if (!Number.isFinite(component.items.reduce((sum, item) => sum + item.weight, 0))) {
        fail(lineNumber, "The combined subitem weights are too large. Use smaller proportional weights.");
      }
    } else {
      const previous = components.at(-1);
      if (previous && previous.items.length === 0) fail(componentLine, `Add at least one indented subitem under "${previous.name}".`);
      if (components.length >= MAX_COMPONENTS) fail(lineNumber, `Use at most ${MAX_COMPONENTS} components in one rubric.`);
      totalMarks += value;
      if (!Number.isFinite(totalMarks)) fail(lineNumber, "The total marks are too large. Use smaller mark values.");
      components.push({ name, marks: value, items: [] });
      componentLine = lineNumber;
    }
  }

  const last = components.at(-1);
  if (!last) throw new Error("Add a component without indentation, followed by its indented subitems.");
  if (last.items.length === 0) fail(componentLine, `Add at least one indented subitem under "${last.name}".`);
  return { components, totalMarks, itemCount };
}
