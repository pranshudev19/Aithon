require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('./index');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting database seed...');

    // Run schema
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✅ Schema applied');

    // Clear existing data
    await client.query('TRUNCATE subtasks, tasks, users RESTART IDENTITY CASCADE');

    // Seed users
    const users = [
      {
        name: 'Alex Manager',
        email: 'manager@taskplanner.com',
        password: 'Manager@123',
        role: 'manager',
        skills: [],
      },
      {
        name: 'Alice Frontend',
        email: 'alice@taskplanner.com',
        password: 'Dev@123',
        role: 'developer',
        skills: ['frontend', 'React', 'CSS', 'TypeScript', 'HTML', 'Vue'],
      },
      {
        name: 'Bob Backend',
        email: 'bob@taskplanner.com',
        password: 'Dev@123',
        role: 'developer',
        skills: ['backend', 'Node.js', 'PostgreSQL', 'REST', 'Express', 'Python'],
      },
      {
        name: 'Carol DevOps',
        email: 'carol@taskplanner.com',
        password: 'Dev@123',
        role: 'developer',
        skills: ['API', 'GraphQL', 'REST', 'Docker', 'DevOps', 'AWS', 'CI/CD'],
      },
    ];

    for (const user of users) {
      const hash = await bcrypt.hash(user.password, 10);
      await client.query(
        `INSERT INTO users (name, email, password_hash, role, skills)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING`,
        [user.name, user.email, hash, user.role, user.skills]
      );
      console.log(`  ✅ Seeded user: ${user.email} (${user.role})`);
    }

    console.log('\n🎉 Seed complete!');
    console.log('\n📋 Test Credentials:');
    console.log('  Manager  → manager@taskplanner.com / Manager@123');
    console.log('  Dev 1    → alice@taskplanner.com   / Dev@123');
    console.log('  Dev 2    → bob@taskplanner.com     / Dev@123');
    console.log('  Dev 3    → carol@taskplanner.com   / Dev@123');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
