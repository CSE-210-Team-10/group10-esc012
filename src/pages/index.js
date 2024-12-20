import TaskStore from '../js/task/crud.js';
import { TaskItem } from '../components/task-item/index.js';
import { TaskForm } from '../components/task-form/index.js';
import { authService } from '../js/auth.js';
import { setTheme, getTheme, refreshGithubTasks } from '../js/local-storage.js';

import { main as filterMain } from './filters.js';
import { renderTaskPanels } from './render.js';

const NUMBER_UPCOMING_DEADLINE_DAYS = 7;

/** @typedef { import('../js/task/index.js').Task } Task */
/** @typedef { import('../js/auth.js').UserData } User */

/**
 * @typedef { object } TaskFormData
 * @property { string } id - ID of the task
 * @property { string } taskName - Name/title of the task
 * @property { 'high' | 'medium' | 'low' } priority - Priority level of the task
 * @property { string[] } tags - Array of tags associated with the task
 * @property { string } dueDate - Due date string from the form
 * @property { string } description - Description of the task
 */

/** @type { 'create' | 'edit' | null } current state of the task form */
let taskFormMode = null;

document.addEventListener('DOMContentLoaded', main);

/**
 *
 */
export function main() {
  authService.subscribeToAuthChanges(authEventHandler);

  /** @type { TaskForm } */
  const taskForm = document.querySelector('task-form');

  const darkModeToggle = document.querySelector('button:has(i.fa-moon)');
  const lightModeToggle = document.querySelector('button:has(i.fa-sun)');
  const createTaskBtn = document.querySelector('#create-task-btn');

  createTaskBtn.addEventListener('click', openTaskForm);
  taskForm.addEventListener(TaskForm.taskFormSubmitEvent, handleTaskFormSubmit);
  document.addEventListener(TaskItem.editTaskEvent, handleTaskEdit);
  document.addEventListener(TaskItem.deleteTaskEvent, handleTaskDelete);
  document.addEventListener(TaskItem.completeTaskEvent, handleTaskCompleted);

  /**
   * Add event listener for "Sign Out" button to sign user out of GitHub account
   */
  const signOutButton = document.querySelector('.signout-btn');
  if (signOutButton) {
    signOutButton.addEventListener('click', async () => {
      await authService.logout();
    });
  }

  darkModeToggle.addEventListener('click', () => renderTheme('dark'));
  lightModeToggle.addEventListener('click', () => renderTheme('light'));

  generateUpcomingDeadlines();
  filterMain();
  renderTheme(getTheme());
}

/**
 * Set the theme to the one user wants
 * @param { 'dark' | 'light' } theme The them that user wants to set
 */
function renderTheme(theme) {
  /** @type { HTMLButtonElement } */
  const darkModeToggle = document.querySelector('button:has(i.fa-moon)');

  /** @type { HTMLButtonElement } */
  const lightModeToggle = document.querySelector('button:has(i.fa-sun)');

  const isDarkMode = theme === 'dark';

  if (isDarkMode) document.documentElement.classList.add('dark-mode');
  else document.documentElement.classList.remove('dark-mode');

  darkModeToggle.ariaDisabled = String(!isDarkMode);

  lightModeToggle.ariaDisabled = String(isDarkMode);

  setTheme(theme);
}

/**
 * Redirect user to the login page
 */
function redirectToLogin() {
  window.location.href = '/login';
}

/**
 * Render the page with user data
 * @param { User } user user data from auth service
 */
async function renderPage(user) {
  console.log(user);
  console.log(TaskStore.getAllTasks());
  renderTaskPanels(TaskStore.getAllTasks());
}

/**
 * A subscriber to authService to listen to any authentication changes
 * if signed in and user is valid, render the page
 * otherwise, redirect to login page
 * @param { string } event The new state of authentication
 * @param { User } user The user data passed from authService
 */
function authEventHandler(event, user) {
  if (event === 'SIGNED_IN' && user) {
    refreshGithubTasks(user);
    renderPage(user);
  } else if (event === 'SIGNED_OUT' || !user) {
    redirectToLogin();
  }
}

/**
 * Generate upcoming deadlines with their priority counts
 */
