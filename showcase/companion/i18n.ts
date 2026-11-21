// Placement-editor labels are not displayed by Jarvis; retain readable diagnostics.
export const getI18n = () => ({ getFixedT: () => (key: string, options?: {defaultValue?: string}) => options?.defaultValue ?? key });
export const useTranslation = () => ({ t: getI18n().getFixedT(), i18n: getI18n() });
