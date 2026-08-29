/**
 * Star Rating Store - Intermediate Example #10
 *
 * Demonstrates:
 * - data-wp-on--click (selection)
 * - data-wp-on--mouseenter / data-wp-on--mouseleave (hover preview)
 * - data-wp-class (visual feedback)
 * - Combined interaction patterns
 */

import { store, getContext } from '@wordpress/interactivity';
import { RatingCategory } from '@shared/types';

interface StarRatingContext {
	rating: number;
	hoverRating: number;
	maxRating: number;
	hasSubmitted: boolean;
	ratingTexts: string[];
	ratingClasses: Record<RatingCategory, string>;
	// Item added by wp-each context wrapper
	item?: number;
}

store( 'starRating', {
	state: {
		get stars(): number[] {
			const context = getContext<StarRatingContext>();
			return Array.from( { length: context.maxRating }, ( _, i ) => i + 1 );
		},
	},
	actions: {
		submitRating: () => {
			const context = getContext<StarRatingContext>();
			if ( context.rating > 0 ) {
				context.hasSubmitted = true;

				// In a real app, this would send to server
				console.log( 'Submitted rating:', context.rating );
			}
		},
	},
} );
