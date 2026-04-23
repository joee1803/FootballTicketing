"use client";

import { useEffect, useMemo, useState } from "react";

// Centralises six-item batching so fixture, ticket, and activity views cannot drift out of sync.
export function usePagedList(items = [], pageSize = 6) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage(0);
  }, [items.length, pageSize]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages - 1));
  }, [totalPages]);

  const visibleItems = useMemo(
    () => items.slice(page * pageSize, page * pageSize + pageSize),
    [items, page, pageSize]
  );

  return {
    page,
    setPage,
    totalPages,
    visibleItems,
    hasItems: items.length > 0,
    canGoPrevious: page > 0,
    canGoNext: page < totalPages - 1
  };
}
