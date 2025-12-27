import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DrivePage from './page';
import axios from 'axios';
import { AuthContext } from '@/context/AuthContext';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock DnD Kit
jest.mock('@dnd-kit/core', () => ({
  ...jest.requireActual('@dnd-kit/core'),
  DndContext: ({ children, onDragEnd }: any) => (
    <div data-testid="dnd-context">
      <button
        data-testid="trigger-drag-end"
        onClick={() =>
          onDragEnd({
            active: { id: 'file-f1' },
            over: { id: 'folder-fold1' },
          })
        }
      >
        Trigger Drag End
      </button>
      {children}
    </div>
  ),
  useDroppable: ({ id }: any) => ({ isOver: false, setNodeRef: jest.fn() }),
  useSensors: jest.fn(),
  useSensor: jest.fn(),
  PointerSensor: jest.fn(),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  useSortable: ({ id }: any) => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
  }),
  verticalListSortingStrategy: {},
  arrayMove: (items: any[], from: number, to: number) => items, // Simple mock
}));

// Mock AuthContext
const mockAuth = {
  user: { id: 'user1', email: 'test@example.com' },
  login: jest.fn(),
  logout: jest.fn(),
  isAuthenticated: true,
};

describe('DrivePage Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.get.mockResolvedValue({
      data: {
        folders: [{ id: 'fold1', name: 'Folder 1' }],
        files: [{ id: 'f1', name: 'File 1' }],
        docs: [],
      },
    });
  });

  it('renders contents and handles move on drag end', async () => {
    render(
      <AuthContext.Provider value={mockAuth}>
        <DrivePage />
      </AuthContext.Provider>
    );

    // Verify initial fetch
    await waitFor(() => {
      expect(screen.getByText('Folder 1')).toBeInTheDocument();
      expect(screen.getByText('File 1')).toBeInTheDocument();
    });

    // Trigger drag end (move file f1 to folder fold1)
    mockedAxios.post.mockResolvedValue({}); // Mock move API response

    fireEvent.click(screen.getByTestId('trigger-drag-end'));

    await waitFor(() => {
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/drive/item/move'),
        {
          itemType: 'file',
          itemId: 'f1',
          folderId: 'fold1',
        },
        expect.any(Object)
      );
    });
  });
});
