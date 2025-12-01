import { neon } from '@neondatabase/serverless';

// In a Vite app, we access env vars via import.meta.env
// We use VITE_DATABASE_URL to expose it to the client.
// WARNING: This exposes the database credentials to anyone who can view the client code.
// For a production app with sensitive data, use a backend (Netlify Functions) instead.
const connectionString = import.meta.env.VITE_DATABASE_URL;

export const sql = connectionString ? neon(connectionString) : null;

export const checkConnection = async () => {
    if (!sql) {
        return { success: false, message: 'Database URL not configured.' };
    }
    try {
        const [result] = await sql`SELECT version()`;
        return { success: true, version: result.version };
    } catch (error) {
        console.error('Neon connection error:', error);
        return { success: false, message: error.message };
    }
};
