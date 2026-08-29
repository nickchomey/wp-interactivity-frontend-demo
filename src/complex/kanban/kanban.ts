/**
 * Kanban Board Store - The Masterpiece
 *
 * This is the capstone example demonstrating ALL directives and patterns
 * in one cohesive, impressive experience.
 *
 * Demonstrates:
 * - Nested data-wp-each (columns → cards)
 * - data-wp-on-window--* (global keyboard shortcuts)
 * - Multi-zone drag-drop between columns
 * - Undo/redo with history stack
 * - Search & filter with derived state
 * - Focus management with data-wp-watch
 */

import {
	store,
	getContext,
	getElement,
	withSyncEvent,
	splitTask,
} from '@wordpress/interactivity';

// =============================================================================
// ENUMS
// =============================================================================

/** Priority levels for kanban cards */
export enum Priority {
	High = 'high',
	Medium = 'medium',
	Low = 'low',
}

export type PriorityFilter = 'all' | Priority;

/** Command types for undo/redo operations */
export enum CommandType {
	Move = 'move',
	Create = 'create',
	Edit = 'edit',
	Delete = 'delete',
}

// =============================================================================
// TYPES
// =============================================================================

export interface KanbanCard {
	id: string;
	title: string;
	description?: string;
	priority: Priority;
	assignee?: string;
	createdAt: number;
}

export interface KanbanColumn {
	id: string;
	title: string;
	cards: KanbanCard[];
	color: string;
}

// =============================================================================
// COMMAND PATTERN - Reversible operations for undo/redo + revision history
// =============================================================================

interface BaseCommand {
	type: CommandType;
	timestamp: number;
	description: string;
	// Unique sequence ID for reliable comparison (avoids timestamp collisions)
	seqId: number;
}

export interface MoveCommand extends BaseCommand {
	type: CommandType.Move;
	cardId: string;
	cardTitle: string;
	from: { columnId: string; index: number };
	to: { columnId: string; index: number };
}

export interface CreateCommand extends BaseCommand {
	type: CommandType.Create;
	card: KanbanCard;
	columnId: string;
}

export interface EditCommand extends BaseCommand {
	type: CommandType.Edit;
	cardId: string;
	oldValues: { title: string; priority: Priority; description: string; assignee: string };
	newValues: { title: string; priority: Priority; description: string; assignee: string };
}

export interface DeleteCommand extends BaseCommand {
	type: CommandType.Delete;
	card: KanbanCard;
	columnId: string;
	index: number;
}

export type Command = MoveCommand | CreateCommand | EditCommand | DeleteCommand;

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_TITLE_LENGTH = 200;
const MAX_HISTORY_SIZE = 50;

// Monotonic sequence counter for unique command IDs
let commandSeqId = 0;

interface KanbanContext {
	columns: KanbanColumn[];
	draggedCardId: string | null;
	sourceColumnId: string | null;
	dropTargetColumnId: string | null;
	dropTargetCardId: string | null;
	dropPosition: 'before' | 'after';
	editingCardId: string | null;
	editTitle: string;
	editPriority: Priority;
	editDescription: string;
	editAssignee: string;
	searchQuery: string;
	filterPriority: PriorityFilter;
	history: Command[];
	historyIndex: number;
	newCardModalOpen: boolean;
	newCardColumnId: string | null;
	newCardTitle: string;
	newCardPriority: Priority;
	newCardDescription: string;
	newCardAssignee: string;
	revisionPanelOpen: boolean;
	hoveredRevisionId: string | null;
	// Auto-provided by wp-each
	item?: KanbanColumn | KanbanCard | Command;
}

// =============================================================================
// COMMAND EXECUTION
// =============================================================================

/** Find card location across all columns */
const findCardLocation = (
	columns: KanbanColumn[],
	cardId: string
): { column: KanbanColumn; index: number } | null => {
	for ( const column of columns ) {
		const index = column.cards.findIndex( ( c ) => c.id === cardId );
		if ( index !== -1 ) {
			return { column, index };
		}
	}
	return null;
};

