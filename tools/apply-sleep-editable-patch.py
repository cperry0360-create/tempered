from pathlib import Path

path = Path('src/ui/screens/today.js')
text = path.read_text()
old = """export function staysEditableAfterComplete(activity) {\n  return activity?.spec?.entry === 'number' && activity?.spec?.mode === 'add'\n}\n"""
new = """export function staysEditableAfterComplete(activity) {\n  return activity?.id === 'sleep'\n    || (activity?.spec?.entry === 'number' && activity?.spec?.mode === 'add')\n}\n"""
if old not in text:
    raise SystemExit('staysEditableAfterComplete block not found')
path.write_text(text.replace(old, new, 1))
print('Sleep remains editable after logging')
