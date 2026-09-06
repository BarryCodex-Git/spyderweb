export type ClientIntake = {
  clientName: string;
  industry: string;
  primaryRegion: string;
  phone: string;
  email: string;
  whatsapp: string;
  contactFormEmail: string;
  businessAddress: string;
  existingWebsite: string;
  googleBusinessProfiles: string[];
  socialAccounts: string[];
  clientFolderCreated: string;
  logoReady: string;
  imageAssetExamples: string;
  homePageH1: string;
  focusKeyphrase: string;
  primaryServices: string[];
  additionalServices: string[];
  additionalLocations: string[];
  additionalInformation: string;
  trustFacts: string[];
  brandGuidelines: string;
  contentStyle: string;
  colorsToAvoid: string;
  clientImagesAvailable: string;
  aiImagesPermitted: string;
  stockImagesPermitted: string;
};

export const emptyClientIntake: ClientIntake = {
  clientName: '', industry: '', primaryRegion: '', phone: '', email: '', whatsapp: '',
  contactFormEmail: '', businessAddress: '', existingWebsite: '', googleBusinessProfiles: [''],
  socialAccounts: [''], clientFolderCreated: '', logoReady: '', imageAssetExamples: '',
  homePageH1: '', focusKeyphrase: '', primaryServices: [''], additionalServices: [''],
  additionalLocations: [''], additionalInformation: '', trustFacts: [''], brandGuidelines: '',
  contentStyle: '', colorsToAvoid: '', clientImagesAvailable: '', aiImagesPermitted: '', stockImagesPermitted: '',
};

const arrayFields = new Set(['googleBusinessProfiles', 'socialAccounts', 'primaryServices', 'additionalServices', 'additionalLocations', 'trustFacts']);

export function parseClientIntake(value: unknown, fallbackClientName = ''): ClientIntake {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const result = { ...emptyClientIntake, clientName: fallbackClientName } as ClientIntake;
  for (const key of Object.keys(result) as Array<keyof ClientIntake>) {
    if (arrayFields.has(key)) {
      const values = Array.isArray(source[key]) ? source[key] as unknown[] : [];
      (result[key] as string[]) = values.map((item) => String(item).trim().slice(0, 1000)).filter(Boolean).slice(0, 30);
      if (!(result[key] as string[]).length) (result[key] as string[]) = [''];
    } else if (typeof source[key] === 'string') {
      (result[key] as string) = source[key].trim().slice(0, 5000);
    }
  }
  if (!result.clientName) result.clientName = fallbackClientName;
  return result;
}
