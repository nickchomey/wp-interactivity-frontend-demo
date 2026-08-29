/**
 * Form Wizard Store - Complex Example #12
 *
 * Demonstrates:
 * - Multi-step form state management
 * - Complex validation logic
 * - Async submit with loading states
 * - data-wp-bind--disabled for navigation
 */

import { store, getContext, getElement, splitTask } from '@wordpress/interactivity';
import { KeyboardKey } from '@shared/types';

// Validation constants
const MIN_NAME_LENGTH = 2;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_ERROR = 'Name must be at least 2 characters';
const EMAIL_ERROR = 'Please enter a valid email address';

// Validation helpers (return true if valid)
const isValidName = ( name: string ): boolean => name.trim().length >= MIN_NAME_LENGTH;
const isValidEmail = ( email: string ): boolean => {
	if ( ! email ) {
		return false;
	}
	return EMAIL_REGEX.test( email.toLowerCase() );
};

interface FormWizardContext {
	currentStep: number;
	totalSteps: number;
	isSubmitting: boolean;
	isComplete: boolean;

	// Form fields
	name: string;
	email: string;
	phone: string;
	message: string;
	preferences: string[];

	// Validation
	errors: Record<string, string>;

	// Local context for inputs
	fieldName?: keyof FormWizardContext;
	// Local context for wizard steps
	stepNumber?: number;

    // Focus
    needsFocus: boolean;
}

const { state, actions } = store( 'formWizard', {
	state: {
		get isStepValid(): boolean {
			const context = getContext<FormWizardContext>();
			const step = context.currentStep;
			switch ( step ) {
				case 1:
					return isValidName( context.name );
				case 2:
					return isValidEmail( context.email );
				case 3:
					return isValidName( context.name ) && isValidEmail( context.email );
				default:
					return true;
			}
		},
	},
	actions: {
		nextStep: () => {
			const context = getContext<FormWizardContext>();
			if ( context.currentStep < context.totalSteps ) {
				context.currentStep++;
			}
            context.needsFocus = true;
		},

		handleEnter: ( event: KeyboardEvent ) => {
			if ( event.key !== KeyboardKey.Enter || !state.isStepValid || getContext<FormWizardContext>().currentStep >= getContext<FormWizardContext>().totalSteps ) return;
            actions.nextStep();
		},

		prevStep: () => {
			const context = getContext<FormWizardContext>();
			if ( context.currentStep > 1 ) {
				context.currentStep--;
			}
            context.needsFocus = true;
		},

		validateField: () => {
			const context = getContext<FormWizardContext>();
			const field = context.fieldName;
			if ( ! field ) return;
			const value = context[ field ] as unknown as string;
			const isValid = field === 'email' ? isValidEmail( value ) : field === 'name' ? isValidName( value ) : true;
			if ( ! isValid ) {
				const errorMessage = field === 'email' ? EMAIL_ERROR : NAME_ERROR;
				context.errors = { ...context.errors, [ field ]: errorMessage };
			} else {
				const { [ field ]: _, ...rest } = context.errors;
				context.errors = rest;
			}
		},

		*submitForm() {
			const context = getContext<FormWizardContext>();

			if ( ! state.isStepValid ) return;

			context.isSubmitting = true;
			yield splitTask();

			// Simulate API call
			yield new Promise( ( resolve ) => setTimeout( resolve, 1500 ) );

			context.isSubmitting = false;
			context.isComplete = true;

			console.log( 'Form submitted:', {
				name: context.name,
				email: context.email,
				phone: context.phone,
				message: context.message,
				preferences: context.preferences,
			} );
		},

	},
	callbacks: {
		focusWhenVisible: () => {
			const { ref } = getElement();
            const context = getContext<FormWizardContext>();

            if (ref && context.needsFocus) {
              const toFocus: HTMLElement | null =
                    ref.querySelector(':scope :not([hidden]) :is(input, [data-wp-on--click="actions.submitForm"]:not([hidden]))');

              if (toFocus) {
                toFocus.focus();
                context.needsFocus = false;
              }
            }
		},
	},
} );
