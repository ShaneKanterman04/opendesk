import { Test } from '@nestjs/testing';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { ExportService } from './export.service';
import { DriveService } from '../drive/drive.service';

describe('DocsController (export)', () => {
  let controller: DocsController;
  const mockDocsService: Partial<any> = {
    findOne: jest.fn(),
  };
  const mockExportService: Partial<any> = {
    convertJsonToHtml: jest.fn(),
    exportToPdf: jest.fn(),
    exportToDocx: jest.fn(),
    exportToMd: jest.fn(),
  };
  const mockDriveService: Partial<any> = {
    initUpload: jest.fn(),
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DocsController],
      providers: [
        { provide: DocsService, useValue: mockDocsService },
        { provide: ExportService, useValue: mockExportService },
        { provide: DriveService, useValue: mockDriveService },
      ],
    }).compile();

    controller = moduleRef.get(DocsController);
  });

  it('streams a PDF when destination=local', async () => {
    const fakeDoc = { id: 'd1', title: 'T', content: { content: [] }, ownerId: 'u1' };
    (mockDocsService.findOne as jest.Mock).mockResolvedValue(fakeDoc);
    (mockExportService.convertJsonToHtml as jest.Mock).mockReturnValue('<p>hi</p>');
    (mockExportService.exportToPdf as jest.Mock).mockResolvedValue(Buffer.from('pdfdata'));

    const res: any = {
      setHeader: jest.fn(),
      send: jest.fn(),
      json: jest.fn(),
    };

    await controller.export({ user: { userId: 'u1' } } as any, 'd1', { format: 'pdf', destination: 'local' }, res);

    expect(mockDocsService.findOne).toHaveBeenCalledWith('u1', 'd1');
    expect(mockExportService.exportToPdf).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('pdfdata'));
  });

  it('saves exported file to drive when destination=drive', async () => {
    const fakeDoc = { id: 'd2', title: 'MyDoc', content: { content: [] }, ownerId: 'u1' };
    (mockDocsService.findOne as jest.Mock).mockResolvedValue(fakeDoc);
    (mockExportService.convertJsonToHtml as jest.Mock).mockReturnValue('<p>x</p>');
    (mockExportService.exportToDocx as jest.Mock).mockResolvedValue(Buffer.from('docx'));

    const fileEntry = { file: { id: 'f1' } };
    (mockDriveService.initUpload as jest.Mock).mockResolvedValue(fileEntry);
    (mockDriveService.uploadFile as jest.Mock).mockResolvedValue({ status: 'ok' });

    const res: any = {
      setHeader: jest.fn(),
      send: jest.fn(),
      json: jest.fn(),
    };

    await controller.export({ user: { userId: 'u1' } } as any, 'd2', { format: 'docx', destination: 'drive', folderId: null }, res);

    expect(mockDriveService.initUpload).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'MyDoc.docx' }));
    expect(mockDriveService.uploadFile).toHaveBeenCalledWith('u1', 'f1', expect.any(Buffer), expect.any(String));
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', fileId: 'f1' });
  });
});
