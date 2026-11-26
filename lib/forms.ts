/** Shared shape returned by server actions to <ActionForm>. Safe on client and server. */
export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** When set, the browser navigates here (used for Stripe and confirmation pages). */
  url?: string;
};

export type FormAction = (state: FormState, formData: FormData) => Promise<FormState>;
