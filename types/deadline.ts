/** Controller for an enhanced native datetime-local source input. */
export interface DeadlineController {
  input: HTMLInputElement;
  button: HTMLButtonElement;
  popover: HTMLDivElement;
  refresh(): DeadlineController;
  open(): void;
  close(): void;
}

export interface DeadlineApi {
  enhance(input: HTMLInputElement): DeadlineController;
  attach(input: HTMLInputElement): DeadlineController;
}
