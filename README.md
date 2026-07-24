# My Calendar

A private, responsive calendar for:

- Birthdays, including yearly repeats
- Holidays
- Morning, afternoon, night, extra and custom work shifts
- Events
- Daily notes and a separate day-to-day notepad

## Open the website

Open `index.html` in a modern browser. No installation, database or API key is
required.

For GitHub Pages, upload everything in this folder to your repository and keep
`index.html` at the repository root.

## Saving and backups

Calendar data is saved in the browser on the current device. Use the three-dot
menu to export a JSON backup before clearing browser data or moving to another
device. Use **Import backup** to restore it.

The new version also detects and imports birthdays and shifts saved by the
earlier My Calendar website in the same browser.

## Useful controls

- Click a date to select it.
- Click the small `+` in a date or use **Add item** to create something.
- Double-click a date to open the item editor.
- Select an existing calendar chip to edit or delete it.
- Press `Ctrl/Command + N` to add an item.
- Press `T` to return to today.

## Files

- `index.html` — website structure
- `assets/styles.css` — responsive visual design
- `assets/app.js` — calendar, editing, notepad, filters and device storage
