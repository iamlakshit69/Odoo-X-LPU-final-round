import React, { useState } from 'react';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { LoadingState, EmptyState } from './States';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  searchKey?: keyof T;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  searchKey,
  searchPlaceholder = 'Search records...',
  emptyTitle,
  emptyDescription,
  pageSize = 10,
  onRowClick,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = React.useMemo(() => {
    if (!searchKey || !search.trim()) return data;
    const term = search.toLowerCase();
    return data.filter((item) => {
      const val = item[searchKey];
      return val && String(val).toLowerCase().includes(term);
    });
  }, [data, searchKey, search]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const pageData = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <div className="space-y-3">
      {searchKey && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedText" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-surface border border-border text-primaryText focus:outline-none focus:ring-1 focus:ring-accent-orange"
          />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted text-mutedText uppercase font-semibold tracking-wider border-b border-border">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className={`px-4 py-3 ${col.className || ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {pageData.length > 0 ? (
                pageData.map((row, idx) => (
                  <tr
                    key={row.id || idx}
                    onClick={() => onRowClick?.(row)}
                    className={`transition-colors hover:bg-canvas/60 ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={`px-4 py-3 text-primaryText ${col.className || ''}`}>
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    <EmptyState title={emptyTitle} description={emptyDescription} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-muted/40 text-xs text-mutedText">
            <span>
              Showing {Math.min((page - 1) * pageSize + 1, filtered.length)} -{' '}
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="p-1 rounded hover:bg-surface disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium">
                {page} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 rounded hover:bg-surface disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
