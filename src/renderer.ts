// src/renderer.ts
import './index.css';
import { Note, Tag } from './types';

// =================================================================
// STATE MANAGEMENT
// =================================================================
// These variables will hold the live data from the API.
let allNotes: Note[] = [];
let allTags: Tag[] = [];
let currentNoteId: string | null = null; // Track which note is open in the editor

// =================================================================
// DOM ELEMENT SELECTORS
// =================================================================
// Getting all the HTML elements we need to interact with.
const noteListContainer = document.getElementById('note-list-container')!;
const noteEditorForm = document.getElementById('note-editor-form')!;
const noteTitleInput = document.getElementById('note-title-input') as HTMLInputElement;
const noteContentTextarea = document.getElementById('note-content-textarea') as HTMLTextAreaElement;
const newNoteBtn = document.getElementById('new-note-btn')!;
const deleteNoteBtn = document.getElementById('delete-note-btn')!;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchResultsContainer = document.getElementById('search-results-container')!;
const tagsListContainer = document.getElementById('tags-list-container')!;
const addTagForm = document.getElementById('add-tag-form')!;
const addTagInput = document.getElementById('add-tag-input') as HTMLInputElement;
const noteTagsContainer = document.getElementById('note-tags-container')!;

// =================================================================
// RENDERING FUNCTIONS (Updating the UI)
// =================================================================

/**
 * Renders a list of notes into a given container element.
 */
