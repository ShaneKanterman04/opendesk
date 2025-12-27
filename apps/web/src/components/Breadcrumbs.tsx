import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  onNavigate: (id: string | null) => void;
}

export function Breadcrumbs({ items, onNavigate }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center text-sm text-muted mb-6 overflow-x-auto whitespace-nowrap pb-2">
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded-md transition-colors"
      >
        <Home size={16} className="mr-1" />
        My Drive
      </button>

      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          <ChevronRight size={16} className="mx-1 text-muted flex-shrink-0" />
          <button
            onClick={() => onNavigate(item.id)}
            className={`px-2 py-1 rounded-md transition-colors max-w-[150px] truncate ${
              index === items.length - 1
                ? 'font-medium text-foreground bg-muted/10 cursor-default'
                : 'hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
            }`}
            disabled={index === items.length - 1}
          >
            {item.name}
          </button>
        </React.Fragment>
      ))}
    </nav>
  );
}
