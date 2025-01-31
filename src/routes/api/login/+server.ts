import { json } from '@sveltejs/kit';
import Database from 'better-sqlite3';
import type { RequestHandler } from './$types';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { building } from '$app/environment';

const DB_PATH = process.env.DB_PATH || 'users.db';
const db = new Database(DB_PATH);

// Create users table with proper schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Rate limiting configuration
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again later',
  skipFailedRequests: false
});

// Skip rate limiting during build
const rateLimitMiddleware = building ? 
  (_: Request, __: any, next: () => void) => next() 
  : loginLimiter;

interface LoginRequest {
  email: string;
  password: string;
}

// Define the User interface
interface User {
  id: number;
  email: string;
  password: string; // Include password for comparison
}

export const POST: RequestHandler = async ({ request }) => {
  // Apply rate limiting
  await new Promise((resolve) => rateLimitMiddleware(request, {}, resolve));

  const { email, password } = await request.json() as LoginRequest;

  try {
    // Use parameterized query to prevent SQL injection
    const query = `
      SELECT * FROM users 
      WHERE email = ?
    `;
    
    const user = db.prepare(query).get(email) as User; // Cast to User type

    if (user && await bcrypt.compare(password, user.password)) {
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
    console.error('Login error:', error);
    return json({
      success: false,
      message: 'Login failed'
    }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request }) => {
  // Apply rate limiting for registration too
  await new Promise((resolve) => rateLimitMiddleware(request, {}, resolve));

  const { email, password } = await request.json();

  try {
    // Input validation
    if (!email || !password || password.length < 8) {
      return json({
        success: false,
        message: 'Invalid input: Email required and password must be at least 8 characters'
      }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return json({
        success: false,
        message: 'Email already registered'
      }, { status: 409 });
    }

    // Hash password before storing
    const hashedPassword = await bcrypt.hash(password, 12);

    // Use parameterized query to prevent SQL injection
    const query = `
      INSERT INTO users (email, password)
      VALUES (?, ?)
    `;

    db.prepare(query).run(email, hashedPassword);

    return json({
      success: true,
      message: 'User registered successfully'
    });

  } catch (error) {
    console.error('Registration error:', error);
    return json({
      success: false,
      message: 'Registration failed'
    }, { status: 500 });
  }
};
