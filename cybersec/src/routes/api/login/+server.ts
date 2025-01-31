import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import type { RequestHandler } from './$types';

// Initialize SQLite database
const db = new Database('users.db');

// Create users table if it doesn't exist (vulnerable schema)
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT,
    password TEXT
  )
`);

export const POST: RequestHandler = async ({ request }) => {
  const { email, password } = await request.json();

  console.log(email, password);

  try {
    // VULNERABLE: Direct string concatenation leading to SQL injection
    const query = `
      SELECT * FROM users 
      WHERE email = '${email}' 
      AND password = '${password}'
    `;
    
    const user = db.prepare(query).get();

    if (user) {
        console.log(user);
      return json({
        success: true,
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email
        }
      });
    } else {
      return json({
        success: false,
        message: 'Invalid credentials'
      }, { status: 401 });
    }

  } catch (error) {
    return json({
      success: false,
      message: 'Login failed',
      error: error.message
    }, { status: 500 });
  }
};

// Signup endpoint - also vulnerable
export const PUT: RequestHandler = async ({ request }) => {
  const { email, password } = await request.json();

  try {
    // VULNERABLE: Direct string concatenation leading to SQL injection
    const query = `
      INSERT INTO users (email, password)
      VALUES ('${email}', '${password}')
    `;

    db.prepare(query).run();

    return json({
      success: true,
      message: 'User registered successfully'
    });

  } catch (error) {
    return json({
      success: false,
      message: 'Registration failed',
      error: error.message
    }, { status: 500 });
  }
};
