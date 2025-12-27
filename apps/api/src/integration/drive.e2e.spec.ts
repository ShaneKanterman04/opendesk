import { describe, it, beforeAll, expect, jest } from '@jest/globals';
const supertest = require('supertest');

jest.setTimeout(180_000);

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';
const api = supertest(API_BASE);

describe('Drive E2E against running infra', () => {
  let token: string;
  let folderId: string;
  let docId: string;

  beforeAll(async () => {
    // wait for API to be responsive (200/401) up to ~60s
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      try {
        const res = await api.get('/drive/list');
        if ([200, 401].includes(res.status)) break;
      } catch (e) {
        // ignore and retry
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    // register a fresh user
    const email = `e2e+${Date.now()}@example.com`;
    const password = 'password123';

    const reg = await api.post('/auth/register').send({ email, password }).set('Content-Type', 'application/json');
    expect([200, 201]).toContain(reg.status);

    const login = await api.post('/auth/login').send({ email, password }).set('Content-Type', 'application/json');
    expect(login.status).toBe(201);
    token = login.body?.access_token;
    expect(token).toBeTruthy();
  });

  it('creates a folder and document, exports, deletes and verifies listing', async () => {
    // create folder
    const folderRes = await api.post('/drive/folders').set('Authorization', `Bearer ${token}`).send({ name: 'e2e-folder' });
    expect([200, 201]).toContain(folderRes.status);
    folderId = folderRes.body?.id;
    expect(folderId).toBeTruthy();

    // create doc in folder
    const docRes = await api.post('/docs').set('Authorization', `Bearer ${token}`).send({ title: 'E2E Doc', folderId });
    expect([200, 201]).toContain(docRes.status);
    docId = docRes.body?.id;
    expect(docId).toBeTruthy();

    // list drive and assert doc present
    const list = await api.get('/drive/list').set('Authorization', `Bearer ${token}`).query({ folderId });
    expect(list.status).toBe(200);
    const docs = list.body.docs || [];
    expect(docs.some((d: any) => d.id === docId)).toBe(true);

    // rename folder
    const newFolderName = 'renamed-e2e-folder';
    const renameFolderRes = await api.put(`/drive/folder/${folderId}`).set('Authorization', `Bearer ${token}`).send({ name: newFolderName });
    expect([200, 204]).toContain(renameFolderRes.status);

    // verify folder rename at root
    const rootList = await api.get('/drive/list').set('Authorization', `Bearer ${token}`);
    expect(rootList.status).toBe(200);
    const folders = rootList.body.folders || [];
    expect(folders.some((f: any) => f.id === folderId && f.name === newFolderName)).toBe(true);

    // rename document
    const newDocTitle = 'Renamed E2E Doc';
    const renameDocRes = await api.put(`/docs/${docId}`).set('Authorization', `Bearer ${token}`).send({ title: newDocTitle });
    expect([200, 204]).toContain(renameDocRes.status);

    // verify doc rename within folder
    const listAfterRename = await api.get('/drive/list').set('Authorization', `Bearer ${token}`).query({ folderId });
    expect(listAfterRename.status).toBe(200);
    const docsAfter = listAfterRename.body.docs || [];
    expect(docsAfter.some((d: any) => d.id === docId && d.title === newDocTitle)).toBe(true);

    // export doc as markdown (local)
    const exportRes = await api.post(`/docs/${docId}/export`).set('Authorization', `Bearer ${token}`).send({ format: 'md', destination: 'local', html: '<p>hi</p>' });
    expect([200, 201]).toContain(exportRes.status);
    // response should be a buffer/stream; supertest stores buffer in body as string for binary — check content-length header or body length
    const contentType = exportRes.headers['content-type'] || '';
    expect(contentType).toMatch(/markdown|text|octet-stream/);
    expect(exportRes.body).toBeDefined();

    // delete doc
    const del = await api.delete(`/docs/${docId}`).set('Authorization', `Bearer ${token}`);
    expect([200, 204]).toContain(del.status);

    // list again, doc should be absent
    const list2 = await api.get('/drive/list').set('Authorization', `Bearer ${token}`).query({ folderId });
    expect(list2.status).toBe(200);
    const docs2 = list2.body.docs || [];
    expect(docs2.some((d: any) => d.id === docId)).toBe(false);
  });
});