function generateUpcomingDeadlines() {
  const deadlinesContainer = document.querySelector('#upcoming-deadlines .deadlines');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const allTasks = TaskStore.getAllTasks().filter(task => task.type === 'personal');
  const { overdueTasks, upcomingTasksByDate } = categorizeTasksByDate(allTasks, today);
  deadlinesContainer.innerHTML = '';

  // Render overdue section
  const overdueElement = document.createElement('li');
  overdueElement.classList.add('deadline');
  overdueElement.id = 'deadline-overdue';
  overdueElement.innerHTML = `
        <div>Overdue</div>
        <ul class="deadline-tags">
            <li class="tag tag-priority-high">High: ${overdueTasks.high}</li>
            <li class="tag tag-priority-medium">Medium: ${overdueTasks.medium}</li>
            <li class="tag tag-priority-low">Low: ${overdueTasks.low}</li>
        </ul>
    `;
  deadlinesContainer.appendChild(overdueElement);

  // Render upcoming 7 days starting from today
  for (let i = 0; i < NUMBER_UPCOMING_DEADLINE_DAYS; i++) {
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + i);
      
    const dateTaskCounts = upcomingTasksByDate[currentDate.toISOString().split('T')[0]] || {
      high: 0,
      medium: 0,
      low: 0
    };

    const formattedDate = currentDate.toLocaleDateString('en-US', {
      weekday: 'short', 
      month: 'short', 
      day: 'numeric'
    });

    const deadlineElement = document.createElement('li');
    deadlineElement.classList.add('deadline');
    deadlineElement.innerHTML = `
          <div class="deadline-date">${formattedDate}</div>
          <ul class="deadline-tags">
              <li class="tag tag-priority-high">High: ${dateTaskCounts.high}</li>
              <li class="tag tag-priority-medium">Medium: ${dateTaskCounts.medium}</li>
              <li class="tag tag-priority-low">Low: ${dateTaskCounts.low}</li>
          </ul>
      `;

    // Add event listener to the deadline element
    deadlineElement.addEventListener('click', () => {
      if (deadlineElement.classList.contains('selected')) {
        deadlineElement.classList.remove('selected');

        removeFilterByDate();
      } else {
        const allDeadlines = deadlinesContainer.querySelectorAll('.deadline');
        allDeadlines.forEach(el => el.classList.remove('selected'));

        deadlineElement.classList.add('selected');

        const [date] = currentDate.toISOString().split('T');
        filterTasksByDate(date);
      }
    });

    deadlinesContainer.appendChild(deadlineElement);
  }
}

/**
 * Filter tasks by date
 * @param {string} date The date to filter tasks by
 */
function filterTasksByDate(date) {
  const tasks = TaskStore.getAllTasks().filter(task => task.type === 'personal');
  const filteredTasks = tasks.filter(task => {
    const taskDate = new Date(task.dueDate);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate.toISOString().split('T')[0] === date;
  });

  renderTaskPanels(filteredTasks);
}

/**
 * Remove filter by date
 */
function removeFilterByDate() {
  const tasks = TaskStore.getAllTasks();
  renderTaskPanels(tasks);
}

/**
* Categorize tasks by date, separating overdue and upcoming tasks
* @param {Task[]} tasks - Array of tasks
* @param {Date} today - Current date
* @returns {object} Categorized tasks
*/
function categorizeTasksByDate(tasks, today) {
  const overdueTasks = {
    high: 0,
    medium: 0,
    low: 0
  };

  const upcomingTasksByDate = {};

  tasks.forEach(task => {
    if (!task.dueDate) return;

    const taskDate = new Date(task.dueDate);
    taskDate.setHours(0, 0, 0, 0); // Reset time to start of day

    const [dateKey] = taskDate.toISOString().split('T');

    // Categorize tasks
    if (taskDate < today) {
      // Overdue tasks
      if (task.priority === 'high') overdueTasks.high++;
      else if (task.priority === 'medium') overdueTasks.medium++;
      else if (task.priority === 'low') overdueTasks.low++;
    } else {
      // Upcoming tasks
      if (!upcomingTasksByDate[dateKey]) {
        upcomingTasksByDate[dateKey] = {
          high: 0,
          medium: 0,
          low: 0
        };
      }

      if (task.priority === 'high') upcomingTasksByDate[dateKey].high++;
      else if (task.priority === 'medium') upcomingTasksByDate[dateKey].medium++;
      else if (task.priority === 'low') upcomingTasksByDate[dateKey].low++;
    }
  });

  return { overdueTasks, upcomingTasksByDate };
}

/**
 * Open up the create task form for user to create a new task
 */
function openTaskForm() {
  /** @type { TaskForm } */
  const taskForm = document.querySelector('task-form');
  taskFormMode = 'create';
  taskForm.show();
}

/**
 * Convert form data to task format
 * @param { TaskFormData } formData The data from the form submission event
 * @returns { Omit<Task, 'id'> & { id?: string } } Formatted task data
 */
function formatTaskData(formData) {
  // Convert to local date
  const utcDate = new Date(formData.dueDate);
  const offset = utcDate.getTimezoneOffset();
  const localDate = new Date(utcDate.getTime() + offset * 60000);

  return {
    id: formData.id,
    title: formData.taskName,
    type: 'personal',
    done: false,
    priority: formData.priority,
    tags: formData.tags,
    dueDate: localDate,
    description: formData.description,
    url: '',
  };
}

