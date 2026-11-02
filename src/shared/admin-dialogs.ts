type InputOptions = {
  title: string;
  description: string;
  label: string;
  initialValue?: string;
  type?: "text" | "date";
  required?: boolean;
  minLength?: number;
  placeholder?: string;
};

function makeDialog(title: string, description: string) {
  const dialog = document.createElement("dialog");
  dialog.className =
    "w-[min(92vw,32rem)] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-0 text-[var(--text)] shadow-2xl backdrop:bg-[var(--text)]/60";
  const form = document.createElement("form");
  form.method = "dialog";
  form.className = "space-y-4 p-6";
  const heading = document.createElement("h2");
  heading.className = "text-lg font-semibold";
  heading.textContent = title;
  const help = document.createElement("p");
  help.className = "text-sm text-[var(--text-muted)]";
  help.textContent = description;
  form.append(heading, help);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, form };
}

function addButtons(form: HTMLFormElement, submitText: string) {
  const actions = document.createElement("div");
  actions.className = "flex justify-end gap-2";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "min-h-10 rounded-lg border border-[var(--border)] px-4";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => {
    const dialog = form.closest("dialog");
    if (dialog instanceof HTMLDialogElement) dialog.close("cancel");
  });
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className =
    "min-h-10 rounded-lg bg-[var(--primary)] px-4 font-semibold text-[var(--on-primary)]";
  submit.textContent = submitText;
  actions.append(cancel, submit);
  form.append(actions);
}

export function requestInput(options: InputOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const { dialog, form } = makeDialog(options.title, options.description);
    const label = document.createElement("label");
    label.className = "block text-sm font-medium";
    label.textContent = options.label;
    const input = document.createElement("input");
    input.type = options.type ?? "text";
    input.value = options.initialValue ?? "";
    input.required = options.required ?? false;
    input.minLength = options.minLength ?? 0;
    input.placeholder = options.placeholder ?? "";
    input.className =
      "mt-1.5 min-h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm";
    label.append(input);
    form.append(label);
    addButtons(form, "Continue");
    let result: string | null = null;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      result = input.value;
      dialog.close("submit");
    });
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        resolve(result);
      },
      { once: true },
    );
    input.focus();
  });
}

export function confirmAction(
  title: string,
  description: string,
  actionLabel = "Continue",
): Promise<boolean> {
  return new Promise((resolve) => {
    const { dialog, form } = makeDialog(title, description);
    addButtons(form, actionLabel);
    let accepted = false;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      accepted = true;
      dialog.close("submit");
    });
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        resolve(accepted);
      },
      { once: true },
    );
    form.querySelector<HTMLButtonElement>('button[type="submit"]')?.focus();
  });
}
