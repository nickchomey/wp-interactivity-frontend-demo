/**
 * Todo List Store - Intermediate Example #6
 *
 * Demonstrates:
 * - data-wp-each (list rendering)
 * - data-wp-each-key (unique item keys)
 * - Array manipulation in context
 * - Conditional rendering based on item state
 */

import { store, getContext } from '@wordpress/interactivity';
import { KeyboardKey } from '@shared/types';

interface TodoItem {
	id: number;
	text: string;
	completed: boolean;
}

interface TodoContext {
	todos: TodoItem[];
	newTodoText: string;
	nextId: number;
	item?: TodoItem;
}

// Helper to add a todo (shared logic)
const addTodoItem = ( context: TodoContext ) => {
	const text = context.newTodoText.trim();
	if ( text ) {
		context.todos.push( {
			id: context.nextId++,
			text,
			completed: false,
		} );
		context.newTodoText = '';
	}
};

store( 'todoList', {
	actions: {
		addTodo: () => {
			const context = getContext<TodoContext>();
			addTodoItem( context );
		},
		addTodoOnEnter: ( event: KeyboardEvent ) => {
			if ( event.key === KeyboardKey.Enter ) {
				addTodoItem( getContext<TodoContext>() );
			}
		},
	},
} );
