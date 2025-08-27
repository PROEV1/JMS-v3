import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface PaginationState {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginationControls {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  resetToFirstPage: () => void;
}

export interface UsePaginationReturn {
  pagination: PaginationState;
  controls: PaginationControls;
}

export function useServerPagination(defaultPageSize: number = 25): UsePaginationReturn {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize from URL params or defaults
  const [page, setPageState] = useState(() => {
    const urlPage = searchParams.get('page');
    return urlPage ? Math.max(1, parseInt(urlPage)) : 1;
  });
  
  const [pageSize, setPageSizeState] = useState(() => {
    const urlPageSize = searchParams.get('pageSize');
    const parsed = urlPageSize ? parseInt(urlPageSize) : defaultPageSize;
    return [25, 50, 100].includes(parsed) ? parsed : defaultPageSize;
  });

  // Update URL when pagination changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    if (page === 1) {
      params.delete('page');
    } else {
      params.set('page', page.toString());
    }
    
    if (pageSize === defaultPageSize) {
      params.delete('pageSize');
    } else {
      params.set('pageSize', pageSize.toString());
    }
    
    setSearchParams(params, { replace: true });
  }, [page, pageSize, searchParams, setSearchParams, defaultPageSize]);

  const setPage = (newPage: number) => {
    setPageState(Math.max(1, newPage));
  };

  const setPageSize = (newPageSize: number) => {
    setPageSizeState(newPageSize);
    setPageState(1); // Reset to first page when changing page size
  };

  const resetToFirstPage = () => {
    setPageState(1);
  };

  return {
    pagination: {
      page,
      pageSize,
      offset: (page - 1) * pageSize,
    },
    controls: {
      setPage,
      setPageSize,
      resetToFirstPage,
    },
  };
}