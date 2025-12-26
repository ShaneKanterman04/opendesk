import { Test } from '@nestjs/testing';
import { StorageService } from './storage.service';
import { ConfigService } from '@nestjs/config';

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StorageService,
        { provide: ConfigService, useValue: { get: (k: string) => undefined } },
      ],
    }).compile();

    service = moduleRef.get(StorageService);
  });

  it('removeObject retries on failure and succeeds', async () => {
    const mockClient: any = {
      removeObject: jest.fn()
        .mockRejectedValueOnce(new Error('transient'))
        .mockResolvedValueOnce(undefined),
    };

    (service as any).minioClient = mockClient;

    await expect(service.removeObject('some/key')).resolves.toBeUndefined();
    expect(mockClient.removeObject).toHaveBeenCalledTimes(2);
  });

  it('removeObject throws after max retries', async () => {
    const mockClient: any = {
      removeObject: jest.fn().mockRejectedValue(new Error('perm')),
    };
    (service as any).minioClient = mockClient;

    await expect(service.removeObject('some/key')).rejects.toThrow('perm');
    expect(mockClient.removeObject).toHaveBeenCalled();
  });
});