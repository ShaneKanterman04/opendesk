'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

type UserStat = { id: string; email: string; totalDocuments: number; totalFiles: number };

export default function AdminPage() {
  const [data, setData] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('token');
    const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    fetch(`${api}/admin/users/stats`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    })
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return <div>Please log in as admin to view this page.</div>;
  if (loading) return <div>Loading…</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>Admin — User Stats</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd' }}>Email</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd' }}>Total Documents</th>
            <th style={{ textAlign: 'right', borderBottom: '1px solid #ddd' }}>Total Uploaded Files</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.id}>
              <td style={{ padding: '8px 0' }}>{d.email}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>{d.totalDocuments}</td>
              <td style={{ padding: '8px 0', textAlign: 'right' }}>{d.totalFiles}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
