// Shared form value shapes and blank defaults.
//
// These deliberately live outside the "use client" form modules: a plain value
// imported from a client module into a Server Component arrives as a client
// reference proxy rather than the object itself, which silently blanks every
// default. Keeping them here lets both sides import the real value.

export type ClientFormValues = {
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  industry: string;
  status: string;
  addressLine: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
  ownerId: string;
};

export const emptyClient: ClientFormValues = {
  name: "",
  company: "",
  email: "",
  phone: "",
  website: "",
  industry: "",
  status: "LEAD",
  addressLine: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  notes: "",
  ownerId: "",
};

export type ProjectFormValues = {
  clientId: string;
  name: string;
  description: string;
  status: string;
  budget: string;
  liveUrl: string;
  startDate: string;
  endDate: string;
};

export const emptyProject: ProjectFormValues = {
  clientId: "",
  name: "",
  description: "",
  status: "PLANNING",
  budget: "0.00",
  liveUrl: "",
  startDate: "",
  endDate: "",
};

export type TaskFormValues = {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  clientId: string;
  projectId: string;
  assigneeId: string;
};

export const emptyTask: TaskFormValues = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
  clientId: "",
  projectId: "",
  assigneeId: "",
};

export type ContactFormValues = {
  clientId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  isPrimary: boolean;
};

export type InvoiceLineValues = {
  description: string;
  quantity: string;
  unitPrice: string;
};

export const emptyLine: InvoiceLineValues = {
  description: "",
  quantity: "1",
  unitPrice: "0.00",
};

export type InvoiceFormValues = {
  clientId: string;
  projectId: string;
  number: string;
  status: string;
  issueDate: string;
  dueDate: string;
  taxRate: string;
  notes: string;
  items: InvoiceLineValues[];
};

/** Option shape shared by the client/project/user pickers. */
export type SelectOption = { id: string; name: string; clientId?: string };
