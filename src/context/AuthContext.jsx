import React, { createContext, useState, useContext, useEffect } from 'react';
import { db } from '../db/db';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in (simple persistence via localStorage)
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const userRecord = await db.users.where('username').equals(username).first();
            if (userRecord && userRecord.password === password) {
                const userData = { id: userRecord.id, username: userRecord.username };
                setUser(userData);
                localStorage.setItem('user', JSON.stringify(userData));
                return { success: true };
            }
            return { success: false, message: 'Invalid username or password' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Login failed' };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('user');
    };

    const updatePassword = async (newPassword) => {
        if (!user) return { success: false, message: 'Not logged in' };
        try {
            await db.users.update(user.id, { password: newPassword });
            return { success: true, message: 'Password updated successfully' };
        } catch (error) {
            console.error('Update password error:', error);
            return { success: false, message: 'Failed to update password' };
        }
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, updatePassword, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
