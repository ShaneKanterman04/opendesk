import { Test } from '@nestjs/testing';
import { DocsService } from './docs.service';
import { PrismaService } from '../prisma.service';

describe('DocsService', () => {
  let service: DocsService;
  const mockPrisma: Partial<any> = {
    document: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DocsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = moduleRef.get(DocsService);
  });

  it('creates document with folderId and settings', async () => {
    (mockPrisma.document.create as jest.Mock).mockResolvedValue({ id: '1', title: 't' });
    const res = await service.create('user1', 'My Doc', 'fold1', { theme: 'dark' });
    expect(mockPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ folderId: 'fold1', settings: { theme: 'dark' } }),
      })
    );
    expect(res).toEqual({ id: '1', title: 't' });
  });

  it('lists documents filtered by folderId', async () => {
    (mockPrisma.document.findMany as jest.Mock).mockResolvedValue([{ id: 'd1' }]);
    const res = await service.list('user1', 'fold1');
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ ownerId: 'user1', folderId: 'fold1' }) })
    );
    expect(res).toEqual([{ id: 'd1' }]);
  });
});
