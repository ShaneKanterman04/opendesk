'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();
  const [error, setError] = useState('');
  const [adminWarning, setAdminWarning] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3001/auth/register', {
        email,
        password,
      });

      if (res.data?.adminWarning) {
        setAdminWarning(res.data.adminWarning);
        return;
      }

      router.push('/login');
    } catch (err) {
      setError('Registration failed');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <h2 className="mb-6 text-center text-2xl font-bold text-gray-900">Register for OpenDesk</h2>
        {error && <p className="mb-4 text-red-500">{error}</p>}
        {adminWarning && (
          <div className="mb-4 rounded border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
            <p className="mb-2 font-semibold">Admin created</p>
            <p className="text-sm">{adminWarning}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-3 rounded bg-blue-500 px-3 py-1 text-white"
            >
              Continue to Login
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="mb-2 block text-sm font-bold text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-6">
            <label className="mb-2 block text-sm font-bold text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full rounded bg-green-500 py-2 font-bold text-white hover:bg-green-600"
          >
            Register
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          Already have an account? <Link href="/login" className="text-blue-500">Login</Link>
        </p>
      </div>
    </div>
  );
}
