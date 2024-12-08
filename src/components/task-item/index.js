import css from './component.css';
import html from './template.html';

const sheet = new CSSStyleSheet();
sheet.replaceSync(css);

const DataAttributeSelector = {
  title: 'data-title',
  priority: 'data-priority',
  date: 'data-date',
  tags: 'data-tags',
  interactive: 'interactive',
};

const UISelector = {
  slot: 'slot',
  details: 'details',
  title: '.task-title',
  priority: '.task-priority',
  date: '.task-date',
  tags: '.tags',
  editBtn: '.edit-btn',
  deleteBtn: '.delete-btn',
  completeBtn: '.complete-btn',
  collapseBtn: '.collapse-btn',
  controlBtns: '.task-control-btn',
};

/**
 * A custom component that displays details of a task and provides interaction
 */
export class TaskItem extends HTMLElement {
  /**
   *
   */
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    shadow.adoptedStyleSheets = [sheet];
  }

  /**
   * @returns { string[] } A list of attributes to listen to
   */
  static get observedAttributes() {
    return Object.values(DataAttributeSelector); //
  }

  /**
   * Render and add event listeners when the component is mounted to the DOM
   */
  connectedCallback() {
    this.mountTemplate();
    this.render();
    this.addEventListeners();
  }

  /**
   * Render the page whenever an attribute is updated
   */
  attributeChangedCallback() {
    // Only update content if template is already mounted
    if (this.shadowRoot.querySelector(UISelector.details)) {
      this.render();
    }
  }

  /**
   * @returns { string } value in data-title attribute
   */
  get title() {
    return this.getAttribute(DataAttributeSelector.title) || '';
  }

  /**
   * @returns { string } value in data-priority attribute
   */
  get priority() {
    return this.getAttribute(DataAttributeSelector.priority) || '';
  }

  /**
   * @returns { string } value in data-date attribute
   */
  get date() {
    return this.getAttribute(DataAttributeSelector.date) || '';
  }

  /**
   * @returns {boolean} Whether the task item is interactive
   */
  get interactive() {
    return this.hasAttribute(DataAttributeSelector.interactive);
  }

  /**
   * @returns { string[] } a parsed string array of data-tags attribute
   * @throws { Error } if data-tags is non parseable
   */
  get tags() {
    try {
      return JSON.parse(this.getAttribute(DataAttributeSelector.tags) || '[]');
    } catch (error) {
      console.error('Error parsing tags:', error);
      return [];
    }
  }

  /**
   * Mount HTML code to the component
   */
  mountTemplate() {
    this.shadowRoot.innerHTML = html;
  }

  /**
   * Render the component
   */
  render() {
    // Get all attributes
    const { title, priority, date, tags, interactive } = this;
    const details = this.shadowRoot.querySelector(UISelector.details);

    /** @type { globalThis.NodeListOf<globalThis.HTMLButtonElement> } */
    const controls = this.shadowRoot.querySelectorAll(UISelector.controlBtns);

    if (details) {
      details.classList.toggle('non-interactive', !interactive);
    }

    controls.forEach(btn => {
      btn.style.display = interactive ? '' : 'none';
    });

    // Update title
    const titleElement = this.shadowRoot.querySelector(UISelector.title);
    if (titleElement) titleElement.textContent = title;

    // Update date
    const dateElement = this.shadowRoot.querySelector(UISelector.date);
    if (dateElement) dateElement.textContent = date;

    // Update tags
    const tagsContainer = this.shadowRoot.querySelector(UISelector.tags);
    if (!tagsContainer) return;

    tagsContainer.innerHTML = '';

    // Add priority tag
    if (priority) {
      const priorityTag = document.createElement('li');
      priorityTag.className = `tag priority-${priority.toLowerCase()}`;
      priorityTag.textContent = priority;
      tagsContainer.appendChild(priorityTag);
    }

    // Handle additional tags from JSON
    tags.forEach(tag => {
      const tagElement = document.createElement('li');
      tagElement.className = 'tag';
      tagElement.textContent = tag;
      tagsContainer.appendChild(tagElement);
    });
  }

  /**
   * Add event listeners to buttons and slots
   * Fire custom events for button clicked
   * And check description length for slot changed
   */
  addEventListeners() {
    /** @type { globalThis.HTMLSlotElement | null } */
    const slot = this.shadowRoot.querySelector(UISelector.slot);

    /** @type { globalThis.HTMLDetailsElement | null } */
    const details = this.shadowRoot.querySelector(UISelector.details);
    const editBtn = this.shadowRoot.querySelector(UISelector.editBtn);
    const deleteBtn = this.shadowRoot.querySelector(UISelector.deleteBtn);
    const completeBtn = this.shadowRoot.querySelector(UISelector.completeBtn);
    const collapseBtn = this.shadowRoot.querySelector(UISelector.collapseBtn);

    details?.addEventListener('click', e => {
      if (!this.interactive) {
        e.preventDefault();
      }
    });

    editBtn?.addEventListener('click', e => {
      e.preventDefault();
      this.dispatchEvent(
        new CustomEvent('task-edit', {
          detail: { id: this.getAttribute('id') },
        })
      );
    });

    deleteBtn?.addEventListener('click', e => {
      e.preventDefault();
      this.dispatchEvent(
        new CustomEvent('task-delete', {
          detail: { id: this.getAttribute('id') },
        })
      );
    });

    completeBtn?.addEventListener('click', e => {
      e.preventDefault();
      this.dispatchEvent(
        new CustomEvent('task-complete', {
          detail: { id: this.getAttribute('id') },
        })
      );
    });

    collapseBtn?.addEventListener('click', e => {
      e.preventDefault();
      details.open = !details.open;
    });

    slot?.addEventListener('slotchange', () => {
      const nodes = slot.assignedNodes();
      const description = nodes
        .map(node => node.textContent)
        .join('')
        .trim();

      if (description.length > 500) console.warn('Description is too long');
    });
  }
}

customElements.define('task-item', TaskItem);
