// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- reason: Window must be an interface for global declaration merging
interface Window {
  turnstile?: {
    render: (
      container: HTMLElement,
      options: {
        sitekey: string;
        callback: (token: string) => void;
        "expired-callback": () => void;
        "error-callback": () => void;
        theme?: "light" | "dark";
        appearance?: "always";
      },
    ) => string;
    reset: (widgetId?: string) => void;
    remove: (widgetId: string) => void;
  };
}
