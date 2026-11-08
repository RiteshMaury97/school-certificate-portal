export {};

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": (errorCode: string) => void;
      theme?: "light" | "dark";
      appearance?: "always" | "execute" | "interaction-only";
      size?: "normal" | "compact" | "flexible";
      execution?: "render" | "execute";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  execute: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  var turnstile: TurnstileApi | undefined;
}
