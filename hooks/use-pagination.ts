import { useState, useMemo } from "react"

export function usePagination<T>(items: T[], pageSize: number = 10) {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(pageSize)

  const totalPages = Math.ceil(items.length / itemsPerPage)

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return items.slice(start, start + itemsPerPage)
  }, [items, currentPage, itemsPerPage])

  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  const nextPage = () => goToPage(currentPage + 1)
  const prevPage = () => goToPage(currentPage - 1)

  const startIndex = (currentPage - 1) * itemsPerPage + 1
  const endIndex = Math.min(currentPage * itemsPerPage, items.length)

  return {
    currentPage,
    totalPages,
    itemsPerPage,
    paginatedItems,
    setItemsPerPage: (size: number) => { setItemsPerPage(size); setCurrentPage(1) },
    goToPage,
    nextPage,
    prevPage,
    startIndex,
    endIndex,
    totalItems: items.length,
  }
}
