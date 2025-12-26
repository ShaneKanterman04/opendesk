jest.mock('uuid', () => ({ v4: () => 'fake-uuid' }));
import { Test } from '@nestjs/testing';
import { DriveService } from './drive.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

describe('DriveService', () => {
  let service: DriveService;
  const mockPrisma: Partial<any> = {
    folder: { findMany: jest.fn() },
    file: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    document: { findMany: jest.fn() },
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
  });

  it('includes documents in listContents', async () => {
    (mockPrisma.folder.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.file.findMany as jest.Mock).mockResolvedValue([]);
    (mockPrisma.document.findMany as jest.Mock).mockResolvedValue([{ id: 'doc1', title: 'Doc' }]);

    const res = await service.listContents('user1', null);
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'user1', folderId: null, deletedAt: null }) })
    );
    expect(res.docs).toEqual([{ id: 'doc1', title: 'Doc' }]);

    // Files should be requested with deletedAt filter
    expect(mockPrisma.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'user1', folderId: null, deletedAt: null }) })
    );
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
});
