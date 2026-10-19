const SHORTCUTS = [
  ['Ctrl + V', 'Paste a screenshot into the gallery'],
  ['V / R / O / A / L / P', 'Select, rectangle, circle, arrow, line, freehand'],
  ['T / H / B / N / C', 'Text, highlighter, blur, numbered step, crop'],
  ['Shift + drag', 'Perfect squares / circles, 45° lines'],
  ['Delete', 'Remove selected shape'],
  ['Arrow keys', 'Nudge selected shape (Shift = 10px), otherwise previous / next image'],
  ['Ctrl + Z / Ctrl + Shift + Z', 'Undo / redo'],
  ['Ctrl + S', 'Save edits back to the gallery'],
  ['Ctrl + wheel, Ctrl + / −, Ctrl + 0', 'Zoom in / out, fit to screen'],
  ['Enter / Esc', 'Apply crop / cancel or close the editor'],
]

export default function About() {
  return (
    <div className="page">
      <h1>Keyboard shortcuts</h1>
      <p className="muted">Everything runs in your browser. Nothing is uploaded.</p>
      <table className="shortcuts">
        <tbody>
          {SHORTCUTS.map(([k, d]) => (
            <tr key={k}>
              <td>
                <kbd>{k}</kbd>
              </td>
              <td>{d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
