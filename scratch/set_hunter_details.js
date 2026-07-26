// One-off: set real Hunter Details for Sipho's account (identified by
// email match against the `users` collection — see conversation for how
// this userId was confirmed).
//
// Usage:
//   node scratch/set_hunter_details.js            # dry run
//   node scratch/set_hunter_details.js --apply     # actually write

const { db } = require('../backend/config/firebase');

const APPLY = process.argv.includes('--apply');
const USER_ID = 'Ng82vlN0bIMVIXdg9DIuH98NzJy2'; // siphomciwa@gmail.com

const details = {
  firstName: 'Sipho',
  lastName: 'Mciwa',
  dateOfBirth: '1999-12-17',
  sex: 'Male',
  height: '165 cm', // 5'5" -> 65in * 2.54 = 165.1cm
  weight: '59.4 kg',
};

async function main() {
  const userRef = db.collection('users').doc(USER_ID);
  const snap = await userRef.get();
  if (!snap.exists) {
    console.error(`No user doc found for ${USER_ID}`);
    process.exit(1);
  }

  console.log(`${APPLY ? 'Applying' : 'Would apply'} to ${USER_ID} (${snap.data().email}):`);
  console.log(JSON.stringify(details, null, 2));

  if (!APPLY) {
    console.log('\nDry run only — rerun with --apply to write.');
    return;
  }

  await userRef.update(details);
  const updated = await userRef.get();
  console.log('\nDone. New doc:', JSON.stringify(updated.data(), null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
