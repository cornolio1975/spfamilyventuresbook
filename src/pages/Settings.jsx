import React, { useEffect, useState } from 'react';
import { db, useSettings } from '../db/hooks';
import { seedDatabase, clearDatabase } from '../utils/seedData';
import { Save, Upload, Database, Trash2, Download, User, Lock } from 'lucide-react';
import { exportDatabase, importDatabase } from '../utils/backupRestore';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../firebase/config';

export default function Settings() {
    const currentSettings = useSettings();
    const [formData, setFormData] = useState({});
    const [status, setStatus] = useState('');
    const { user, updatePassword, logout } = useAuth();
    const [newPassword, setNewPassword] = useState('');
    const [passwordStatus, setPasswordStatus] = useState('');

    useEffect(() => {
        if (currentSettings.id && !formData.id) {
            setFormData(currentSettings);
        }
    }, [currentSettings, formData.id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e, field) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, [field]: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (formData.id) {
                await db.settings.put(formData);
                setStatus('Settings saved successfully!');
                setTimeout(() => setStatus(''), 3000);
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            setStatus('Error saving settings.');
        }
    };

    if (!formData.id) return <div className="p-4">Loading settings...</div>;

    return (
        <div className="p-4 max-w-lg mx-auto pb-24">
            <h1 className="text-2xl font-bold mb-6 text-gray-800">Company Settings</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Company Details */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 space-y-3">
                    <h2 className="font-semibold text-gray-700 mb-2">Company Details</h2>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Company Name</label>
                        <input
                            type="text"
                            name="companyName"
                            value={formData.companyName || ''}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Registration Number</label>
                        <input
                            type="text"
                            name="regNum"
                            value={formData.regNum || ''}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Description Line 1</label>
                        <input
                            type="text"
                            name="desc1"
                            value={formData.desc1 || ''}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Description Line 2</label>
                        <input
                            type="text"
                            name="desc2"
                            value={formData.desc2 || ''}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Contact Info</label>
                        <input
                            type="text"
                            name="contact"
                            value={formData.contact || ''}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Invoice Start Number</label>
                        <input
                            type="number"
                            name="invoiceStart"
                            value={formData.invoiceStart || ''}
                            onChange={handleChange}
                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="e.g. 10000"
                        />
                    </div>
                </div>

                {/* Logo Uploads */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 space-y-4">
                    <h2 className="font-semibold text-gray-700 mb-2">Logos</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Left Logo (Company)</label>
                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                                {formData.logoLeft ? (
                                    <img src={formData.logoLeft} alt="Left Logo" className="h-20 mx-auto object-contain mb-2" />
                                ) : (
                                    <div className="h-20 flex items-center justify-center text-gray-400">No Logo</div>
                                )}
                                <label className="cursor-pointer block">
                                    <span className="text-xs text-blue-600 font-medium">Change</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'logoLeft')} />
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-600 mb-2">Right Logo (Poultry)</label>
                            <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors">
                                {formData.logoRight ? (
                                    <img src={formData.logoRight} alt="Right Logo" className="h-20 mx-auto object-contain mb-2" />
                                ) : (
                                    <div className="h-20 flex items-center justify-center text-gray-400">No Logo</div>
                                )}
                                <label className="cursor-pointer block">
                                    <span className="text-xs text-blue-600 font-medium">Change</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, 'logoRight')} />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold shadow-md hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                    <Save size={20} />
                    Save Settings
                </button>

                {status && (
                    <div className={`text-center p-2 rounded ${status.includes('Error') ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                        {status}
                    </div>
                )}
            </form>

            {/* User Profile Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8 mt-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <User size={24} className="text-blue-600" />
                    User Profile
                </h2>
                <div className="space-y-4">
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <p className="text-sm text-gray-500">Logged in as</p>
                                <p className="font-bold text-gray-900">{user?.username}</p>
                            </div>
                            <button
                                onClick={logout}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                            >
                                Sign Out
                            </button>
                        </div>

                        <div className="border-t pt-4">
                            <h3 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                <Lock size={16} /> Change Password
                            </h3>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    placeholder="New Password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="flex-1 p-2 border rounded-md text-sm"
                                />
                                <button
                                    onClick={async () => {
                                        if (!newPassword) return;
                                        const result = await updatePassword(newPassword);
                                        setPasswordStatus(result.message);
                                        if (result.success) setNewPassword('');
                                        setTimeout(() => setPasswordStatus(''), 3000);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                                >
                                    Update
                                </button>
                            </div>
                            {passwordStatus && (
                                <p className={`text-xs mt-2 ${passwordStatus.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                                    {passwordStatus}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Management Section */}
            <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Database size={24} className="text-blue-600" />
                    Data Management
                </h2>
                <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                        <h3 className="font-semibold text-blue-900 mb-2">Backup & Restore</h3>
                        <p className="text-sm text-blue-700 mb-4">
                            Save your data to a file or restore from a backup. Use this to move data between devices.
                        </p>
                        <div className="flex flex-col md:flex-row gap-4">
                            <button
                                onClick={async () => {
                                    const result = await exportDatabase();
                                    alert(result.message);
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                <Download size={18} /> Export Data
                            </button>
                            <label className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer">
                                <Upload size={18} /> Import Data
                                <input
                                    type="file"
                                    accept=".json"
                                    className="hidden"
                                    onChange={async (e) => {
                                        if (e.target.files?.[0]) {
                                            if (confirm('This will merge the backup data with your current data. Continue?')) {
                                                const result = await importDatabase(e.target.files[0]);
                                                alert(result.message);
                                                if (result.success) {
                                                    window.location.reload();
                                                }
                                            }
                                        }
                                    }}
                                />
                            </label>
                        </div>
                    </div>

                    <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                        <h3 className="font-semibold text-green-900 mb-2">Cloud Sync Status</h3>
                        <p className="text-sm text-green-700 mb-4">
                            Check if your device can connect to the cloud database.
                        </p>
                        <button
                            onClick={async () => {
                                try {
                                    await setDoc(doc(firestoreDb, '_connection_test', 'test'), {
                                        timestamp: new Date().toISOString(),
                                        device: navigator.userAgent
                                    });
                                    alert('Connection Successful! Cloud sync is working.');
                                } catch (error) {
                                    console.error(error);
                                    alert('Connection Failed: ' + error.message + '\n\nPlease check your Firestore Rules in the Firebase Console.');
                                }
                            }}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                            <Database size={18} /> Test Connection
                        </button>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-12 border-t pt-8">
                <h2 className="text-lg font-bold text-red-600 mb-4">Danger Zone</h2>
                <button
                    onClick={async () => {
                        if (confirm('WARNING: This will delete ALL data (customers, products, sales). This action cannot be undone. Are you sure?')) {
                            const result = await clearDatabase();
                            alert(result.message);
                        }
                    }}
                    className="w-full bg-red-50 text-red-600 border border-red-200 py-3 rounded-lg font-semibold hover:bg-red-100 flex items-center justify-center gap-2 mb-3"
                >
                    <Trash2 size={20} />
                    Clear All Data
                </button>
                <button
                    onClick={async () => {
                        if (confirm('WARNING: This will delete ALL data (customers, products, sales) and replace it with sample data. Are you sure?')) {
                            await clearDatabase();
                            const result = await seedDatabase();
                            alert(result.message);
                        }
                    }}
                    className="w-full bg-red-50 text-red-600 border border-red-200 py-3 rounded-lg font-semibold hover:bg-red-100 flex items-center justify-center gap-2"
                >
                    <Database size={20} />
                    Reset & Seed Sample Data
                </button>
            </div>
        </div>
    );
}