/** Execute a command (apply changes) */
const executeCommand = ( columns: KanbanColumn[], command: Command ): void => {
	switch ( command.type ) {
		case CommandType.Move: {
			const location = findCardLocation( columns, command.cardId );
			if ( ! location ) return;
			const [ card ] = location.column.cards.splice( location.index, 1 );
			const targetColumn = findColumn( columns, command.to.columnId );
			if ( card && targetColumn ) {
				targetColumn.cards.splice( command.to.index, 0, card );
			}
			break;
		}
		case CommandType.Create: {
			const column = findColumn( columns, command.columnId );
			if ( column ) {
				column.cards.push( command.card );
			}
			break;
		}
		case CommandType.Edit: {
			const location = findCardLocation( columns, command.cardId );
			if ( location ) {
				location.column.cards[ location.index ].title = command.newValues.title;
				location.column.cards[ location.index ].priority = command.newValues.priority;
				location.column.cards[ location.index ].description = command.newValues.description || undefined;
				location.column.cards[ location.index ].assignee = command.newValues.assignee || undefined;
			}
			break;
		}
		case CommandType.Delete: {
			const column = findColumn( columns, command.columnId );
			if ( column ) {
				const index = column.cards.findIndex( ( c ) => c.id === command.card.id );
				if ( index !== -1 ) {
					column.cards.splice( index, 1 );
				}
			}
			break;
		}
	}
};

/** Reverse a command (undo changes) */
const reverseCommand = ( columns: KanbanColumn[], command: Command ): void => {
	switch ( command.type ) {
		case CommandType.Move: {
			// Reverse: move from 'to' back to 'from'
			const location = findCardLocation( columns, command.cardId );
			if ( ! location ) return;
			const [ card ] = location.column.cards.splice( location.index, 1 );
			const sourceColumn = findColumn( columns, command.from.columnId );
			if ( card && sourceColumn ) {
				sourceColumn.cards.splice( command.from.index, 0, card );
			}
			break;
		}
		case CommandType.Create: {
			// Reverse: delete the created card
			const column = findColumn( columns, command.columnId );
			if ( column ) {
				const index = column.cards.findIndex( ( c ) => c.id === command.card.id );
				if ( index !== -1 ) {
					column.cards.splice( index, 1 );
				}
			}
			break;
		}
		case CommandType.Edit: {
			// Reverse: restore old values
			const location = findCardLocation( columns, command.cardId );
			if ( location ) {
				location.column.cards[ location.index ].title = command.oldValues.title;
				location.column.cards[ location.index ].priority = command.oldValues.priority;
				location.column.cards[ location.index ].description = command.oldValues.description || undefined;
				location.column.cards[ location.index ].assignee = command.oldValues.assignee || undefined;
			}
			break;
		}
		case CommandType.Delete: {
			// Reverse: restore the deleted card
			const column = findColumn( columns, command.columnId );
			if ( column ) {
				column.cards.splice( command.index, 0, command.card );
			}
			break;
		}
	}
};

/** Add command to history with size limit */
const pushCommand = ( context: KanbanContext, command: Command ): void => {
	// Truncate future history if we're not at the end
	context.history = context.history.slice( 0, context.historyIndex + 1 );

	// Add new command
	context.history.push( command );

	// Enforce max history size
	if ( context.history.length > MAX_HISTORY_SIZE ) {
		context.history = context.history.slice( -MAX_HISTORY_SIZE );
		// Recalculate index: if we were at the end, stay at the new end
		context.historyIndex = Math.min( context.historyIndex, context.history.length - 1 );
	} else {
		context.historyIndex = context.history.length - 1;
	}
};

// =============================================================================
// HELPERS
// =============================================================================

/** Find column by ID */
const findColumn = ( columns: KanbanColumn[], id: string ): KanbanColumn | undefined =>
	columns.find( ( c ) => c.id === id );

/** Check if element is an input-like element */
const isInputElement = (
	target: unknown
): target is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
	target instanceof HTMLInputElement ||
	target instanceof HTMLTextAreaElement ||
	target instanceof HTMLSelectElement;

/** Reset new card modal state */
const resetNewCardModal = ( context: KanbanContext ): void => {
	context.newCardModalOpen = false;
	context.newCardColumnId = null;
	context.newCardTitle = '';
	context.newCardDescription = '';
	context.newCardAssignee = '';
};

