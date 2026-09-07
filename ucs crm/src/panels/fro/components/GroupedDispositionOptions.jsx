export function GroupedDispositionOptions({ groups }) {
  return (groups || []).map(g => {
    if (!g.items || g.items.length === 0) return null;
    if (g.items.length === 1) {
      return <option key={g.items[0].id} value={g.items[0].id}>{g.label}</option>;
    }
    return (
      <optgroup key={g.label} label={g.label}>
        {g.items.map(it => <option key={it.id} value={it.id}>{it.label}</option>)}
      </optgroup>
    );
  });
}