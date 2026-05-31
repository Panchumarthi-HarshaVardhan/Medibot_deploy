import connection from './db.js';

connection.query('SELECT id, name, email, password, role FROM users', (err, results) => {
  if (err) {
    console.error('Error fetching users:', err);
    process.exit(1);
  }
  console.log('Users in database:', results);
  process.exit(0);
});
