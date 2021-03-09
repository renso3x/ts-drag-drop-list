interface Draggable {
  dragStartHandler(event: DragEvent): void;
  dragEndHandler(event: DragEvent): void;
}
interface DragTarget{
  dragOverHandler(event: DragEvent): void
  dropHandler(event: DragEvent): void
  dragLeaveHandler(event: DragEvent): void
}

// Project Type
enum ProjectStatus {
  Active,
  Finished
}
class Project {
  constructor(
    public id: string, 
    public title: string, 
    public description: string, 
    public people: number, 
    public status: ProjectStatus) {
  }
}

// Project State Management
type Listener<T> = (items: T[]) => void;

class State<T> {
  protected listeners: Listener<T>[] = [];
  addListener(listenerFn: Listener<T>) {
    this.listeners.push(listenerFn);
  }
}

// Project State Management
class ProjectState extends State<Project> {
  private projects: Project[] = [];
  private static instance: ProjectState;

  private constructor() {
    super();
  }

  static getInstance() {
    if(this.instance) {
      return this.instance;
    }
    this.instance = new ProjectState();
    return this.instance;
  }

  addProject(title: string, description: string, numPeople: number) {
    const newProject = new Project(
      Math.random().toString(),
      title,
      description,
      numPeople,
      ProjectStatus.Active
    )
    this.projects.push(newProject);
    this.updateListeners();
  }

  moveProject(projectId: string, newStatus: ProjectStatus) {
    const project = this.projects.find(proj => proj.id === projectId);
    if (project && project.status !== newStatus) {
      project.status = newStatus;
      this.updateListeners();
    }
  }

  private updateListeners() {
    for (const listerFn of this.listeners) {
      // pass the copy of the array
      listerFn(this.projects.slice())
    }
  }
}
// Singleton
const projectState = ProjectState.getInstance();

// Validation
interface Validatable {
  value: string | number;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

function validate(validatebleInput: Validatable) {
  let isValid = true;

  if (validatebleInput.required) {
    isValid = isValid && validatebleInput.value.toString().trim().length !== 0;
  }
  if (validatebleInput.minLength != null && typeof validatebleInput.value === 'string') {
    isValid = isValid && validatebleInput.value.length >= validatebleInput.minLength;
  }
  if (validatebleInput.maxLength != null && typeof validatebleInput.value === 'string') {
    isValid = isValid && validatebleInput.value.length <= validatebleInput.maxLength;
  }
  if(validatebleInput.min != null && typeof validatebleInput.value === 'number') {
    isValid = isValid && validatebleInput.value >= validatebleInput.min;
  }
  if(validatebleInput.max != null && typeof validatebleInput.value === 'number') {
    isValid = isValid && validatebleInput.value <= validatebleInput.max;
  }
  return isValid
}

function autobind(_: any, _2: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const adjDescriptor: PropertyDescriptor = {
    configurable: true,
      get() {
      const boundFn = originalMethod.bind(this);
      return boundFn;
    }
  }
  return adjDescriptor;
}

abstract class Component<T extends HTMLElement, U extends HTMLElement> {
  templateEl: HTMLTemplateElement;
  hostEl: T;
  element: U;

  constructor(
    templateId: string,
    hosteElementId: string,
    insertAtStart: boolean,
    newElementId?: string,
  ) {
    this.templateEl = document.getElementById(templateId)! as HTMLTemplateElement;
    this.hostEl = document.getElementById(hosteElementId)! as T;

    const importedNode = document.importNode(this.templateEl.content, true);
    this.element = importedNode.firstElementChild as U;
    if (newElementId) {
      this.element.id = newElementId;
    }
    this.attach(insertAtStart);
  }

  private attach(insertAtStart: boolean) {
    this.hostEl.insertAdjacentElement(insertAtStart ? 'afterbegin' : 'beforeend', this.element)
  }

  abstract configure(): void;

  abstract renderContent(): void;
}

class ProjectItem extends Component<HTMLUListElement, HTMLLIElement> implements Draggable {
  private project: Project;

  get persons() {
    return this.project.people === 1 ? '1 person' : `${this.project.people} persons`;
  }

  constructor(hostId: string, project: Project) {
    super('single-project', hostId, false, project.id);
    this.project = project;

    this.configure();
    this.renderContent();
  }

  configure() {
    this.element.addEventListener('dragstart', this.dragStartHandler)
    this.element.addEventListener('dragend', this.dragEndHandler)
  }

  renderContent() {
    this.element.querySelector('h2')!.textContent = this.project.title;
    this.element.querySelector('h3')!.textContent = this.persons + ' assigned';
    this.element.querySelector('p')!.textContent = this.project.description;
  }