/**
 * Handle the fired event when the user creates or edits a task
 * @param { CustomEvent } e The custom event object passed from task-form
 */
function handleTaskFormSubmit(e) {
  if (!taskFormMode)
    throw new Error(
      'Task form mode should not be null when the task form is submitted.'
    );
  const taskData = formatTaskData(e.detail);

  try {
    if (taskFormMode === 'create') {
      TaskStore.createTask(taskData);
      renderTaskPanels(TaskStore.getAllTasks());
      generateUpcomingDeadlines();
    } else if (taskFormMode === 'edit') {
      const taskId = taskData.id;

      if (!taskId) throw new Error('Task ID is required for edit mode');

      console.log(taskData);
      const updates = {
        title: taskData.title,
        dueDate: taskData.dueDate,
        description: taskData.description,
        priority: taskData.priority,
        tags: taskData.tags,
        url: '', // TODO: Implement URL handling when necessary. Currently not used in the task data.
      };

      TaskStore.updateTask(Number(taskId), updates);
      renderTaskPanels(TaskStore.getAllTasks());
      generateUpcomingDeadlines();
    }
  } catch (error) {
    console.error('Failed to process task:', error);
  }
}

/**
 * Handle the fired event when the user wants to edit a task
 * @param { CustomEvent } e The custom event object passed from task-item
 */
function handleTaskEdit(e) {
  /** @type { TaskForm } */
  const taskForm = document.querySelector('task-form');
  taskForm.fill({
    id: e.detail.id,
    taskName: e.detail.title,
    priority: e.detail.priority,
    tags: e.detail.tags,
    dueDate: e.detail.date,
    description: e.detail.description,
  });
  taskFormMode = 'edit';
  taskForm.show();
  generateUpcomingDeadlines();
}

/**
 * Handle the fired event when the user wants to delete a task
 * @param { CustomEvent } e The custom event object passed from task-item
 */
function handleTaskDelete(e) {
  const taskId = e.detail.id;

  if (!taskId) throw new Error('Task ID is required for delete mode');

  TaskStore.deleteTask(Number(taskId));

  renderTaskPanels(TaskStore.getAllTasks());
  generateUpcomingDeadlines();
}

/**
 * Handle the fired event when the user wants to mark a task as completed
 * @param { CustomEvent } e The custom event object passed from task-item
 */
function handleTaskCompleted(e) {
  const taskId = e.detail.id;

  if (!taskId) throw new Error('Task ID is required for completion mode');

  TaskStore.updateTask(Number(taskId), { done: true });
  renderTaskPanels(TaskStore.getAllTasks());
  generateUpcomingDeadlines();
}

const STORAGE_KEY = 'byteboard_links';

/**
 * Helper function to get links from localStorage.
 * @returns {Array} The array of links stored in localStorage.
 */
function getAllLinks() {
  const linksJson = localStorage.getItem(STORAGE_KEY);
  return linksJson ? JSON.parse(linksJson) : [];
}

/**
 * Function to render links in the sidebar.
 * Updates the DOM with the list of links stored in localStorage.
 * @returns {void}
 */
function renderLinks() {
  const linkList = document.getElementById('link-list');
  const links = getAllLinks();
  const toggleDeleteBtn = document.getElementById('toggle-delete-btn');
  const isDeleteMode = toggleDeleteBtn.dataset.deleteMode === 'true'; // Track delete mode state
  linkList.innerHTML = ''; // Clear the current list

  links.forEach(link => {
    const li = document.createElement('li');
    li.classList.add('link-item');

    // Add icon if available
    if (link.iconUrl) {
      const iconImage = document.createElement('img');
      iconImage.src = link.iconUrl;
      iconImage.alt = 'Link Icon';
      iconImage.style.width = '24px'; // Set size for icon
      iconImage.style.height = '24px'; // Set size for icon
      li.appendChild(iconImage);
    }

    // Add link button
    const linkButton = document.createElement('button');
    linkButton.classList.add('link-button');
    linkButton.textContent = link.title;
    /**
     *
     */
    // Update this to handle 'www.' URLs properly
    linkButton.onclick = function () {
      let validUrl = link.url;
      // If the URL starts with 'www.', prepend 'http://'
      if (validUrl.startsWith('www.')) {
        validUrl = `http://${validUrl}`;
      }
      window.open(validUrl, '_blank');
    };

    // Add delete icon
    const deleteIcon = document.createElement('i');
    deleteIcon.classList.add('delete-icon', 'fa-solid', 'fa-trash-can');
    deleteIcon.style.color = '#ef4444';
    deleteIcon.style.display = isDeleteMode ? 'inline' : 'none'; // Show based on delete mode
    deleteIcon.addEventListener('click', () => deleteLink(link.id));

    // Append elements to the list item
    li.appendChild(linkButton);
    li.appendChild(deleteIcon);
    linkList.appendChild(li);
  });
}