/** Generate unique card ID: timestamp + 7 random chars */
const generateId = (): string => {
	const RANDOM_CHARS = 7;
	const RADIX = 36;
	return `card-${ Date.now() }-${ Math.random().toString( RADIX ).substring( 2, 2 + RANDOM_CHARS ) }`;
};

/** Sanitize and validate title input */
const sanitizeTitle = ( title: string ): string => {
	return title.trim().slice( 0, MAX_TITLE_LENGTH );
};

/** Generate descriptive edit message */
const getEditDescription = (
	oldValues: { title: string; priority: Priority; description: string; assignee: string },
	newValues: { title: string; priority: Priority; description: string; assignee: string }
): string => {
	const titleChanged = oldValues.title !== newValues.title;
	const priorityChanged = oldValues.priority !== newValues.priority;
	const descriptionChanged = oldValues.description !== newValues.description;
	const assigneeChanged = oldValues.assignee !== newValues.assignee;
	const cardTitle = newValues.title;

	const changes: string[] = [];
	if ( titleChanged ) changes.push( 'title' );
	if ( priorityChanged ) changes.push( 'priority' );
	if ( descriptionChanged ) changes.push( 'description' );
	if ( assigneeChanged ) changes.push( 'assignee' );

	if ( changes.length === 0 ) {
		return `"${ cardTitle }" ✎`;
	}

	return `"${ cardTitle }" ✎ ${ changes.join( ', ' ) }`;
};

/** Reset drag state to clean values */
const resetDragState = ( context: KanbanContext ): void => {
	context.draggedCardId = null;
	context.sourceColumnId = null;
	context.dropTargetColumnId = null;
	context.dropTargetCardId = null;
};

/** Perform edit save - shared between blur and explicit save */
const performEdit = ( context: KanbanContext ): void => {
	const sanitizedTitle = sanitizeTitle( context.editTitle );
	if ( ! context.editingCardId || ! sanitizedTitle ) {
		context.editingCardId = null;
		return;
	}

	const location = findCardLocation( context.columns, context.editingCardId );
	if ( ! location ) {
		context.editingCardId = null;
		return;
	}

	const card = location.column.cards[ location.index ];
	const oldValues = {
		title: card.title,
		priority: card.priority,
		description: card.description || '',
		assignee: card.assignee || '',
	};
	const newValues = {
		title: sanitizedTitle,
		priority: context.editPriority,
		description: context.editDescription.trim(),
		assignee: context.editAssignee.trim(),
	};

	const command: EditCommand = {
		type: CommandType.Edit,
		cardId: context.editingCardId,
		oldValues,
		newValues,
		timestamp: Date.now(),
		description: getEditDescription( oldValues, newValues ),
		seqId: ++commandSeqId,
	};

	card.title = newValues.title;
	card.priority = newValues.priority;
	card.description = newValues.description || undefined;
	card.assignee = newValues.assignee || undefined;
	pushCommand( context, command );
	context.editingCardId = null;
};

/** Initialize new card modal with default values */
const initNewCardModal = ( context: KanbanContext, columnId: string | null ): void => {
	context.newCardColumnId = columnId;
	context.newCardModalOpen = true;
	context.newCardTitle = '';
	context.newCardPriority = Priority.Medium;
	context.newCardDescription = '';
	context.newCardAssignee = '';
};

// =============================================================================
// STORE HELPERS
// =============================================================================

/** Extract card ID from any command type */
const getCardIdFromCommand = ( command: Command | undefined ): string | null => {
	if ( ! command ) return null;
	switch ( command.type ) {
		case CommandType.Move:
		case CommandType.Edit:
			return command.cardId;
		case CommandType.Create:
		case CommandType.Delete:
			return command.card.id;
		default:
			return null;
	}
};

/** Perform undo - shared by keyboard handler and action */
const performUndo = ( context: KanbanContext ): void => {
	if ( context.historyIndex >= 0 ) {
		reverseCommand( context.columns, context.history[ context.historyIndex ] );
		context.historyIndex--;
	}
};

