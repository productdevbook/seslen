import * as React from "react"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type RowData,
  type SortingState,
  type Table as TanstackTable,
  useReactTable,
} from "@tanstack/react-table"

declare module "@tanstack/react-table" {
  // Augment ColumnMeta so columns can declare per-cell classes.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Tailwind classes applied to both the <th> and <td> for this column. */
    className?: string
    /** Tailwind classes applied only to the <th>. */
    headClassName?: string
    /** Tailwind classes applied only to the <td>. */
    cellClassName?: string
  }
}

import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  /** Custom global filter (search) value, controlled. */
  globalFilter?: string
  onGlobalFilterChange?: (value: string) => void
  /** Custom global filter function. Receives the row's data and the filter string. */
  globalFilterFn?: (row: TData, filterValue: string) => boolean
  /** Optional click handler for an entire row. */
  onRowClick?: (row: TData) => void
  /** Render override when there are no rows. */
  emptyState?: React.ReactNode
  className?: string
  rowClassName?: string | ((row: TData) => string)
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  globalFilter,
  onGlobalFilterChange,
  globalFilterFn,
  onRowClick,
  emptyState,
  className,
  rowClassName,
}: DataTableProps<TData>): React.ReactElement {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      ...(globalFilter !== undefined ? { globalFilter } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange,
    globalFilterFn: globalFilterFn
      ? (row, _id, value: string) => globalFilterFn(row.original as TData, value)
      : "auto",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className={cn("overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10", className)}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta
                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(meta?.className, meta?.headClassName)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyState ?? "No results."}
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(
                  onRowClick ? "cursor-pointer" : undefined,
                  typeof rowClassName === "function"
                    ? rowClassName(row.original as TData)
                    : rowClassName,
                )}
                onClick={onRowClick ? () => onRowClick(row.original as TData) : undefined}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <TableCell key={cell.id} className={cn(meta?.className, meta?.cellClassName)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export type { ColumnDef, TanstackTable }
