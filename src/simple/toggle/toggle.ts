/**
 * Toggle Store - Simple Example #2
 *
 * Demonstrates:
 * - data-wp-bind--hidden (show/hide elements)
 * - data-wp-bind--aria-expanded (accessibility)
 * - Boolean context values
 */

import { store, getContext } from '@wordpress/interactivity';

interface ToggleContext {
	isOpen: boolean;
}

store( 'toggle', {
	actions: {
		toggle: () => {
			const context = getContext<ToggleContext>();
			context.isOpen = !context.isOpen;
		},
	},
} );