/** Perform redo - shared by keyboard handler and action */
const performRedo = ( context: KanbanContext ): void => {
	if ( context.historyIndex < context.history.length - 1 ) {
		context.historyIndex++;
		executeCommand( context.columns, context.history[ context.historyIndex ] );
	}
};

// =============================================================================
// STORE
// =============================================================================

store( 'kanban', {
	state: {
		// Get filtered cards for current column
		get filteredCards(): KanbanCard[] {
			const context = getContext<KanbanContext>();
			const column = context.item as KanbanColumn | undefined;
			if ( ! column ) return [];

			let cards = column.cards;

			// Filter by search query
			if ( context.searchQuery ) {
				const query = context.searchQuery.toLowerCase();
				cards = cards.filter(
					( card ) =>
						card.title.toLowerCase().includes( query ) ||
						card.description?.toLowerCase().includes( query ) ||
						card.assignee?.toLowerCase().includes( query )
				);
			}

			// Filter by priority
			if ( context.filterPriority !== 'all' ) {
				cards = cards.filter(
					( card ) => card.priority === context.filterPriority
				);
			}

			return cards;
		},

		// ========================
		// REVISION HISTORY
		// ========================

		// Get the column name for in-column moves
		get revisionMoveColumn(): string {
			const context = getContext<KanbanContext>();
			const command = context.item as MoveCommand | undefined;
			if ( ! command || command.type !== CommandType.Move ) return '';
			const column = context.columns.find( c => c.id === command.to.columnId );
			return column?.title || '';
		},

		// Get column name where card was created
		get revisionCreateColumn(): string {
			const context = getContext<KanbanContext>();
			const command = context.item as CreateCommand | undefined;
			if ( ! command || command.type !== CommandType.Create ) return '';
			const column = context.columns.find( c => c.id === command.columnId );
			return column?.title || '';
		},

		// Get card title from revision
		get revisionCardTitle(): string {
			const context = getContext<KanbanContext>();
			const command = context.item as Command | undefined;
			if ( ! command ) return '';
			switch ( command.type ) {
				case CommandType.Move:
					return command.cardTitle;
				case CommandType.Edit:
					return command.newValues.title;
				case CommandType.Create:
				case CommandType.Delete:
					return command.card.title;
				default:
					return '';
			}
		},

		// Get from column name (for moves)
		get revisionFromColumn(): string {
			const context = getContext<KanbanContext>();
			const command = context.item as MoveCommand | undefined;
			if ( ! command || command.type !== CommandType.Move ) return '';
			const column = context.columns.find( c => c.id === command.from.columnId );
			return column?.title || '';
		},

		// Get to column name (for moves)
		get revisionToColumn(): string {
			const context = getContext<KanbanContext>();
			const command = context.item as MoveCommand | undefined;
			if ( ! command || command.type !== CommandType.Move ) return '';
			const column = context.columns.find( c => c.id === command.to.columnId );
			return column?.title || '';
		},

		// Get relative time ago
		get revisionTimeAgo(): string {
			const context = getContext<KanbanContext>();
			const command = context.item as Command | undefined;
			if ( ! command ) return '';

			const now = Date.now();
			const diff = now - command.timestamp;
			const seconds = Math.floor( diff / 1000 );
			const minutes = Math.floor( seconds / 60 );
			const hours = Math.floor( minutes / 60 );

			if ( seconds < 60 ) return 'just now';
			if ( minutes < 60 ) return `${ minutes } min ago`;
			if ( hours < 24 ) return `${ hours }h ago`;
			return `${ Math.floor( hours / 24 ) }d ago`;
		},
	},

	actions: {
		// ========================
		// DRAG & DROP
		// ========================

		handleDragStart: withSyncEvent( ( event: DragEvent ) => {
			const context = getContext<KanbanContext>();
			const { ref } = getElement();
			const card = context.item as KanbanCard | undefined;
			if ( ! card ) return;

			context.draggedCardId = card.id;

			// Find source column using existing helper
			const location = findCardLocation( context.columns, card.id );
			if ( location ) {
				context.sourceColumnId = location.column.id;
			}

			if ( event.dataTransfer && ref ) {
				event.dataTransfer.setData(
					'text/plain',
					card.id
				);
				event.dataTransfer.effectAllowed = 'move';
				const rect = ref.getBoundingClientRect();
				event.dataTransfer.setDragImage(
					ref,
					rect.width / 2,
					rect.height / 2
				);
			}
		} ),

		handleDragOver: withSyncEvent( ( event: DragEvent ) => {
			event.preventDefault();
			if ( event.dataTransfer ) {
				event.dataTransfer.dropEffect = 'move';
			}

			const context = getContext<KanbanContext>();
			const column = context.item as KanbanColumn | undefined;

			// Set column as drop target
			if ( column && column.id !== context.sourceColumnId ) {
				context.dropTargetColumnId = column.id;
				context.dropTargetCardId = null;
			}
		} ),

		handleCardDragOver: withSyncEvent( ( event: DragEvent ) => {
			event.preventDefault();
			event.stopPropagation();

			if ( event.dataTransfer ) {
				event.dataTransfer.dropEffect = 'move';
			}

			const context = getContext<KanbanContext>();
			const { ref } = getElement();
			const card = context.item as KanbanCard | undefined;

			if (
				! card ||
				card.id === context.draggedCardId
			) {
				return;
			}

			context.dropTargetCardId = card.id;

			// Determine position based on Y coordinate
			if ( ref ) {
				const rect = ref.getBoundingClientRect();
				const midY = rect.top + rect.height / 2;
				context.dropPosition =
					event.clientY < midY ? 'before' : 'after';
			}
		} ),

		handleCardDragLeave: withSyncEvent( ( event: DragEvent ) => {
			event.stopPropagation();
			const context = getContext<KanbanContext>();
			const card = context.item as KanbanCard | undefined;

			// Only clear if we're actually leaving this card
			const { ref } = getElement();
			if ( ref && ! ref.contains( event.relatedTarget as Node ) ) {
				if ( context.dropTargetCardId === card?.id ) {
					context.dropTargetCardId = null;
				}
			}
		} ),

		handleDropOnColumn: withSyncEvent( ( event: DragEvent ) => {
			event.preventDefault();
			event.stopPropagation();

			const context = getContext<KanbanContext>();
			const column = context.item as KanbanColumn | undefined;
			const targetColumnId = column?.id;

			if (
				! context.draggedCardId ||
				! context.sourceColumnId ||
				! targetColumnId
			) {
				return;
			}

			// Find source column and card
			const sourceColumn = findColumn( context.columns, context.sourceColumnId );
			const targetColumn = findColumn( context.columns, targetColumnId );

			if ( ! sourceColumn || ! targetColumn ) return;

			const cardIndex = sourceColumn.cards.findIndex(
				( c ) => c.id === context.draggedCardId
			);
			if ( cardIndex === -1 ) return;

			const card = sourceColumn.cards[ cardIndex ];

			// Determine insertion position
			let insertIndex = targetColumn.cards.length;
			if ( context.dropTargetCardId ) {
				const targetIndex = targetColumn.cards.findIndex(
					( c ) => c.id === context.dropTargetCardId
				);
				if ( targetIndex !== -1 ) {
					insertIndex =
						context.dropPosition === 'before'
							? targetIndex
							: targetIndex + 1;
				}
			}

			// Skip if no actual movement (same column, same effective position)
			if ( sourceColumn === targetColumn ) {
				// After splicing out, indices shift - calculate final position
				const finalIndex = insertIndex > cardIndex ? insertIndex - 1 : insertIndex;
				if ( finalIndex === cardIndex ) {
					resetDragState( context );
					return;
				}
			}

			// Calculate the actual insertion index after splice
			// If same column and inserting after current position, adjust for the removed card
			let actualInsertIndex = insertIndex;
			if ( sourceColumn === targetColumn && insertIndex > cardIndex ) {
				actualInsertIndex = insertIndex - 1;
			}

			// Create and execute move command (use original indices for undo accuracy)
			const command: MoveCommand = {
				type: CommandType.Move,
				cardId: card.id,
				cardTitle: card.title,
				from: { columnId: context.sourceColumnId, index: cardIndex },
				to: { columnId: targetColumnId, index: insertIndex },
				timestamp: Date.now(),
				description: `${ sourceColumn.title } → ${ targetColumn.title }`,
				seqId: ++commandSeqId,
			};

			// Execute the move - splice out first, then insert at adjusted position
			sourceColumn.cards.splice( cardIndex, 1 );
			targetColumn.cards.splice( actualInsertIndex, 0, card );

			pushCommand( context, command );
			resetDragState( context );
		} ),

		handleDragEnd: withSyncEvent( () => {
			resetDragState( getContext<KanbanContext>() );
		} ),

		// ========================
		// CRUD
		// ========================

		openNewCardModal() {
			const context = getContext<KanbanContext>();
			const column = context.item as KanbanColumn | undefined;
			initNewCardModal( context, column?.id || null );
		},

		openNewCardModalFirstColumn() {
			const context = getContext<KanbanContext>();
			initNewCardModal( context, context.columns[ 0 ]?.id || null );
		},

		closeNewCardModal() {
			resetNewCardModal( getContext<KanbanContext>() );
		},

		createCard() {
			const context = getContext<KanbanContext>();

			const sanitizedTitle = sanitizeTitle( context.newCardTitle );
			if ( ! sanitizedTitle || ! context.newCardColumnId ) return;

			const column = findColumn( context.columns, context.newCardColumnId );
			if ( ! column ) {
				// Column was deleted while modal was open - reset and notify user
				console.warn( `Column "${ context.newCardColumnId }" no longer exists` );
				resetNewCardModal( context );
				return;
			}

			const newCard: KanbanCard = {
				id: generateId(),
				title: sanitizedTitle,
				description: context.newCardDescription.trim() || undefined,
				priority: context.newCardPriority,
				assignee: context.newCardAssignee.trim() || undefined,
				createdAt: Date.now(),
			};

			// Create and execute create command
			const command: CreateCommand = {
				type: CommandType.Create,
				card: newCard,
				columnId: context.newCardColumnId,
				timestamp: Date.now(),
				description: `+ "${ newCard.title }"`,
				seqId: ++commandSeqId,
			};

			column.cards.push( newCard );
			pushCommand( context, command );

			context.newCardModalOpen = false;
			context.newCardTitle = '';
		},

		*editCard() {
			const context = getContext<KanbanContext>();
			const card = context.item as KanbanCard | undefined;
			if ( ! card ) return;

			context.editingCardId = card.id;
			context.editTitle = card.title;
			context.editPriority = card.priority;
			context.editDescription = card.description || '';
			context.editAssignee = card.assignee || '';

			// Yield to let DOM update, then focus input
			yield splitTask();
			const { ref } = getElement();
			if ( ref ) {
				const cardEl = ref.closest( '.kanban-card' );
				const input = cardEl?.querySelector(
					'.kanban-card__edit-input'
				) as HTMLInputElement;
				if ( input ) {
					// Set initial value directly - don't use data-wp-bind--value
					// which would reset cursor position on every state change
					input.value = card.title;
					input.focus();
				}
			}
		},

		handleEditBlur: withSyncEvent( ( event: FocusEvent ) => {
			const context = getContext<KanbanContext>();
			const { ref } = getElement();

			// Find the edit form container
			const editForm = ref?.closest( '.kanban-card__edit' );

			// Check if focus is moving to a delete button (skip save to avoid orphaned edit command)
			const relatedTarget = event.relatedTarget as HTMLElement | null;
			const isDeleteButton = relatedTarget?.closest( '.kanban-card__actions' )?.querySelector( '[title="Delete"]' ) === relatedTarget;

			// Only save if focus is leaving the edit form entirely and not to delete button
			if ( editForm && ! editForm.contains( relatedTarget ) && ! isDeleteButton ) {
				performEdit( context );
			}
		} ),

		saveEdit() {
			performEdit( getContext<KanbanContext>() );
		},

		deleteCard() {
			const context = getContext<KanbanContext>();
			const card = context.item as KanbanCard | undefined;
			if ( ! card ) return;

			const location = findCardLocation( context.columns, card.id );
			if ( ! location ) return;

			const command: DeleteCommand = {
				type: CommandType.Delete,
				card: { ...card }, // Copy for history
				columnId: location.column.id,
				index: location.index,
				timestamp: Date.now(),
				description: card.title,
				seqId: ++commandSeqId,
			};

			location.column.cards.splice( location.index, 1 );
			pushCommand( context, command );
		},

		// ========================
		// KEYBOARD SHORTCUTS
		// ========================

		handleGlobalKeydown: withSyncEvent( ( event: KeyboardEvent ) => {
			const context = getContext<KanbanContext>();

			// Ctrl+Z: Undo
			if (
				event.ctrlKey &&
				! event.shiftKey &&
				event.key === 'z'
			) {
				event.preventDefault();
				performUndo( context );
				return;
			}

			// Ctrl+Shift+Z: Redo
			if (
				event.ctrlKey &&
				event.shiftKey &&
				event.key === 'Z'
			) {
				event.preventDefault();
				performRedo( context );
				return;
			}

			// Escape: Close modals
			if ( event.key === 'Escape' ) {
				if ( context.newCardModalOpen ) {
					resetNewCardModal( context );
				}
				if ( context.editingCardId ) {
					context.editingCardId = null;
				}
				return;
			}

			// N: New card (when not in input)
			if (
				event.key === 'n' &&
				! event.ctrlKey &&
				! event.metaKey &&
				! isInputElement( event.target )
			) {
				event.preventDefault();
				// Open modal in first column (To Do)
				initNewCardModal( context, context.columns[ 0 ]?.id || null );
			}
		} ),

		// ========================
		// HISTORY (UNDO/REDO)
		// ========================

		undo() {
			performUndo( getContext<KanbanContext>() );
		},

		redo() {
			performRedo( getContext<KanbanContext>() );
		},

		// ========================
		// REVISION PANEL
		// ========================

		toggleRevisionPanel() {
			const context = getContext<KanbanContext>();
			context.revisionPanelOpen = ! context.revisionPanelOpen;
			// Clear hover state when closing panel to prevent stuck highlights
			if ( ! context.revisionPanelOpen ) {
				context.hoveredRevisionId = null;
			}
		},

		jumpToRevision() {
			const context = getContext<KanbanContext>();
			const command = context.item as Command | undefined;
			if ( ! command ) return;

			const targetIndex = context.history.findIndex( c => c.seqId === command.seqId );
			if ( targetIndex === -1 ) return;

			// If jumping to a future state, we need to execute commands
			if ( targetIndex > context.historyIndex ) {
				for ( let i = context.historyIndex + 1; i <= targetIndex; i++ ) {
					executeCommand( context.columns, context.history[ i ] );
				}
			}
			// If jumping to a past state, we need to reverse commands
			else if ( targetIndex < context.historyIndex ) {
				for ( let i = context.historyIndex; i > targetIndex; i-- ) {
					reverseCommand( context.columns, context.history[ i ] );
				}
			}

			context.historyIndex = targetIndex;
		},

		setHoveredRevision() {
			const context = getContext<KanbanContext>();
			context.hoveredRevisionId = getCardIdFromCommand( context.item as Command | undefined );
		},

		resetToInitial() {
			const context = getContext<KanbanContext>();
			// Reverse all commands from current position back to start
			while ( context.historyIndex >= 0 ) {
				reverseCommand( context.columns, context.history[ context.historyIndex ] );
				context.historyIndex--;
			}
		},
	},

	callbacks: {
		// Focus on new card input when modal opens
		focusNewCardInput() {
			const context = getContext<KanbanContext>();
			if ( context.newCardModalOpen ) {
				const { ref } = getElement();
				if ( ref ) {
					const input = ref.querySelector(
						'.kanban-modal__input'
					) as HTMLInputElement;
					input?.focus();
				}
			}
		},

		// Scroll current revision into view
		scrollToCurrentRevision() {
			const context = getContext<KanbanContext>();
			// Read historyIndex to establish reactive dependency
			void context.historyIndex;

			const { ref } = getElement();
			if ( ! ref ) return;

			// Find the active revision item
			const activeItem = ref.querySelector( '.kanban-revision-item.active' ) as HTMLElement;
			if ( activeItem ) {
				activeItem.scrollIntoView( {
					behavior: 'smooth',
					inline: 'center',
					block: 'nearest',
				} );
			}
		},
	},
} );