function renderNoteList(notes: Note[], container: HTMLElement) {
  container.innerHTML = '';
  if (notes.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <svg class="w-16 h-16 mx-auto text-text-muted mb-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z"/>
        </svg>
        <p class="text-text-muted text-lg">No notes found</p>
        <p class="text-text-secondary text-sm mt-2">Create your first note to get started</p>
      </div>
    `;
    return;
  }

  // Clear container and set grid layout
  container.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
  
  notes.forEach(note => {
    const noteElement = document.createElement('div');
    noteElement.className = 'note-card p-6 rounded-2xl shadow-soft cursor-pointer hover:shadow-medium transition-all duration-200 transform hover:-translate-y-1';
    
    // Get tags for this note
    const noteTags = allTags.filter(tag => note.tagIds.includes(tag.id));
    const tagsHtml = noteTags.length > 0 
      ? `<div class="flex flex-wrap gap-2 mt-4">
           ${noteTags.map(tag => `<span class="tag-chip text-xs px-3 py-1 rounded-full font-medium">${tag.name}</span>`).join('')}
         </div>`
      : '';
    
    noteElement.innerHTML = `
      <div class="flex items-start justify-between mb-4">
        <h3 class="text-lg font-semibold text-text-primary line-clamp-2 flex-1 mr-3">${note.title || 'Untitled Note'}</h3>
        <span class="text-xs text-text-muted bg-gray-100 px-2 py-1 rounded-full shrink-0">${formatDate(note.updatedAt)}</span>
      </div>
      <p class="text-text-secondary text-sm line-clamp-3 mb-4">${note.content ? truncateContent(note.content, 120) : 'No content'}</p>
      ${tagsHtml}
    `;
    
    noteElement.addEventListener('click', () => handleNoteSelect(note.id));
    container.appendChild(noteElement);
  });
}

/**
 * Renders the list of all tags on the Tags page.
 */
function renderTagsList() {
  tagsListContainer.innerHTML = '';
  
  if (allTags.length === 0) {
    tagsListContainer.innerHTML = `
      <tr>
        <td colspan="3" class="p-12 text-center">
          <svg class="w-16 h-16 mx-auto text-text-muted mb-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7V17C3 18.1 3.9 19 5 19H16C16.67 19 17.27 18.67 17.63 18.16L22 12L17.63 5.84Z"/>
          </svg>
          <p class="text-text-muted text-lg">No tags yet</p>
          <p class="text-text-secondary text-sm mt-2">Add your first tag to organize your notes</p>
        </td>
      </tr>
    `;
    return;
  }
  
  allTags.forEach(tag => {
    const noteCount = allNotes.filter(note => note.tagIds.includes(tag.id)).length;
    const tagRow = document.createElement('tr');
    tagRow.className = 'hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200';
    tagRow.innerHTML = `
      <td class="p-6">
        <span class="tag-chip px-4 py-2 rounded-xl font-medium">${tag.name}</span>
      </td>
      <td class="p-6 text-text-secondary">${noteCount} note${noteCount !== 1 ? 's' : ''}</td>
      <td class="p-6 text-right">
        <button data-id="${tag.id}" class="delete-tag-btn text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-all duration-200">
          <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z"/>
          </svg>
        </button>
      </td>
    `;
    tagsListContainer.appendChild(tagRow);
  });

  document.querySelectorAll('.delete-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDeleteTag((btn as HTMLElement).dataset.id!));
  });
}

/**
 * Renders tag checkboxes in the note editor, checking the ones relevant to the current note.
 */
function renderNoteTagsSelector() {
  noteTagsContainer.innerHTML = '';
  const currentNote = allNotes.find(n => n.id === currentNoteId);
  const currentTagIds = new Set(currentNote?.tagIds || []);

  if (allTags.length === 0) {
    noteTagsContainer.innerHTML = `
      <div class="text-center py-8">
        <svg class="w-12 h-12 mx-auto text-text-muted mb-3" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.63 5.84C17.27 5.33 16.67 5 16 5L5 5.01C3.9 5.01 3 5.9 3 7V17C3 18.1 3.9 19 5 19H16C16.67 19 17.27 18.67 17.63 18.16L22 12L17.63 5.84Z"/>
        </svg>
        <p class="text-text-muted">No tags available</p>
        <p class="text-text-secondary text-sm mt-1">Add some tags on the Tags page to organize your notes</p>
      </div>
    `;
    return;
  }

  const tagsWrapper = document.createElement('div');
  tagsWrapper.className = 'flex flex-wrap gap-3';
  
  allTags.forEach(tag => {
    const isChecked = currentTagIds.has(tag.id);
    const wrapper = document.createElement('label');
    // We add a unique ID to the wrapper to make it easy to find and update its style
    wrapper.id = `tag-wrapper-${tag.id}`;
    wrapper.className = `flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-all duration-200`;
    
    // The input is visually hidden but still functional
    const checkbox = document.createElement('input');
    checkbox.id = `tag-${tag.id}`;
    checkbox.type = 'checkbox';
    checkbox.value = tag.id;
    checkbox.className = 'sr-only'; // Screen-reader only (hidden)
    checkbox.checked = isChecked;
    
    // The visual representation of the checkbox and the label
    const visualContent = document.createElement('div');
    visualContent.className = 'flex items-center gap-2 pointer-events-none'; // pointer-events-none prevents double clicks
    visualContent.innerHTML = `
      <div class="w-4 h-4 rounded border-2 flex items-center justify-center">
        ${isChecked ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z"/></svg>' : ''}
      </div>
      <span class="text-sm font-medium">${tag.name}</span>
    `;

    // Function to update the style based on the checked state
    function updateStyle(checked: boolean) {
      wrapper.classList.toggle('border-primary', checked);
      wrapper.classList.toggle('bg-gradient-to-br', checked);
      wrapper.classList.toggle('from-blue-50', checked);
      wrapper.classList.toggle('to-indigo-50', checked);
      wrapper.classList.toggle('text-primary', checked);
      wrapper.classList.toggle('border-gray-200', !checked);
      wrapper.classList.toggle('hover:border-gray-300', !checked);
      wrapper.classList.toggle('text-text-secondary', !checked);
      wrapper.classList.toggle('hover:bg-gray-50', !checked);
      
      const checkmarkContainer = visualContent.querySelector('div')!;
      checkmarkContainer.classList.toggle('bg-primary', checked);
      checkmarkContainer.classList.toggle('border-primary', checked);
      checkmarkContainer.classList.toggle('border-gray-300', !checked);
      checkmarkContainer.innerHTML = checked ? '<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12L3.41 13.41L9 19L21 7L19.59 5.59L9 16.17Z"/></svg>' : '';
    }

    // --- THIS IS THE CORRECT EVENT LISTENER ---
    // Listen for the 'change' event on the actual checkbox input
    checkbox.addEventListener('change', () => {
      updateStyle(checkbox.checked);
    });

    wrapper.appendChild(checkbox);
    wrapper.appendChild(visualContent);
    tagsWrapper.appendChild(wrapper);
    
    // Set the initial style correctly
    updateStyle(isChecked);
  });
  
  noteTagsContainer.appendChild(tagsWrapper);
}

/**
 * Renders search results in the search page.
 */
function renderSearchResults(notes: Note[]) {
  searchResultsContainer.innerHTML = '';
  
  if (notes.length === 0) {
    searchResultsContainer.innerHTML = `
      <div class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-text-muted mb-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3S3 5.91 3 9.5S5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14Z"/>
        </svg>
        <p class="text-text-muted text-lg">No notes found</p>
        <p class="text-text-secondary text-sm mt-2">Try a different search term</p>
      </div>
    `;
    return;
  }
  
  // Create a container for search results
  const resultsWrapper = document.createElement('div');
  resultsWrapper.className = 'space-y-4';
  
  notes.forEach(note => {
    const noteTags = allTags.filter(tag => note.tagIds.includes(tag.id));
    const tagsHtml = noteTags.length > 0 
      ? `<div class="flex flex-wrap gap-2 mt-3">
           ${noteTags.map(tag => `<span class="tag-chip text-xs px-3 py-1 rounded-full font-medium">${tag.name}</span>`).join('')}
         </div>`
      : '';
    
    const noteElement = document.createElement('div');
    noteElement.className = 'note-card p-6 rounded-2xl shadow-soft cursor-pointer hover:shadow-medium transition-all duration-200';
    noteElement.innerHTML = `
      <div class="flex items-start justify-between mb-3">
        <h3 class="text-xl font-semibold text-text-primary flex-1 mr-3">${note.title || 'Untitled Note'}</h3>
        <span class="text-xs text-text-muted bg-gray-100 px-2 py-1 rounded-full shrink-0">${formatDate(note.updatedAt)}</span>
      </div>
      <p class="text-text-secondary leading-relaxed">${note.content ? truncateContent(note.content, 200) : 'No content'}</p>
      ${tagsHtml}
    `;
    
    noteElement.addEventListener('click', () => handleNoteSelect(note.id));
    resultsWrapper.appendChild(noteElement);
  });
  
  searchResultsContainer.appendChild(resultsWrapper);
}

// =================================================================
// UTILITY FUNCTIONS
// =================================================================

/**
 * Formats a date string into a human-readable format.
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'today';
  if (diffDays === 2) return 'yesterday';
  if (diffDays <= 7) return `${diffDays - 1} days ago`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  
  return date.toLocaleDateString();
}

/**
 * Truncates content to a specified length with ellipsis.
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength).trim() + '...';
}

// =================================================================
// DATA HANDLING (Interacting with the API)
// =================================================================

/**
 * Fetches both notes and tags from the main process and updates the UI.
 */
async function loadAppData() {
  const [_notes, _tags] = await Promise.all([
    window.electronAPI.getNotes(),
    window.electronAPI.getTags()
  ]);
  allNotes = _notes;
  allTags = _tags;
  renderNoteList(allNotes, noteListContainer);
  renderTagsList();
}

/**
 * Opens a specific note in the editor.
 */
function handleNoteSelect(noteId: string) {
  currentNoteId = noteId;
  const note = allNotes.find(n => n.id === noteId);
  if (note) {
    noteTitleInput.value = note.title;
    noteContentTextarea.value = note.content;
    deleteNoteBtn.style.display = 'inline-flex'; // Changed to inline-flex to match button styling
    renderNoteTagsSelector();
    showPage('page-editor');
  }
}

/**
 * Handles the form submission for saving a note (new or existing).
 */
async function handleSaveNote(event: SubmitEvent) {
  event.preventDefault();
  const selectedTagIds = Array.from(noteTagsContainer.querySelectorAll('input:checked'))
                            .map(input => (input as HTMLInputElement).value);

  const notePayload = {
    id: currentNoteId || undefined,
    title: noteTitleInput.value || 'Untitled Note',
    content: noteContentTextarea.value,
    tagIds: selectedTagIds,
  };

  await window.electronAPI.saveNote(notePayload);
  await loadAppData();
  showPage('page-all-notes');
}

/**
 * Clears the editor to create a new note.
 */
function handleNewNote() {
  currentNoteId = null;
  noteEditorForm.reset();
  noteTitleInput.value = '';
  noteContentTextarea.value = '';
  deleteNoteBtn.style.display = 'none';
  renderNoteTagsSelector();
  showPage('page-editor');
}

/**
 * Deletes the currently opened note.
 */
async function handleDeleteNote() {
  if (currentNoteId && confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
    await window.electronAPI.deleteNote(currentNoteId);
    await loadAppData();
    showPage('page-all-notes');
  }
}

/**
 * Handles adding a new tag from the Tags page.
 */
async function handleAddTag(event: SubmitEvent) {
  event.preventDefault();
  const tagName = addTagInput.value.trim();
  if (tagName) {
    await window.electronAPI.addTag(tagName);
    addTagInput.value = '';
    await loadAppData();
  }
}

/**
 * Deletes a tag and removes it from all notes.
 */
async function handleDeleteTag(tagId: string) {
  if (confirm('Are you sure you want to delete this tag? It will be removed from all notes.')) {
    await window.electronAPI.deleteTag(tagId);
    await loadAppData();
  }
}

/**
 * Handles real-time search and renders the results.
 */
async function handleSearch() {
  const searchTerm = searchInput.value.trim();
  if (searchTerm.length > 1) {
    const results = await window.electronAPI.getNotes(searchTerm);
    renderSearchResults(results);
  } else {
    searchResultsContainer.innerHTML = `
      <div class="text-center py-12">
        <svg class="w-16 h-16 mx-auto text-text-muted mb-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3S3 5.91 3 9.5S5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14Z"/>
        </svg>
        <p class="text-text-muted text-lg">Start typing to search your notes</p>
      </div>
    `;
  }
}

// =================================================================
// NAVIGATION & SETTINGS
// =================================================================

/**
 * Shows a specific page/view and hides the others.
 */
/**
 * Shows a specific page/view and hides the others.
 * @param pageId The ID of the <section> element to show.
 */
function showPage(pageId: string) {
    document.querySelectorAll('.page').forEach(page => {
        (page as HTMLElement).style.display = 'none';
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    const pageToShow = document.getElementById(pageId);
    if (pageToShow) {
        pageToShow.style.display = 'block';

        // --- THE FIX IS HERE ---
        // If we are showing the editor, we must always refresh its tag list
        // to ensure it has the latest tags available.
        if (pageId === 'page-editor') {
            renderNoteTagsSelector();
        }
    }

    const activeLink = document.querySelector(`.nav-link[data-page="${pageId}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

/**
 * Applies a theme (light/dark) and saves the preference.
 */
function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.querySelectorAll('.theme-btn').forEach(btn => {
    const isCurrentTheme = (btn as HTMLElement).dataset.theme === theme;
    btn.classList.toggle('border-primary', isCurrentTheme);
    btn.classList.toggle('bg-gradient-to-br', isCurrentTheme);
    btn.classList.toggle('from-blue-50', isCurrentTheme);
    btn.classList.toggle('to-indigo-50', isCurrentTheme);
    btn.classList.toggle('border-gray-200', !isCurrentTheme);
  });
  localStorage.setItem('theme', theme);
}

/**
 * Applies a font size and saves the preference.
 */
function applyFontSize(size: 'sm' | 'base' | 'lg') {
  const body = document.body;
  body.classList.remove('text-sm', 'text-base', 'text-lg');
  body.classList.add(`text-${size}`);
  document.querySelectorAll('.font-size-btn').forEach(btn => {
    const isCurrentSize = (btn as HTMLElement).dataset.size === size;
    btn.classList.toggle('border-primary', isCurrentSize);
    btn.classList.toggle('bg-gradient-to-br', isCurrentSize);
    btn.classList.toggle('from-blue-50', isCurrentSize);
    btn.classList.toggle('to-indigo-50', isCurrentSize);
    btn.classList.toggle('border-gray-200', !isCurrentSize);
  });
  localStorage.setItem('fontSize', size);
}

// =================================================================
// INITIALIZATION
// =================================================================

/**
 * Sets up all event listeners and loads initial app state.
 */
async function initializeApp() {
  // Setup navigation link listeners
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const pageId = (link as HTMLElement).dataset.page;
      if (pageId) showPage(pageId);
    });
  });

  // Setup main action listeners
  newNoteBtn.addEventListener('click', handleNewNote);
  noteEditorForm.addEventListener('submit', handleSaveNote);
  deleteNoteBtn.addEventListener('click', handleDeleteNote);
  addTagForm.addEventListener('submit', handleAddTag);
  searchInput.addEventListener('input', handleSearch);

  // Setup settings listeners
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme((btn as HTMLElement).dataset.theme as 'light' | 'dark'));
  });
  document.querySelectorAll('.font-size-btn').forEach(btn => {
    btn.addEventListener('click', () => applyFontSize((btn as HTMLElement).dataset.size as 'sm' | 'base' | 'lg'));
  });

  // Apply saved settings from previous sessions
  applyTheme((localStorage.getItem('theme') as 'light' | 'dark') || 'light');
  applyFontSize((localStorage.getItem('fontSize') as 'sm' | 'base' | 'lg') || 'base');

  // Load all data and show the main page
  await loadAppData();
  showPage('page-all-notes');
}

// Run the application
initializeApp();