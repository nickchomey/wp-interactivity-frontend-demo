/**
 * Search Filter Store - Intermediate Example #9
 *
 * Demonstrates:
 * - Derived state using getters
 * - Real-time filtering
 * - data-wp-each with filtered array
 */

import { store, getContext } from '@wordpress/interactivity';
import { FilterCategory } from '@shared/types';

// Helper to check if filters contain non-'all' categories
const hasNonAllFilter = ( categories: FilterCategory[] ): boolean => {
	return categories.length > 0 && ! categories.includes( FilterCategory.All );
};

interface SearchFilterContext {
	searchTerm: string;
	items: FilterItem[];
	selectedCategories: FilterCategory[];
	// Local context for category buttons
	category?: FilterCategory;
}

interface FilterItem {
	id: number;
	name: string;
	category: Exclude<FilterCategory, 'all'>;
}

const getFilteredItems = ( context: SearchFilterContext ): FilterItem[] => {
	let result = context.items;

	if ( context.searchTerm ) {
		const term = context.searchTerm.toLowerCase();
		result = result.filter(
			( item ) =>
				item.name.toLowerCase().includes( term ) ||
				item.category.toLowerCase().includes( term )
		);
	}

	// Filter by selected categories (cumulative - OR logic across selected categories)
	if ( hasNonAllFilter( context.selectedCategories ) ) {
		result = result.filter( ( item ) => context.selectedCategories.includes( item.category ) );
	}

	return result;
};

store( 'searchFilter', {
	state: {
		get filteredItems(): FilterItem[] {
			return getFilteredItems( getContext<SearchFilterContext>() );
		},
	},
	actions: {
		setCategory: () => {
			const context = getContext<SearchFilterContext>();
			// category is provided by local context on each button
			if ( context.category !== undefined ) {
				const category = context.category;
				if ( category === FilterCategory.All ) {
					// "All" resets to show everything
					context.selectedCategories = [ FilterCategory.All ];
				} else {
					// Remove 'all' if present, then toggle the clicked category
					context.selectedCategories = context.selectedCategories.filter( c => c !== FilterCategory.All );
					const index = context.selectedCategories.indexOf( category );
					if ( index > -1 ) {
						context.selectedCategories.splice( index, 1 );
					} else {
						context.selectedCategories.push( category );
					}
					// If no categories selected, reset to 'all'
					if ( context.selectedCategories.length === 0 ) {
						context.selectedCategories = [ FilterCategory.All ];
					}
				}
			}
		},
	},
} );
