jest.mock('uuid', () => ({ v4: () => 'fake-uuid' }));
import { Test } from '@nestjs/testing';
import { DriveService } from './drive.service';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

describe('DriveService', () => {
  let service: DriveService;
  const mockPrisma: Partial<any> = {
    folder: { findMany: jest.fn() },
    file: { findMany: jest.fn() },
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
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'user1', folderId: null }) })
    );
    expect(res.docs).toEqual([{ id: 'doc1', title: 'Doc' }]);
  });
});
