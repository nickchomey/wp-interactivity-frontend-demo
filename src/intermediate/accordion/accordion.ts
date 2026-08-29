/**
 * Accordion Store - Intermediate Example #8
 *
 * Demonstrates:
 * - Multi-section state management
 * - data-wp-bind--aria-expanded
 * - data-wp-class--open
 * - Single vs multiple open panels
 */

import { store, getContext } from '@wordpress/interactivity';

interface AccordionContext {
	openPanels: string[];
	allowMultiple: boolean;
	// Local context for panel headers
	panelId?: string;
}

store( 'accordion', {
	actions: {
		togglePanel: () => {
			const context = getContext<AccordionContext>();
			// panelId is provided by local context on each header
			const panelId = context.panelId;
			if ( ! panelId ) return;

			const index = context.openPanels.indexOf( panelId );

			if ( index > -1 ) {
				// Close panel
				context.openPanels.splice( index, 1 );
			} else {
				// Open panel
				if ( context.allowMultiple ) {
					context.openPanels.push( panelId );
				} else {
					// Single mode - close all others first
					context.openPanels = [ panelId ];
				}
			}
		},
	},
} );
