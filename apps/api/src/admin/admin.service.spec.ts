import { AdminService } from './admin.service';

describe('AdminService', () => {
  it('maps prisma counts to stats', async () => {
    const mockPrisma: any = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: '1', email: 'a@example.com', _count: { documents: 2, files: 3 } },
          { id: '2', email: 'b@example.com', _count: { documents: 0, files: 1 } },
        ]),
        findUnique: jest.fn(),
      },
    };

    const svc = new AdminService(mockPrisma as any);
    const stats = await svc.getUsersStats();
    expect(stats).toEqual([
      { id: '1', email: 'a@example.com', totalDocuments: 2, totalFiles: 3 },
      { id: '2', email: 'b@example.com', totalDocuments: 0, totalFiles: 1 },
    ]);
  });

  it('ensureIsAdmin throws for non-admin', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isAdmin: false }),
      },
    };
    const svc = new AdminService(mockPrisma as any);
    await expect(svc.ensureIsAdmin('1')).rejects.toThrow();
  });

  it('ensureIsAdmin passes for admin', async () => {
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isAdmin: true }),
      },
    };
    const svc = new AdminService(mockPrisma as any);
    await expect(svc.ensureIsAdmin('1')).resolves.toBeUndefined();
  });
});
