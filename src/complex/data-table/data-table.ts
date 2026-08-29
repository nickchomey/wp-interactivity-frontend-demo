/**
 * Data Table Store - Complex Example #14
 *
 * Demonstrates:
 * - Multi-column sorting
 * - Pagination state
 * - Row selection
 * - Filtering
 */

import { store, getContext } from '@wordpress/interactivity';
import type { UserStatus, SortDirection, UserRole, StatusFilter } from '@shared/types';

// Helper function for sort direction comparison
const isAscending = ( dir: SortDirection | null ): boolean => dir === 'asc';

interface DataTableContext {
	sortColumn: string;
	sortDirection: SortDirection | null;
	currentPage: number;
	pageSize: number;
	selectedRows: number[];
	searchTerm: string;
	statusFilter: StatusFilter;
	// Local context for buttons/headers
	filterValue?: StatusFilter;
	columnName?: string;
	// Item added by wp-each context wrapper
	item?: TableRow;
}

interface TableRow {
	id: number;
	name: string;
	email: string;
	role: UserRole;
	status: UserStatus;
	createdAt: string;
	lastLogin: string;
}

// Sample data
const tableData: TableRow[] = [
	{ id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', status: 'active', createdAt: '2024-01-15', lastLogin: '2024-02-20' },
	{ id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'Editor', status: 'active', createdAt: '2024-02-01', lastLogin: '2024-02-19' },
	{ id: 3, name: 'Carol White', email: 'carol@example.com', role: 'Viewer', status: 'inactive', createdAt: '2023-11-20', lastLogin: '2024-01-05' },
	{ id: 4, name: 'David Brown', email: 'david@example.com', role: 'Editor', status: 'pending', createdAt: '2024-02-10', lastLogin: '' },
	{ id: 5, name: 'Eve Davis', email: 'eve@example.com', role: 'Admin', status: 'active', createdAt: '2023-09-01', lastLogin: '2024-02-21' },
	{ id: 6, name: 'Frank Miller', email: 'frank@example.com', role: 'Viewer', status: 'active', createdAt: '2024-01-25', lastLogin: '2024-02-18' },
	{ id: 7, name: 'Grace Lee', email: 'grace@example.com', role: 'Editor', status: 'active', createdAt: '2023-12-15', lastLogin: '2024-02-20' },
	{ id: 8, name: 'Henry Wilson', email: 'henry@example.com', role: 'Viewer', status: 'inactive', createdAt: '2023-10-10', lastLogin: '2023-12-01' },
	{ id: 9, name: 'Ivy Chen', email: 'ivy@example.com', role: 'Admin', status: 'active', createdAt: '2024-02-05', lastLogin: '2024-02-21' },
	{ id: 10, name: 'Jack Taylor', email: 'jack@example.com', role: 'Editor', status: 'pending', createdAt: '2024-02-15', lastLogin: '' },
	{ id: 11, name: 'Kate Anderson', email: 'kate@example.com', role: 'Viewer', status: 'active', createdAt: '2023-08-20', lastLogin: '2024-02-17' },
	{ id: 12, name: 'Liam Thomas', email: 'liam@example.com', role: 'Editor', status: 'active', createdAt: '2024-01-08', lastLogin: '2024-02-19' },
];

store( 'dataTable', {
	state: {
		// Each getter is a Preact Signals `computed` (via PropSignal).
		// Reads of `context.*` inside are tracked, so computeds cache and
		// only re-run when their dependencies change. Chaining them
		// (filtered -> sorted -> paginated) avoids the previous 3×
		// `getProcessedData(context)` per render and removes the unused
		// `filtered`/`sorted` allocations.
		get filteredData(): TableRow[] {
			const context = getContext<DataTableContext>();
			let result = tableData;
			if ( context.searchTerm ) {
				const term = context.searchTerm.toLowerCase();
				result = result.filter(
					(row) =>
						row.name.toLowerCase().includes(term) || row.email.toLowerCase().includes(term) || row.role.toLowerCase().includes(term));
			}
			if ( context.statusFilter && context.statusFilter !== 'all' ) {
				result = result.filter( ( row ) => row.status === context.statusFilter );
			}
			return result;
		},
		get sortedData(): TableRow[] {
			const context = getContext<DataTableContext>();
			const data = ( this as unknown as { filteredData: TableRow[] } ).filteredData;
			if ( ! context.sortColumn || ! context.sortDirection ) return data;
			const validColumns: (keyof TableRow)[] = [ 'id', 'name', 'email', 'role', 'status', 'createdAt', 'lastLogin' ];
			if ( ! validColumns.includes( context.sortColumn as keyof TableRow ) ) return data;
			return [ ...data ].sort( ( a, b ) => {
				const aVal = a[ context.sortColumn as keyof TableRow ];
				const bVal = b[ context.sortColumn as keyof TableRow ];
				if ( typeof aVal === 'string' && typeof bVal === 'string' ) {
					const comparison = aVal.localeCompare( bVal );
					return isAscending( context.sortDirection ) ? comparison : -comparison;
				}
				if ( typeof aVal === 'number' && typeof bVal === 'number' ) {
					return isAscending( context.sortDirection ) ? aVal - bVal : bVal - aVal;
				}
				return 0;
			} );
		},
		get paginatedData(): TableRow[] {
			const context = getContext<DataTableContext>();
			const data = ( this as unknown as { sortedData: TableRow[] } ).sortedData;
			const start = ( context.currentPage - 1 ) * context.pageSize;
			return data.slice( start, start + context.pageSize );
		},
		get totalCount(): number {
			return ( this as unknown as { filteredData: TableRow[] } ).filteredData.length;
		},
		get totalPages(): number {
			const context = getContext<DataTableContext>();
			const count = ( this as unknown as { filteredData: TableRow[] } ).filteredData.length;
			return Math.ceil( count / context.pageSize ) || 1;
		},
	},
	actions: {
		sortBy() {
			const context = getContext<DataTableContext>();
			const column = context.columnName;
			if ( ! column ) return;

			if ( context.sortColumn === column ) {
				// Cycle: asc -> desc -> none
				if ( context.sortDirection === 'asc' ) {
					context.sortDirection = 'desc';
				} else if ( context.sortDirection === 'desc' ) {
					context.sortColumn = '';
					context.sortDirection = null;
				}
			} else {
				context.sortColumn = column;
				context.sortDirection = 'asc';
			}
		},

		nextPage() {
			const context = getContext<DataTableContext>();
			const state = store( 'dataTable' ).state as unknown as { totalPages: number };
			if ( context.currentPage < state.totalPages ) {
				context.currentPage++;
			}
		},

		prevPage() {
			const context = getContext<DataTableContext>();
			if ( context.currentPage > 1 ) {
				context.currentPage--;
			}
		},

		setStatusFilter() {
			const context = getContext<DataTableContext>();
			if ( context.filterValue !== undefined ) {
				context.statusFilter = context.filterValue;
				context.currentPage = 1;
				context.selectedRows = [];
			}
		},
	},
} );
