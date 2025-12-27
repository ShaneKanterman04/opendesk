jest.mock('uuid', () => ({ v4: () => 'fake-uuid' }));
import { Test } from '@nestjs/testing';
import { DriveService } from './drive.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

describe('DriveService', () => {
  let service: DriveService;
  const mockPrisma: Partial<any> = {
    folder: { findMany: jest.fn(), aggregate: jest.fn() },
    file: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
    document: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), aggregate: jest.fn() },
    $transaction: jest.fn(),
    $queryRawUnsafe: jest.fn(),
  };
  const mockStorage: Partial<any> = { getPresignedGetUrl: jest.fn() };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DriveService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StorageService, useValue: mockStorage },
      ],
    }).compile();

    service = moduleRef.get(DriveService);
    // Clear all mock call history between tests to keep assertions deterministic
    jest.clearAllMocks();
  });

  it('includes documents in listContents', async () => {
    // listContents uses raw SQL fallback; mock $queryRawUnsafe for folders, files, docs
    (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'doc1', title: 'Doc' }]);

    const res = await service.listContents('user1', null);
    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(3);
    expect(res.docs).toEqual([{ id: 'doc1', title: 'Doc' }]);
  });

  describe('deleteFile', () => {
    it('soft-deletes a file when owned by user', async () => {
      const file = { id: 'f1', ownerId: 'user1' };
      (mockPrisma.file.findUnique as jest.Mock).mockResolvedValue(file);
      (mockPrisma.file.update as jest.Mock).mockResolvedValue({ ...file, deletedAt: new Date() });

      const res = await service.deleteFile('user1', 'f1');
      expect(mockPrisma.file.findUnique).toHaveBeenCalledWith({ where: { id: 'f1' } });
      expect(mockPrisma.file.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: expect.objectContaining({ deletedAt: expect.any(Date) }) });
      expect(res).toEqual(expect.objectContaining({ id: 'f1' }));
    });

    it('throws NotFoundException when file does not exist or not owned', async () => {
      (mockPrisma.file.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.deleteFile('user1', 'missing')).rejects.toThrow();
    });
  });

  describe('moveItem', () => {
    it('moves a file into a folder and sets sortOrder', async () => {
      const file = { id: 'f1', ownerId: 'user1' };
      (mockPrisma.file.findUnique as jest.Mock).mockResolvedValue(file);
      // Mock getNextSortOrderForFolder raw query
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ max: 2 }]);
      (mockPrisma.file.update as jest.Mock).mockResolvedValue({ id: 'f1', folderId: 'folder1', sortOrder: 3 });

      const res = await service.moveItem('user1', 'file', 'f1', 'folder1');
      expect(mockPrisma.file.update).toHaveBeenCalledWith({ where: { id: 'f1' }, data: { folderId: 'folder1', sortOrder: 3 } });
      expect(res).toEqual(expect.objectContaining({ id: 'f1', folderId: 'folder1', sortOrder: 3 }));
    });

    it('throws when file not found or not owned', async () => {
      (mockPrisma.file.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.moveItem('user1', 'file', 'missing', 'folder1')).rejects.toThrow();
    });

    it('moves a document into root (null folder)', async () => {
      const doc = { id: 'd1', ownerId: 'user1' };
      (mockPrisma.document.findUnique as jest.Mock).mockResolvedValue(doc);
      // Mock getNextSortOrderForFolder raw query
      (mockPrisma.$queryRawUnsafe as jest.Mock).mockResolvedValue([{ max: 0 }]);
      (mockPrisma.document.update as jest.Mock).mockResolvedValue({ id: 'd1', folderId: null, sortOrder: 1 });

      const res = await service.moveItem('user1', 'doc', 'd1', undefined);
      expect(mockPrisma.document.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { folderId: null, sortOrder: 1 } });
      expect(res).toEqual(expect.objectContaining({ id: 'd1', folderId: null, sortOrder: 1 }));
    });
  });

  describe('reorderItems', () => {
    it('reorders files inside a folder', async () => {
      const ordered = ['f1', 'f2', 'f3'];
      (mockPrisma.file.findMany as jest.Mock).mockResolvedValue(ordered.map((id) => ({ id, ownerId: 'user1' })));
      (mockPrisma.file.update as jest.Mock).mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, sortOrder: data.sortOrder }));
      (mockPrisma.$transaction as jest.Mock).mockImplementation((arr) => Promise.all(arr));

      const res = await service.reorderItems('user1', 'file', 'folder1', ordered);
      expect(mockPrisma.file.update).toHaveBeenCalledTimes(3);
      expect(mockPrisma.file.update).toHaveBeenNthCalledWith(1, { where: { id: 'f1' }, data: { sortOrder: 1 } });
      expect(res).toEqual([{ id: 'f1', sortOrder: 1 }, { id: 'f2', sortOrder: 2 }, { id: 'f3', sortOrder: 3 }]);
    });

    it('throws when one or more files are missing', async () => {
      const ordered = ['f1', 'f2', 'f3'];
      (mockPrisma.file.findMany as jest.Mock).mockResolvedValue([{ id: 'f1', ownerId: 'user1' }]);
      await expect(service.reorderItems('user1', 'file', 'folder1', ordered)).rejects.toThrow();
    });

    it('reorders documents inside a folder', async () => {
      const ordered = ['d1', 'd2'];
      (mockPrisma.document.findMany as jest.Mock).mockResolvedValue(ordered.map((id) => ({ id, ownerId: 'user1' })));
      (mockPrisma.document.update as jest.Mock).mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, sortOrder: data.sortOrder }));
      (mockPrisma.$transaction as jest.Mock).mockImplementation((arr) => Promise.all(arr));

      const res = await service.reorderItems('user1', 'doc', 'folder1', ordered);
      expect(mockPrisma.document.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.document.update).toHaveBeenNthCalledWith(2, { where: { id: 'd2' }, data: { sortOrder: 2 } });
      expect(res).toEqual([{ id: 'd1', sortOrder: 1 }, { id: 'd2', sortOrder: 2 }]);
    });

    it('throws when one or more documents are missing', async () => {
      const ordered = ['d1', 'd2'];
      (mockPrisma.document.findMany as jest.Mock).mockResolvedValue([{ id: 'd1', ownerId: 'user1' }]);
      await expect(service.reorderItems('user1', 'doc', 'folder1', ordered)).rejects.toThrow();
    });
  });
});