/**
 * Function to add a new link.
 *  Saves the new link to localStorage and re-renders the links list.
 * @returns {void} This function does not return any value.
 */
function addLink() {
  const titleInput = document.getElementById('link-title');
  const urlInput = document.getElementById('link-url');
  const iconUrlInput = document.getElementById('link-icon-url');
  const errorMessage = document.getElementById('url-error-message');

  if (titleInput instanceof HTMLInputElement && urlInput instanceof HTMLInputElement && iconUrlInput instanceof HTMLInputElement) {
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();
    const iconUrl = iconUrlInput.value.trim();

    if (title !== null && title.length === 0) {
      errorMessage.textContent = 'Invalid title name';
      errorMessage.style.display = 'block';
      titleInput.value = '';
      urlInput.value = '';
      iconUrlInput.value = '';
      return;
    }

    // Validate the URLs
    if (!isValidUrl(iconUrl) && iconUrl !== '') {
      errorMessage.textContent = 'Invalid icon URL!';
      errorMessage.style.display = 'block';
      titleInput.value = '';
      urlInput.value = '';
      iconUrlInput.value = '';
      return;
    }

    if (!isValidUrl(url)) {
      errorMessage.textContent = 'Invalid URL!';
      errorMessage.style.display = 'block';
      titleInput.value = '';
      urlInput.value = '';
      iconUrlInput.value = '';
      return;
    }

    errorMessage.style.display = 'none';

    // Format the URL before saving
    const formattedUrl = formatUrl(url);

    // Create a new link object
    const newLink = {
      id: Date.now(), // Unique ID based on timestamp
      title,
      url: formattedUrl,
      iconUrl: iconUrl || null,
    };

    const links = getAllLinks();
    links.push(newLink);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));

    // Clear the input fields
    titleInput.value = '';
    urlInput.value = '';
    iconUrlInput.value = '';

    renderLinks();

    // Hide the form after saving
    document.getElementById('add-link-form').style.display = 'none';
  } else {
    console.log('Invalid input fields. Please check and try again.');
  }
}

/**
 * Function to check if the URL is valid.
 * @param {string} url - The URL to validate.
 * @returns {boolean}
 */
function isValidUrl(url) {
  const urlPattern = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-z]{2,}(\S*)$/i;
  return urlPattern.test(url);
}

/**
 * Function to format a URL.
 * @param {string} url - The URL to format.
 * @returns {string}
 */
function formatUrl(url) {
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
    formattedUrl = `https://${formattedUrl}`;
  }
  if (!formattedUrl.includes('www.')) {
    const urlParts = formattedUrl.split('://');
    formattedUrl = `${urlParts[0]}://www.${urlParts[1]}`;
  }
  return formattedUrl;
}

/**
 * Function to toggle delete mode.
 * Shows or hides the delete icons when the toggle-delete button is clicked.
 */
function toggleDeleteMode() {
  const toggleDeleteBtn = document.getElementById('toggle-delete-btn');
  const isDeleteMode = toggleDeleteBtn.dataset.deleteMode === 'true'; // Check current state

  // Toggle the state
  // Toggle the state
  toggleDeleteBtn.dataset.deleteMode = String(!isDeleteMode); // Convert to string

  // Re-render the links to update the visibility of delete icons
  renderLinks();
}

/**
 * Function to delete a link.
 * Removes the link from localStorage and re-renders the list of links.
 * @param {number} linkId - The ID of the link to be deleted.
 */
function deleteLink(linkId) {
  const links = getAllLinks();
  const filteredLinks = links.filter(link => link.id !== linkId);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredLinks));
  renderLinks();
}

/**
 * Event listener for the "Add Link" button.
 */
document.getElementById('add-link-btn').addEventListener('click', () => {
  const addLinkForm = document.getElementById('add-link-form');
  addLinkForm.style.display = addLinkForm.style.display === 'block' ? 'none' : 'block';
});

/**
 * Event listener for the "Close" button in the form.
 */
document.getElementById('close-popup-btn').addEventListener('click', () => {
  document.getElementById('add-link-form').style.display = 'none';
});

/**
 * Event listener for clicks outside of the
 *  * "Add Link" form.
 * Closes the form if the user clicks outside of it.
 */
window.addEventListener('click', (e) => {
  const modal = document.getElementById('add-link-form');
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

/**
 * Event listener for the "Save Link" button.
 */
document.getElementById('save-link-btn').addEventListener('click', addLink);

/**
 * Event listener for the "Toggle Delete" button.
 */
document.getElementById('toggle-delete-btn').addEventListener('click', toggleDeleteMode);

/**
 * Initial render of the links on page load.
 */
document.addEventListener('DOMContentLoaded', renderLinks);