  @autobind
  dragStartHandler(event: DragEvent) {
    // transfer only the id
    event.dataTransfer!.setData('text/plain', this.project.id);
    event.dataTransfer!.effectAllowed = 'move';
  }

  dragEndHandler(_: DragEvent) {
    console.log('DragEnd', )
  }
}

// Render Project List
class ProjectList 
extends Component<HTMLDivElement, HTMLElement> 
implements DragTarget {
  assignedProjects: Project[];

  constructor(private type: 'active' | 'finished') {
    super('project-list', 'app', false, `${type}-projects`)
    this.assignedProjects = [];
    
    this.configure();
    this.renderContent();
  }
  
  @autobind
  dragOverHandler(event: DragEvent) {
    if (event.dataTransfer && event.dataTransfer.types[0] === 'text/plain') {
      event.preventDefault();
      const listEl = this.element.querySelector('ul')!
      listEl.classList.add('droppable');
    }
  }

  @autobind
  dragLeaveHandler(_: DragEvent) {
    const listEl = this.element.querySelector('ul')!; 
    listEl.classList.remove('droppable');
  }

  @autobind
  dropHandler(event: DragEvent) {
    const projectId = event.dataTransfer!.getData('text/plain');
    projectState.moveProject(
      projectId, 
      this.type === 'active' ? ProjectStatus.Active : ProjectStatus.Finished
    );
  }

  configure() {
    this.element.addEventListener('dragover', this.dragOverHandler);
    this.element.addEventListener('dragleave', this.dragLeaveHandler);
    this.element.addEventListener('drop', this.dropHandler);

    projectState.addListener((projects: Project[]) => {
      const relevantProjects = projects.filter(prj => {
        if (this.type === 'active') {
          return prj.status === ProjectStatus.Active;
        }
        return prj.status === ProjectStatus.Finished
      });
      this.assignedProjects = relevantProjects;
      this.renderProjects();
    });
  }

  renderContent() {
    const listId = `${this.type}-project-list`;
    this.element.querySelector('ul')!.id = listId;
    this.element.querySelector('h2')!.textContent = this.type.toUpperCase() + " PROJECTS";
  }

  private renderProjects() {
    const listEl = document.getElementById(
      `${this.type}-project-list`
    )! as HTMLUListElement;
    listEl.innerHTML = '';
    for (const prjItem of this.assignedProjects) {
      new ProjectItem(this.element.querySelector('ul')!.id, prjItem);
    }
  }
}

class ProjectInput extends Component<HTMLDivElement, HTMLFormElement> {
  titleInputEl: HTMLInputElement;
  descriptionInputEl: HTMLInputElement;
  peopleInputEl: HTMLInputElement;

  constructor() {
    super('project-input', 'app', true, 'user-input');
    this.titleInputEl = this.element.querySelector('#title') as HTMLInputElement;
    this.descriptionInputEl = this.element.querySelector('#description') as HTMLInputElement;
    this.peopleInputEl = this.element.querySelector('#people') as HTMLInputElement;

    this.configure();
  }

  configure() {
    this.element.addEventListener('submit', this.submitHandler)
  }

  renderContent() {}

  private clearInputs() {
    this.titleInputEl.value = '';
    this.descriptionInputEl.value = '';
    this.peopleInputEl.value = '';
  }
  // returns a tuple
  private gatherUserInput(): [string, string, number] | void {
    const title = this.titleInputEl.value;
    const description = this.descriptionInputEl.value;
    const people = this.peopleInputEl.value;

    const titleValidatable: Validatable = {
      value: title,
      required: true,
    }
    const descriptionValidatable: Validatable = {
      value: description,
      required: true,
      minLength: 5,
    }
    const peopleValidatable: Validatable = {
      value: +people,
      required: true,
      min: 1,
      max: 5,
    }
    
    if (
      !validate(titleValidatable) ||
      !validate(descriptionValidatable) ||
      !validate(peopleValidatable)
    ) {
      return alert('Invalid input');
    }
    return [title, description, +people];
  }

  @autobind
  private submitHandler(event: Event) {
    event.preventDefault();
    const userInput = this.gatherUserInput();
    // check whether a tuple or undefined
    if (Array.isArray(userInput)) {
      const [title, desc, people] = userInput;
      projectState.addProject(title, desc, people);
      this.clearInputs();
    }
  }

}

const projInput = new ProjectInput();
const activeProjList = new ProjectList('active');
const finishedProjList = new ProjectList('finished');