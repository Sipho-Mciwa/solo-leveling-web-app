const { db } = require('../backend/config/firebase');

async function fixTodayChallenges() {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Fixing challenges for date: ${today}`);

  const snapshot = await db.collection('dailyChallenges')
    .where('date', '==', today)
    .get();

  if (snapshot.empty) {
    console.log('No challenges found for today.');
    return;
  }

  const updates = {
    'wake_up_5am':   { key: 'wake_up_6am', title: 'Wake up at 6:00 AM' },
    'read_10_pages': { key: 'read_book',    title: 'Read a Book' },
    'sleep_2130':    { key: 'sleep_2200',   title: 'Sleep at 22:00' }
  };

  for (const doc of snapshot.docs) {
    const data = doc.data();
    let changed = false;
    const newChallenges = data.challenges.map(c => {
      if (updates[c.key]) {
        changed = true;
        return { ...c, key: updates[c.key].key, title: updates[c.key].title };
      }
      return c;
    });

    if (changed) {
      await doc.ref.update({ challenges: newChallenges });
      console.log(`Updated doc: ${doc.id}`);
    }
  }

  console.log('Done.');
  process.exit(0);
}

fixTodayChallenges().catch(err => {
  console.error(err);
  process.exit(1);
});
