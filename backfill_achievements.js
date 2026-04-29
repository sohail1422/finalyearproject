const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, 'achievements.json');

function parseDate(item) {
  if (!item || !item.createdAt) return null;
  const d = new Date(item.createdAt);
  return isNaN(d.valueOf()) ? null : d;
}

try {
  const raw = fs.readFileSync(filePath, 'utf-8');
  let achievements = JSON.parse(raw);

  if (!Array.isArray(achievements)) throw new Error('achievements.json must be an array');

  const updated = achievements.map((item, index) => {
    const existing = parseDate(item);
    if (existing) return item;

    const newDate = new Date();
    console.log(`Backfilling achievement id=${item.id || index} createdAt=${newDate.toISOString()}`);

    return {
      ...item,
      createdAt: newDate.toISOString()
    };
  });

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  console.log('Backfill complete:', updated.length, 'items processed.');
} catch (err) {
  console.error('Error updating achievements.json:', err.message);
  process.exit(1);
}